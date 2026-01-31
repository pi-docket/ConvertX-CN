//! Formats endpoints
//!
//! 格式支援查詢 API。

use axum::{
    extract::{Path, State},
    routing::get,
    Json, Router,
};

use crate::models::{ApiResponse, ListFormatsResponse, FormatTargetsResponse, ConversionTarget};
use crate::AppState;

/// Create formats routes
pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/api/v1/formats", get(list_formats))
        .route("/api/v1/formats/:format/targets", get(get_format_targets))
}

/// List all supported formats
#[utoipa::path(
    get,
    path = "/api/v1/formats",
    tag = "Formats",
    responses(
        (status = 200, description = "List of all formats", body = ListFormatsResponse)
    )
)]
async fn list_formats(State(state): State<AppState>) -> Json<ApiResponse<ListFormatsResponse>> {
    let inputs = state.engine_registry.all_input_formats();
    let outputs = state.engine_registry.all_output_formats();
    
    let response = ListFormatsResponse {
        input_count: inputs.len(),
        output_count: outputs.len(),
        inputs,
        outputs,
    };
    
    Json(ApiResponse::success(response, &state.config.api_version))
}

/// Get possible targets for a format
#[utoipa::path(
    get,
    path = "/api/v1/formats/{format}/targets",
    tag = "Formats",
    params(
        ("format" = String, Path, description = "Input format (e.g., pdf, docx)")
    ),
    responses(
        (status = 200, description = "Possible conversion targets", body = FormatTargetsResponse),
        (status = 404, description = "Format not supported")
    )
)]
async fn get_format_targets(
    State(state): State<AppState>,
    Path(format): Path<String>,
) -> Json<ApiResponse<FormatTargetsResponse>> {
    let format = format.to_lowercase();
    let targets = state.engine_registry.get_targets_for(&format);
    
    if targets.is_empty() {
        return Json(ApiResponse::error(
            "FORMAT_NOT_SUPPORTED",
            &format!("Format '{}' is not supported as input", format),
            None,
            &state.config.api_version,
        ).into());
    }
    
    let converters: Vec<ConversionTarget> = targets
        .into_iter()
        .map(|(engine, outputs)| ConversionTarget { engine, outputs })
        .collect();
    
    let all_outputs: Vec<String> = converters
        .iter()
        .flat_map(|c| c.outputs.clone())
        .collect::<std::collections::HashSet<_>>()
        .into_iter()
        .collect();
    
    let response = FormatTargetsResponse {
        input_format: format,
        converters,
        all_outputs,
    };
    
    Json(ApiResponse::success(response, &state.config.api_version))
}
