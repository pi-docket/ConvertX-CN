//! Configuration module for the RAS API server
//!
//! 支援環境變數配置，包含合理的預設值。

use std::env;
use anyhow::Result;

/// 固定端口號 - 使用不常見的端口避免衝突
pub const DEFAULT_PORT: u16 = 7890;

/// Server configuration
#[derive(Debug, Clone)]
pub struct Config {
    /// Server host address
    pub host: String,
    /// Server port (default: 7890)
    pub port: u16,
    /// JWT secret key for token validation
    pub jwt_secret: String,
    /// Directory for uploaded files
    pub upload_dir: String,
    /// Directory for converted output files
    pub output_dir: String,
    /// Maximum file size in bytes (default: 500MB)
    pub max_file_size: usize,
    /// JWT token expiration time in seconds
    pub jwt_expiration_secs: i64,
    /// API version
    pub api_version: String,
    /// Enable Swagger UI
    pub enable_swagger: bool,
}

impl Config {
    /// Load configuration from environment variables
    pub fn from_env() -> Result<Self> {
        Ok(Self {
            host: env::var("RAS_API_HOST").unwrap_or_else(|_| "0.0.0.0".to_string()),
            port: env::var("RAS_API_PORT")
                .unwrap_or_else(|_| DEFAULT_PORT.to_string())
                .parse()?,
            jwt_secret: env::var("JWT_SECRET")
                .unwrap_or_else(|_| "convertx-ras-api-secret-change-in-production".to_string()),
            upload_dir: env::var("UPLOAD_DIR")
                .unwrap_or_else(|_| "./data/uploads".to_string()),
            output_dir: env::var("OUTPUT_DIR")
                .unwrap_or_else(|_| "./data/output".to_string()),
            max_file_size: env::var("MAX_FILE_SIZE")
                .unwrap_or_else(|_| "524288000".to_string()) // 500MB
                .parse()?,
            jwt_expiration_secs: env::var("JWT_EXPIRATION_SECS")
                .unwrap_or_else(|_| "86400".to_string()) // 24 hours
                .parse()?,
            api_version: env::var("API_VERSION")
                .unwrap_or_else(|_| "2.0.0".to_string()),
            enable_swagger: env::var("ENABLE_SWAGGER")
                .unwrap_or_else(|_| "true".to_string())
                .parse()
                .unwrap_or(true),
        })
    }

    /// Create a configuration for testing
    #[cfg(test)]
    pub fn test_config() -> Self {
        Self {
            host: "127.0.0.1".to_string(),
            port: DEFAULT_PORT,
            jwt_secret: "test-secret-key".to_string(),
            upload_dir: "./test_data/uploads".to_string(),
            output_dir: "./test_data/output".to_string(),
            max_file_size: 10 * 1024 * 1024, // 10MB for tests
            jwt_expiration_secs: 3600,
            api_version: "2.0.0".to_string(),
            enable_swagger: true,
        }
    }
}

impl Default for Config {
    fn default() -> Self {
        Self {
            host: "0.0.0.0".to_string(),
            port: DEFAULT_PORT,
            jwt_secret: "default-secret-change-me".to_string(),
            upload_dir: "./data/uploads".to_string(),
            output_dir: "./data/output".to_string(),
            max_file_size: 500 * 1024 * 1024, // 500MB
            jwt_expiration_secs: 86400,
            api_version: "2.0.0".to_string(),
            enable_swagger: true,
        }
    }
}
