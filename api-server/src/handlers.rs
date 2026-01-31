//! API 路由處理器

use axum::{
    body::Body,
    extract::{Multipart, Path, State},
    http::{header, StatusCode},
    response::Response,
    Json,
};
use std::path::PathBuf;
use tokio::fs::File;
use tokio::io::AsyncWriteExt;
use tokio_util::io::ReaderStream;
use zip::{write::SimpleFileOptions, ZipWriter};

use crate::auth::AppState;
use crate::auth::AuthenticatedUser;
use crate::engine::EngineInfo;
use crate::error::ApiError;
use crate::models::{
    ApiResponse, ConvertParams, ConvertResponse, EngineDetailResponse,
    EnginesListResponse, HealthResponse, Job, JobStatus, JobStatusResponse,
};

/// 健康檢查
pub async fn health_check(State(state): State<AppState>) -> Json<ApiResponse<HealthResponse>> {
    // 檢查後端狀態
    let backend_status = match check_backend_health(&state).await {
        Ok(_) => "healthy".to_string(),
        Err(_) => "unhealthy".to_string(),
    };

    Json(ApiResponse::success(HealthResponse {
        status: "healthy".to_string(),
        version: env!("CARGO_PKG_VERSION").to_string(),
        backend_status,
    }))
}

/// 檢查後端健康狀態
async fn check_backend_health(state: &AppState) -> Result<(), ApiError> {
    let client = reqwest::Client::new();
    let url = format!("{}/api/health", state.config.backend_url);
    
    let response = client
        .get(&url)
        .timeout(std::time::Duration::from_secs(5))
        .send()
        .await
        .map_err(|e| ApiError::BackendError(format!("Backend unreachable: {}", e)))?;

    if response.status().is_success() {
        Ok(())
    } else {
        Err(ApiError::BackendError("Backend unhealthy".to_string()))
    }
}

/// 列出所有引擎
pub async fn list_engines(
    State(state): State<AppState>,
    _user: AuthenticatedUser,
) -> Result<Json<ApiResponse<EnginesListResponse>>, ApiError> {
    let engines = state.engine_registry.list_engines().await;
    let engine_infos: Vec<EngineInfo> = engines.iter().map(EngineInfo::from).collect();
    let total = engine_infos.len();

    Ok(Json(ApiResponse::success(EnginesListResponse {
        engines: engine_infos,
        total,
    })))
}

/// 取得引擎詳情
pub async fn get_engine(
    State(state): State<AppState>,
    _user: AuthenticatedUser,
    Path(engine_id): Path<String>,
) -> Result<Json<ApiResponse<EngineDetailResponse>>, ApiError> {
    let engine = state
        .engine_registry
        .get_engine(&engine_id)
        .await
        .ok_or(ApiError::EngineNotFound(engine_id))?;

    Ok(Json(ApiResponse::success(EngineDetailResponse {
        engine: EngineInfo::from(&engine),
    })))
}

