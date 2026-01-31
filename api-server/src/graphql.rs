//! GraphQL API 模組

use async_graphql::{Context, EmptySubscription, Object, Schema, SimpleObject, InputObject, Enum};
use chrono::{DateTime, Utc};

use crate::auth::AppState;
use crate::models::JobStatus as ModelJobStatus;

/// GraphQL Schema 類型
pub type ApiSchema = Schema<QueryRoot, MutationRoot, EmptySubscription>;

/// 建立 GraphQL Schema
pub fn create_schema(state: AppState) -> ApiSchema {
    Schema::build(QueryRoot, MutationRoot, EmptySubscription)
        .data(state)
        .finish()
}

// ============================================================================
// GraphQL Types
// ============================================================================

/// 引擎資訊
#[derive(SimpleObject, Clone)]
pub struct Engine {
    /// 引擎 ID
    pub id: String,
    /// 引擎名稱
    pub name: String,
    /// 引擎描述
    pub description: String,
    /// 是否啟用
    pub enabled: bool,
    /// 支援的輸入格式
    pub input_formats: Vec<String>,
    /// 支援的輸出格式
    pub output_formats: Vec<String>,
    /// 最大檔案大小（MB）
    pub max_file_size_mb: i32,
    /// 是否需要額外參數
    pub requires_params: bool,
}

/// 任務狀態
#[derive(Enum, Copy, Clone, Eq, PartialEq)]
pub enum JobStatus {
    /// 等待中
    Pending,
    /// 處理中
    Processing,
    /// 已完成
    Completed,
    /// 失敗
    Failed,
}

impl From<ModelJobStatus> for JobStatus {
    fn from(status: ModelJobStatus) -> Self {
        match status {
            ModelJobStatus::Pending => JobStatus::Pending,
            ModelJobStatus::Processing => JobStatus::Processing,
            ModelJobStatus::Completed => JobStatus::Completed,
            ModelJobStatus::Failed => JobStatus::Failed,
        }
    }
}

/// 轉換任務
#[derive(SimpleObject, Clone)]
pub struct Job {
    /// 任務 ID
    pub id: String,
    /// 使用者 ID
    pub user_id: String,
    /// 原始檔案名稱
    pub original_filename: String,
    /// 輸入格式
    pub input_format: String,
    /// 輸出格式
    pub output_format: String,
    /// 使用的引擎 ID
    pub engine_id: String,
    /// 任務狀態
    pub status: JobStatus,
    /// 進度（0-100）
    pub progress: i32,
    /// 錯誤訊息
    pub error_message: Option<String>,
    /// 建立時間
    pub created_at: DateTime<Utc>,
    /// 更新時間
    pub updated_at: DateTime<Utc>,
    /// 完成時間
    pub completed_at: Option<DateTime<Utc>>,
    /// 是否可下載
    pub download_ready: bool,
}

/// 健康狀態
#[derive(SimpleObject)]
pub struct HealthStatus {
    /// 狀態
    pub status: String,
    /// 版本
    pub version: String,
    /// 後端狀態
    pub backend_status: String,
    /// 時間戳記
    pub timestamp: DateTime<Utc>,
}

/// 轉換建議
#[derive(SimpleObject)]
pub struct ConversionSuggestion {
    /// 引擎 ID
    pub engine: String,
    /// 引擎名稱
    pub engine_name: String,
    /// 來源格式
    pub from: String,
    /// 目標格式
    pub to: String,
}

/// 驗證結果
#[derive(SimpleObject)]
pub struct ValidationResult {
    /// 是否有效
    pub valid: bool,
    /// 訊息
    pub message: String,
    /// 建議
    pub suggestions: Vec<ConversionSuggestion>,
}

/// 建立任務輸入
#[derive(InputObject)]
pub struct CreateJobInput {
    /// 引擎 ID
    pub engine_id: String,
    /// 輸入格式
    pub input_format: String,
    /// 輸出格式
    pub output_format: String,
    /// 檔案名稱
    pub filename: String,
}

/// 建立任務結果
#[derive(SimpleObject)]
pub struct CreateJobResult {
    /// 是否成功
    pub success: bool,
    /// 任務 ID
    pub job_id: Option<String>,
    /// 訊息
    pub message: String,
}

// ============================================================================
// Query Root
// ============================================================================

pub struct QueryRoot;

#[Object]
impl QueryRoot {
    /// 健康檢查
    async fn health(&self, ctx: &Context<'_>) -> HealthStatus {
        let state = ctx.data::<AppState>().unwrap();
        
        // 檢查後端狀態
        let backend_status = match check_backend(state).await {
            Ok(_) => "healthy".to_string(),
            Err(_) => "unhealthy".to_string(),
        };

        HealthStatus {
            status: "healthy".to_string(),
            version: env!("CARGO_PKG_VERSION").to_string(),
            backend_status,
            timestamp: Utc::now(),
        }
    }

