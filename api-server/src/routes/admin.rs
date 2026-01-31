//! Admin Routes - High-risk administrative endpoints
//!
//! 高風險管理 API，需要 admin 角色和確認參數。
//!
//! ## 安全機制
//!
//! 1. 必須具有 `admin` 角色
//! 2. 必須提供 `confirm=true` 查詢參數
//! 3. 所有操作都會記錄日誌

use axum::{
    extract::{Query, State},
    http::StatusCode,
    response::IntoResponse,
    routing::post,
    Json, Router,
};
use serde::{Deserialize, Serialize};
use utoipa::{IntoParams, ToSchema};
use std::fs;
use std::path::Path;
use tracing::{info, warn, error};

use crate::auth::RequireAuth;
use crate::error::{ApiError, ApiResult};
use crate::AppState;

/// Admin confirmation query parameters
#[derive(Debug, Deserialize, IntoParams)]
#[into_params(parameter_in = Query)]
pub struct PurgeConfirmation {
    /// Must be `true` to confirm the destructive operation
    pub confirm: Option<bool>,
}

/// Purge operation response
#[derive(Debug, Serialize, ToSchema)]
pub struct PurgeResponse {
    /// Operation success status
    pub success: bool,
    /// Descriptive message
    pub message: String,
    /// Number of directories removed
    pub directories_removed: u32,
    /// Number of files removed
    pub files_removed: u32,
    /// Total size freed in bytes
    pub bytes_freed: u64,
}

/// Admin statistics response
#[derive(Debug, Serialize, ToSchema)]
pub struct AdminStatsResponse {
    /// Total users with data
    pub total_users: u32,
    /// Total files stored
    pub total_files: u32,
    /// Total storage used in bytes
    pub total_bytes: u64,
    /// Upload directory path
    pub upload_dir: String,
    /// Output directory path
    pub output_dir: String,
}

/// Create admin routes
pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/api/v1/admin/stats", axum::routing::get(get_admin_stats))
        .route("/api/v1/admin/purge/all", post(purge_all))
        .route("/api/v1/admin/purge/users", post(purge_users))
        .route("/api/v1/admin/cleanup", post(run_cleanup))
}

/// Get admin statistics
///
/// Returns storage statistics including user count, file count, and total bytes.
/// Requires `admin` role.
#[utoipa::path(
    get,
    path = "/api/v1/admin/stats",
    tag = "Admin",
    summary = "Get storage statistics",
    description = "Returns detailed statistics about storage usage. Requires admin role.",
    responses(
        (status = 200, description = "Statistics retrieved successfully", body = AdminStatsResponse),
        (status = 401, description = "Unauthorized - missing or invalid token"),
        (status = 403, description = "Forbidden - admin role required")
    ),
    security(
        ("bearer_auth" = [])
    )
)]
async fn get_admin_stats(
    State(state): State<AppState>,
    RequireAuth(user): RequireAuth,
) -> ApiResult<Json<AdminStatsResponse>> {
    // Check admin role
    if !user.has_role("admin") {
        warn!(user_id = %user.user_id, "Non-admin attempted to access admin stats");
        return Err(ApiError::Unauthorized("Admin role required".into()));
    }

    let upload_dir = &state.config.upload_dir;
    let output_dir = &state.config.output_dir;

    let (upload_stats, output_stats) = tokio::join!(
        async { count_directory_stats(upload_dir) },
        async { count_directory_stats(output_dir) }
    );

    let (upload_users, upload_files, upload_bytes) = upload_stats.unwrap_or((0, 0, 0));
    let (output_users, output_files, output_bytes) = output_stats.unwrap_or((0, 0, 0));

    // Users are unique across both directories
    let total_users = upload_users.max(output_users);

    Ok(Json(AdminStatsResponse {
        total_users,
        total_files: upload_files + output_files,
        total_bytes: upload_bytes + output_bytes,
        upload_dir: upload_dir.clone(),
        output_dir: output_dir.clone(),
    }))
}