/// 建立轉換任務
pub async fn create_conversion(
    State(state): State<AppState>,
    user: AuthenticatedUser,
    mut multipart: Multipart,
) -> Result<Json<ApiResponse<ConvertResponse>>, ApiError> {
    // 檢查轉換權限
    if !user.can_convert() {
        return Err(ApiError::Forbidden("Missing 'convert' scope".to_string()));
    }

    let mut file_data: Option<(String, Vec<u8>)> = None;
    let mut params: Option<ConvertParams> = None;

    // 解析 multipart 表單
    while let Some(field) = multipart
        .next_field()
        .await
        .map_err(|e| ApiError::InvalidInput(format!("Failed to read multipart: {}", e)))?
    {
        let name = field.name().unwrap_or("").to_string();

        match name.as_str() {
            "file" => {
                let filename = field
                    .file_name()
                    .ok_or_else(|| ApiError::InvalidInput("Missing filename".to_string()))?
                    .to_string();
                
                let data = field
                    .bytes()
                    .await
                    .map_err(|e| ApiError::InvalidInput(format!("Failed to read file: {}", e)))?;

                // 檢查檔案大小
                if data.len() > state.config.max_file_size as usize {
                    return Err(ApiError::FileTooLarge(state.config.max_file_size));
                }

                file_data = Some((filename, data.to_vec()));
            }
            "params" | "options" => {
                let text = field
                    .text()
                    .await
                    .map_err(|e| ApiError::InvalidInput(format!("Failed to read params: {}", e)))?;
                
                params = Some(
                    serde_json::from_str(&text)
                        .map_err(|e| ApiError::InvalidInput(format!("Invalid params JSON: {}", e)))?,
                );
            }
            _ => {}
        }
    }

    // 驗證必要欄位
    let (filename, data) = file_data.ok_or_else(|| ApiError::InvalidInput("Missing file".to_string()))?;
    let params = params.ok_or_else(|| ApiError::InvalidInput("Missing params".to_string()))?;

    // 取得輸入格式
    let input_format = PathBuf::from(&filename)
        .extension()
        .and_then(|e| e.to_str())
        .map(|s| s.to_lowercase())
        .ok_or_else(|| ApiError::InvalidInput("Cannot determine file format".to_string()))?;

    // 選擇引擎
    let engine_id = if let Some(ref id) = params.engine_id {
        // 驗證指定的引擎
        let engine = state
            .engine_registry
            .get_engine(id)
            .await
            .ok_or_else(|| ApiError::EngineNotFound(id.clone()))?;

        if !engine.supports_conversion(&input_format, &params.output_format) {
            return Err(ApiError::UnsupportedConversion {
                from: input_format.clone(),
                to: params.output_format.clone(),
            });
        }
        id.clone()
    } else {
        // 自動選擇引擎
        let engine = state
            .engine_registry
            .find_engine_for_conversion(&input_format, &params.output_format)
            .await
            .ok_or_else(|| ApiError::UnsupportedConversion {
                from: input_format.clone(),
                to: params.output_format.clone(),
            })?;
        engine.engine_id
    };

    // 建立任務
    let job = Job::new(
        user.user_id.clone(),
        filename.clone(),
        input_format.clone(),
        params.output_format.clone(),
        engine_id.clone(),
    );
    let job_id = job.job_id.clone();

    // 儲存任務
    state.job_store.create_job(job).await;

    // 儲存上傳檔案
    let upload_dir = PathBuf::from(&state.config.upload_dir).join(&job_id);
    tokio::fs::create_dir_all(&upload_dir)
        .await
        .map_err(|e| ApiError::InternalError(format!("Failed to create upload dir: {}", e)))?;

    let upload_path = upload_dir.join(&filename);
    let mut file = File::create(&upload_path)
        .await
        .map_err(|e| ApiError::InternalError(format!("Failed to create file: {}", e)))?;
    
    file.write_all(&data)
        .await
        .map_err(|e| ApiError::InternalError(format!("Failed to write file: {}", e)))?;

    // 啟動後台轉換任務
    let state_clone = state.clone();
    let job_id_clone = job_id.clone();
    let upload_path_clone = upload_path.clone();
    let output_format = params.output_format.clone();
    let options = params.options.clone();

    tokio::spawn(async move {
        process_conversion(
            state_clone,
            job_id_clone,
            upload_path_clone,
            output_format,
            engine_id,
            options,
        )
        .await;
    });

    Ok(Json(ApiResponse::success(ConvertResponse {
        job_id,
        status: "pending".to_string(),
        message: "Conversion job created".to_string(),
    })))
}

/// 處理轉換任務（後台執行）
async fn process_conversion(
    state: AppState,
    job_id: String,
    input_path: PathBuf,
    output_format: String,
    engine_id: String,
    options: Option<serde_json::Value>,
) {
    // 更新狀態為處理中
    state.job_store.update_status(&job_id, JobStatus::Processing).await;
    state.job_store.update_progress(&job_id, 10).await;

    // 建立輸出目錄
    let output_dir = PathBuf::from(&state.config.output_dir).join(&job_id);
    if let Err(e) = tokio::fs::create_dir_all(&output_dir).await {
        let _ = state.job_store.fail_job(&job_id, format!("Failed to create output dir: {}", e)).await;
        return;
    }

    // 呼叫後端 API 進行轉換
    let result = call_backend_convert(
        &state,
        &input_path,
        &output_dir,
        &output_format,
        &engine_id,
        options,
    )
    .await;

    match result {
        Ok(output_file) => {
            state.job_store.complete_job(&job_id, output_file).await;
        }
        Err(e) => {
            let _ = state.job_store.fail_job(&job_id, e.to_string()).await;
        }
    }
}

