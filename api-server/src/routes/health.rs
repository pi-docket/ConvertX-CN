//! Health check endpoint
//!
//! 用於監控和負載均衡器健康探測。

use axum::{routing::get, Json, Router};
use chrono::Utc;

use crate::models::HealthResponse;
use crate::AppState;

/// Create health routes
pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/health", get(health_check))
        .route("/api/v1/health", get(health_check))
}

/// Health check handler
///
/// 不需要認證，用於監控系統。
#[utoipa::path(
    get,
    path = "/api/v1/health",
    tag = "Health",
    responses(
        (status = 200, description = "Service is healthy", body = HealthResponse)
    )
)]
async fn health_check() -> Json<HealthResponse> {
    Json(HealthResponse {
        status: "healthy".to_string(),
        version: env!("CARGO_PKG_VERSION").to_string(),
        timestamp: Utc::now(),
        uptime_secs: None, // TODO: Track actual uptime
    })
}