/// Purge all data including admin data
///
/// ⚠️ **DANGER**: Deletes ALL uploaded files and converted outputs for ALL users,
/// including admin users. This operation cannot be undone.
///
/// Requires `admin` role and `confirm=true` query parameter.
#[utoipa::path(
    post,
    path = "/api/v1/admin/purge/all",
    tag = "Admin",
    summary = "Purge ALL data",
    description = "⚠️ DANGER: Deletes ALL files for ALL users including admin. Cannot be undone.",
    params(PurgeConfirmation),
    responses(
        (status = 200, description = "All data purged successfully", body = PurgeResponse),
        (status = 400, description = "Missing confirm=true parameter"),
        (status = 401, description = "Unauthorized"),
        (status = 403, description = "Forbidden - admin role required")
    ),
    security(
        ("bearer_auth" = [])
    )
)]
async fn purge_all(
    State(state): State<AppState>,
    RequireAuth(user): RequireAuth,
    Query(params): Query<PurgeConfirmation>,
) -> ApiResult<Json<PurgeResponse>> {
    // Check admin role
    if !user.has_role("admin") {
        warn!(user_id = %user.user_id, "Non-admin attempted purge/all");
        return Err(ApiError::Unauthorized("Admin role required".into()));
    }

    // Require confirmation
    if params.confirm != Some(true) {
        return Err(ApiError::BadRequest(
            "This is a destructive operation. Add '?confirm=true' to proceed.".into()
        ));
    }

    info!(user_id = %user.user_id, "Admin initiated PURGE ALL operation");

    // Purge both directories
    let upload_result = purge_directory(&state.config.upload_dir).await;
    let output_result = purge_directory(&state.config.output_dir).await;

    let dirs_removed = upload_result.0 + output_result.0;
    let files_removed = upload_result.1 + output_result.1;
    let bytes_freed = upload_result.2 + output_result.2;

    info!(
        user_id = %user.user_id,
        dirs = dirs_removed,
        files = files_removed,
        bytes = bytes_freed,
        "PURGE ALL completed"
    );

    Ok(Json(PurgeResponse {
        success: true,
        message: "All data purged successfully".into(),
        directories_removed: dirs_removed,
        files_removed: files_removed,
        bytes_freed: bytes_freed,
    }))
}

/// Purge user data (preserves admin data)
///
/// Deletes all uploaded files and converted outputs for non-admin users.
/// Admin user data is preserved.
///
/// Requires `admin` role and `confirm=true` query parameter.
#[utoipa::path(
    post,
    path = "/api/v1/admin/purge/users",
    tag = "Admin",
    summary = "Purge user data (keep admin)",
    description = "Deletes files for all non-admin users. Admin data is preserved.",
    params(PurgeConfirmation),
    responses(
        (status = 200, description = "User data purged successfully", body = PurgeResponse),
        (status = 400, description = "Missing confirm=true parameter"),
        (status = 401, description = "Unauthorized"),
        (status = 403, description = "Forbidden - admin role required")
    ),
    security(
        ("bearer_auth" = [])
    )
)]
async fn purge_users(
    State(state): State<AppState>,
    RequireAuth(user): RequireAuth,
    Query(params): Query<PurgeConfirmation>,
) -> ApiResult<Json<PurgeResponse>> {
    // Check admin role
    if !user.has_role("admin") {
        warn!(user_id = %user.user_id, "Non-admin attempted purge/users");
        return Err(ApiError::Unauthorized("Admin role required".into()));
    }

    // Require confirmation
    if params.confirm != Some(true) {
        return Err(ApiError::BadRequest(
            "This is a destructive operation. Add '?confirm=true' to proceed.".into()
        ));
    }

    info!(user_id = %user.user_id, "Admin initiated PURGE USERS operation");

    // Get admin user ID to exclude
    let admin_user_id = &user.user_id;

    // Purge both directories, excluding admin
    let upload_result = purge_directory_except(&state.config.upload_dir, admin_user_id).await;
    let output_result = purge_directory_except(&state.config.output_dir, admin_user_id).await;

    let dirs_removed = upload_result.0 + output_result.0;
    let files_removed = upload_result.1 + output_result.1;
    let bytes_freed = upload_result.2 + output_result.2;

    info!(
        user_id = %user.user_id,
        dirs = dirs_removed,
        files = files_removed,
        bytes = bytes_freed,
        "PURGE USERS completed (admin data preserved)"
    );

    Ok(Json(PurgeResponse {
        success: true,
        message: format!("User data purged successfully. Admin '{}' data preserved.", admin_user_id),
        directories_removed: dirs_removed,
        files_removed: files_removed,
        bytes_freed: bytes_freed,
    }))
}

