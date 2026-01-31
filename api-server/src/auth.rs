//! JWT 認證模組

use axum::{
    async_trait,
    extract::FromRequestParts,
    http::{header::AUTHORIZATION, request::Parts},
};
use jsonwebtoken::{decode, Algorithm, DecodingKey, Validation};
use serde::{Deserialize, Serialize};
use std::sync::Arc;

use crate::config::AppConfig;
use crate::error::ApiError;

/// JWT Claims 結構
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct JwtClaims {
    /// 使用者 ID
    pub sub: String,
    /// 使用者 Email（可選）
    #[serde(default)]
    pub email: Option<String>,
    /// 權限範圍
    #[serde(default)]
    pub scope: Vec<String>,
    /// 簽發時間
    pub iat: i64,
    /// 過期時間
    pub exp: i64,
}

impl JwtClaims {
    /// 檢查是否有指定權限
    pub fn has_scope(&self, scope: &str) -> bool {
        // 如果沒有指定 scope，預設允許所有操作
        if self.scope.is_empty() {
            return true;
        }
        self.scope.iter().any(|s| s == scope || s == "*")
    }

    /// 檢查是否有轉換權限
    pub fn can_convert(&self) -> bool {
        self.has_scope("convert") || self.has_scope("*")
    }

    /// 檢查是否有讀取權限
    pub fn can_read(&self) -> bool {
        self.has_scope("read") || self.has_scope("list_engines") || self.has_scope("*")
    }

    /// 檢查是否有下載權限
    pub fn can_download(&self) -> bool {
        self.has_scope("download") || self.has_scope("*")
    }
}

/// 已認證的使用者
#[derive(Debug, Clone)]
pub struct AuthenticatedUser {
    pub user_id: String,
    pub email: Option<String>,
    pub claims: JwtClaims,
}

/// JWT 驗證器
pub struct JwtValidator {
    decoding_key: DecodingKey,
    validation: Validation,
}

impl JwtValidator {
    /// 建立新的 JWT 驗證器
    pub fn new(secret: &str) -> Self {
        let decoding_key = DecodingKey::from_secret(secret.as_bytes());
        let mut validation = Validation::new(Algorithm::HS256);
        validation.validate_exp = true;
        validation.validate_aud = false;

        Self {
            decoding_key,
            validation,
        }
    }

    /// 驗證 JWT Token
    pub fn validate(&self, token: &str) -> Result<JwtClaims, ApiError> {
        let token_data = decode::<JwtClaims>(token, &self.decoding_key, &self.validation)
            .map_err(|e| match e.kind() {
                jsonwebtoken::errors::ErrorKind::ExpiredSignature => ApiError::TokenExpired,
                jsonwebtoken::errors::ErrorKind::InvalidToken => {
                    ApiError::InvalidToken("Token 格式無效".to_string())
                }
                jsonwebtoken::errors::ErrorKind::InvalidSignature => {
                    ApiError::InvalidToken("簽名驗證失敗".to_string())
                }
                _ => ApiError::InvalidToken(e.to_string()),
            })?;

        Ok(token_data.claims)
    }
}

/// 應用程式狀態
#[derive(Clone)]
pub struct AppState {
    pub config: AppConfig,
    pub jwt_validator: Arc<JwtValidator>,
    pub engine_registry: crate::engine::EngineRegistry,
    pub job_store: crate::job::JobStore,
}

impl AppState {
    pub fn new(config: AppConfig) -> Self {
        let jwt_validator = JwtValidator::new(&config.jwt_secret);
        Self {
            config,
            jwt_validator: Arc::new(jwt_validator),
            engine_registry: crate::engine::EngineRegistry::new(),
            job_store: crate::job::JobStore::new(),
        }
    }
}

/// 已認證使用者方法
impl AuthenticatedUser {
    /// 檢查是否有轉換權限
    pub fn can_convert(&self) -> bool {
        self.claims.can_convert()
    }

    /// 檢查是否有下載權限
    pub fn can_download(&self) -> bool {
        self.claims.can_download()
    }
}

/// 從請求中提取已認證使用者
#[async_trait]
impl FromRequestParts<AppState> for AuthenticatedUser {
    type Rejection = ApiError;

    async fn from_request_parts(parts: &mut Parts, state: &AppState) -> Result<Self, Self::Rejection> {
        // 取得 Authorization header
        let auth_header = parts
            .headers
            .get(AUTHORIZATION)
            .and_then(|h| h.to_str().ok())
            .ok_or(ApiError::MissingAuthHeader)?;

        // 解析 Bearer token
        let token = auth_header
            .strip_prefix("Bearer ")
            .ok_or(ApiError::InvalidToken("需要 Bearer Token".to_string()))?;

        // 驗證 JWT
        let claims = state.jwt_validator.validate(token)?;

        Ok(AuthenticatedUser {
            user_id: claims.sub.clone(),
            email: claims.email.clone(),
            claims,
        })
    }
}
