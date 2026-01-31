//! 轉換引擎模組

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;

/// 引擎能力定義
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EngineCapability {
    /// 輸入格式
    pub input_format: String,
    /// 輸出格式列表
    pub output_formats: Vec<String>,
}

/// 轉換引擎定義
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Engine {
    /// 引擎 ID
    pub engine_id: String,
    /// 引擎名稱
    pub engine_name: String,
    /// 引擎描述
    pub description: String,
    /// 是否啟用
    pub enabled: bool,
    /// 支援的輸入格式
    pub input_formats: Vec<String>,
    /// 支援的輸出格式
    pub output_formats: Vec<String>,
    /// 最大檔案大小（MB）
    pub max_file_size_mb: u64,
    /// 是否需要額外參數
    pub requires_params: bool,
    /// 引擎參數說明
    #[serde(default)]
    pub params_schema: Option<serde_json::Value>,
}

impl Engine {
    /// 檢查是否支援指定的轉換
    pub fn supports_conversion(&self, input: &str, output: &str) -> bool {
        if !self.enabled {
            return false;
        }
        self.input_formats.iter().any(|f| f.eq_ignore_ascii_case(input))
            && self.output_formats.iter().any(|f| f.eq_ignore_ascii_case(output))
    }
}

/// 引擎資訊回應
#[derive(Debug, Clone, Serialize)]
pub struct EngineInfo {
    pub engine_id: String,
    pub engine_name: String,
    pub description: String,
    pub enabled: bool,
    pub input_formats: Vec<String>,
    pub output_formats: Vec<String>,
    pub max_file_size_mb: u64,
    pub requires_params: bool,
}

impl From<&Engine> for EngineInfo {
    fn from(engine: &Engine) -> Self {
        Self {
            engine_id: engine.engine_id.clone(),
            engine_name: engine.engine_name.clone(),
            description: engine.description.clone(),
            enabled: engine.enabled,
            input_formats: engine.input_formats.clone(),
            output_formats: engine.output_formats.clone(),
            max_file_size_mb: engine.max_file_size_mb,
            requires_params: engine.requires_params,
        }
    }
}

/// 引擎註冊表
#[derive(Clone)]
pub struct EngineRegistry {
    engines: Arc<RwLock<HashMap<String, Engine>>>,
}

