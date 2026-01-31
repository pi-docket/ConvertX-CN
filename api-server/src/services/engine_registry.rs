//! Engine Registry - Manages all conversion engines
//!
//! 引擎註冊機制：新引擎只需實作 trait 並註冊，即可自動出現在 API 中。

use std::collections::HashMap;
use std::sync::RwLock;

use crate::models::{EngineInfo, EngineConversion};

/// Represents a conversion engine's capabilities
#[derive(Debug, Clone)]
pub struct Engine {
    /// Unique engine identifier
    pub id: String,
    /// Human-readable name
    pub name: String,
    /// Description
    pub description: String,
    /// Category (image, video, document, ai, etc.)
    pub category: String,
    /// Map of input format to supported output formats
    pub conversions: HashMap<String, Vec<String>>,
    /// Whether the engine is currently available
    pub available: bool,
}

impl Engine {
    /// Create a new engine
    pub fn new(id: &str, name: &str, description: &str, category: &str) -> Self {
        Self {
            id: id.to_string(),
            name: name.to_string(),
            description: description.to_string(),
            category: category.to_string(),
            conversions: HashMap::new(),
            available: true,
        }
    }

    /// Add a supported conversion
    pub fn add_conversion(mut self, from: &str, to_formats: Vec<&str>) -> Self {
        let from = from.to_lowercase();
        let to: Vec<String> = to_formats.iter().map(|s| s.to_lowercase()).collect();
        self.conversions.insert(from, to);
        self
    }

    /// Check if this engine supports a specific conversion
    pub fn supports_conversion(&self, from: &str, to: &str) -> bool {
        let from = from.to_lowercase();
        let to = to.to_lowercase();
        
        self.conversions
            .get(&from)
            .map(|outputs| outputs.contains(&to))
            .unwrap_or(false)
    }

    /// Get all supported input formats
    pub fn input_formats(&self) -> Vec<String> {
        self.conversions.keys().cloned().collect()
    }

    /// Get all supported output formats
    pub fn output_formats(&self) -> Vec<String> {
        let mut outputs: Vec<String> = self.conversions
            .values()
            .flatten()
            .cloned()
            .collect();
        outputs.sort();
        outputs.dedup();
        outputs
    }

    /// Get supported output formats for a given input format
    pub fn output_formats_for(&self, from: &str) -> Vec<String> {
        let from = from.to_lowercase();
        self.conversions
            .get(&from)
            .cloned()
            .unwrap_or_default()
    }

    /// Convert to EngineInfo for API response
    pub fn to_info(&self) -> EngineInfo {
        EngineInfo {
            id: self.id.clone(),
            name: self.name.clone(),
            description: self.description.clone(),
            category: self.category.clone(),
            supported_input_formats: self.input_formats(),
            supported_output_formats: self.output_formats(),
            available: self.available,
        }
    }

    /// Get all conversions as a list
    pub fn get_conversions(&self) -> Vec<EngineConversion> {
        self.conversions
            .iter()
            .flat_map(|(from, tos)| {
                tos.iter().map(move |to| EngineConversion {
                    from: from.clone(),
                    to: to.clone(),
                })
            })
            .collect()
    }
}

/// Registry of all available conversion engines
#[derive(Debug)]
pub struct EngineRegistry {
    engines: RwLock<HashMap<String, Engine>>,
}

impl EngineRegistry {
    /// Create a new engine registry with default engines
    pub fn new() -> Self {
        let registry = Self {
            engines: RwLock::new(HashMap::new()),
        };
        
        // Register all available engines
        registry.register_default_engines();
        
        registry
    }

    /// Register an engine
    pub fn register(&self, engine: Engine) {
        let mut engines = self.engines.write().unwrap();
        engines.insert(engine.id.clone(), engine);
    }

    /// Get an engine by ID
    pub fn get(&self, id: &str) -> Option<Engine> {
        let engines = self.engines.read().unwrap();
        engines.get(id).cloned()
    }

    /// List all engines
    pub fn list(&self) -> Vec<Engine> {
        let engines = self.engines.read().unwrap();
        engines.values().cloned().collect()
    }

