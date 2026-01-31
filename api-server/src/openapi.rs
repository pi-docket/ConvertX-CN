//! OpenAPI documentation generation
//!
//! 使用 utoipa 自動生成 OpenAPI 3.0 規範。

use axum::Router;
use utoipa::OpenApi;
use utoipa_swagger_ui::SwaggerUi;

use crate::models::*;
use crate::AppState;

/// OpenAPI documentation
#[derive(OpenApi)]
#[openapi(
    info(
        title = "ConvertX RAS API",
        version = "2.0.0",
        description = "ConvertX 遠端 AI 服務 API - 檔案格式轉換服務\n\n## 概述\n\nRAS (Remote AI Service) API 是 ConvertX-CN 的對外公開 API，專為外部系統整合設計。\n\n## 認證\n\n- 公開端點（/health, /info, /engines, /formats, /validate）不需要認證\n- 任務端點（/jobs/*）需要 Bearer Token 認證\n\n## 端口\n\n預設端口：**7890**",
        license(
            name = "MIT",
            url = "https://opensource.org/licenses/MIT"
        ),
        contact(
            name = "ConvertX Team",
            url = "https://github.com/c-ares-wiki/ConvertX-CN"
        )
    ),
    servers(
        (url = "http://localhost:7890", description = "Local development server"),
        (url = "http://0.0.0.0:7890", description = "Docker container")
    ),
    tags(
        (name = "Health", description = "健康檢查端點"),
        (name = "Info", description = "API 資訊端點"),
        (name = "Engines", description = "引擎管理端點"),
        (name = "Formats", description = "格式查詢端點"),
        (name = "Validate", description = "轉換驗證端點"),
        (name = "Jobs", description = "任務管理端點（需認證）")
    ),
    paths(
        crate::routes::health::health_check,
        crate::routes::info::get_info,
        crate::routes::engines::list_engines,
        crate::routes::engines::get_engine,
        crate::routes::engines::get_engine_conversions,
        crate::routes::formats::list_formats,
        crate::routes::formats::get_format_targets,
        crate::routes::validate::validate_conversion,
        crate::routes::jobs::create_job,
        crate::routes::jobs::list_jobs,
        crate::routes::jobs::get_job,
        crate::routes::jobs::delete_job,
        crate::routes::jobs::get_job_result,
    ),
    components(
        schemas(
            // API 回應
            HealthResponse,
            InfoResponse,
            EndpointList,
            Capabilities,
            ApiError,
            ResponseMeta,
            
            // 引擎
            EngineInfo,
            EngineConversion,
            EngineDetail,
            ListEnginesResponse,
            ConversionTarget,
            
            // 格式
            ListFormatsResponse,
            FormatTargetsResponse,
            
            // 驗證
            ValidateRequest,
            ValidateResponse,
            
            // 任務
            JobStatus,
            ConversionJob,
            JobSummary,
            CreateJobResponse,
            JobStatusResponse,
            ListJobsResponse,
            DeleteJobResponse,
        )
    ),
    modifiers(&SecurityAddon)
)]
pub struct ApiDoc;

struct SecurityAddon;

impl utoipa::Modify for SecurityAddon {
    fn modify(&self, openapi: &mut utoipa::openapi::OpenApi) {
        if let Some(components) = openapi.components.as_mut() {
            components.add_security_scheme(
                "bearer_auth",
                utoipa::openapi::security::SecurityScheme::Http(
                    utoipa::openapi::security::Http::new(
                        utoipa::openapi::security::HttpAuthScheme::Bearer,
                    ),
                ),
            );
        }
    }
}

/// Create Swagger UI routes
pub fn swagger_routes() -> Router<AppState> {
    Router::new()
        .merge(SwaggerUi::new("/swagger-ui").url("/api-docs/openapi.json", ApiDoc::openapi()))
}