    /// 列出所有引擎
    async fn engines(&self, ctx: &Context<'_>) -> Vec<Engine> {
        let state = ctx.data::<AppState>().unwrap();
        let engines = state.engine_registry.list_engines().await;
        
        engines.into_iter().map(|e| Engine {
            id: e.engine_id,
            name: e.engine_name,
            description: e.description,
            enabled: e.enabled,
            input_formats: e.input_formats,
            output_formats: e.output_formats,
            max_file_size_mb: e.max_file_size_mb as i32,
            requires_params: e.requires_params,
        }).collect()
    }

    /// 取得特定引擎
    async fn engine(&self, ctx: &Context<'_>, id: String) -> Option<Engine> {
        let state = ctx.data::<AppState>().unwrap();
        let engine = state.engine_registry.get_engine(&id).await?;
        
        Some(Engine {
            id: engine.engine_id,
            name: engine.engine_name,
            description: engine.description,
            enabled: engine.enabled,
            input_formats: engine.input_formats,
            output_formats: engine.output_formats,
            max_file_size_mb: engine.max_file_size_mb as i32,
            requires_params: engine.requires_params,
        })
    }

    /// 取得任務狀態
    async fn job(&self, ctx: &Context<'_>, id: String) -> Option<Job> {
        let state = ctx.data::<AppState>().unwrap();
        let job = state.job_store.get_job(&id).await?;
        
        Some(Job {
            id: job.job_id,
            user_id: job.user_id,
            original_filename: job.original_filename,
            input_format: job.input_format,
            output_format: job.output_format,
            engine_id: job.engine_id,
            status: job.status.into(),
            progress: job.progress as i32,
            error_message: job.error_message,
            created_at: DateTime::from_timestamp(job.created_at, 0).unwrap_or_default(),
            updated_at: DateTime::from_timestamp(job.updated_at, 0).unwrap_or_default(),
            completed_at: job.completed_at.and_then(|t| DateTime::from_timestamp(t, 0)),
            download_ready: job.status == ModelJobStatus::Completed && job.output_file.is_some(),
        })
    }

    /// 驗證轉換是否支援
    async fn validate_conversion(
        &self,
        ctx: &Context<'_>,
        engine_id: String,
        from: String,
        to: String,
    ) -> ValidationResult {
        let state = ctx.data::<AppState>().unwrap();
        
        // 檢查引擎是否存在
        let engine = match state.engine_registry.get_engine(&engine_id).await {
            Some(e) => e,
            None => {
                return ValidationResult {
                    valid: false,
                    message: format!("引擎不存在：{}", engine_id),
                    suggestions: get_suggestions(state, &from, &to).await,
                };
            }
        };

        // 檢查是否支援轉換
        if engine.supports_conversion(&from, &to) {
            ValidationResult {
                valid: true,
                message: "支援此轉換".to_string(),
                suggestions: vec![],
            }
        } else {
            ValidationResult {
                valid: false,
                message: format!("引擎 {} 不支援 {} → {} 轉換", engine_id, from, to),
                suggestions: get_suggestions(state, &from, &to).await,
            }
        }
    }

    /// 取得轉換建議
    async fn suggestions(
        &self,
        ctx: &Context<'_>,
        from: String,
        to: String,
    ) -> Vec<ConversionSuggestion> {
        let state = ctx.data::<AppState>().unwrap();
        get_suggestions(state, &from, &to).await
    }
}

// ============================================================================
// Mutation Root
// ============================================================================

pub struct MutationRoot;

#[Object]
impl MutationRoot {
    /// 刪除任務
    async fn delete_job(&self, ctx: &Context<'_>, id: String) -> bool {
        let state = ctx.data::<AppState>().unwrap();
        
        // 目前 JobStore 沒有刪除方法，返回 false
        // TODO: 實作刪除功能
        if state.job_store.get_job(&id).await.is_some() {
            // 任務存在但無法刪除
            false
        } else {
            false
        }
    }

    /// 取消任務（僅限等待中的任務）
    async fn cancel_job(&self, ctx: &Context<'_>, id: String) -> bool {
        let state = ctx.data::<AppState>().unwrap();
        
        if let Some(job) = state.job_store.get_job(&id).await {
            if job.status == ModelJobStatus::Pending {
                // 更新狀態為失敗
                state.job_store.fail_job(&id, "已取消".to_string()).await;
                return true;
            }
        }
        false
    }
}

// ============================================================================
// Helper Functions
// ============================================================================

/// 檢查後端狀態
async fn check_backend(state: &AppState) -> Result<(), String> {
    let client = reqwest::Client::new();
    let url = format!("{}/api/health", state.config.backend_url);
    
    let response = client
        .get(&url)
        .timeout(std::time::Duration::from_secs(5))
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if response.status().is_success() {
        Ok(())
    } else {
        Err("Backend unhealthy".to_string())
    }
}

/// 取得轉換建議
async fn get_suggestions(state: &AppState, from: &str, to: &str) -> Vec<ConversionSuggestion> {
    let engines = state.engine_registry.list_engines().await;
    
    engines
        .into_iter()
        .filter(|e| e.enabled && e.supports_conversion(from, to))
        .map(|e| ConversionSuggestion {
            engine: e.engine_id.clone(),
            engine_name: e.engine_name.clone(),
            from: from.to_string(),
            to: to.to_string(),
        })
        .collect()
}
