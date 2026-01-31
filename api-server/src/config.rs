//! 應用程式配置模組

use std::env;

/// 應用程式配置
#[derive(Clone, Debug)]
pub struct AppConfig {
    /// API Server 監聽端口
    pub port: u16,
    /// ConvertX Web UI 後端地址
    pub backend_url: String,
    /// JWT 密鑰（必須與 Web UI 共用）
    pub jwt_secret: String,
    /// 最大檔案大小（bytes）
    pub max_file_size: u64,
    /// 上傳目錄
    pub upload_dir: String,
    /// 輸出目錄
    pub output_dir: String,
}

impl AppConfig {
    /// 從環境變數載入配置
    pub fn from_env() -> Self {
        Self {
            port: env::var("RAS_API_PORT")
                .unwrap_or_else(|_| "7890".to_string())
                .parse()
                .unwrap_or(7890),
            backend_url: env::var("CONVERTX_BACKEND_URL")
                .unwrap_or_else(|_| "http://convertx:3000".to_string()),
            jwt_secret: env::var("JWT_SECRET")
                .expect("JWT_SECRET environment variable is required"),
            max_file_size: env::var("MAX_FILE_SIZE")
                .unwrap_or_else(|_| "524288000".to_string()) // 500MB
                .parse()
                .unwrap_or(524288000),
            upload_dir: env::var("UPLOAD_DIR")
                .unwrap_or_else(|_| "./data/uploads".to_string()),
            output_dir: env::var("OUTPUT_DIR")
                .unwrap_or_else(|_| "./data/output".to_string()),
        }
    }
}
