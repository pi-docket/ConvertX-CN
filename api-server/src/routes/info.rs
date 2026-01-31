//! API Info endpoint
//!
//! 提供 API 版本、功能列表等資訊。

use axum::{extract::State, routing::get, Json, Router};

use crate::models::{InfoResponse, EndpointList, Capabilities, ApiResponse};
use crate::AppState;

/// Create info routes
pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/api/v1/info", get(get_info))
}

/// Get API information
#[utoipa::path(
    get,
    path = "/api/v1/info",
    tag = "Info",
    responses(
        (status = 200, description = "API information", body = InfoResponse)
    )
)]
async fn get_info(State(state): State<AppState>) -> Json<ApiResponse<InfoResponse>> {
    let engines = state.engine_registry.list();
    let available = engines.iter().filter(|e| e.available).count();

    let info = InfoResponse {
        name: "ConvertX RAS API".to_string(),
        version: state.config.api_version.clone(),
        description: "ConvertX 遠端 AI 服務 API - 檔案格式轉換服務".to_string(),
        documentation: "/swagger-ui".to_string(),
        endpoints: EndpointList {
            public: vec![
                "GET /api/v1/health".to_string(),
                "GET /api/v1/info".to_string(),
                "GET /api/v1/engines".to_string(),
                "GET /api/v1/engines/{id}".to_string(),
                "GET /api/v1/formats".to_string(),
                "GET /api/v1/formats/{format}/targets".to_string(),
                "POST /api/v1/validate".to_string(),
            ],
            authenticated: vec![
                "POST /api/v1/jobs".to_string(),
                "GET /api/v1/jobs".to_string(),
                "GET /api/v1/jobs/{id}".to_string(),
                "GET /api/v1/jobs/{id}/result".to_string(),
                "DELETE /api/v1/jobs/{id}".to_string(),
            ],
        },
        capabilities: Capabilities {
            total_engines: engines.len(),
            available_engines: available,
            max_file_size: state.config.max_file_size,
        },
    };

    Json(ApiResponse::success(info, &state.config.api_version))
}
