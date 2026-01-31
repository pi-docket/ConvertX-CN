# 管理 API (Admin API)

本文件說明 ConvertX RAS API 的高風險管理端點。

---

## 概述

管理 API 提供系統級別的操作功能，包括：

- 儲存統計資訊
- 資料清除（Purge）
- 手動觸發清理

> ⚠️ **警告**：這些操作具有高風險，可能導致資料永久遺失。

---

## 認證要求

所有管理 API 端點都需要：

1. **JWT Token**：有效的 Bearer Token
2. **Admin 角色**：Token 中必須包含 `"roles": ["admin"]`
3. **確認參數**：破壞性操作需要 `?confirm=true`

---

## 端點列表

| 方法 | 端點                        | 說明                         |
| ---- | --------------------------- | ---------------------------- |
| GET  | `/api/v1/admin/stats`       | 取得儲存統計                 |
| POST | `/api/v1/admin/purge/all`   | 清除所有資料                 |
| POST | `/api/v1/admin/purge/users` | 清除使用者資料（保留 admin） |
| POST | `/api/v1/admin/cleanup`     | 手動觸發 24 小時清理         |

---

## 取得儲存統計

取得系統儲存使用情況。

### 請求

```bash
curl -X GET \
  -H "Authorization: Bearer <admin-token>" \
  http://localhost:7890/api/v1/admin/stats
```

### 回應

```json
{
  "total_users": 5,
  "total_files": 123,
  "total_bytes": 1073741824,
  "upload_dir": "/app/data/api-uploads",
  "output_dir": "/app/data/api-output"
}
```

---

## 清除所有資料

⚠️ **DANGER**：刪除所有使用者的上傳檔案和轉換結果，**包括 admin**。

### 請求

```bash
curl -X POST \
  -H "Authorization: Bearer <admin-token>" \
  "http://localhost:7890/api/v1/admin/purge/all?confirm=true"
```

### 回應

```json
{
  "success": true,
  "message": "All data purged successfully",
  "directories_removed": 15,
  "files_removed": 234,
  "bytes_freed": 5368709120
}
```

### 安全機制

- 必須有 `admin` 角色
- 必須提供 `confirm=true` 參數
- 操作會記錄到日誌

---

## 清除使用者資料（保留 admin）

刪除非 admin 使用者的資料，admin 資料保留。

### 請求

```bash
curl -X POST \
  -H "Authorization: Bearer <admin-token>" \
  "http://localhost:7890/api/v1/admin/purge/users?confirm=true"
```

### 回應

```json
{
  "success": true,
  "message": "User data purged successfully. Admin 'admin-user-id' data preserved.",
  "directories_removed": 12,
  "files_removed": 198,
  "bytes_freed": 4294967296
}
```

---

## 手動觸發清理

執行與 24 小時自動清理相同的操作。刪除超過 24 小時的檔案。

### 請求

```bash
curl -X POST \
  -H "Authorization: Bearer <admin-token>" \
  "http://localhost:7890/api/v1/admin/cleanup?confirm=true"
```

### 回應

```json
{
  "success": true,
  "message": "Cleanup completed. Files older than 24 hours removed.",
  "directories_removed": 3,
  "files_removed": 45,
  "bytes_freed": 536870912
}
```

---

## 錯誤回應

### 未認證

```json
{
  "error": {
    "code": "MISSING_AUTH_HEADER",
    "message": "Missing authorization header"
  }
}
```

### 非 admin 角色

```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Unauthorized: Admin role required"
  }
}
```

### 缺少確認參數

```json
{
  "error": {
    "code": "BAD_REQUEST",
    "message": "Invalid request: This is a destructive operation. Add '?confirm=true' to proceed."
  }
}
```

---

## 最佳實踐

### 1. 謹慎使用

管理 API 應該只在必要時使用：

- 定期清理可以依賴自動排程
- 手動清除只在緊急情況下使用

### 2. 日誌監控

所有管理操作都會記錄到日誌：

```log
INFO user_id="admin-123" "Admin initiated PURGE ALL operation"
INFO user_id="admin-123" dirs=15 files=234 bytes=5368709120 "PURGE ALL completed"
```

### 3. 備份策略

在執行 purge 操作前，建議先備份：

```bash
# 備份資料目錄
tar -czvf backup-$(date +%Y%m%d).tar.gz ./data
```

---

## 自動清理設定

### Docker Compose 配置

使用 `--profile cleanup` 啟用自動清理：

```bash
docker compose --profile cleanup up -d
```

### 清理排程

預設每天凌晨 3:00 執行清理：

```yaml
labels:
  ofelia.job-exec.cleanup.schedule: "0 3 * * *"
```

### 清理邏輯

1. 刪除超過 24 小時的檔案
2. 刪除空目錄
3. 同時清理 uploads 和 output 目錄

---

## 相關文件

- [安全性設定](../配置設定/安全性.md)
- [部署指南](../部署指南/Docker部署.md)
- [RAS API 文件](RAS-API完整使用文件.md)
