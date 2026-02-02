#!/bin/bash
# ==============================================================================
# ConvertX-CN 啟動腳本
# ==============================================================================
#
# 📦 說明：
#   此腳本作為 Docker 容器的入口點
#   1. 驗證 llama.cpp server 配置（如果是 VLM 模式）
#   2. VLM server 採用按需啟動模式，不在啟動時常駐
#   3. 啟動主應用程式
#
# 📌 環境變數：
#   MINERU_BACKEND     - 後端選擇（vlm-http-client / pipeline）
#   LLAMA_SERVER_PORT  - llama.cpp 端口（預設：11785）
#   SKIP_LLAMA_SERVER  - 設為 1 跳過 llama.cpp 驗證
#
# ==============================================================================

set -e

# 顏色輸出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[OK]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }
log_config() { echo -e "${GREEN}[CONFIG]${NC} $1"; }
log_backend() { echo -e "${BLUE}[BACKEND]${NC} $1"; }
log_check() { echo -e "${CYAN}[CHECK]${NC} $1"; }

# ==============================================================================
# 依賴檢查函數
# ==============================================================================

# 檢查 llama-server 是否可執行（包含動態連結庫檢查）
check_llama_server_dependencies() {
    local LLAMA_PATH="$1"
    
    log_check "檢查 llama-server 依賴..."
    
    # 檢查執行檔是否存在
    if [ ! -f "$LLAMA_PATH" ]; then
        log_error "llama-server 執行檔不存在: $LLAMA_PATH"
        return 1
    fi
    
    # 檢查執行權限
    if [ ! -x "$LLAMA_PATH" ]; then
        log_error "llama-server 無執行權限: $LLAMA_PATH"
        log_info "嘗試修正權限..."
        chmod +x "$LLAMA_PATH" 2>/dev/null || {
            log_error "無法修正權限"
            return 1
        }
    fi
    
    # 使用 ldd 檢查動態連結庫
    if command -v ldd &> /dev/null; then
        local LDD_OUTPUT
        LDD_OUTPUT=$(ldd "$LLAMA_PATH" 2>&1)
        
        # 檢查是否有 "not found" 的 library
        if echo "$LDD_OUTPUT" | grep -q "not found"; then
            log_error "llama-server 缺少以下動態連結庫:"
            echo "$LDD_OUTPUT" | grep "not found" | while read -r line; do
                local LIB_NAME=$(echo "$line" | awk '{print $1}')
                log_error "  • $LIB_NAME"
            done
            echo ""
            log_warn "┌─────────────────────────────────────────────────────────────┐"
            log_warn "│ 💡 解決方案：                                                │"
            log_warn "├─────────────────────────────────────────────────────────────┤"
            log_warn "│ 1️⃣  使用 Docker 環境（推薦）                                 │"
            log_warn "│     docker pull convertx/convertx-cn:latest                 │"
            log_warn "│                                                             │"
            log_warn "│ 2️⃣  從 llama.cpp 官方 Release 下載完整版本                   │"
            log_warn "│     https://github.com/ggml-org/llama.cpp/releases          │"
            log_warn "│                                                             │"
            log_warn "│ 3️⃣  從源碼編譯 llama.cpp（確保複製所有 .so 檔案）            │"
            log_warn "└─────────────────────────────────────────────────────────────┘"
            echo ""
            return 1
        fi
    fi
    
    # 嘗試執行 --version 驗證
    if ! "$LLAMA_PATH" --version &>/dev/null; then
        local ERROR_OUTPUT
        ERROR_OUTPUT=$("$LLAMA_PATH" --version 2>&1 || true)
        
        if echo "$ERROR_OUTPUT" | grep -q "cannot open shared object file"; then
            local MISSING_LIB=$(echo "$ERROR_OUTPUT" | grep -oP 'error while loading shared libraries: \K\S+')
            log_error "llama-server 無法載入動態連結庫: $MISSING_LIB"
            log_warn "系統將回退到 pipeline 模式"
            return 1
        fi
        
        log_error "llama-server 執行失敗: $ERROR_OUTPUT"
        return 1
    fi
    
    log_success "llama-server 依賴檢查通過"
    return 0
}

