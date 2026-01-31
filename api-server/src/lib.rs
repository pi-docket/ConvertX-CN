//! ConvertX RAS API Server - Remote AI Service for file conversion
//!
//! ## 架構說明
//!
//! ```text
//! src/
//! ├── main.rs              # 入口點
//! ├── lib.rs               # 模組匯出與 AppState
//! ├── config.rs            # 配置管理
//! ├── error.rs             # 錯誤處理
//! │
//! ├── routes/              # API 路由
//! │   ├── mod.rs           # 路由匯出
//! │   ├── health.rs        # 健康檢查
//! │   ├── info.rs          # API 資訊
//! │   ├── engines.rs       # 引擎管理
//! │   ├── formats.rs       # 格式查詢
//! │   ├── validate.rs      # 轉換驗證
//! │   └── jobs.rs          # 任務管理
//! │
//! ├── models/              # 資料模型
//! │   ├── mod.rs           # 模型匯出
//! │   ├── job.rs           # 任務模型
//! │   ├── engine.rs        # 引擎模型
//! │   └── api.rs           # API 回應模型
//! │
//! ├── services/            # 業務邏輯
//! │   ├── mod.rs           # 服務匯出
//! │   ├── dispatcher.rs    # 任務分派
//! │   └── engine_registry.rs # 引擎註冊
//! │
//! └── openapi.rs           # OpenAPI 文件生成
//! ```
//!
//! ## 端口說明
//!
//! 預設端口：**7890**（固定，不常用端口避免衝突）
//!
//! ## 環境變數
//!
//! | 變數名 | 預設值 | 說明 |
//! |--------|--------|------|
//! | RAS_API_HOST | 0.0.0.0 | 監聽地址 |
//! | RAS_API_PORT | 7890 | 監聯端口 |
//! | JWT_SECRET | (內建) | JWT 密鑰 |
//! | UPLOAD_DIR | ./data/uploads | 上傳目錄 |
//! | OUTPUT_DIR | ./data/output | 輸出目錄 |
//! | MAX_FILE_SIZE | 524288000 | 最大檔案 (500MB) |
//! | ENABLE_SWAGGER | true | 啟用 Swagger UI |

pub mod auth;
pub mod config;
pub mod error;
pub mod models;
pub mod services;
pub mod routes;
pub mod openapi;

// 保留舊模組相容性
pub mod engine;
pub mod conversion;
pub mod rest;
pub mod graphql;

use std::sync::Arc;
use axum::Router;
use tower_http::cors::{CorsLayer, Any};
use tower_http::trace::TraceLayer;
use tower_http::compression::CompressionLayer;

use crate::config::Config;
use crate::services::EngineRegistry;
use crate::services::ConversionDispatcher;

/// Application state shared across all handlers
#[derive(Clone)]
pub struct AppState {
    pub config: Arc<Config>,
    pub engine_registry: Arc<EngineRegistry>,
    pub dispatcher: Arc<ConversionDispatcher>,
}

impl AppState {
    pub fn new(config: Config) -> Self {
        let config = Arc::new(config);
        let engine_registry = Arc::new(EngineRegistry::new());
        let dispatcher = Arc::new(ConversionDispatcher::new(
            engine_registry.clone(),
            config.clone(),
        ));

        Self {
            config,
            engine_registry,
            dispatcher,
        }
    }
}

/// Build the application router with all routes
pub fn build_router(state: AppState) -> Router {
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let mut router = Router::new()
        .merge(routes::routes())
        .layer(cors)
        .layer(CompressionLayer::new())
        .layer(TraceLayer::new_for_http())
        .with_state(state.clone());

    // 如果啟用 Swagger，加入 OpenAPI 路由
    if state.config.enable_swagger {
        router = router.merge(openapi::swagger_routes());
    }

    router
}