/// Run cleanup of old files
///
/// Deletes files older than the specified hours (default: 24 hours).
/// This is the same operation that runs automatically via cron.
#[utoipa::path(
    post,
    path = "/api/v1/admin/cleanup",
    tag = "Admin",
    summary = "Run file cleanup",
    description = "Manually trigger cleanup of files older than 24 hours.",
    params(PurgeConfirmation),
    responses(
        (status = 200, description = "Cleanup completed successfully", body = PurgeResponse),
        (status = 400, description = "Missing confirm=true parameter"),
        (status = 401, description = "Unauthorized"),
        (status = 403, description = "Forbidden - admin role required")
    ),
    security(
        ("bearer_auth" = [])
    )
)]
async fn run_cleanup(
    State(state): State<AppState>,
    RequireAuth(user): RequireAuth,
    Query(params): Query<PurgeConfirmation>,
) -> ApiResult<Json<PurgeResponse>> {
    // Check admin role
    if !user.has_role("admin") {
        warn!(user_id = %user.user_id, "Non-admin attempted cleanup");
        return Err(ApiError::Unauthorized("Admin role required".into()));
    }

    // Require confirmation
    if params.confirm != Some(true) {
        return Err(ApiError::BadRequest(
            "This is a destructive operation. Add '?confirm=true' to proceed.".into()
        ));
    }

    info!(user_id = %user.user_id, "Admin initiated manual cleanup");

    // Clean files older than 24 hours
    let max_age_hours = 24;
    let upload_result = cleanup_old_files(&state.config.upload_dir, max_age_hours).await;
    let output_result = cleanup_old_files(&state.config.output_dir, max_age_hours).await;

    let dirs_removed = upload_result.0 + output_result.0;
    let files_removed = upload_result.1 + output_result.1;
    let bytes_freed = upload_result.2 + output_result.2;

    info!(
        user_id = %user.user_id,
        max_age_hours = max_age_hours,
        dirs = dirs_removed,
        files = files_removed,
        bytes = bytes_freed,
        "Cleanup completed"
    );

    Ok(Json(PurgeResponse {
        success: true,
        message: format!("Cleanup completed. Files older than {} hours removed.", max_age_hours),
        directories_removed: dirs_removed,
        files_removed: files_removed,
        bytes_freed: bytes_freed,
    }))
}

// ============================================================================
// Helper Functions
// ============================================================================

/// Count directory statistics (users, files, bytes)
fn count_directory_stats(dir: &str) -> std::io::Result<(u32, u32, u64)> {
    let path = Path::new(dir);
    if !path.exists() {
        return Ok((0, 0, 0));
    }

    let mut users = 0u32;
    let mut files = 0u32;
    let mut bytes = 0u64;

    for entry in fs::read_dir(path)? {
        let entry = entry?;
        if entry.file_type()?.is_dir() {
            users += 1;
            let (_, f, b) = count_directory_recursive(&entry.path())?;
            files += f;
            bytes += b;
        }
    }

    Ok((users, files, bytes))
}

/// Count files and bytes recursively
fn count_directory_recursive(dir: &Path) -> std::io::Result<(u32, u32, u64)> {
    let mut dirs = 0u32;
    let mut files = 0u32;
    let mut bytes = 0u64;

    for entry in fs::read_dir(dir)? {
        let entry = entry?;
        let metadata = entry.metadata()?;
        
        if metadata.is_dir() {
            dirs += 1;
            let (d, f, b) = count_directory_recursive(&entry.path())?;
            dirs += d;
            files += f;
            bytes += b;
        } else {
            files += 1;
            bytes += metadata.len();
        }
    }

    Ok((dirs, files, bytes))
}

/// Purge entire directory contents
async fn purge_directory(dir: &str) -> (u32, u32, u64) {
    let path = Path::new(dir);
    if !path.exists() {
        return (0, 0, 0);
    }

    let (dirs, files, bytes) = count_directory_recursive(path).unwrap_or((0, 0, 0));

    // Remove all contents
    if let Ok(entries) = fs::read_dir(path) {
        for entry in entries.flatten() {
            let entry_path = entry.path();
            if entry_path.is_dir() {
                if let Err(e) = fs::remove_dir_all(&entry_path) {
                    error!(path = ?entry_path, error = %e, "Failed to remove directory");
                }
            } else {
                if let Err(e) = fs::remove_file(&entry_path) {
                    error!(path = ?entry_path, error = %e, "Failed to remove file");
                }
            }
        }
    }

    (dirs, files, bytes)
}

