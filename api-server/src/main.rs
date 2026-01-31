//! ConvertX RAS API Server - Main entry point
//!
//! Remote AI Service (RAS) API for file conversion operations.
//!
//! ## 啟動方式
//!
//! ```bash
//! # 使用預設配置（端口 7890）
//! cargo run
//!
//! # 自訂端口
//! RAS_API_PORT=8080 cargo run
//! ```

use std::net::SocketAddr;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

use convertx_ras_api::{build_router, config::Config, AppState};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Initialize logging
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "convertx_ras_api=debug,tower_http=debug".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    // Load configuration
    dotenvy::dotenv().ok();
    let config = Config::from_env()?;

    println!(r#"
╔═══════════════════════════════════════════════════════════════════╗
║                                                                   ║
║   ██████╗ ██████╗ ███╗   ██╗██╗   ██╗███████╗██████╗ ████████╗   ║
║  ██╔════╝██╔═══██╗████╗  ██║██║   ██║██╔════╝██╔══██╗╚══██╔══╝   ║
║  ██║     ██║   ██║██╔██╗ ██║██║   ██║█████╗  ██████╔╝   ██║      ║
║  ██║     ██║   ██║██║╚██╗██║╚██╗ ██╔╝██╔══╝  ██╔══██╗   ██║      ║
║  ╚██████╗╚██████╔╝██║ ╚████║ ╚████╔╝ ███████╗██║  ██║   ██║      ║
║   ╚═════╝ ╚═════╝ ╚═╝  ╚═══╝  ╚═══╝  ╚══════╝╚═╝  ╚═╝   ╚═╝      ║
║                                                                   ║
║                    RAS API v{}                               ║
║                Remote AI Service for File Conversion              ║
║                                                                   ║
╚═══════════════════════════════════════════════════════════════════╝
"#, config.api_version);

    tracing::info!("Starting ConvertX RAS API Server v{}", config.api_version);
    tracing::info!("REST API:        http://{}:{}/api/v1", config.host, config.port);
    tracing::info!("Health Check:    http://{}:{}/api/v1/health", config.host, config.port);
    
    if config.enable_swagger {
        tracing::info!("Swagger UI:      http://{}:{}/swagger-ui", config.host, config.port);
        tracing::info!("OpenAPI JSON:    http://{}:{}/api-docs/openapi.json", config.host, config.port);
    }
    
    tracing::info!("GraphQL:         http://{}:{}/graphql", config.host, config.port);

    // Build application state
    let state = AppState::new(config.clone());

    // Build router
    let app = build_router(state);

    // Start server
    let addr = SocketAddr::new(config.host.parse()?, config.port);
    let listener = tokio::net::TcpListener::bind(addr).await?;
    
    tracing::info!("🚀 Server listening on http://{}", addr);
    
    axum::serve(listener, app).await?;

    Ok(())
}
