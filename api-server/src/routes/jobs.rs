//! Jobs endpoints
//!
//! 轉換任務管理 API（需要認證）。

use axum::{
    extract::{Multipart, Path, State},
    http::StatusCode,
    response::IntoResponse,
    routing::{delete, get, post},
    Json, Router,
};
use uuid::Uuid;
use std::fs;

use crate::auth::RequireAuth;
use crate::models::{
    ApiResponse, CreateJobResponse, JobStatusResponse, ListJobsResponse, 
    DeleteJobResponse, JobSummary,
};
use crate::services::dispatcher::ValidationResult;
use crate::AppState;

/// Create jobs routes
pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/api/v1/jobs", post(create_job))
        .route("/api/v1/jobs", get(list_jobs))
        .route("/api/v1/jobs/:job_id", get(get_job))
        .route("/api/v1/jobs/:job_id", delete(delete_job))
        .route("/api/v1/jobs/:job_id/result", get(get_job_result))
}

/// Create a new conversion job
#[utoipa::path(
    post,
    path = "/api/v1/jobs",
    tag = "Jobs",
    request_body(content_type = "multipart/form-data"),
    responses(
        (status = 201, description = "Job created", body = CreateJobResponse),
        (status = 400, description = "Invalid request"),
        (status = 401, description = "Unauthorized")
    ),
    security(
        ("bearer_auth" = [])
    )
)]
async fn create_job(
    State(state): State<AppState>,
    RequireAuth(user_id): RequireAuth,
    mut multipart: Multipart,
) -> Result<(StatusCode, Json<ApiResponse<CreateJobResponse>>), (StatusCode, Json<ApiResponse<()>>)> {
    let mut file_data: Option<Vec<u8>> = None;
    let mut filename: Option<String> = None;
    let mut target_format: Option<String> = None;
    let mut engine: Option<String> = None;
    let mut options: Option<serde_json::Value> = None;

    // Parse multipart form data
    while let Ok(Some(field)) = multipart.next_field().await {
        let name = field.name().unwrap_or_default().to_string();

        match name.as_str() {
            "file" => {
                filename = field.file_name().map(|s| s.to_string());
                if let Ok(data) = field.bytes().await {
                    if data.len() > state.config.max_file_size {
                        return Err((
                            StatusCode::PAYLOAD_TOO_LARGE,
                            Json(ApiResponse::error(
                                "FILE_TOO_LARGE",
                                &format!(
                                    "File size exceeds maximum allowed ({}MB)",
                                    state.config.max_file_size / 1024 / 1024
                                ),
                                None,
                                &state.config.api_version,
                            )),
                        ));
                    }
                    file_data = Some(data.to_vec());
                }
            }
            "target_format" => {
                if let Ok(text) = field.text().await {
                    target_format = Some(text.to_lowercase());
                }
            }
            "engine" => {
                if let Ok(text) = field.text().await {
                    if !text.is_empty() {
                        engine = Some(text);
                    }
                }
            }
            "options" => {
                if let Ok(text) = field.text().await {
                    if !text.is_empty() {
                        options = serde_json::from_str(&text).ok();
                    }
                }
            }
            _ => {}
        }
    }

    // Validate required fields
    let file_data = file_data.ok_or_else(|| {
        (
            StatusCode::BAD_REQUEST,
            Json(ApiResponse::error(
                "MISSING_FILE",
                "No file provided",
                None,
                &state.config.api_version,
            )),
        )
    })?;

    let filename = filename.ok_or_else(|| {
        (
            StatusCode::BAD_REQUEST,
            Json(ApiResponse::error(
                "MISSING_FILENAME",
                "File must have a filename",
                None,
                &state.config.api_version,
            )),
        )
    })?;

    let target_format = target_format.ok_or_else(|| {
        (
            StatusCode::BAD_REQUEST,
            Json(ApiResponse::error(
                "MISSING_TARGET_FORMAT",
                "target_format is required",
                None,
                &state.config.api_version,
            )),
        )
    })?;

    // Extract source format from filename
    let source_format = filename
        .rsplit('.')
        .next()
        .unwrap_or("")
        .to_lowercase();

    if source_format.is_empty() {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(ApiResponse::error(
                "INVALID_FILENAME",
                "Cannot determine file format from filename",
                None,
                &state.config.api_version,
            )),
        ));
    }

    // Validate and select engine
    let selected_engine = match state.dispatcher.validate_conversion(
        &source_format,
        &target_format,
        engine.as_deref(),
    ) {
        ValidationResult::Valid { engine } => engine,
        ValidationResult::Invalid { reason, suggestions } => {
            return Err((
                StatusCode::BAD_REQUEST,
                Json(ApiResponse::error(
                    "UNSUPPORTED_CONVERSION",
                    &reason,
                    Some(serde_json::json!({ "suggestions": suggestions })),
                    &state.config.api_version,
                )),
            ));
        }
    };

    // Create job
    let job = state.dispatcher.create_job(
        &user_id,
        filename.clone(),
        source_format,
        target_format,
        selected_engine,
        options,
    );

    let job_id = job.id;

    // Create directories and save file
    let upload_path = state.dispatcher.get_upload_path(job_id, &user_id);
    fs::create_dir_all(&upload_path).map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ApiResponse::error(
                "STORAGE_ERROR",
                &format!("Failed to create upload directory: {}", e),
                None,
                &state.config.api_version,
            )),
        )
    })?;

    let file_path = upload_path.join(&filename);
    fs::write(&file_path, &file_data).map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ApiResponse::error(
                "STORAGE_ERROR",
                &format!("Failed to save file: {}", e),
                None,
                &state.config.api_version,
            )),
        )
    })?;

    // TODO: Queue job for processing
    // For now, we just return the job ID

    let response = CreateJobResponse {
        job_id,
        status: "pending".to_string(),
        status_url: format!("/api/v1/jobs/{}", job_id),
        estimated_time: None,
    };

    Ok((
        StatusCode::CREATED,
        Json(ApiResponse::success(response, &state.config.api_version)),
    ))
}

