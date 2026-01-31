//! 錯誤處理模組

use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde::Serialize;
use thiserror::Error;

/// API 錯誤類型
#[derive(Error, Debug)]
pub enum ApiError {
    #[error("未授權：{0}")]
    Unauthorized(String),

    #[error("JWT Token 無效：{0}")]
    InvalidToken(String),

    #[error("JWT Token 已過期")]
    TokenExpired,

    #[error("缺少授權標頭")]
    MissingAuthHeader,

    #[error("權限不足：{0}")]
    Forbidden(String),

    #[error("引擎不存在：{0}")]
    EngineNotFound(String),

    #[error("引擎已停用：{0}")]
    EngineDisabled(String),

    #[error("不支援的轉換：{from} → {to}")]
    UnsupportedConversion { from: String, to: String },

    #[error("檔案過大：最大 {0} bytes")]
    FileTooLarge(u64),

    #[error("不支援的檔案格式：{0}")]
    UnsupportedFormat(String),

    #[error("任務不存在：{0}")]
    JobNotFound(String),

    #[error("任務尚未完成：{0}")]
    JobNotReady(String),

    #[error("任務執行失敗：{0}")]
    JobFailed(String),

    #[error("檔案不存在：{0}")]
    FileNotFound(String),

    #[error("請求無效：{0}")]
    InvalidInput(String),

    #[error("內部錯誤：{0}")]
    InternalError(String),

    #[error("後端服務錯誤：{0}")]
    BackendError(String),
}

/// 錯誤回應結構
#[derive(Serialize)]
pub struct ErrorResponse {
    pub error: String,
    pub code: String,
    pub message: String,
}

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        let (status, code) = match &self {
            ApiError::Unauthorized(_) => (StatusCode::UNAUTHORIZED, "UNAUTHORIZED"),
            ApiError::InvalidToken(_) => (StatusCode::UNAUTHORIZED, "INVALID_TOKEN"),
            ApiError::TokenExpired => (StatusCode::UNAUTHORIZED, "TOKEN_EXPIRED"),
            ApiError::MissingAuthHeader => (StatusCode::UNAUTHORIZED, "MISSING_AUTH_HEADER"),
            ApiError::Forbidden(_) => (StatusCode::FORBIDDEN, "FORBIDDEN"),
            ApiError::EngineNotFound(_) => (StatusCode::NOT_FOUND, "ENGINE_NOT_FOUND"),
            ApiError::EngineDisabled(_) => (StatusCode::BAD_REQUEST, "ENGINE_DISABLED"),
            ApiError::UnsupportedConversion { .. } => {
                (StatusCode::BAD_REQUEST, "UNSUPPORTED_CONVERSION")
            }
            ApiError::FileTooLarge(_) => (StatusCode::PAYLOAD_TOO_LARGE, "FILE_TOO_LARGE"),
            ApiError::UnsupportedFormat(_) => (StatusCode::BAD_REQUEST, "UNSUPPORTED_FORMAT"),
            ApiError::JobNotFound(_) => (StatusCode::NOT_FOUND, "JOB_NOT_FOUND"),
            ApiError::JobNotReady(_) => (StatusCode::BAD_REQUEST, "JOB_NOT_READY"),
            ApiError::JobFailed(_) => (StatusCode::INTERNAL_SERVER_ERROR, "JOB_FAILED"),
            ApiError::FileNotFound(_) => (StatusCode::NOT_FOUND, "FILE_NOT_FOUND"),
            ApiError::InvalidInput(_) => (StatusCode::BAD_REQUEST, "INVALID_INPUT"),
            ApiError::InternalError(_) => (StatusCode::INTERNAL_SERVER_ERROR, "INTERNAL_ERROR"),
            ApiError::BackendError(_) => (StatusCode::BAD_GATEWAY, "BACKEND_ERROR"),
        };

        let body = ErrorResponse {
            error: code.to_string(),
            code: code.to_string(),
            message: self.to_string(),
        };

        (status, Json(body)).into_response()
    }
}

/// API 結果類型
pub type ApiResult<T> = Result<T, ApiError>;
