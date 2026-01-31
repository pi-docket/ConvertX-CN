//! API 資料模型

use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// API 回應包裝
#[derive(Debug, Serialize)]
pub struct ApiResponse<T: Serialize> {
    pub success: bool,
    pub data: Option<T>,
    pub error: Option<ApiErrorResponse>,
}

impl<T: Serialize> ApiResponse<T> {
    pub fn success(data: T) -> Self {
        Self {
            success: true,
            data: Some(data),
            error: None,
        }
    }

    pub fn error(code: &str, message: &str) -> Self {
        Self {
            success: false,
            data: None,
            error: Some(ApiErrorResponse {
                code: code.to_string(),
                message: message.to_string(),
            }),
        }
    }
}

/// API 錯誤回應
#[derive(Debug, Serialize)]
pub struct ApiErrorResponse {
    pub code: String,
    pub message: String,
}

/// 引擎列表回應
#[derive(Debug, Serialize)]
pub struct EnginesListResponse {
    pub engines: Vec<super::engine::EngineInfo>,
    pub total: usize,
}

/// 引擎詳情回應
#[derive(Debug, Serialize)]
pub struct EngineDetailResponse {
    pub engine: super::engine::EngineInfo,
}

/// 轉換請求參數
#[derive(Debug, Deserialize)]
pub struct ConvertParams {
    /// 目標格式
    pub output_format: String,
    /// 引擎 ID（可選，自動選擇）
    pub engine_id: Option<String>,
    /// 額外參數
    #[serde(default)]
    pub options: Option<serde_json::Value>,
}

/// 轉換任務回應
#[derive(Debug, Serialize)]
pub struct ConvertResponse {
    pub job_id: String,
    pub status: String,
    pub message: String,
}

/// 任務狀態
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum JobStatus {
    /// 等待中
    Pending,
    /// 處理中
    Processing,
    /// 已完成
    Completed,
    /// 失敗
    Failed,
}

impl std::fmt::Display for JobStatus {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            JobStatus::Pending => write!(f, "pending"),
            JobStatus::Processing => write!(f, "processing"),
            JobStatus::Completed => write!(f, "completed"),
            JobStatus::Failed => write!(f, "failed"),
        }
    }
}

/// 轉換任務
#[derive(Debug, Clone, Serialize)]
pub struct Job {
    /// 任務 ID
    pub job_id: String,
    /// 使用者 ID
    pub user_id: String,
    /// 原始檔案名稱
    pub original_filename: String,
    /// 輸入格式
    pub input_format: String,
    /// 輸出格式
    pub output_format: String,
    /// 使用的引擎
    pub engine_id: String,
    /// 任務狀態
    pub status: JobStatus,
    /// 進度（0-100）
    pub progress: u8,
    /// 錯誤訊息
    pub error_message: Option<String>,
    /// 輸出檔案路徑
    pub output_file: Option<String>,
    /// 建立時間
    pub created_at: i64,
    /// 更新時間
    pub updated_at: i64,
    /// 完成時間
    pub completed_at: Option<i64>,
}

impl Job {
    /// 建立新任務
    pub fn new(
        user_id: String,
        original_filename: String,
        input_format: String,
        output_format: String,
        engine_id: String,
    ) -> Self {
        let now = chrono::Utc::now().timestamp();
        Self {
            job_id: Uuid::new_v4().to_string(),
            user_id,
            original_filename,
            input_format,
            output_format,
            engine_id,
            status: JobStatus::Pending,
            progress: 0,
            error_message: None,
            output_file: None,
            created_at: now,
            updated_at: now,
            completed_at: None,
        }
    }
}

/// 任務狀態回應
#[derive(Debug, Serialize)]
pub struct JobStatusResponse {
    pub job_id: String,
    pub status: JobStatus,
    pub progress: u8,
    pub original_filename: String,
    pub input_format: String,
    pub output_format: String,
    pub engine_id: String,
    pub error_message: Option<String>,
    pub created_at: i64,
    pub updated_at: i64,
    pub completed_at: Option<i64>,
    pub download_ready: bool,
}

impl From<&Job> for JobStatusResponse {
    fn from(job: &Job) -> Self {
        Self {
            job_id: job.job_id.clone(),
            status: job.status,
            progress: job.progress,
            original_filename: job.original_filename.clone(),
            input_format: job.input_format.clone(),
            output_format: job.output_format.clone(),
            engine_id: job.engine_id.clone(),
            error_message: job.error_message.clone(),
            created_at: job.created_at,
            updated_at: job.updated_at,
            completed_at: job.completed_at,
            download_ready: job.status == JobStatus::Completed && job.output_file.is_some(),
        }
    }
}

/// 健康檢查回應
#[derive(Debug, Serialize)]
pub struct HealthResponse {
    pub status: String,
    pub version: String,
    pub backend_status: String,
}
