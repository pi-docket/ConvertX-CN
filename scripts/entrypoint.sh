#!/bin/bash
# ==============================================================================
# ConvertX-CN 啟動腳本（包含 llama.cpp VLM server）
# ==============================================================================
#
# 📦 說明：
#   此腳本作為 Docker 容器的入口點
#   1. 根據使用者設定決定是否啟動 llama.cpp server
#   2. 等待 server 就緒（如果需要）
#   3. 啟動主應用程式
#
# 📌 環境變數：
#   MINERU_BACKEND     - 後端選擇（vlm-http-client / pipeline）
#   LLAMA_SERVER_PORT  - llama.cpp 端口（預設：11785）
#   SKIP_LLAMA_SERVER  - 設為 1 跳過 llama.cpp 啟動
#
# ==============================================================================

set -e

# 顏色輸出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[OK]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }
log_config() { echo -e "${GREEN}[CONFIG]${NC} $1"; }
log_backend() { echo -e "${BLUE}[BACKEND]${NC} $1"; }

# ==============================================================================
# VLM Server 啟動邏輯
# ==============================================================================
start_vlm_server() {
    local PORT="${LLAMA_SERVER_PORT:-11785}"
    local HOST="${LLAMA_SERVER_HOST:-127.0.0.1}"
    local MODEL="${VLM_GGUF_MODEL:-/opt/convertx/models/vlm/mineru2.5-2509-1.2b/MinerU2.5-2509-1.2B.Q6_K.gguf}"
    local MMPROJ="${VLM_GGUF_MMPROJ:-/opt/convertx/models/vlm/mineru2.5-2509-1.2b/MinerU2.5-2509-1.2B.mmproj-Q8_0.gguf}"
    
    # 檢查是否應該跳過
    if [ "${SKIP_LLAMA_SERVER}" = "1" ]; then
        log_config "SKIP_LLAMA_SERVER=1，跳過 llama.cpp server"
        return 0
    fi
    
    # 只有當明確設定為 VLM 模式時才嘗試啟動
    if [ "${MINERU_BACKEND}" != "vlm-http-client" ] && [ "${MINERU_BACKEND}" != "hybrid-http-client" ]; then
        log_config "模式：${MINERU_BACKEND:-pipeline}"
        log_backend "使用 pipeline 模式（穩定，不需要 VLM）"
        return 0
    fi
    
    # 使用者選擇了 VLM 模式
    log_info "MinerU 後端：vlm-http-client"
    log_info "VLM URL：http://${HOST}:${PORT}/v1"
    
    # 檢查 llama-server 是否安裝
    if ! command -v llama-server &> /dev/null; then
        log_error "llama-server 未安裝"
        log_info "  預期路徑：/usr/local/bin/llama-server"
        log_info "  PATH：$PATH"
        # 檢查檔案是否存在但不在 PATH 中
        if [ -f "/usr/local/bin/llama-server" ]; then
            log_info "  檔案存在但無法執行，檢查權限和依賴..."
            ls -la /usr/local/bin/llama-server
            ldd /usr/local/bin/llama-server 2>&1 || true
        fi
        export VLM_AVAILABLE="false"
        return 1
    fi
    
    # 檢查模型檔案
    if [ ! -f "$MODEL" ]; then
        log_error "VLM 模型不存在：$MODEL"
        export VLM_AVAILABLE="false"
        return 1
    fi
    
    if [ ! -f "$MMPROJ" ]; then
        log_error "VLM 投影器模型不存在：$MMPROJ"
        export VLM_AVAILABLE="false"
        return 1
    fi
    
    log_backend "啟動 llama.cpp VLM server..."
    log_info "  模型：$(basename $MODEL)"
    log_info "  投影器：$(basename $MMPROJ)"
    log_info "  監聽：$HOST:$PORT"
    
    # 背景啟動 llama.cpp server
    llama-server \
        -m "$MODEL" \
        --mmproj "$MMPROJ" \
        --host "$HOST" \
        --port "$PORT" \
        -c "${LLAMA_CTX_SIZE:-4096}" \
        -ngl 0 \
        --log-disable \
        2>&1 | while read -r line; do echo "[llama] $line"; done &
    
    LLAMA_PID=$!
    
    # 等待 server 就緒（最多 60 秒）
    log_info "等待 llama.cpp server 就緒..."
    local MAX_WAIT=60
    local WAITED=0
    
    while [ $WAITED -lt $MAX_WAIT ]; do
        if curl -s "http://$HOST:$PORT/health" > /dev/null 2>&1; then
            log_success "llama.cpp server 就緒 (http://$HOST:$PORT)"
            export VLM_AVAILABLE="true"
            return 0
        fi
        
        # 檢查進程是否還在運行
        if ! kill -0 $LLAMA_PID 2>/dev/null; then
            log_error "llama.cpp server 啟動失敗"
            export VLM_AVAILABLE="false"
            return 1
        fi
        
        sleep 1
        WAITED=$((WAITED + 1))
        
        if [ $((WAITED % 10)) -eq 0 ]; then
            log_info "  等待中... (${WAITED}s)"
        fi
    done
    
    log_error "llama.cpp server 啟動逾時 (${MAX_WAIT}s)"
    export VLM_AVAILABLE="false"
    
    # 嘗試終止殭屍進程
    kill $LLAMA_PID 2>/dev/null || true
    return 1
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
    
    # 嘗試啟動 VLM server（只有當設定為 VLM 模式時才會實際啟動）
    if start_vlm_server; then
        log_backend "後端就緒：${MINERU_BACKEND:-pipeline}"
    else
        # VLM 啟動失敗，自動回退到 pipeline 模式
        log_warn "回退到 pipeline 模式"
        export MINERU_BACKEND="pipeline"
        export VLM_AVAILABLE="false"
        export VLM_FALLBACK="true"
    fi
    
    echo ""
    log_info "最終後端設定：${MINERU_BACKEND:-pipeline}"
    echo ""
    
    # 啟動主應用程式
    log_info "啟動 ConvertX-CN 主程式..."
    exec bun run dist/src/index.js "$@"
}

# 執行
main "$@"
