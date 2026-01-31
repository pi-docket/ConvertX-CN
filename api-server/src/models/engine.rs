//! Engine models - Conversion engine data structures

use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

/// Engine information for API responses
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct EngineInfo {
    /// Unique engine identifier
    pub id: String,
    /// Human-readable name
    pub name: String,
    /// Description of the engine
    pub description: String,
    /// Category (image, video, document, ai, etc.)
    pub category: String,
    /// List of supported input formats
    pub supported_input_formats: Vec<String>,
    /// List of supported output formats
    pub supported_output_formats: Vec<String>,
    /// Whether the engine is currently available
    pub available: bool,
}

/// Single conversion capability
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct EngineConversion {
    /// Source format
    pub from: String,
    /// Target format
    pub to: String,
}

/// Engine with full conversion details
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct EngineDetail {
    /// Basic engine info
    #[serde(flatten)]
    pub info: EngineInfo,
    /// All supported conversions
    pub conversions: Vec<EngineConversion>,
}

/// Format information
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct FormatInfo {
    /// Format extension (e.g., "pdf", "docx")
    pub format: String,
    /// Engines that can read this format
    pub engines: Vec<String>,
    /// Possible output formats
    pub targets: Vec<String>,
}

/// Conversion target info
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct ConversionTarget {
    /// Engine ID
    pub engine: String,
    /// Possible output formats for this engine
    pub outputs: Vec<String>,
}
