//! ConvertX-CN API Server v2.0
//!
//! 提供 REST API 和 GraphQL API 介面供第三方程式呼叫 ConvertX-CN 轉換功能。
//!
//! ## 功能特點
//!
//! - JWT 認證：所有 API 都需要有效的 JWT Token
//! - REST API：傳統 RESTful 端點
//! - GraphQL API：靈活的查詢介面
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

// 允許未使用的代碼，因為這些是公共 API 的一部分
#![allow(dead_code)]

use async_graphql_axum::{GraphQLRequest, GraphQLResponse};
use axum::{
    extract::State,
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
mod graphql;
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

    // 建立 GraphQL Schema
    let schema = graphql::create_schema(state.clone());
    let state = state.with_graphql_schema(schema);

    // 建立路由
    let app = create_router(state);

    // 啟動伺服器
    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    info!("✅ Server started successfully");
    info!("📊 GraphQL Playground: http://{}/graphql", addr);
    axum::serve(listener, app).await.unwrap();
}

/// GraphQL 處理器
async fn graphql_handler(
    State(state): State<AppState>,
    req: GraphQLRequest,
) -> GraphQLResponse {
    if let Some(schema) = &state.graphql_schema {
        schema.execute(req.into_inner()).await.into()
    } else {
        GraphQLResponse::from(async_graphql::Response::from_errors(vec![
            async_graphql::ServerError::new("GraphQL not initialized", None)
        ]))
    }
}

/// GraphQL Playground HTML
async fn graphql_playground() -> axum::response::Html<&'static str> {
    axum::response::Html(r#"
<!DOCTYPE html>
<html>
<head>
    <title>ConvertX API - GraphQL Playground</title>
    <link rel="stylesheet" href="https://unpkg.com/graphiql/graphiql.min.css" />
</head>
<body style="margin: 0;">
    <div id="graphiql" style="height: 100vh;"></div>
    <script crossorigin src="https://unpkg.com/react/umd/react.production.min.js"></script>
    <script crossorigin src="https://unpkg.com/react-dom/umd/react-dom.production.min.js"></script>
    <script crossorigin src="https://unpkg.com/graphiql/graphiql.min.js"></script>
    <script>
        const fetcher = GraphiQL.createFetcher({ url: '/graphql' });
        ReactDOM.render(
            React.createElement(GraphiQL, { fetcher }),
            document.getElementById('graphiql'),
        );
    </script>
</body>
</html>
"#)
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
        // GraphQL（無需認證，Token 在請求中傳遞）
        .route("/graphql", get(graphql_playground).post(graphql_handler))
        // API v1 路由（需要認證）
        .route("/api/v1/engines", get(handlers::list_engines))
        .route("/api/v1/engines/{engine_id}", get(handlers::get_engine))
        .route("/api/v1/convert", post(handlers::create_conversion))
        .route("/api/v1/jobs/{job_id}", get(handlers::get_job_status))
        .route("/api/v1/jobs/{job_id}/download", get(handlers::download_job_result))
        .layer(cors)
        .with_state(state)
}
