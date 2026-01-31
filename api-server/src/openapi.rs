//! OpenAPI documentation generation
//!
//! 使用 utoipa 自動生成 OpenAPI 3.0 規範。

use axum::Router;
use utoipa::OpenApi;
use utoipa_swagger_ui::SwaggerUi;

use crate::models::*;
use crate::routes::admin::{AdminStatsResponse, PurgeResponse};
use crate::AppState;

/// OpenAPI documentation
#[derive(OpenApi)]
#[openapi(
    info(
        title = "ConvertX RAS API",
        version = "2.0.0",
        description = "ConvertX 遠端 AI 服務 API - 檔案格式轉換服務\n\n## 概述\n\nRAS (Remote AI Service) API 是 ConvertX-CN 的對外公開 API，專為外部系統整合設計。\n\n## 認證\n\n- 公開端點（/health, /info, /engines, /formats, /validate）不需要認證\n- 任務端點（/jobs/*）需要 Bearer Token 認證\n- 管理端點（/admin/*）需要 admin 角色\n\n## 端口\n\n預設端口：**7890**\n\n## JWT 統一認證\n\nWeb UI 和 API Server 使用相同的 `JWT_SECRET` 環境變數。部署時只需設定一次，兩個服務會共用同一個密鑰。",
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
        (name = "Jobs", description = "任務管理端點（需認證）"),
        (name = "Admin", description = "管理端點（需 admin 角色）⚠️ 高風險操作")
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
        crate::routes::admin::get_admin_stats,
        crate::routes::admin::purge_all,
        crate::routes::admin::purge_users,
        crate::routes::admin::run_cleanup,
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
            
            // 管理
            AdminStatsResponse,
            PurgeResponse,
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