impl EngineRegistry {
    /// 建立新的引擎註冊表（使用預設引擎）
    pub fn new() -> Self {
        let mut engines = HashMap::new();

        // 註冊預設引擎
        let default_engines = vec![
            Engine {
                engine_id: "ffmpeg".to_string(),
                engine_name: "FFmpeg".to_string(),
                description: "影音轉換引擎".to_string(),
                enabled: true,
                input_formats: vec![
                    "mp4", "avi", "mkv", "mov", "wmv", "flv", "webm",
                    "mp3", "wav", "flac", "aac", "ogg", "m4a",
                ].into_iter().map(String::from).collect(),
                output_formats: vec![
                    "mp4", "avi", "mkv", "mov", "webm", "gif",
                    "mp3", "wav", "flac", "aac", "ogg",
                ].into_iter().map(String::from).collect(),
                max_file_size_mb: 2000,
                requires_params: false,
                params_schema: None,
            },
            Engine {
                engine_id: "libreoffice".to_string(),
                engine_name: "LibreOffice".to_string(),
                description: "文件轉換引擎".to_string(),
                enabled: true,
                input_formats: vec![
                    "doc", "docx", "xls", "xlsx", "ppt", "pptx", "odt", "ods", "odp",
                ].into_iter().map(String::from).collect(),
                output_formats: vec![
                    "pdf", "docx", "xlsx", "pptx", "odt", "txt", "html",
                ].into_iter().map(String::from).collect(),
                max_file_size_mb: 100,
                requires_params: false,
                params_schema: None,
            },
            Engine {
                engine_id: "graphicsmagick".to_string(),
                engine_name: "GraphicsMagick".to_string(),
                description: "圖片轉換引擎".to_string(),
                enabled: true,
                input_formats: vec![
                    "jpg", "jpeg", "png", "gif", "bmp", "tiff", "webp", "svg",
                ].into_iter().map(String::from).collect(),
                output_formats: vec![
                    "jpg", "png", "gif", "bmp", "tiff", "webp", "pdf",
                ].into_iter().map(String::from).collect(),
                max_file_size_mb: 50,
                requires_params: false,
                params_schema: None,
            },
            Engine {
                engine_id: "pandoc".to_string(),
                engine_name: "Pandoc".to_string(),
                description: "文檔格式轉換引擎".to_string(),
                enabled: true,
                input_formats: vec![
                    "md", "markdown", "html", "docx", "rst", "tex", "epub",
                ].into_iter().map(String::from).collect(),
                output_formats: vec![
                    "pdf", "docx", "html", "md", "rst", "tex", "epub", "txt",
                ].into_iter().map(String::from).collect(),
                max_file_size_mb: 50,
                requires_params: false,
                params_schema: None,
            },
            Engine {
                engine_id: "ghostscript".to_string(),
                engine_name: "Ghostscript".to_string(),
                description: "PDF 處理引擎".to_string(),
                enabled: true,
                input_formats: vec!["pdf", "ps", "eps"].into_iter().map(String::from).collect(),
                output_formats: vec!["pdf", "png", "jpg", "tiff"].into_iter().map(String::from).collect(),
                max_file_size_mb: 200,
                requires_params: false,
                params_schema: None,
            },
            Engine {
                engine_id: "mineru".to_string(),
                engine_name: "MinerU".to_string(),
                description: "PDF 轉 Markdown 引擎（AI 驅動）".to_string(),
                enabled: true,
                input_formats: vec!["pdf"].into_iter().map(String::from).collect(),
                output_formats: vec!["md", "txt", "json"].into_iter().map(String::from).collect(),
                max_file_size_mb: 100,
                requires_params: true,
                params_schema: Some(serde_json::json!({
                    "type": "object",
                    "properties": {
                        "ocr": {
                            "type": "boolean",
                            "description": "啟用 OCR"
                        },
                        "lang": {
                            "type": "string",
                            "description": "OCR 語言（如 chi_tra, eng）"
                        }
                    }
                })),
            },
            Engine {
                engine_id: "babeldoc".to_string(),
                engine_name: "BabelDOC".to_string(),
                description: "PDF 翻譯引擎".to_string(),
                enabled: true,
                input_formats: vec!["pdf"].into_iter().map(String::from).collect(),
                output_formats: vec!["pdf"].into_iter().map(String::from).collect(),
                max_file_size_mb: 100,
                requires_params: true,
                params_schema: Some(serde_json::json!({
                    "type": "object",
                    "properties": {
                        "source_lang": {
                            "type": "string",
                            "description": "來源語言"
                        },
                        "target_lang": {
                            "type": "string",
                            "description": "目標語言"
                        }
                    },
                    "required": ["source_lang", "target_lang"]
                })),
            },
        ];

        for engine in default_engines {
            engines.insert(engine.engine_id.clone(), engine);
        }

        Self {
            engines: Arc::new(RwLock::new(engines)),
        }
    }

    /// 取得所有引擎
    pub async fn list_engines(&self) -> Vec<Engine> {
        let engines = self.engines.read().await;
        engines.values().cloned().collect()
    }

    /// 取得指定引擎
    pub async fn get_engine(&self, engine_id: &str) -> Option<Engine> {
        let engines = self.engines.read().await;
        engines.get(engine_id).cloned()
    }

    /// 檢查引擎是否存在且啟用
    pub async fn is_engine_available(&self, engine_id: &str) -> bool {
        let engines = self.engines.read().await;
        engines.get(engine_id).map(|e| e.enabled).unwrap_or(false)
    }

    /// 尋找支援指定轉換的引擎
    pub async fn find_engine_for_conversion(&self, input: &str, output: &str) -> Option<Engine> {
        let engines = self.engines.read().await;
        engines
            .values()
            .find(|e| e.supports_conversion(input, output))
            .cloned()
    }
}

impl Default for EngineRegistry {
    fn default() -> Self {
        Self::new()
    }
}