# ==============================================================================
# VLM Server 驗證邏輯（按需啟動模式）
# ==============================================================================
verify_vlm_server() {
    local PORT="${LLAMA_SERVER_PORT:-11785}"
    local HOST="${LLAMA_SERVER_HOST:-127.0.0.1}"
    local MODEL="${VLM_GGUF_MODEL:-/opt/convertx/models/vlm/mineru2.5-2509-1.2b/MinerU2.5-2509-1.2B.Q6_K.gguf}"
    local MMPROJ="${VLM_GGUF_MMPROJ:-/opt/convertx/models/vlm/mineru2.5-2509-1.2b/MinerU2.5-2509-1.2B.mmproj-Q8_0.gguf}"
    
    # 檢查是否應該跳過
    if [ "${SKIP_LLAMA_SERVER}" = "1" ]; then
        log_config "SKIP_LLAMA_SERVER=1，跳過 VLM 驗證"
        return 0
    fi
    
    # 只有當明確設定為 VLM 模式時才驗證
    if [ "${MINERU_BACKEND}" != "vlm-http-client" ] && [ "${MINERU_BACKEND}" != "hybrid-http-client" ]; then
        log_config "模式：${MINERU_BACKEND:-pipeline}"
        log_backend "使用 pipeline 模式（穩定，不需要 VLM）"
        return 0
    fi
    
    # 使用者選擇了 VLM 模式，進行驗證
    log_info "MinerU 後端：vlm-http-client（按需啟動模式）"
    log_info "VLM URL：http://${HOST}:${PORT}/v1"
    
    # ==== 使用依賴檢查函數 ====
    local LLAMA_PATH="/usr/local/bin/llama-server"
    if ! check_llama_server_dependencies "$LLAMA_PATH"; then
        log_warn "llama-server 依賴檢查失敗"
        log_warn "系統將自動回退到 pipeline 模式"
        export VLM_AVAILABLE="false"
        export VLM_FALLBACK_REASON="missing_dependencies"
        return 1
    fi
    
    # 檢查模型檔案
    if [ ! -f "$MODEL" ]; then
        log_error "VLM 模型不存在：$MODEL"
        log_warn "系統將自動回退到 pipeline 模式"
        export VLM_AVAILABLE="false"
        export VLM_FALLBACK_REASON="missing_model"
        return 1
    fi
    
    if [ ! -f "$MMPROJ" ]; then
        log_error "VLM 投影器模型不存在：$MMPROJ"
        log_warn "系統將自動回退到 pipeline 模式"
        export VLM_AVAILABLE="false"
        export VLM_FALLBACK_REASON="missing_mmproj"
        return 1
    fi
    
    # 驗證通過
    log_success "VLM 配置驗證通過"
    log_info "  模型：$(basename $MODEL)"
    log_info "  投影器：$(basename $MMPROJ)"
    log_info "  💡 VLM server 將在需要時按需啟動"
    
    export VLM_AVAILABLE="true"
    export VLM_ON_DEMAND="true"
    return 0
}

# ==============================================================================
# 主程式
# ==============================================================================
main() {
    echo "=============================================="
    echo "  ConvertX-CN 啟動中..."
    echo "=============================================="
    echo ""
    
    # 顯示配置（預設為 pipeline）
    local CONFIGURED_MODE="${MINERU_BACKEND:-pipeline}"
    log_config "設定模式：${CONFIGURED_MODE}"
    
    # 驗證 VLM 配置（只驗證，不啟動）
    if verify_vlm_server; then
        if [ "${VLM_ON_DEMAND}" = "true" ]; then
            log_backend "VLM 模式就緒（按需啟動）"
        else
            log_backend "後端就緒：${MINERU_BACKEND:-pipeline}"
        fi
    else
        # VLM 驗證失敗，自動回退到 pipeline 模式
        log_warn "回退到 pipeline 模式"
        export MINERU_BACKEND="pipeline"
        export VLM_AVAILABLE="false"
        export VLM_FALLBACK="true"
    fi
    
    echo ""
    log_info "最終後端設定：${MINERU_BACKEND:-pipeline}"
    if [ "${VLM_ON_DEMAND}" = "true" ]; then
        log_info "💡 VLM server 將在首次使用時啟動"
    fi
    echo ""
    
    # 啟動主應用程式
    log_info "啟動 ConvertX-CN 主程式..."
    exec bun run dist/src/index.js "$@"
}

# 執行
main "$@"