/// 呼叫後端轉換 API
async fn call_backend_convert(
    state: &AppState,
    input_path: &PathBuf,
    output_dir: &PathBuf,
    output_format: &str,
    _engine_id: &str,
    _options: Option<serde_json::Value>,
) -> Result<String, ApiError> {
    let client = reqwest::Client::new();
    
    // 讀取檔案
    let file_data = tokio::fs::read(input_path)
        .await
        .map_err(|e| ApiError::InternalError(format!("Failed to read input file: {}", e)))?;

    let filename = input_path
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("file");

    // 建立 multipart 表單
    let form = reqwest::multipart::Form::new()
        .part(
            "file",
            reqwest::multipart::Part::bytes(file_data)
                .file_name(filename.to_string()),
        )
        .text("targetFormat", output_format.to_string());

    // 呼叫後端 API
    let url = format!("{}/api/convert", state.config.backend_url);
    let response = client
        .post(&url)
        .multipart(form)
        .timeout(std::time::Duration::from_secs(300))
        .send()
        .await
        .map_err(|e| ApiError::BackendError(format!("Backend request failed: {}", e)))?;

    if !response.status().is_success() {
        let status = response.status();
        let text = response.text().await.unwrap_or_default();
        return Err(ApiError::BackendError(format!(
            "Backend returned {}: {}",
            status, text
        )));
    }

    // 取得轉換後的檔案
    let content = response
        .bytes()
        .await
        .map_err(|e| ApiError::BackendError(format!("Failed to read response: {}", e)))?;

    // 產生輸出檔名
    let stem = input_path
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("output");
    let output_filename = format!("{}.{}", stem, output_format);
    let output_path = output_dir.join(&output_filename);

    // 寫入輸出檔案
    tokio::fs::write(&output_path, &content)
        .await
        .map_err(|e| ApiError::InternalError(format!("Failed to write output file: {}", e)))?;

    Ok(output_path.to_string_lossy().to_string())
}

/// 取得任務狀態
pub async fn get_job_status(
    State(state): State<AppState>,
    user: AuthenticatedUser,
    Path(job_id): Path<String>,
) -> Result<Json<ApiResponse<JobStatusResponse>>, ApiError> {
    // 取得任務
    let job = state
        .job_store
        .get_job(&job_id)
        .await
        .ok_or(ApiError::JobNotFound(job_id.clone()))?;

    // 驗證權限（只能查看自己的任務）
    if job.user_id != user.user_id {
        return Err(ApiError::Forbidden("Not authorized to access this job".to_string()));
    }

    Ok(Json(ApiResponse::success(JobStatusResponse::from(&job))))
}

/// 下載轉換結果
pub async fn download_job_result(
    State(state): State<AppState>,
    user: AuthenticatedUser,
    Path(job_id): Path<String>,
) -> Result<Response, ApiError> {
    // 檢查下載權限
    if !user.can_download() {
        return Err(ApiError::Forbidden("Missing 'download' scope".to_string()));
    }

    // 取得任務
    let job = state
        .job_store
        .get_job(&job_id)
        .await
        .ok_or(ApiError::JobNotFound(job_id.clone()))?;

    // 驗證權限
    if job.user_id != user.user_id {
        return Err(ApiError::Forbidden("Not authorized to access this job".to_string()));
    }

    // 檢查任務狀態
    if job.status != JobStatus::Completed {
        return Err(ApiError::JobNotReady(job_id));
    }

    let output_file = job
        .output_file
        .ok_or_else(|| ApiError::InternalError("Output file not found".to_string()))?;

    let output_path = PathBuf::from(&output_file);
    
    // 建立 ZIP 檔案
    let zip_filename = format!("{}.zip", job_id);
    let zip_path = output_path
        .parent()
        .unwrap_or(&output_path)
        .join(&zip_filename);

    // 建立 ZIP
    create_zip_file(&output_path, &zip_path)?;

    // 讀取 ZIP 檔案
    let file = File::open(&zip_path)
        .await
        .map_err(|e| ApiError::InternalError(format!("Failed to open zip file: {}", e)))?;

    let stream = ReaderStream::new(file);
    let body = Body::from_stream(stream);

    // 回傳檔案
    let response = Response::builder()
        .status(StatusCode::OK)
        .header(header::CONTENT_TYPE, "application/zip")
        .header(
            header::CONTENT_DISPOSITION,
            format!("attachment; filename=\"{}\"", zip_filename),
        )
        .body(body)
        .map_err(|e| ApiError::InternalError(format!("Failed to build response: {}", e)))?;

    Ok(response)
}

/// 建立 ZIP 檔案
fn create_zip_file(source: &PathBuf, zip_path: &PathBuf) -> Result<(), ApiError> {
    let zip_file = std::fs::File::create(zip_path)
        .map_err(|e| ApiError::InternalError(format!("Failed to create zip: {}", e)))?;

    let mut zip = ZipWriter::new(zip_file);
    let options = SimpleFileOptions::default()
        .compression_method(zip::CompressionMethod::Deflated);

    let filename = source
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("output");

    zip.start_file(filename, options)
        .map_err(|e| ApiError::InternalError(format!("Failed to start zip entry: {}", e)))?;

    let content = std::fs::read(source)
        .map_err(|e| ApiError::InternalError(format!("Failed to read source file: {}", e)))?;

    std::io::Write::write_all(&mut zip, &content)
        .map_err(|e| ApiError::InternalError(format!("Failed to write to zip: {}", e)))?;

    zip.finish()
        .map_err(|e| ApiError::InternalError(format!("Failed to finish zip: {}", e)))?;

    Ok(())
}