/// List user's jobs
#[utoipa::path(
    get,
    path = "/api/v1/jobs",
    tag = "Jobs",
    responses(
        (status = 200, description = "List of jobs", body = ListJobsResponse),
        (status = 401, description = "Unauthorized")
    ),
    security(
        ("bearer_auth" = [])
    )
)]
async fn list_jobs(
    State(state): State<AppState>,
    RequireAuth(user_id): RequireAuth,
) -> Json<ApiResponse<ListJobsResponse>> {
    let jobs = state.dispatcher.list_user_jobs(&user_id);
    let summaries: Vec<JobSummary> = jobs.into_iter().map(|j| j.into()).collect();
    let total = summaries.len();

    Json(ApiResponse::success(
        ListJobsResponse { jobs: summaries, total },
        &state.config.api_version,
    ))
}

/// Get job status
#[utoipa::path(
    get,
    path = "/api/v1/jobs/{job_id}",
    tag = "Jobs",
    params(
        ("job_id" = Uuid, Path, description = "Job ID")
    ),
    responses(
        (status = 200, description = "Job status", body = JobStatusResponse),
        (status = 404, description = "Job not found"),
        (status = 401, description = "Unauthorized")
    ),
    security(
        ("bearer_auth" = [])
    )
)]
async fn get_job(
    State(state): State<AppState>,
    RequireAuth(user_id): RequireAuth,
    Path(job_id): Path<Uuid>,
) -> Result<Json<ApiResponse<JobStatusResponse>>, (StatusCode, Json<ApiResponse<()>>)> {
    let job = state.dispatcher.get_user_job(job_id, &user_id).ok_or_else(|| {
        (
            StatusCode::NOT_FOUND,
            Json(ApiResponse::error(
                "JOB_NOT_FOUND",
                &format!("Job '{}' not found", job_id),
                None,
                &state.config.api_version,
            )),
        )
    })?;

    let result_url = if job.output_filename.is_some() {
        Some(format!("/api/v1/jobs/{}/result", job_id))
    } else {
        None
    };

    Ok(Json(ApiResponse::success(
        JobStatusResponse { job, result_url },
        &state.config.api_version,
    )))
}