    /// List all engine info for API response
    pub fn list_info(&self) -> Vec<EngineInfo> {
        self.list().into_iter().map(|e| e.to_info()).collect()
    }

    /// Find engines that support a specific conversion
    pub fn find_engines_for(&self, from: &str, to: &str) -> Vec<Engine> {
        let engines = self.engines.read().unwrap();
        engines
            .values()
            .filter(|e| e.available && e.supports_conversion(from, to))
            .cloned()
            .collect()
    }

    /// Get all supported input formats across all engines
    pub fn all_input_formats(&self) -> Vec<String> {
        let engines = self.engines.read().unwrap();
        let mut formats: Vec<String> = engines
            .values()
            .flat_map(|e| e.input_formats())
            .collect();
        formats.sort();
        formats.dedup();
        formats
    }

    /// Get all supported output formats across all engines
    pub fn all_output_formats(&self) -> Vec<String> {
        let engines = self.engines.read().unwrap();
        let mut formats: Vec<String> = engines
            .values()
            .flat_map(|e| e.output_formats())
            .collect();
        formats.sort();
        formats.dedup();
        formats
    }

    /// Get possible output formats for a given input format
    pub fn get_targets_for(&self, from: &str) -> HashMap<String, Vec<String>> {
        let engines = self.engines.read().unwrap();
        let from = from.to_lowercase();
        
        let mut result: HashMap<String, Vec<String>> = HashMap::new();
        
        for engine in engines.values() {
            if let Some(outputs) = engine.conversions.get(&from) {
                if !outputs.is_empty() {
                    result.insert(engine.id.clone(), outputs.clone());
                }
            }
        }
        
        result
    }

