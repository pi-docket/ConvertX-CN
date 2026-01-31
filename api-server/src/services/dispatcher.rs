//! Conversion Dispatcher - Manages job execution
//!
//! 負責任務分派和執行的核心服務。

use std::collections::HashMap;
use std::sync::{Arc, RwLock};
use std::path::PathBuf;
use uuid::Uuid;
use chrono::Utc;

use crate::config::Config;
use crate::models::{ConversionJob, JobStatus};
use crate::services::EngineRegistry;

/// Job storage (in-memory for now, can be replaced with database)
#[derive(Debug, Default)]
struct JobStore {
    jobs: HashMap<Uuid, ConversionJob>,
    user_jobs: HashMap<String, Vec<Uuid>>,
}

/// Conversion dispatcher service
#[derive(Debug)]
pub struct ConversionDispatcher {
    engine_registry: Arc<EngineRegistry>,
    config: Arc<Config>,
    job_store: RwLock<JobStore>,
}

impl ConversionDispatcher {
    /// Create a new dispatcher
    pub fn new(engine_registry: Arc<EngineRegistry>, config: Arc<Config>) -> Self {
        Self {
            engine_registry,
            config,
            job_store: RwLock::new(JobStore::default()),
        }
    }

    /// Create a new conversion job
    pub fn create_job(
        &self,
        user_id: &str,
        original_filename: String,
        source_format: String,
        target_format: String,
        engine: String,
        options: Option<serde_json::Value>,
    ) -> ConversionJob {
        let job = ConversionJob::new(
            user_id.to_string(),
            original_filename,
            source_format,
            target_format,
            engine,
            options,
        );

        let job_id = job.id;
        
        // Store the job
        {
            let mut store = self.job_store.write().unwrap();
            store.jobs.insert(job_id, job.clone());
            store.user_jobs
                .entry(user_id.to_string())
                .or_default()
                .push(job_id);
        }

        job
    }

    /// Get a job by ID
    pub fn get_job(&self, job_id: Uuid) -> Option<ConversionJob> {
        let store = self.job_store.read().unwrap();
        store.jobs.get(&job_id).cloned()
    }

    /// Get a job by ID and user ID (for authorization)
    pub fn get_user_job(&self, job_id: Uuid, user_id: &str) -> Option<ConversionJob> {
        let store = self.job_store.read().unwrap();
        store.jobs.get(&job_id).filter(|j| j.user_id == user_id).cloned()
    }

    /// List all jobs for a user
    pub fn list_user_jobs(&self, user_id: &str) -> Vec<ConversionJob> {
        let store = self.job_store.read().unwrap();
        store.user_jobs
            .get(user_id)
            .map(|ids| {
                ids.iter()
                    .filter_map(|id| store.jobs.get(id).cloned())
                    .collect()
            })
            .unwrap_or_default()
    }

    /// Update job status
    pub fn update_job_status(&self, job_id: Uuid, status: JobStatus) {
        let mut store = self.job_store.write().unwrap();
        if let Some(job) = store.jobs.get_mut(&job_id) {
            job.status = status;
            if matches!(status, JobStatus::Completed | JobStatus::Failed) {
                job.completed_at = Some(Utc::now());
            }
        }
    }

    /// Mark job as completed
    pub fn complete_job(&self, job_id: Uuid, output_filename: String) {
        let mut store = self.job_store.write().unwrap();
        if let Some(job) = store.jobs.get_mut(&job_id) {
            job.set_completed(output_filename);
        }
    }

    /// Mark job as failed
    pub fn fail_job(&self, job_id: Uuid, error_message: String) {
        let mut store = self.job_store.write().unwrap();
        if let Some(job) = store.jobs.get_mut(&job_id) {
            job.set_failed(error_message);
        }
    }

    /// Delete a job
    pub fn delete_job(&self, job_id: Uuid, user_id: &str) -> bool {
        let mut store = self.job_store.write().unwrap();
        
        // Check ownership
        if let Some(job) = store.jobs.get(&job_id) {
            if job.user_id != user_id {
                return false;
            }
        } else {
            return false;
        }

        // Remove from jobs
        store.jobs.remove(&job_id);
        
        // Remove from user index
        if let Some(ids) = store.user_jobs.get_mut(user_id) {
            ids.retain(|id| *id != job_id);
        }

        true
    }

    /// Get upload path for a job
    pub fn get_upload_path(&self, job_id: Uuid, user_id: &str) -> PathBuf {
        PathBuf::from(&self.config.upload_dir)
            .join(user_id)
            .join(job_id.to_string())
    }

    /// Get output path for a job
    pub fn get_output_path(&self, job_id: Uuid, user_id: &str) -> PathBuf {
        PathBuf::from(&self.config.output_dir)
            .join(user_id)
            .join(job_id.to_string())
    }

    /// Validate that a conversion is supported
    pub fn validate_conversion(&self, from: &str, to: &str, engine: Option<&str>) -> ValidationResult {
        if let Some(engine_id) = engine {
            // Check specific engine
            if let Some(eng) = self.engine_registry.get(engine_id) {
                if eng.supports_conversion(from, to) {
                    ValidationResult::Valid {
                        engine: engine_id.to_string(),
                    }
                } else {
                    ValidationResult::Invalid {
                        reason: format!(
                            "Engine '{}' does not support {} → {} conversion",
                            engine_id, from, to
                        ),
                        suggestions: eng.output_formats_for(from),
                    }
                }
            } else {
                ValidationResult::Invalid {
                    reason: format!("Engine '{}' not found", engine_id),
                    suggestions: self.engine_registry.list().iter().map(|e| e.id.clone()).collect(),
                }
            }
        } else {
            // Find any engine that supports this conversion
            let engines = self.engine_registry.find_engines_for(from, to);
            if !engines.is_empty() {
                ValidationResult::Valid {
                    engine: engines[0].id.clone(),
                }
            } else {
                let targets = self.engine_registry.get_targets_for(from);
                let all_outputs: Vec<String> = targets.values().flatten().cloned().collect();
                ValidationResult::Invalid {
                    reason: format!("No engine supports {} → {} conversion", from, to),
                    suggestions: all_outputs,
                }
            }
        }
    }

    /// Get engine registry
    pub fn engine_registry(&self) -> &Arc<EngineRegistry> {
        &self.engine_registry
    }
}

/// Result of conversion validation
#[derive(Debug)]
pub enum ValidationResult {
    Valid { engine: String },
    Invalid { reason: String, suggestions: Vec<String> },
}

impl Clone for ConversionDispatcher {
    fn clone(&self) -> Self {
        // Note: This shares the job store
        Self {
            engine_registry: self.engine_registry.clone(),
            config: self.config.clone(),
            job_store: RwLock::new(JobStore::default()),
        }
    }
}
