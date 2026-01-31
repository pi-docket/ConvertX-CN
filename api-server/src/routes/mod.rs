//! Routes module - API endpoint definitions
//!
//! 所有 API 路由定義。

mod health;
mod info;
mod engines;
mod formats;
mod validate;
mod jobs;
mod admin;

use axum::Router;
use crate::AppState;

/// Create all API routes
pub fn routes() -> Router<AppState> {
    Router::new()
        // 公開端點（不需認證）
        .merge(health::routes())
        .merge(info::routes())
        .merge(engines::routes())
        .merge(formats::routes())
        .merge(validate::routes())
        // 受保護端點（需要認證）
        .merge(jobs::routes())
        // 管理端點（需要 admin 角色）
        .merge(admin::routes())
}