/// Delete a job
#[utoipa::path(
    delete,
    path = "/api/v1/jobs/{job_id}",
    tag = "Jobs",
    params(
        ("job_id" = Uuid, Path, description = "Job ID")
    ),
    responses(
        (status = 200, description = "Job deleted", body = DeleteJobResponse),
        (status = 404, description = "Job not found"),
        (status = 401, description = "Unauthorized")
    ),
    security(
        ("bearer_auth" = [])
    )
)]
async fn delete_job(
    State(state): State<AppState>,
    RequireAuth(user_id): RequireAuth,
    Path(job_id): Path<Uuid>,
) -> Result<Json<ApiResponse<DeleteJobResponse>>, (StatusCode, Json<ApiResponse<()>>)> {
    if !state.dispatcher.delete_job(job_id, &user_id) {
        return Err((
            StatusCode::NOT_FOUND,
            Json(ApiResponse::error(
                "JOB_NOT_FOUND",
                &format!("Job '{}' not found", job_id),
                None,
                &state.config.api_version,
            )),
        ));
    }

    Ok(Json(ApiResponse::success(
        DeleteJobResponse {
            message: "Job deleted successfully".to_string(),
            job_id,
        },
        &state.config.api_version,
    )))
}

/// Get job result (download)
#[utoipa::path(
    get,
    path = "/api/v1/jobs/{job_id}/result",
    tag = "Jobs",
    params(
        ("job_id" = Uuid, Path, description = "Job ID")
    ),
    responses(
        (status = 200, description = "File download"),
        (status = 404, description = "Job or result not found"),
        (status = 401, description = "Unauthorized")
    ),
    security(
        ("bearer_auth" = [])
    )
)]
async fn get_job_result(
    State(state): State<AppState>,
    RequireAuth(user_id): RequireAuth,
    Path(job_id): Path<Uuid>,
) -> Result<impl IntoResponse, (StatusCode, Json<ApiResponse<()>>)> {
    let job = state.dispatcher.get_user_job(job_id, &user_id).ok_or_else(|| {
        (
            StatusCode::NOT_FOUND,
            Json(ApiResponse::error(
                "JOB_NOT_FOUND",
                &format!("Job '{}' not found", job_id),
                None,
                &state.config.api_version,
            )),
        )
    })?;

    let output_filename = job.output_filename.ok_or_else(|| {
        (
            StatusCode::NOT_FOUND,
            Json(ApiResponse::error(
                "RESULT_NOT_READY",
                "Job result is not ready yet",
                None,
                &state.config.api_version,
            )),
        )
    })?;

    let output_path = state.dispatcher.get_output_path(job_id, &user_id);
    let file_path = output_path.join(&output_filename);

    if !file_path.exists() {
        return Err((
            StatusCode::NOT_FOUND,
            Json(ApiResponse::error(
                "FILE_NOT_FOUND",
                "Output file not found",
                None,
                &state.config.api_version,
            )),
        ));
    }

    let file_data = fs::read(&file_path).map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ApiResponse::error(
                "READ_ERROR",
                &format!("Failed to read file: {}", e),
                None,
                &state.config.api_version,
            )),
        )
    })?;

    let content_type = mime_guess::from_path(&file_path)
        .first_or_octet_stream()
        .to_string();

    Ok((
        StatusCode::OK,
        [
            ("Content-Type", content_type),
            (
                "Content-Disposition",
                format!("attachment; filename=\"{}\"", output_filename),
            ),
        ],
        file_data,
    ))
}
