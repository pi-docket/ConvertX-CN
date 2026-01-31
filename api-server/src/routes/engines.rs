//! Engines endpoints
//!
//! 引擎資訊查詢 API。

use axum::{
    extract::{Path, State},
    routing::get,
    Json, Router,
};
use serde_json::json;

use crate::models::{ApiResponse, ListEnginesResponse, EngineDetail};
use crate::AppState;

/// Create engines routes
pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/api/v1/engines", get(list_engines))
        .route("/api/v1/engines/:engine_id", get(get_engine))
        .route("/api/v1/engines/:engine_id/conversions", get(get_engine_conversions))
}

/// List all engines
#[utoipa::path(
    get,
    path = "/api/v1/engines",
    tag = "Engines",
    responses(
        (status = 200, description = "List of all engines", body = ListEnginesResponse)
    )
)]
async fn list_engines(State(state): State<AppState>) -> Json<ApiResponse<ListEnginesResponse>> {
    let engines = state.engine_registry.list_info();
    
    Json(ApiResponse::success(
        ListEnginesResponse { engines },
        &state.config.api_version,
    ))
}

/// Get engine details
#[utoipa::path(
    get,
    path = "/api/v1/engines/{engine_id}",
    tag = "Engines",
    params(
        ("engine_id" = String, Path, description = "Engine ID")
    ),
    responses(
        (status = 200, description = "Engine details", body = EngineDetail),
        (status = 404, description = "Engine not found")
    )
)]
async fn get_engine(
    State(state): State<AppState>,
    Path(engine_id): Path<String>,
) -> Json<ApiResponse<EngineDetail>> {
    if let Some(engine) = state.engine_registry.get(&engine_id) {
        let detail = EngineDetail {
            info: engine.to_info(),
            conversions: engine.get_conversions(),
        };
        Json(ApiResponse::success(detail, &state.config.api_version))
    } else {
        let available: Vec<String> = state.engine_registry.list().iter().map(|e| e.id.clone()).collect();
        Json(ApiResponse::error(
            "ENGINE_NOT_FOUND",
            &format!("Engine '{}' not found", engine_id),
            Some(json!({ "available_engines": available })),
            &state.config.api_version,
        ).into())
    }
}

/// Get engine conversions
#[utoipa::path(
    get,
    path = "/api/v1/engines/{engine_id}/conversions",
    tag = "Engines",
    params(
        ("engine_id" = String, Path, description = "Engine ID")
    ),
    responses(
        (status = 200, description = "Engine conversions"),
        (status = 404, description = "Engine not found")
    )
)]
async fn get_engine_conversions(
    State(state): State<AppState>,
    Path(engine_id): Path<String>,
) -> Json<serde_json::Value> {
    if let Some(engine) = state.engine_registry.get(&engine_id) {
        Json(json!({
            "success": true,
            "data": {
                "engine_id": engine.id,
                "conversions": engine.get_conversions(),
            },
            "meta": {
                "version": state.config.api_version,
            }
        }))
    } else {
        Json(json!({
            "success": false,
            "error": {
                "code": "ENGINE_NOT_FOUND",
                "message": format!("Engine '{}' not found", engine_id),
            }
        }))
    }
}

// Type conversion helper for error responses
impl<T> From<ApiResponse<()>> for ApiResponse<T> {
    fn from(err: ApiResponse<()>) -> Self {
        ApiResponse {
            success: false,
            data: None,
            error: err.error,
            meta: err.meta,
        }
    }
}