/// Purge directory contents except for specified user
async fn purge_directory_except(dir: &str, except_user: &str) -> (u32, u32, u64) {
    let path = Path::new(dir);
    if !path.exists() {
        return (0, 0, 0);
    }

    let mut total_dirs = 0u32;
    let mut total_files = 0u32;
    let mut total_bytes = 0u64;

    if let Ok(entries) = fs::read_dir(path) {
        for entry in entries.flatten() {
            let entry_path = entry.path();
            
            // Skip if this is the admin user's directory
            if let Some(name) = entry_path.file_name().and_then(|n| n.to_str()) {
                if name == except_user {
                    info!(user = name, "Preserving admin user data");
                    continue;
                }
            }

            if entry_path.is_dir() {
                let (d, f, b) = count_directory_recursive(&entry_path).unwrap_or((0, 0, 0));
                total_dirs += d + 1;
                total_files += f;
                total_bytes += b;

                if let Err(e) = fs::remove_dir_all(&entry_path) {
                    error!(path = ?entry_path, error = %e, "Failed to remove directory");
                }
            }
        }
    }

    (total_dirs, total_files, total_bytes)
}

/// Cleanup files older than specified hours
async fn cleanup_old_files(dir: &str, max_age_hours: u64) -> (u32, u32, u64) {
    let path = Path::new(dir);
    if !path.exists() {
        return (0, 0, 0);
    }

    let max_age = std::time::Duration::from_secs(max_age_hours * 3600);
    let now = std::time::SystemTime::now();

    let mut total_dirs = 0u32;
    let mut total_files = 0u32;
    let mut total_bytes = 0u64;

    if let Err(e) = cleanup_old_files_recursive(path, max_age, now, &mut total_dirs, &mut total_files, &mut total_bytes) {
        error!(path = ?path, error = %e, "Error during cleanup");
    }

    (total_dirs, total_files, total_bytes)
}

/// Recursively cleanup old files
fn cleanup_old_files_recursive(
    dir: &Path,
    max_age: std::time::Duration,
    now: std::time::SystemTime,
    dirs_removed: &mut u32,
    files_removed: &mut u32,
    bytes_freed: &mut u64,
) -> std::io::Result<bool> {
    let mut is_empty = true;

    for entry in fs::read_dir(dir)? {
        let entry = entry?;
        let entry_path = entry.path();
        let metadata = entry.metadata()?;

        if metadata.is_dir() {
            // Recurse into subdirectory
            if cleanup_old_files_recursive(&entry_path, max_age, now, dirs_removed, files_removed, bytes_freed)? {
                // Directory is empty after cleanup, remove it
                if let Err(e) = fs::remove_dir(&entry_path) {
                    error!(path = ?entry_path, error = %e, "Failed to remove empty directory");
                } else {
                    *dirs_removed += 1;
                }
            } else {
                is_empty = false;
            }
        } else {
            // Check file age
            let modified = metadata.modified()?;
            if let Ok(age) = now.duration_since(modified) {
                if age > max_age {
                    let size = metadata.len();
                    if let Err(e) = fs::remove_file(&entry_path) {
                        error!(path = ?entry_path, error = %e, "Failed to remove old file");
                    } else {
                        *files_removed += 1;
                        *bytes_freed += size;
                    }
                } else {
                    is_empty = false;
                }
            } else {
                is_empty = false;
            }
        }
    }

    Ok(is_empty)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_purge_confirmation_missing() {
        let params = PurgeConfirmation { confirm: None };
        assert!(params.confirm.is_none());
    }

    #[test]
    fn test_purge_confirmation_false() {
        let params = PurgeConfirmation { confirm: Some(false) };
        assert_eq!(params.confirm, Some(false));
    }

    #[test]
    fn test_purge_confirmation_true() {
        let params = PurgeConfirmation { confirm: Some(true) };
        assert_eq!(params.confirm, Some(true));
    }
}
