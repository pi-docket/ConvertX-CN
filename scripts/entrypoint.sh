#!/bin/bash
# ==============================================================================
# ConvertX-CN 啟動腳本（包含 llama.cpp VLM server）
# ==============================================================================
#
# 📦 說明：
#   此腳本作為 Docker 容器的入口點
#   1. 檢查並啟動 llama.cpp server（背景運行）
#   2. 等待 server 就緒
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

# ==============================================================================
# VLM Server 啟動邏輯
# ==============================================================================
start_vlm_server() {
    local PORT="${LLAMA_SERVER_PORT:-11785}"
    local HOST="${LLAMA_SERVER_HOST:-127.0.0.1}"
    local MODEL="${VLM_GGUF_MODEL:-/opt/convertx/models/vlm/mineru2.5-2509-1.2b/MinerU2.5-2509-1.2B.Q6_K.gguf}"
    local MMPROJ="${VLM_GGUF_MMPROJ:-/opt/convertx/models/vlm/mineru2.5-2509-1.2b/MinerU2.5-2509-1.2B.mmproj-Q8_0.gguf}"
    
    # 檢查是否應該啟動
    if [ "${SKIP_LLAMA_SERVER}" = "1" ]; then
        log_warn "SKIP_LLAMA_SERVER=1，跳過 llama.cpp server"
        return 0
    fi
    
    # 檢查後端設定
    if [ "${MINERU_BACKEND}" != "vlm-http-client" ] && [ "${MINERU_BACKEND}" != "hybrid-http-client" ]; then
        log_info "MINERU_BACKEND=${MINERU_BACKEND}，不需要 llama.cpp server"
        return 0
    fi
    
    # 檢查 llama-server 是否可用
    if ! command -v llama-server &> /dev/null; then
        log_error "llama-server 未安裝"
        log_warn "回退到 pipeline 模式"
        export MINERU_BACKEND="pipeline"
        unset MINERU_VLM_URL
        return 0
    fi
    
    # 檢查模型檔案
    if [ ! -f "$MODEL" ]; then
        log_error "找不到 VLM 主模型：$MODEL"
        log_warn "回退到 pipeline 模式"
        export MINERU_BACKEND="pipeline"
        unset MINERU_VLM_URL
        return 0
    fi
    
    if [ ! -f "$MMPROJ" ]; then
        log_error "找不到視覺投影器：$MMPROJ"
        log_warn "回退到 pipeline 模式"
        export MINERU_BACKEND="pipeline"
        unset MINERU_VLM_URL
        return 0
    fi
    
    log_info "啟動 llama.cpp VLM server..."
    log_info "  主模型：$(basename $MODEL)"
    log_info "  視覺投影器：$(basename $MMPROJ)"
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
            log_success "llama.cpp server 已就緒 (http://$HOST:$PORT)"
            return 0
        fi
        
        # 檢查進程是否還在運行
        if ! kill -0 $LLAMA_PID 2>/dev/null; then
            log_error "llama.cpp server 啟動失敗"
            log_warn "回退到 pipeline 模式"
            export MINERU_BACKEND="pipeline"
            unset MINERU_VLM_URL
            return 0
        fi
        
        sleep 1
        WAITED=$((WAITED + 1))
        
        if [ $((WAITED % 10)) -eq 0 ]; then
            log_info "  等待中... (${WAITED}s)"
        fi
    done
    
    log_error "llama.cpp server 啟動超時（${MAX_WAIT}s）"
    log_warn "回退到 pipeline 模式"
    export MINERU_BACKEND="pipeline"
    unset MINERU_VLM_URL
    
    # 嘗試終止殭屍進程
    kill $LLAMA_PID 2>/dev/null || true
}

# ==============================================================================
# 主程式
# ==============================================================================
main() {
    echo "=============================================="
    echo "  ConvertX-CN 啟動中..."
    echo "=============================================="
    echo ""
    
    # 顯示配置
    log_info "MinerU 後端：${MINERU_BACKEND:-pipeline}"
    log_info "VLM URL：${MINERU_VLM_URL:-未設定}"
    
    # 啟動 VLM server（如果需要）
    start_vlm_server
    
    echo ""
    log_info "最終後端設定：${MINERU_BACKEND}"
    echo ""
    
    # 啟動主應用程式
    log_info "啟動 ConvertX-CN 主程式..."
    exec bun run dist/src/index.js "$@"
}

# 執行
main "$@"
