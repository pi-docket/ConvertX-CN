#!/bin/bash
# ==============================================================================
# VLM Server 管理腳本（按需啟動/停止）
# ==============================================================================
#
# 📦 說明：
#   管理 llama.cpp VLM server 的啟動、停止、狀態檢查
#   支援按需啟動（on-demand）模式
#
# 📌 用法：
#   vlm-server-manager.sh start   - 啟動 VLM server
#   vlm-server-manager.sh stop    - 停止 VLM server
#   vlm-server-manager.sh status  - 檢查狀態
#   vlm-server-manager.sh verify  - 驗證能否啟動（不實際啟動）
#   vlm-server-manager.sh ensure  - 確保運行中（如果沒運行則啟動）
#
# ==============================================================================

# 顏色輸出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[VLM]${NC} $1"; }
log_success() { echo -e "${GREEN}[VLM]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[VLM]${NC} $1"; }
log_error() { echo -e "${RED}[VLM]${NC} $1"; }

# 配置
LLAMA_PATH="${LLAMA_PATH:-/usr/local/bin/llama-server}"
VLM_MODEL="${VLM_GGUF_MODEL:-/opt/convertx/models/vlm/mineru2.5-2509-1.2b/MinerU2.5-2509-1.2B.Q6_K.gguf}"
VLM_MMPROJ="${VLM_GGUF_MMPROJ:-/opt/convertx/models/vlm/mineru2.5-2509-1.2b/MinerU2.5-2509-1.2B.mmproj-Q8_0.gguf}"
VLM_HOST="${LLAMA_SERVER_HOST:-127.0.0.1}"
VLM_PORT="${LLAMA_SERVER_PORT:-11785}"
VLM_CTX_SIZE="${LLAMA_CTX_SIZE:-16384}"
VLM_BATCH_SIZE="${LLAMA_BATCH_SIZE:-2048}"
VLM_UBATCH_SIZE="${LLAMA_UBATCH_SIZE:-512}"
VLM_IMAGE_MAX_TOKENS="${LLAMA_IMAGE_MAX_TOKENS:-4096}"

# PID 檔案位置
PID_FILE="/tmp/llama-server.pid"
LOG_FILE="/tmp/llama-server.log"

# ==============================================================================
# 輔助函數
# ==============================================================================

get_pid() {
    if [ -f "$PID_FILE" ]; then
        cat "$PID_FILE"
    else
        echo ""
    fi
}

is_running() {
    local pid=$(get_pid)
    if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
        return 0
    fi
    return 1
}

wait_for_ready() {
    local max_wait="${1:-120}"
    local waited=0
    
    while [ $waited -lt $max_wait ]; do
        if curl -s "http://$VLM_HOST:$VLM_PORT/health" > /dev/null 2>&1; then
            return 0
        fi
        sleep 1
        waited=$((waited + 1))
        
        # 每 10 秒顯示進度
        if [ $((waited % 10)) -eq 0 ]; then
            log_info "等待中... (${waited}s / ${max_wait}s)"
        fi
    done
    
    return 1
}

# ==============================================================================
# 驗證函數（檢查能否啟動，但不實際啟動）
# ==============================================================================
verify() {
    log_info "驗證 VLM server 配置..."
    
    # 檢查執行檔
    if [ ! -f "$LLAMA_PATH" ]; then
        log_error "llama-server 執行檔不存在: $LLAMA_PATH"
        return 1
    fi
    
    if [ ! -x "$LLAMA_PATH" ]; then
        log_warn "llama-server 無執行權限，嘗試修正..."
        chmod +x "$LLAMA_PATH" 2>/dev/null || {
            log_error "無法修正執行權限"
            return 1
        }
    fi
    
    # 檢查動態連結庫
    if command -v ldd &> /dev/null; then
        local ldd_output
        ldd_output=$(ldd "$LLAMA_PATH" 2>&1)
        
        if echo "$ldd_output" | grep -q "not found"; then
            log_error "llama-server 缺少動態連結庫:"
            echo "$ldd_output" | grep "not found" | awk '{print "  • " $1}'
            return 1
        fi
    fi
    
    # 嘗試執行 --version
    if ! "$LLAMA_PATH" --version &>/dev/null; then
        log_error "llama-server 無法執行"
        return 1
    fi
    
    # 檢查模型檔案
    if [ ! -f "$VLM_MODEL" ]; then
        log_error "VLM 模型不存在: $VLM_MODEL"
        return 1
    fi
    
    if [ ! -f "$VLM_MMPROJ" ]; then
        log_error "VLM 投影器不存在: $VLM_MMPROJ"
        return 1
    fi
    
    log_success "VLM server 配置驗證通過"
    log_info "  模型: $(basename $VLM_MODEL)"
    log_info "  投影器: $(basename $VLM_MMPROJ)"
    log_info "  監聽: $VLM_HOST:$VLM_PORT"
    return 0
}

