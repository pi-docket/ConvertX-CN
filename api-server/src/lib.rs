//! ConvertX API Server v2.0 - REST & GraphQL API for ConvertX-CN
//!
//! 提供完整的 REST API 和 GraphQL API 給第三方程式調用 ConvertX-CN 的轉換功能。
//!
//! ## 功能
//! - JWT 認證
//! - REST API（/api/v1/*）
//! - GraphQL API（/graphql）
//! - 引擎查詢
//! - 檔案轉換
//! - 任務管理
//! - 結果下載
//!
//! ## 環境變數
//!
//! - `JWT_SECRET`: JWT 密鑰（必須設定）
//! - `RAS_API_PORT`: API 伺服器埠號（預設 7890）
//! - `CONVERTX_BACKEND_URL`: ConvertX 後端 URL（預設 http://localhost:3000）

pub mod auth;
pub mod config;
pub mod engine;
pub mod error;
pub mod graphql;
pub mod handlers;
pub mod job;
pub mod models;

// Re-export commonly used types
pub use auth::{AppState, AuthenticatedUser, JwtClaims, JwtValidator};
pub use config::AppConfig;
pub use engine::{Engine, EngineInfo, EngineRegistry};
pub use error::{ApiError, ApiResult};
pub use graphql::{create_schema, ApiSchema};
pub use job::JobStore;
pub use models::{Job, JobStatus, JobStatusResponse};
