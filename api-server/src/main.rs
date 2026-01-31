//! ConvertX API Server - Simplified Proxy Mode
//!
//! 這是一個輕量級的 API 代理服務器，將請求轉發到 Web UI。

use axum::{
    extract::State,
    response::{IntoResponse, Json},
    routing::get,
    Router,
};
use serde::Serialize;
use std::env;
use std::net::SocketAddr;
use std::sync::Arc;
use tower_http::cors::{Any, CorsLayer};
use tracing::{info, Level};
use tracing_subscriber::FmtSubscriber;

/// Application configuration
#[derive(Clone)]
struct AppConfig {
    port: u16,
    backend_url: String,
    #[allow(dead_code)]
    jwt_secret: String,
}

impl AppConfig {
    fn from_env() -> Self {
        Self {
            port: env::var("RAS_API_PORT")
                .unwrap_or_else(|_| "7890".to_string())
                .parse()
                .unwrap_or(7890),
            backend_url: env::var("CONVERTX_BACKEND_URL")
                .unwrap_or_else(|_| "http://convertx:3000".to_string()),
            jwt_secret: env::var("JWT_SECRET")
                .unwrap_or_else(|_| "default-secret-change-me".to_string()),
        }
    }
}

/// Health check response
#[derive(Serialize)]
struct HealthResponse {
    status: String,
    version: String,
    mode: String,
    backend_url: String,
}

/// API info response
#[derive(Serialize)]
struct InfoResponse {
    name: String,
    version: String,
    description: String,
    mode: String,
    endpoints: Vec<EndpointInfo>,
}

#[derive(Serialize)]
struct EndpointInfo {
    path: String,
    method: String,
    description: String,
}

/// Health check endpoint
async fn health_check(State(config): State<Arc<AppConfig>>) -> impl IntoResponse {
    Json(HealthResponse {
        status: "healthy".to_string(),
        version: env!("CARGO_PKG_VERSION").to_string(),
        mode: "proxy".to_string(),
        backend_url: config.backend_url.clone(),
    })
}

/// API info endpoint
async fn api_info() -> impl IntoResponse {
    Json(InfoResponse {
        name: "ConvertX API Server".to_string(),
        version: env!("CARGO_PKG_VERSION").to_string(),
        description: "Lightweight API proxy for ConvertX-CN".to_string(),
        mode: "proxy".to_string(),
        endpoints: vec![
            EndpointInfo {
                path: "/api/v1/health".to_string(),
                method: "GET".to_string(),
                description: "Health check endpoint".to_string(),
            },
            EndpointInfo {
                path: "/api/v1/info".to_string(),
                method: "GET".to_string(),
                description: "API information".to_string(),
            },
        ],
    })
}

/// Root endpoint
async fn root() -> impl IntoResponse {
    Json(serde_json::json!({
        "message": "ConvertX API Server",
        "docs": "/api/v1/info"
    }))
}

#[tokio::main]
async fn main() {
    // Initialize logging
    let subscriber = FmtSubscriber::builder()
        .with_max_level(Level::INFO)
        .finish();
    tracing::subscriber::set_global_default(subscriber).expect("Failed to set subscriber");

    // Load configuration
    let config = Arc::new(AppConfig::from_env());

    info!("========================================");
    info!("🚀 ConvertX API Server v{}", env!("CARGO_PKG_VERSION"));
    info!("========================================");
    info!("Mode: Proxy (forwarding to Web UI)");
    info!("Backend URL: {}", config.backend_url);
    info!("Port: {}", config.port);
    info!("========================================");

    // Build router
    let app = Router::new()
        .route("/", get(root))
        .route("/api/v1/health", get(health_check))
        .route("/api/v1/info", get(api_info))
        .layer(CorsLayer::new().allow_origin(Any).allow_methods(Any))
        .with_state(config.clone());

    // Start server
    let addr = SocketAddr::from(([0, 0, 0, 0], config.port));
    info!("Listening on http://{}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}