# ==============================================================================
# 啟動函數
# ==============================================================================
start() {
    # 如果已經在運行，直接返回成功
    if is_running; then
        log_info "VLM server 已在運行中 (PID: $(get_pid))"
        return 0
    fi
    
    # 先驗證配置
    if ! verify; then
        log_error "配置驗證失敗，無法啟動"
        return 1
    fi
    
    log_info "啟動 VLM server..."
    log_info "  Context Size: $VLM_CTX_SIZE"
    log_info "  Batch Size: $VLM_BATCH_SIZE"
    log_info "  Image Max Tokens: $VLM_IMAGE_MAX_TOKENS"
    
    # 背景啟動
    nohup "$LLAMA_PATH" \
        -m "$VLM_MODEL" \
        --mmproj "$VLM_MMPROJ" \
        --host "$VLM_HOST" \
        --port "$VLM_PORT" \
        -c "$VLM_CTX_SIZE" \
        -b "$VLM_BATCH_SIZE" \
        -ub "$VLM_UBATCH_SIZE" \
        --image-max-tokens "$VLM_IMAGE_MAX_TOKENS" \
        --flash-attn off \
        --cache-type-k q8_0 \
        --cache-type-v q8_0 \
        -ngl 0 \
        --log-disable \
        > "$LOG_FILE" 2>&1 &
    
    local pid=$!
    echo "$pid" > "$PID_FILE"
    
    log_info "等待 VLM server 就緒 (PID: $pid)..."
    
    # 等待就緒（最多 120 秒，因為 CPU 模式較慢）
    if wait_for_ready 120; then
        log_success "VLM server 已就緒 (http://$VLM_HOST:$VLM_PORT)"
        return 0
    else
        log_error "VLM server 啟動逾時"
        stop
        return 1
    fi
}

# ==============================================================================
# 停止函數
# ==============================================================================
stop() {
    local pid=$(get_pid)
    
    if [ -z "$pid" ]; then
        log_info "VLM server 未運行"
        rm -f "$PID_FILE"
        return 0
    fi
    
    if ! kill -0 "$pid" 2>/dev/null; then
        log_info "VLM server 進程已不存在"
        rm -f "$PID_FILE"
        return 0
    fi
    
    log_info "停止 VLM server (PID: $pid)..."
    
    # 嘗試優雅終止
    kill -TERM "$pid" 2>/dev/null
    
    # 等待最多 10 秒
    local waited=0
    while [ $waited -lt 10 ]; do
        if ! kill -0 "$pid" 2>/dev/null; then
            log_success "VLM server 已停止"
            rm -f "$PID_FILE"
            return 0
        fi
        sleep 1
        waited=$((waited + 1))
    done
    
    # 強制終止
    log_warn "強制終止 VLM server..."
    kill -9 "$pid" 2>/dev/null
    rm -f "$PID_FILE"
    log_success "VLM server 已強制停止"
    return 0
}

# ==============================================================================
# 狀態函數
# ==============================================================================
status() {
    if is_running; then
        local pid=$(get_pid)
        log_success "VLM server 運行中 (PID: $pid)"
        
        # 檢查健康狀態
        if curl -s "http://$VLM_HOST:$VLM_PORT/health" > /dev/null 2>&1; then
            log_success "  健康狀態: OK"
        else
            log_warn "  健康狀態: 無響應"
        fi
        
        return 0
    else
        log_info "VLM server 未運行"
        return 1
    fi
}

# ==============================================================================
# 確保運行（按需啟動）
# ==============================================================================
ensure() {
    if is_running; then
        # 進一步檢查是否真的可用
        if curl -s "http://$VLM_HOST:$VLM_PORT/health" > /dev/null 2>&1; then
            log_info "VLM server 已就緒"
            return 0
        else
            log_warn "VLM server 進程存在但無響應，重啟中..."
            stop
        fi
    fi
    
    start
}

# ==============================================================================
# 主入口
# ==============================================================================
case "${1:-status}" in
    start)
        start
        ;;
    stop)
        stop
        ;;
    status)
        status
        ;;
    verify)
        verify
        ;;
    ensure)
        ensure
        ;;
    restart)
        stop
        start
        ;;
    *)
        echo "用法: $0 {start|stop|status|verify|ensure|restart}"
        exit 1
        ;;
esac