    /// Register default engines based on ConvertX converters
    fn register_default_engines(&self) {
        // FFmpeg - Audio/Video conversion
        let ffmpeg = Engine::new(
            "ffmpeg",
            "FFmpeg",
            "Audio and video conversion using FFmpeg",
            "media"
        )
        .add_conversion("mp4", vec!["webm", "avi", "mkv", "mov", "mp3", "wav", "flac", "ogg", "gif"])
        .add_conversion("webm", vec!["mp4", "avi", "mkv", "mov", "mp3", "wav", "flac", "ogg", "gif"])
        .add_conversion("avi", vec!["mp4", "webm", "mkv", "mov", "mp3", "wav", "flac", "ogg", "gif"])
        .add_conversion("mkv", vec!["mp4", "webm", "avi", "mov", "mp3", "wav", "flac", "ogg", "gif"])
        .add_conversion("mov", vec!["mp4", "webm", "avi", "mkv", "mp3", "wav", "flac", "ogg", "gif"])
        .add_conversion("mp3", vec!["wav", "flac", "ogg", "m4a", "aac"])
        .add_conversion("wav", vec!["mp3", "flac", "ogg", "m4a", "aac"])
        .add_conversion("flac", vec!["mp3", "wav", "ogg", "m4a", "aac"])
        .add_conversion("ogg", vec!["mp3", "wav", "flac", "m4a", "aac"])
        .add_conversion("m4a", vec!["mp3", "wav", "flac", "ogg", "aac"])
        .add_conversion("gif", vec!["mp4", "webm"]);
        self.register(ffmpeg);

        // ImageMagick - Image conversion
        let imagemagick = Engine::new(
            "imagemagick",
            "ImageMagick",
            "Image format conversion using ImageMagick",
            "image"
        )
        .add_conversion("png", vec!["jpg", "jpeg", "gif", "bmp", "webp", "tiff", "ico", "pdf"])
        .add_conversion("jpg", vec!["png", "gif", "bmp", "webp", "tiff", "ico", "pdf"])
        .add_conversion("jpeg", vec!["png", "gif", "bmp", "webp", "tiff", "ico", "pdf"])
        .add_conversion("gif", vec!["png", "jpg", "jpeg", "bmp", "webp", "tiff"])
        .add_conversion("bmp", vec!["png", "jpg", "jpeg", "gif", "webp", "tiff"])
        .add_conversion("webp", vec!["png", "jpg", "jpeg", "gif", "bmp", "tiff"])
        .add_conversion("tiff", vec!["png", "jpg", "jpeg", "gif", "bmp", "webp", "pdf"])
        .add_conversion("svg", vec!["png", "jpg", "jpeg", "pdf"]);
        self.register(imagemagick);

        // LibreOffice - Document conversion
        let libreoffice = Engine::new(
            "libreoffice",
            "LibreOffice",
            "Office document conversion using LibreOffice",
            "document"
        )
        .add_conversion("doc", vec!["pdf", "docx", "odt", "txt", "html"])
        .add_conversion("docx", vec!["pdf", "doc", "odt", "txt", "html"])
        .add_conversion("odt", vec!["pdf", "doc", "docx", "txt", "html"])
        .add_conversion("xls", vec!["pdf", "xlsx", "ods", "csv"])
        .add_conversion("xlsx", vec!["pdf", "xls", "ods", "csv"])
        .add_conversion("ods", vec!["pdf", "xls", "xlsx", "csv"])
        .add_conversion("ppt", vec!["pdf", "pptx", "odp"])
        .add_conversion("pptx", vec!["pdf", "ppt", "odp"])
        .add_conversion("odp", vec!["pdf", "ppt", "pptx"])
        .add_conversion("txt", vec!["pdf", "html"]);
        self.register(libreoffice);

        // Pandoc - Universal document converter
        let pandoc = Engine::new(
            "pandoc",
            "Pandoc",
            "Universal document converter",
            "document"
        )
        .add_conversion("md", vec!["html", "pdf", "docx", "latex", "epub", "rst"])
        .add_conversion("html", vec!["md", "pdf", "docx", "latex", "epub"])
        .add_conversion("latex", vec!["pdf", "html", "md", "docx"])
        .add_conversion("rst", vec!["html", "pdf", "md", "docx"])
        .add_conversion("epub", vec!["pdf", "html", "md"]);
        self.register(pandoc);

        // Calibre - E-book conversion
        let calibre = Engine::new(
            "calibre",
            "Calibre",
            "E-book format conversion",
            "ebook"
        )
        .add_conversion("epub", vec!["mobi", "azw3", "pdf", "txt", "html"])
        .add_conversion("mobi", vec!["epub", "azw3", "pdf", "txt", "html"])
        .add_conversion("azw3", vec!["epub", "mobi", "pdf", "txt", "html"])
        .add_conversion("pdf", vec!["epub", "mobi", "txt", "html"]);
        self.register(calibre);

        // MinerU - AI PDF extraction
        let mineru = Engine::new(
            "mineru",
            "MinerU",
            "AI-powered PDF extraction and parsing",
            "ai"
        )
        .add_conversion("pdf", vec!["md", "json", "html"]);
        self.register(mineru);

        // PDFMathTranslate - PDF translation with math preservation
        let pdfmathtranslate = Engine::new(
            "pdfmathtranslate",
            "PDFMathTranslate",
            "PDF translation preserving mathematical formulas",
            "ai"
        )
        .add_conversion("pdf", vec!["pdf"]);
        self.register(pdfmathtranslate);

        // OCRmyPDF - PDF OCR
        let ocrmypdf = Engine::new(
            "ocrmypdf",
            "OCRmyPDF",
            "Add OCR text layer to PDF",
            "ai"
        )
        .add_conversion("pdf", vec!["pdf"]);
        self.register(ocrmypdf);

        // dasel - Data format conversion
        let dasel = Engine::new(
            "dasel",
            "Dasel",
            "Data format conversion (JSON/YAML/TOML)",
            "data"
        )
        .add_conversion("json", vec!["yaml", "toml", "xml", "csv"])
        .add_conversion("yaml", vec!["json", "toml", "xml"])
        .add_conversion("toml", vec!["json", "yaml", "xml"])
        .add_conversion("xml", vec!["json", "yaml"]);
        self.register(dasel);
    }
}

impl Default for EngineRegistry {
    fn default() -> Self {
        Self::new()
    }
}

impl Clone for EngineRegistry {
    fn clone(&self) -> Self {
        let engines = self.engines.read().unwrap();
        let new_registry = Self {
            engines: RwLock::new(engines.clone()),
        };
        new_registry
    }
}
