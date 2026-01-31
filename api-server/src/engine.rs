//! 轉換引擎模組
//!
//! 完整支援所有 Web UI 的轉換引擎

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
    /// 完整支援所有 Web UI 的轉換引擎
    pub fn new() -> Self {
        let mut engines = HashMap::new();

        // =====================================================================
        // 完整引擎清單（與 Web UI src/converters/ 同步）
        // =====================================================================
        let default_engines = vec![
            // -----------------------------------------------------------------
            // FFmpeg - 影音轉換引擎
            // -----------------------------------------------------------------
            Engine {
                engine_id: "ffmpeg".to_string(),
                engine_name: "FFmpeg".to_string(),
                description: "影音轉換引擎 (v7.1.1)".to_string(),
                enabled: true,
                input_formats: vec![
                    // 影片格式
                    "264", "265", "3g2", "3gp", "avi", "f4v", "flv", "h264", "h265",
                    "m2ts", "m4v", "mkv", "mov", "mp4", "mpeg", "mpg", "mts", "mxf",
                    "ogv", "rm", "rmvb", "ts", "vob", "webm", "wmv",
                    // 音訊格式
                    "aac", "ac3", "aiff", "ape", "au", "flac", "m4a", "mp3", "oga",
                    "ogg", "opus", "ra", "wav", "wma", "wv",
                    // 圖片序列
                    "apng", "gif",
                ].into_iter().map(String::from).collect(),
                output_formats: vec![
                    // 影片輸出
                    "avi", "flv", "gif", "m4v", "mkv", "mov", "mp4", "mpeg", "ogv",
                    "ts", "webm", "wmv",
                    // 音訊輸出
                    "aac", "ac3", "aiff", "flac", "m4a", "mp3", "oga", "ogg", "opus",
                    "wav", "wma",
                ].into_iter().map(String::from).collect(),
                max_file_size_mb: 4000,
                requires_params: false,
                params_schema: None,
            },
            // -----------------------------------------------------------------
            // LibreOffice - 文件轉換引擎
            // -----------------------------------------------------------------
            Engine {
                engine_id: "libreoffice".to_string(),
                engine_name: "LibreOffice".to_string(),
                description: "文件轉換引擎 (v25.8.4)".to_string(),
                enabled: true,
                input_formats: vec![
                    "602", "abw", "csv", "cwk", "doc", "docm", "docx", "dot", "dotx",
                    "dotm", "epub", "fb2", "fodt", "htm", "html", "hwp", "mcw", "mw",
                    "mwd", "lwp", "lrf", "odt", "ott", "pages", "pdf", "psw", "rtf",
                    "sdw", "stw", "sxw", "tab", "tsv", "txt", "wn", "wpd", "wps",
                    "wpt", "wri", "xhtml", "xml", "zabw",
                ].into_iter().map(String::from).collect(),
                output_formats: vec![
                    "csv", "doc", "docm", "docx", "dot", "dotx", "epub", "fb2", "fodt",
                    "html", "odt", "ott", "pdf", "rtf", "sdw", "sxw", "txt", "xhtml",
                ].into_iter().map(String::from).collect(),
                max_file_size_mb: 200,
                requires_params: false,
                params_schema: None,
            },
            // -----------------------------------------------------------------
            // Pandoc - 文檔格式轉換引擎
            // -----------------------------------------------------------------
            Engine {
                engine_id: "pandoc".to_string(),
                engine_name: "Pandoc".to_string(),
                description: "文檔格式轉換引擎 (v3.8.3)".to_string(),
                enabled: true,
                input_formats: vec![
                    "asciidoc", "biblatex", "bibtex", "bits", "commonmark", "commonmark_x",
                    "creole", "csljson", "csv", "djot", "docbook", "docx", "dokuwiki",
                    "endnotexml", "epub", "fb2", "gfm", "haddock", "html", "ipynb",
                    "jats", "jira", "json", "latex", "man", "markdown", "markdown_mmd",
                    "markdown_phpextra", "markdown_strict", "mediawiki", "muse", "opml",
                    "org", "pptx", "ris", "rst", "rtf", "t2t", "tex", "textile",
                    "tikiwiki", "tsv", "twiki", "typst", "vimwiki", "xlsx", "xml",
                ].into_iter().map(String::from).collect(),
                output_formats: vec![
                    "asciidoc", "asciidoc_legacy", "asciidoctor", "bbcode", "bbcode_steam",
                    "bbcode_fluxbb", "bbcode_phpbb", "bbcode_hubzilla", "bbcode_xenforo",
                    "beamer", "biblatex", "bibtex", "chunkedhtml", "commonmark", "commonmark_x",
                    "context", "csljson", "djot", "docbook", "docbook4", "docbook5", "docx",
                    "dokuwiki", "dzslides", "epub", "epub2", "epub3", "fb2", "gfm", "haddock",
                    "html", "html4", "html5", "icml", "ipynb", "jats", "jats_archiving",
                    "jats_articleauthoring", "jats_publishing", "jira", "json", "latex",
                    "man", "markdown", "markdown_mmd", "markdown_phpextra", "markdown_strict",
                    "markua", "mediawiki", "ms", "muse", "odt", "opendocument", "opml", "org",
                    "pdf", "plain", "pptx", "revealjs", "rst", "rtf", "s5", "slideous",
                    "slidy", "tei", "texinfo", "textile", "txt", "typst", "vimdoc", "xwiki",
                    "xml", "zimwiki",
                ].into_iter().map(String::from).collect(),
                max_file_size_mb: 100,
                requires_params: false,
                params_schema: None,
            },
            // -----------------------------------------------------------------
            // ImageMagick - 圖片轉換引擎
            // -----------------------------------------------------------------
            Engine {
                engine_id: "imagemagick".to_string(),
                engine_name: "ImageMagick".to_string(),
                description: "圖片轉換引擎 (v7.1.2)".to_string(),
                enabled: true,
                input_formats: vec![
                    "3fr", "ai", "apng", "arw", "avif", "bmp", "cin", "cr2", "cr3", "crw",
                    "cur", "dcm", "dcr", "dds", "dng", "dpx", "emf", "eps", "erf", "exr",
                    "gif", "heic", "heif", "ico", "j2c", "j2k", "jng", "jp2", "jpeg", "jpg",
                    "jxl", "kdc", "mef", "miff", "mng", "mrw", "nef", "nrw", "orf", "pbm",
                    "pcx", "pdf", "pef", "pgm", "png", "pnm", "ppm", "psd", "raf", "raw",
                    "rw2", "sgi", "sr2", "srf", "svg", "tga", "tif", "tiff", "webp", "wmf",
                    "x3f", "xcf", "xpm",
                ].into_iter().map(String::from).collect(),
                output_formats: vec![
                    "avif", "bmp", "cin", "dds", "dpx", "eps", "exr", "gif", "heic", "heif",
                    "ico", "j2c", "j2k", "jng", "jp2", "jpeg", "jpg", "jxl", "miff", "mng",
                    "pbm", "pcx", "pdf", "pgm", "png", "pnm", "ppm", "psd", "sgi", "tga",
                    "tif", "tiff", "webp", "xpm",
                ].into_iter().map(String::from).collect(),
                max_file_size_mb: 500,
                requires_params: false,
                params_schema: None,
            },
            // -----------------------------------------------------------------
            // GraphicsMagick - 圖片轉換引擎
            // -----------------------------------------------------------------
            Engine {
                engine_id: "graphicsmagick".to_string(),
                engine_name: "GraphicsMagick".to_string(),
                description: "圖片轉換引擎".to_string(),
                enabled: true,
                input_formats: vec![
                    "3fr", "art", "arw", "avs", "bmp", "cin", "cmyk", "cr2", "crw", "cur",
                    "cut", "dcm", "dcr", "dcx", "dng", "dpx", "epi", "eps", "epsf", "epsi",
                    "ept", "erf", "exr", "fax", "fits", "gif", "gray", "heic", "heif", "hrz",
                    "ico", "jbg", "jbig", "jng", "jp2", "jpeg", "jpg", "jxl", "k25", "kdc",
                    "mac", "map", "mat", "mef", "miff", "mng", "mono", "mrw", "mtv", "nef",
                    "nrw", "orf", "pbm", "pcd", "pcx", "pdf", "pef", "pgm", "png", "pnm",
                    "ppm", "psd", "raf", "raw", "rle", "rw2", "sgi", "sr2", "srf", "sun",
                    "svg", "tga", "tif", "tiff", "webp", "wmf", "x3f", "xbm", "xcf", "xpm",
                ].into_iter().map(String::from).collect(),
                output_formats: vec![
                    "avif", "bmp", "cin", "dpx", "eps", "gif", "gray", "heic", "heif", "ico",
                    "jng", "jp2", "jpeg", "jpg", "jxl", "miff", "mng", "mono", "pbm", "pcd",
                    "pcx", "pdf", "pgm", "png", "pnm", "ppm", "psd", "sgi", "sun", "tga",
                    "tif", "tiff", "webp", "xbm", "xpm",
                ].into_iter().map(String::from).collect(),
                max_file_size_mb: 500,
                requires_params: false,
                params_schema: None,
            },
            // -----------------------------------------------------------------
            // libvips - 高效能圖片處理引擎
            // -----------------------------------------------------------------
            Engine {
                engine_id: "vips".to_string(),
                engine_name: "libvips".to_string(),
                description: "高效能圖片處理引擎 (v8.18.0)".to_string(),
                enabled: true,
                input_formats: vec![
                    "avif", "bif", "cr2", "cr3", "csv", "dcraw", "dng", "exr", "fits",
                    "gif", "hdr", "heic", "heif", "j2c", "j2k", "jp2", "jpeg", "jpx",
                    "jxl", "mat", "mrxs", "ndpi", "nef", "arw", "nii", "pdf", "pfm",
                    "pgm", "pic", "png", "ppm", "raw", "scn", "svg", "svs", "svslide",
                    "szi", "tif", "tiff", "uhdr", "v", "vips", "vms", "vmu", "webp", "zip",
                ].into_iter().map(String::from).collect(),
                output_formats: vec![
                    "avif", "dzi", "fits", "gif", "hdr", "heic", "heif", "j2c", "j2k",
                    "jp2", "jpeg", "jpg", "jxl", "mat", "nia", "nii", "pdf", "pfm",
                    "pgm", "png", "ppm", "raw", "szi", "tif", "tiff", "uhdr", "v",
                    "vips", "webp",
                ].into_iter().map(String::from).collect(),
                max_file_size_mb: 1000,
                requires_params: false,
                params_schema: None,
            },
            // -----------------------------------------------------------------
            // Inkscape - 向量圖形編輯器
            // -----------------------------------------------------------------
            Engine {
                engine_id: "inkscape".to_string(),
                engine_name: "Inkscape".to_string(),
                description: "向量圖形轉換引擎".to_string(),
                enabled: true,
                input_formats: vec![
                    "svg", "pdf", "eps", "ps", "wmf", "emf", "png",
                ].into_iter().map(String::from).collect(),
                output_formats: vec![
                    "dxf", "emf", "eps", "fxg", "gpl", "hpgl", "html", "odg", "pdf",
                    "png", "pov", "ps", "sif", "svg", "svgz", "tex", "wmf",
                ].into_iter().map(String::from).collect(),
                max_file_size_mb: 100,
                requires_params: false,
                params_schema: None,
            },
            // -----------------------------------------------------------------
            // Calibre - 電子書轉換引擎
            // -----------------------------------------------------------------
            Engine {
                engine_id: "calibre".to_string(),
                engine_name: "Calibre".to_string(),
                description: "電子書轉換引擎".to_string(),
                enabled: true,
                input_formats: vec![
                    "azw4", "cb7", "cba", "cbr", "cbt", "cbz", "chm", "djvu", "docx",
                    "epub", "fb2", "htlz", "html", "lit", "lrf", "mobi", "odt", "pdb",
                    "pdf", "pml", "rb", "recipe", "rtf", "snb", "tcr", "txt",
                ].into_iter().map(String::from).collect(),
                output_formats: vec![
                    "azw3", "docx", "epub", "fb2", "html", "htmlz", "kepub.epub", "lit",
                    "lrf", "mobi", "oeb", "pdb", "pdf", "pml", "rb", "rtf", "snb",
                    "tcr", "txt", "txtz",
                ].into_iter().map(String::from).collect(),
                max_file_size_mb: 500,
                requires_params: false,
                params_schema: None,
            },
            // -----------------------------------------------------------------
            // MinerU - PDF 轉 Markdown 引擎（AI 驅動）
            // -----------------------------------------------------------------
            Engine {
                engine_id: "mineru".to_string(),
                engine_name: "MinerU".to_string(),
                description: "PDF 轉 Markdown 引擎（AI 驅動）".to_string(),
                enabled: true,
                input_formats: vec![
                    "pdf", "ppt", "pptx", "xls", "xlsx", "doc", "docx",
                ].into_iter().map(String::from).collect(),
                output_formats: vec![
                    "md-t", "md-i",
                ].into_iter().map(String::from).collect(),
                max_file_size_mb: 200,
                requires_params: true,
                params_schema: Some(serde_json::json!({
                    "type": "object",
                    "properties": {
                        "method": {
                            "type": "string",
                            "enum": ["auto", "txt", "ocr"],
                            "description": "解析方法"
                        }
                    }
                })),
            },
            // -----------------------------------------------------------------
            // BabelDOC - PDF 翻譯引擎
            // -----------------------------------------------------------------
            Engine {
                engine_id: "babeldoc".to_string(),
                engine_name: "BabelDOC".to_string(),
                description: "PDF 翻譯引擎（支援多語言）".to_string(),
                enabled: true,
                input_formats: vec!["pdf"].into_iter().map(String::from).collect(),
                output_formats: generate_translation_outputs("pdf"),
                max_file_size_mb: 200,
                requires_params: true,
                params_schema: Some(serde_json::json!({
                    "type": "object",
                    "properties": {
                        "target_lang": {
                            "type": "string",
                            "enum": ["en", "zh", "zh-TW", "ja", "ko", "de", "fr", "es", "it", "pt", "ru", "ar", "hi", "vi", "th"],
                            "description": "目標語言"
                        }
                    },
                    "required": ["target_lang"]
                })),
            },
            // -----------------------------------------------------------------
            // PDFMathTranslate - PDF 數學公式翻譯引擎
            // -----------------------------------------------------------------
            Engine {
                engine_id: "pdfmathtranslate".to_string(),
                engine_name: "PDFMathTranslate".to_string(),
                description: "PDF 數學公式翻譯引擎".to_string(),
                enabled: true,
                input_formats: vec!["pdf"].into_iter().map(String::from).collect(),
                output_formats: generate_translation_outputs("pdf"),
                max_file_size_mb: 200,
                requires_params: true,
                params_schema: Some(serde_json::json!({
                    "type": "object",
                    "properties": {
                        "target_lang": {
                            "type": "string",
                            "enum": ["en", "zh", "zh-TW", "ja", "ko", "de", "fr", "es", "it", "pt", "ru", "ar", "hi", "vi", "th"],
                            "description": "目標語言"
                        }
                    },
                    "required": ["target_lang"]
                })),
            },
            // -----------------------------------------------------------------
            // OCRmyPDF - PDF OCR 引擎
            // -----------------------------------------------------------------
            Engine {
                engine_id: "ocrmypdf".to_string(),
                engine_name: "OCRmyPDF".to_string(),
                description: "PDF OCR 引擎（掃描版 PDF 轉可搜尋 PDF）".to_string(),
                enabled: true,
                input_formats: vec!["pdf"].into_iter().map(String::from).collect(),
                output_formats: vec![
                    "pdf-ocr", "pdf-en", "pdf-zh-TW", "pdf-zh", "pdf-ja", "pdf-ko", "pdf-de", "pdf-fr",
                ].into_iter().map(String::from).collect(),
                max_file_size_mb: 500,
                requires_params: true,
                params_schema: Some(serde_json::json!({
                    "type": "object",
                    "properties": {
                        "lang": {
                            "type": "string",
                            "enum": ["ocr", "en", "zh-TW", "zh", "ja", "ko", "de", "fr"],
                            "description": "OCR 語言（ocr=自動檢測）"
                        }
                    }
                })),
            },
            // -----------------------------------------------------------------
            // PDF Packager - PDF 打包引擎
            // -----------------------------------------------------------------
            Engine {
                engine_id: "pdfpackager".to_string(),
                engine_name: "PDF Packager".to_string(),
                description: "PDF 打包引擎（圖片化、PDF/A、簽章）".to_string(),
                enabled: true,
                input_formats: vec!["pdf"].into_iter().map(String::from).collect(),
                output_formats: generate_pdfpackager_outputs(),
                max_file_size_mb: 500,
                requires_params: true,
                params_schema: Some(serde_json::json!({
                    "type": "object",
                    "properties": {
                        "chip": {
                            "type": "string",
                            "description": "輸出選項 (如 png-300, pdf-300-p, pdfa1b-i-300)"
                        }
                    },
                    "required": ["chip"]
                })),
            },
            // -----------------------------------------------------------------
            // MarkitDown - 文件轉 Markdown 引擎
            // -----------------------------------------------------------------
            Engine {
                engine_id: "markitdown".to_string(),
                engine_name: "MarkitDown".to_string(),
                description: "文件轉 Markdown 引擎（Microsoft）".to_string(),
                enabled: true,
                input_formats: vec![
                    "pdf", "powerpoint", "excel", "docx", "pptx", "html",
                ].into_iter().map(String::from).collect(),
                output_formats: vec!["md"].into_iter().map(String::from).collect(),
                max_file_size_mb: 100,
                requires_params: false,
                params_schema: None,
            },
            // -----------------------------------------------------------------
            // libheif - HEIF/AVIF 轉換引擎
            // -----------------------------------------------------------------
            Engine {
                engine_id: "libheif".to_string(),
                engine_name: "libheif".to_string(),
                description: "HEIF/AVIF 轉換引擎".to_string(),
                enabled: true,
                input_formats: vec![
                    "avci", "avcs", "avif", "h264", "heic", "heics", "heif", "heifs", "hif", "mkv", "mp4",
                ].into_iter().map(String::from).collect(),
                output_formats: vec!["jpeg", "png", "y4m"].into_iter().map(String::from).collect(),
                max_file_size_mb: 200,
                requires_params: false,
                params_schema: None,
            },
            // -----------------------------------------------------------------
            // libjxl - JPEG XL 轉換引擎
            // -----------------------------------------------------------------
            Engine {
                engine_id: "libjxl".to_string(),
                engine_name: "libjxl".to_string(),
                description: "JPEG XL 轉換引擎".to_string(),
                enabled: true,
                input_formats: vec![
                    "jxl", "apng", "exr", "gif", "jpeg", "pam", "pfm", "pgm", "pgx", "png", "ppm",
                ].into_iter().map(String::from).collect(),
                output_formats: vec![
                    "jxl", "apng", "exr", "jpeg", "pam", "pfm", "pgm", "pgx", "png", "ppm",
                ].into_iter().map(String::from).collect(),
                max_file_size_mb: 200,
                requires_params: false,
                params_schema: None,
            },
            // -----------------------------------------------------------------
            // resvg - SVG 轉 PNG 引擎
            // -----------------------------------------------------------------
            Engine {
                engine_id: "resvg".to_string(),
                engine_name: "resvg".to_string(),
                description: "SVG 轉 PNG 引擎（高品質渲染）".to_string(),
                enabled: true,
                input_formats: vec!["svg"].into_iter().map(String::from).collect(),
                output_formats: vec!["png"].into_iter().map(String::from).collect(),
                max_file_size_mb: 50,
                requires_params: false,
                params_schema: None,
            },
            // -----------------------------------------------------------------
            // Potrace - 點陣轉向量引擎
            // -----------------------------------------------------------------
            Engine {
                engine_id: "potrace".to_string(),
                engine_name: "Potrace".to_string(),
                description: "點陣轉向量引擎".to_string(),
                enabled: true,
                input_formats: vec![
                    "pnm", "pbm", "pgm", "bmp",
                ].into_iter().map(String::from).collect(),
                output_formats: vec![
                    "svg", "pdf", "pdfpage", "eps", "postscript", "ps", "dxf", "geojson", "pgm", "gimppath", "xfig",
                ].into_iter().map(String::from).collect(),
                max_file_size_mb: 50,
                requires_params: false,
                params_schema: None,
            },
            // -----------------------------------------------------------------
            // VTracer - 圖片轉 SVG 引擎
            // -----------------------------------------------------------------
            Engine {
                engine_id: "vtracer".to_string(),
                engine_name: "VTracer".to_string(),
                description: "圖片轉 SVG 引擎（AI 驅動）".to_string(),
                enabled: true,
                input_formats: vec![
                    "jpg", "jpeg", "png", "bmp", "gif", "tiff", "tif", "webp",
                ].into_iter().map(String::from).collect(),
                output_formats: vec!["svg"].into_iter().map(String::from).collect(),
                max_file_size_mb: 50,
                requires_params: false,
                params_schema: None,
            },
            // -----------------------------------------------------------------
            // Assimp - 3D 模型轉換引擎
            // -----------------------------------------------------------------
            Engine {
                engine_id: "assimp".to_string(),
                engine_name: "Assimp".to_string(),
                description: "3D 模型轉換引擎".to_string(),
                enabled: true,
                input_formats: vec![
                    "3d", "3ds", "3mf", "ac", "ac3d", "acc", "amf", "amj", "ase", "ask",
                    "assbin", "b3d", "blend", "bsp", "bvh", "cob", "csm", "dae", "dxf",
                    "enff", "fbx", "glb", "gltf", "hmb", "hmp", "ifc", "ifczip", "iqm",
                    "irr", "irrmesh", "lwo", "lws", "lxo", "m3d", "md2", "md3", "md5anim",
                    "md5camera", "md5mesh", "mdc", "mdl", "mesh", "mesh.xml", "mot", "ms3d",
                    "ndo", "nff", "obj", "off", "ogex", "pk3", "ply", "pmx", "prj", "q3o",
                    "q3s", "raw", "scn", "sib", "smd", "step", "stl", "stp", "ter", "uc",
                    "usd", "usda", "usdc", "usdz", "vta", "x", "x3d", "x3db", "xgl", "xml",
                    "zae", "zgl",
                ].into_iter().map(String::from).collect(),
                output_formats: vec![
                    "3ds", "3mf", "assbin", "assjson", "assxml", "collada", "dae", "fbx",
                    "fbxa", "glb", "glb2", "gltf", "gltf2", "obj", "objnomtl", "pbrt", "ply",
                    "plyb", "stp", "stl", "stlb", "x", "x3d",
                ].into_iter().map(String::from).collect(),
                max_file_size_mb: 500,
                requires_params: false,
                params_schema: None,
            },
            // -----------------------------------------------------------------
            // Dasel - 資料格式轉換引擎
            // -----------------------------------------------------------------
            Engine {
                engine_id: "dasel".to_string(),
                engine_name: "Dasel".to_string(),
                description: "資料格式轉換引擎 (YAML/JSON/TOML/XML/CSV)".to_string(),
                enabled: true,
                input_formats: vec![
                    "yaml", "toml", "json", "xml", "csv",
                ].into_iter().map(String::from).collect(),
                output_formats: vec![
                    "yaml", "toml", "json", "csv",
                ].into_iter().map(String::from).collect(),
                max_file_size_mb: 50,
                requires_params: false,
                params_schema: None,
            },
            // -----------------------------------------------------------------
            // XeLaTeX - LaTeX 轉 PDF 引擎
            // -----------------------------------------------------------------
            Engine {
                engine_id: "xelatex".to_string(),
                engine_name: "XeLaTeX".to_string(),
                description: "LaTeX 轉 PDF 引擎".to_string(),
                enabled: true,
                input_formats: vec!["tex", "latex"].into_iter().map(String::from).collect(),
                output_formats: vec!["pdf"].into_iter().map(String::from).collect(),
                max_file_size_mb: 50,
                requires_params: false,
                params_schema: None,
            },
            // -----------------------------------------------------------------
            // dvisvgm - DVI/PDF/EPS 轉 SVG 引擎
            // -----------------------------------------------------------------
            Engine {
                engine_id: "dvisvgm".to_string(),
                engine_name: "dvisvgm".to_string(),
                description: "DVI/PDF/EPS 轉 SVG 引擎".to_string(),
                enabled: true,
                input_formats: vec!["dvi", "xdv", "pdf", "eps"].into_iter().map(String::from).collect(),
                output_formats: vec!["svg", "svgz"].into_iter().map(String::from).collect(),
                max_file_size_mb: 100,
                requires_params: false,
                params_schema: None,
            },
            // -----------------------------------------------------------------
            // msgconvert - MSG 轉 EML 引擎
            // -----------------------------------------------------------------
            Engine {
                engine_id: "msgconvert".to_string(),
                engine_name: "msgconvert".to_string(),
                description: "Outlook MSG 轉 EML 引擎".to_string(),
                enabled: true,
                input_formats: vec!["msg"].into_iter().map(String::from).collect(),
                output_formats: vec!["eml"].into_iter().map(String::from).collect(),
                max_file_size_mb: 50,
                requires_params: false,
                params_schema: None,
            },
            // -----------------------------------------------------------------
            // VCF - 聯絡人轉換引擎
            // -----------------------------------------------------------------
            Engine {
                engine_id: "vcf".to_string(),
                engine_name: "VCF Converter".to_string(),
                description: "聯絡人 VCF 轉 CSV 引擎".to_string(),
                enabled: true,
                input_formats: vec!["vcf"].into_iter().map(String::from).collect(),
                output_formats: vec!["csv"].into_iter().map(String::from).collect(),
                max_file_size_mb: 10,
                requires_params: false,
                params_schema: None,
            },
            // -----------------------------------------------------------------
            // Deark - 古董格式解碼引擎
            // -----------------------------------------------------------------
            Engine {
                engine_id: "deark".to_string(),
                engine_name: "Deark".to_string(),
                description: "古董格式解碼引擎（壓縮檔、舊圖片格式）".to_string(),
                enabled: true,
                input_formats: vec![
                    "zip", "lha", "lzh", "arc", "arj", "zoo", "z", "gz", "bz2", "xz", "cab",
                    "sit", "sitx", "hqx", "bin", "macbin", "cpio", "rpm", "deb", "ar",
                    "ico", "cur", "ani", "icns", "bmp", "dib", "pcx", "dcx", "pict", "pic",
                    "pct", "wmf", "emf", "gem", "img", "mac", "msp", "iff", "ilbm", "lbm",
                    "xbm", "xpm", "ras", "sun", "tga", "vst", "icb", "vda", "sgi", "rgb",
                    "psd", "xcf", "ora", "kra", "psp", "jbig", "jbg", "fpx", "fon", "fnt",
                    "psf", "bdf", "pcf", "exe", "dll", "com", "ne", "mz",
                ].into_iter().map(String::from).collect(),
                output_formats: vec![
                    "png", "bmp", "tiff", "gif",
                ].into_iter().map(String::from).collect(),
                max_file_size_mb: 200,
                requires_params: false,
                params_schema: None,
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
        let mut result: Vec<Engine> = engines.values().cloned().collect();
        // 按 engine_id 排序
        result.sort_by(|a, b| a.engine_id.cmp(&b.engine_id));
        result
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

// =============================================================================
// 輔助函數
// =============================================================================

/// 產生翻譯引擎的輸出格式
fn generate_translation_outputs(format: &str) -> Vec<String> {
    let langs = ["en", "zh", "zh-TW", "ja", "ko", "de", "fr", "es", "it", "pt", "ru", "ar", "hi", "vi", "th"];
    langs.iter().map(|lang| format!("{}-{}", format, lang)).collect()
}

/// 產生 PDF Packager 的輸出格式
fn generate_pdfpackager_outputs() -> Vec<String> {
    let mut outputs = Vec::new();
    
    // 圖片輸出
    for fmt in ["png", "jpg", "jpeg"] {
        for dpi in ["150", "300", "600"] {
            outputs.push(format!("{}-{}", fmt, dpi));
        }
    }
    
    // PDF 輸出
    for dpi in ["150", "300", "600"] {
        outputs.push(format!("pdf-{}", dpi));
        outputs.push(format!("pdf-{}-p", dpi));
        outputs.push(format!("pdf-{}-np", dpi));
        outputs.push(format!("pdf-{}-s", dpi));
        outputs.push(format!("pdf-{}-p-s", dpi));
        outputs.push(format!("pdf-{}-np-s", dpi));
    }
    
    // PDF/A-1b 輸出
    for source in ["i", "o"] {
        for dpi in ["150", "300", "600"] {
            outputs.push(format!("pdfa1b-{}-{}", source, dpi));
            outputs.push(format!("pdfa1b-{}-{}-p", source, dpi));
            outputs.push(format!("pdfa1b-{}-{}-np", source, dpi));
            outputs.push(format!("pdfa1b-{}-{}-s", source, dpi));
            outputs.push(format!("pdfa1b-{}-{}-p-s", source, dpi));
            outputs.push(format!("pdfa1b-{}-{}-np-s", source, dpi));
        }
    }
    
    // PDF/A-2b 輸出
    for source in ["i", "o"] {
        for dpi in ["150", "300", "600"] {
            outputs.push(format!("pdfa2b-{}-{}", source, dpi));
            outputs.push(format!("pdfa2b-{}-{}-p", source, dpi));
            outputs.push(format!("pdfa2b-{}-{}-np", source, dpi));
            outputs.push(format!("pdfa2b-{}-{}-s", source, dpi));
            outputs.push(format!("pdfa2b-{}-{}-p-s", source, dpi));
            outputs.push(format!("pdfa2b-{}-{}-np-s", source, dpi));
        }
    }
    
    outputs
}
