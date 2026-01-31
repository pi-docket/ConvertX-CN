//! Validate endpoint
//!
//! 轉換可行性驗證 API。

use axum::{
    extract::State,
    routing::post,
    Json, Router,
};

use crate::models::{ApiResponse, ValidateRequest, ValidateResponse};
use crate::services::dispatcher::ValidationResult;
use crate::AppState;

/// Create validate routes
pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/api/v1/validate", post(validate_conversion))
}

/// Validate a conversion
#[utoipa::path(
    post,
    path = "/api/v1/validate",
    tag = "Validate",
    request_body = ValidateRequest,
    responses(
        (status = 200, description = "Validation result", body = ValidateResponse)
    )
)]
async fn validate_conversion(
    State(state): State<AppState>,
    Json(request): Json<ValidateRequest>,
) -> Json<ApiResponse<ValidateResponse>> {
    let result = state.dispatcher.validate_conversion(
        &request.input_format,
        &request.output_format,
        request.engine.as_deref(),
    );

    let response = match result {
        ValidationResult::Valid { engine } => {
            // Find all engines that support this conversion
            let available_engines: Vec<String> = state
                .engine_registry
                .find_engines_for(&request.input_format, &request.output_format)
                .iter()
                .map(|e| e.id.clone())
                .collect();

            ValidateResponse {
                valid: true,
                reason: None,
                message: Some(format!(
                    "Conversion from '{}' to '{}' is supported",
                    request.input_format, request.output_format
                )),
                suggestions: None,
                engine: Some(engine),
                available_engines: Some(available_engines),
            }
        }
        ValidationResult::Invalid { reason, suggestions } => {
            ValidateResponse {
                valid: false,
                reason: Some(reason.clone()),
                message: Some(reason),
                suggestions: Some(suggestions),
                engine: None,
                available_engines: None,
            }
        }
    };

    Json(ApiResponse::success(response, &state.config.api_version))
}
