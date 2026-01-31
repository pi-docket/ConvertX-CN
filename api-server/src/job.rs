//! 任務管理模組

use crate::models::{Job, JobStatus};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;

/// 任務儲存器
#[derive(Clone)]
pub struct JobStore {
    jobs: Arc<RwLock<HashMap<String, Job>>>,
}

impl JobStore {
    /// 建立新的任務儲存器
    pub fn new() -> Self {
        Self {
            jobs: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    /// 建立新任務
    pub async fn create_job(&self, job: Job) -> Job {
        let mut jobs = self.jobs.write().await;
        let job_id = job.job_id.clone();
        jobs.insert(job_id, job.clone());
        job
    }

    /// 取得任務
    pub async fn get_job(&self, job_id: &str) -> Option<Job> {
        let jobs = self.jobs.read().await;
        jobs.get(job_id).cloned()
    }

    /// 取得使用者的所有任務
    pub async fn get_user_jobs(&self, user_id: &str) -> Vec<Job> {
        let jobs = self.jobs.read().await;
        jobs.values()
            .filter(|j| j.user_id == user_id)
            .cloned()
            .collect()
    }

    /// 更新任務狀態
    pub async fn update_status(&self, job_id: &str, status: JobStatus) -> Option<Job> {
        let mut jobs = self.jobs.write().await;
        if let Some(job) = jobs.get_mut(job_id) {
            job.status = status;
            job.updated_at = chrono::Utc::now().timestamp();
            if status == JobStatus::Completed {
                job.completed_at = Some(job.updated_at);
            }
            Some(job.clone())
        } else {
            None
        }
    }

    /// 更新任務進度
    pub async fn update_progress(&self, job_id: &str, progress: u8) -> Option<Job> {
        let mut jobs = self.jobs.write().await;
        if let Some(job) = jobs.get_mut(job_id) {
            job.progress = progress.min(100);
            job.updated_at = chrono::Utc::now().timestamp();
            Some(job.clone())
        } else {
            None
        }
    }

    /// 設定任務完成
    pub async fn complete_job(&self, job_id: &str, output_file: String) -> Option<Job> {
        let mut jobs = self.jobs.write().await;
        if let Some(job) = jobs.get_mut(job_id) {
            job.status = JobStatus::Completed;
            job.progress = 100;
            job.output_file = Some(output_file);
            job.updated_at = chrono::Utc::now().timestamp();
            job.completed_at = Some(job.updated_at);
            Some(job.clone())
        } else {
            None
        }
    }

    /// 設定任務失敗
    pub async fn fail_job(&self, job_id: &str, error_message: String) -> Option<Job> {
        let mut jobs = self.jobs.write().await;
        if let Some(job) = jobs.get_mut(job_id) {
            job.status = JobStatus::Failed;
            job.error_message = Some(error_message);
            job.updated_at = chrono::Utc::now().timestamp();
            Some(job.clone())
        } else {
            None
        }
    }

    /// 檢查任務是否屬於使用者
    pub async fn is_job_owner(&self, job_id: &str, user_id: &str) -> bool {
        let jobs = self.jobs.read().await;
        jobs.get(job_id).map(|j| j.user_id == user_id).unwrap_or(false)
    }

    /// 清理過期任務（超過指定小時數）
    pub async fn cleanup_old_jobs(&self, hours: i64) -> usize {
        let mut jobs = self.jobs.write().await;
        let now = chrono::Utc::now().timestamp();
        let cutoff = now - (hours * 3600);
        
        let old_jobs: Vec<String> = jobs
            .iter()
            .filter(|(_, j)| j.created_at < cutoff)
            .map(|(id, _)| id.clone())
            .collect();
        
        let count = old_jobs.len();
        for job_id in old_jobs {
            jobs.remove(&job_id);
        }
        count
    }
}

impl Default for JobStore {
    fn default() -> Self {
        Self::new()
    }
}
