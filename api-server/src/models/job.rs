//! Job models - Conversion job data structures

use serde::{Deserialize, Serialize};
use uuid::Uuid;
use chrono::{DateTime, Utc};
use utoipa::ToSchema;

/// Job status enumeration
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "snake_case")]
pub enum JobStatus {
    /// Job is waiting to be processed
    Pending,
    /// Job is currently being processed
    Processing,
    /// Job completed successfully
    Completed,
    /// Job failed
    Failed,
}

impl std::fmt::Display for JobStatus {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            JobStatus::Pending => write!(f, "pending"),
            JobStatus::Processing => write!(f, "processing"),
            JobStatus::Completed => write!(f, "completed"),
            JobStatus::Failed => write!(f, "failed"),
        }
    }
}

/// Conversion job representation
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct ConversionJob {
    /// Unique job identifier
    pub id: Uuid,
    /// User who created the job
    pub user_id: String,
    /// Original filename
    pub original_filename: String,
    /// Source file format
    pub source_format: String,
    /// Target file format
    pub target_format: String,
    /// Engine used for conversion
    pub engine: String,
    /// Current job status
    pub status: JobStatus,
    /// Output filename (when completed)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub output_filename: Option<String>,
    /// Error message (when failed)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error_message: Option<String>,
    /// Job creation timestamp
    pub created_at: DateTime<Utc>,
    /// Job completion timestamp
    #[serde(skip_serializing_if = "Option::is_none")]
    pub completed_at: Option<DateTime<Utc>>,
    /// Conversion options (engine-specific)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub options: Option<serde_json::Value>,
}

impl ConversionJob {
    /// Create a new pending conversion job
    pub fn new(
        user_id: String,
        original_filename: String,
        source_format: String,
        target_format: String,
        engine: String,
        options: Option<serde_json::Value>,
    ) -> Self {
        Self {
            id: Uuid::new_v4(),
            user_id,
            original_filename,
            source_format,
            target_format,
            engine,
            status: JobStatus::Pending,
            output_filename: None,
            error_message: None,
            created_at: Utc::now(),
            completed_at: None,
            options,
        }
    }

    /// Mark job as processing
    pub fn set_processing(&mut self) {
        self.status = JobStatus::Processing;
    }

    /// Mark job as completed
    pub fn set_completed(&mut self, output_filename: String) {
        self.status = JobStatus::Completed;
        self.output_filename = Some(output_filename);
        self.completed_at = Some(Utc::now());
    }

    /// Mark job as failed
    pub fn set_failed(&mut self, error_message: String) {
        self.status = JobStatus::Failed;
        self.error_message = Some(error_message);
        self.completed_at = Some(Utc::now());
    }
}

/// Job summary for list responses
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct JobSummary {
    pub id: Uuid,
    pub original_filename: String,
    pub source_format: String,
    pub target_format: String,
    pub engine: String,
    pub status: JobStatus,
    pub created_at: DateTime<Utc>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub completed_at: Option<DateTime<Utc>>,
}

impl From<ConversionJob> for JobSummary {
    fn from(job: ConversionJob) -> Self {
        Self {
            id: job.id,
            original_filename: job.original_filename,
            source_format: job.source_format,
            target_format: job.target_format,
            engine: job.engine,
            status: job.status,
            created_at: job.created_at,
            completed_at: job.completed_at,
        }
    }
}
