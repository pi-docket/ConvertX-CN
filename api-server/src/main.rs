//! ConvertX-CN API Server
//!
//! 提供 RESTful API 介面供第三方程式呼叫 ConvertX-CN 轉換功能。
//!
//! ## 功能特點
//!
//! - JWT 認證：所有 API 都需要有效的 JWT Token
//! - 引擎查詢：列出和查詢可用的轉換引擎
//! - 檔案轉換：上傳檔案並進行格式轉換
//! - 任務管理：查詢轉換任務狀態
//! - 結果下載：下載轉換完成的檔案
//!
//! ## 環境變數
//!
//! - `JWT_SECRET`：JWT 簽署密鑰（必須與 ConvertX-CN 主程式相同）
//! - `API_PORT`：API 伺服器埠號（預設 7890）
//! - `BACKEND_URL`：ConvertX-CN 後端 URL（預設 http://localhost:3000）

use axum::{
    routing::{get, post},
    Router,
};
use std::net::SocketAddr;
use tower_http::cors::{Any, CorsLayer};
use tracing::{info, Level};
use tracing_subscriber::FmtSubscriber;

mod auth;
mod config;
mod engine;
mod error;
mod handlers;
mod job;
mod models;

use auth::AppState;
use config::AppConfig;

#[tokio::main]
async fn main() {
    // 初始化日誌
    let subscriber = FmtSubscriber::builder()
        .with_max_level(Level::INFO)
        .finish();
    tracing::subscriber::set_global_default(subscriber).expect("Failed to set subscriber");

    // 載入設定
    let config = AppConfig::from_env();
    let addr: SocketAddr = format!("0.0.0.0:{}", config.port)
        .parse()
        .expect("Invalid address");

    info!("========================================");
    info!("🚀 ConvertX-CN API Server v{}", env!("CARGO_PKG_VERSION"));
    info!("========================================");
    info!("📡 Listening on http://{}", addr);
    info!("🔗 Backend URL: {}", config.backend_url);
    info!("========================================");

    // 建立應用程式狀態
    let state = AppState::new(config);

    // 建立路由
    let app = create_router(state);

    // 啟動伺服器
    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    info!("✅ Server started successfully");
    axum::serve(listener, app).await.unwrap();
}

/// 建立 API 路由
fn create_router(state: AppState) -> Router {
    // CORS 設定
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    Router::new()
        // 健康檢查（無需認證）
        .route("/api/health", get(handlers::health_check))
        .route("/health", get(handlers::health_check))
        // API v1 路由（需要認證）
        .route("/api/v1/engines", get(handlers::list_engines))
        .route("/api/v1/engines/{engine_id}", get(handlers::get_engine))
        .route("/api/v1/convert", post(handlers::create_conversion))
        .route("/api/v1/jobs/{job_id}", get(handlers::get_job_status))
        .route("/api/v1/jobs/{job_id}/download", get(handlers::download_job_result))
        .layer(cors)
        .with_state(state)
}
