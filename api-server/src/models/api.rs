//! API models - Request and response structures

use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};
use utoipa::ToSchema;
use uuid::Uuid;

// ==============================================================================
// 通用 API 回應結構
// ==============================================================================

/// Standard API response wrapper
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct ApiResponse<T> {
    /// Whether the request was successful
    pub success: bool,
    /// Response data (present when success=true)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub data: Option<T>,
    /// Error information (present when success=false)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<ApiError>,
    /// Response metadata
    pub meta: ResponseMeta,
}

/// Response metadata
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct ResponseMeta {
    /// API version
    pub version: String,
    /// Response timestamp
    pub timestamp: DateTime<Utc>,
    /// Unique request ID for tracing
    pub request_id: Uuid,
}

/// API error details
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct ApiError {
    /// Error code
    pub code: String,
    /// Human-readable error message
    pub message: String,
    /// Additional error details
    #[serde(skip_serializing_if = "Option::is_none")]
    pub details: Option<serde_json::Value>,
}

impl<T> ApiResponse<T> {
    /// Create a success response
    pub fn success(data: T, version: &str) -> Self {
        Self {
            success: true,
            data: Some(data),
            error: None,
            meta: ResponseMeta {
                version: version.to_string(),
                timestamp: Utc::now(),
                request_id: Uuid::new_v4(),
            },
        }
    }

    /// Create an error response
    pub fn error(code: &str, message: &str, details: Option<serde_json::Value>, version: &str) -> ApiResponse<()> {
        ApiResponse {
            success: false,
            data: None,
            error: Some(ApiError {
                code: code.to_string(),
                message: message.to_string(),
                details,
            }),
            meta: ResponseMeta {
                version: version.to_string(),
                timestamp: Utc::now(),
                request_id: Uuid::new_v4(),
            },
        }
    }
}

// ==============================================================================
// Health 相關
// ==============================================================================

/// Health check response
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct HealthResponse {
    /// Service status
    pub status: String,
    /// API version
    pub version: String,
    /// Server timestamp
    pub timestamp: DateTime<Utc>,
    /// Uptime in seconds
    #[serde(skip_serializing_if = "Option::is_none")]
    pub uptime_secs: Option<u64>,
}

// ==============================================================================
// Info 相關
// ==============================================================================

/// API information response
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct InfoResponse {
    /// API name
    pub name: String,
    /// API version
    pub version: String,
    /// API description
    pub description: String,
    /// Documentation URL
    pub documentation: String,
    /// Available endpoints
    pub endpoints: EndpointList,
    /// Service capabilities
    pub capabilities: Capabilities,
}

/// List of available endpoints
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct EndpointList {
    /// Public endpoints (no auth required)
    pub public: Vec<String>,
    /// Authenticated endpoints
    pub authenticated: Vec<String>,
}

/// Service capabilities
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct Capabilities {
    /// Total number of engines
    pub total_engines: usize,
    /// Number of available engines
    pub available_engines: usize,
    /// Maximum file size in bytes
    pub max_file_size: usize,
}

// ==============================================================================
// Engines 相關
// ==============================================================================

/// List engines response
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct ListEnginesResponse {
    /// List of engines
    pub engines: Vec<super::EngineInfo>,
}

/// Engine detail response
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct EngineDetailResponse {
    /// Engine details
    pub engine: super::EngineDetail,
}

// ==============================================================================
// Formats 相關
// ==============================================================================

/// List formats response
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct ListFormatsResponse {
    /// All supported input formats
    pub inputs: Vec<String>,
    /// All supported output formats
    pub outputs: Vec<String>,
    /// Number of input formats
    pub input_count: usize,
    /// Number of output formats
    pub output_count: usize,
}

/// Format targets response
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct FormatTargetsResponse {
    /// Input format
    pub input_format: String,
    /// Converters that support this input
    pub converters: Vec<super::ConversionTarget>,
    /// All possible output formats
    pub all_outputs: Vec<String>,
}

// ==============================================================================
// Validate 相關
// ==============================================================================

/// Validation request
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct ValidateRequest {
    /// Input format
    pub input_format: String,
    /// Output format
    pub output_format: String,
    /// Optional specific engine
    #[serde(skip_serializing_if = "Option::is_none")]
    pub engine: Option<String>,
}

/// Validation response
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct ValidateResponse {
    /// Whether the conversion is valid
    pub valid: bool,
    /// Reason if invalid
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reason: Option<String>,
    /// Additional message
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
    /// Suggested alternatives
    #[serde(skip_serializing_if = "Option::is_none")]
    pub suggestions: Option<Vec<String>>,
    /// Selected or recommended engine
    #[serde(skip_serializing_if = "Option::is_none")]
    pub engine: Option<String>,
    /// Available engines for this conversion
    #[serde(skip_serializing_if = "Option::is_none")]
    pub available_engines: Option<Vec<String>>,
}

// ==============================================================================
// Jobs 相關
// ==============================================================================

/// Create job request (form data fields)
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct CreateJobRequest {
    /// Target format
    pub target_format: String,
    /// Engine to use (optional, auto-select if not provided)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub engine: Option<String>,
    /// Engine-specific options
    #[serde(skip_serializing_if = "Option::is_none")]
    pub options: Option<serde_json::Value>,
}

/// Create job response
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct CreateJobResponse {
    /// Created job ID
    pub job_id: Uuid,
    /// Job status
    pub status: String,
    /// Status check URL
    pub status_url: String,
    /// Estimated completion time (seconds)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub estimated_time: Option<u32>,
}

/// Job status response
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct JobStatusResponse {
    /// Job details
    pub job: super::ConversionJob,
    /// Result download URL (if completed)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub result_url: Option<String>,
}

/// List jobs response
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct ListJobsResponse {
    /// List of jobs
    pub jobs: Vec<super::JobSummary>,
    /// Total count
    pub total: usize,
}

/// Delete job response
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct DeleteJobResponse {
    /// Success message
    pub message: String,
    /// Deleted job ID
    pub job_id: Uuid,
}
