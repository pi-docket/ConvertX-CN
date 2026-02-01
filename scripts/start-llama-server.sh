#!/bin/bash
# ==============================================================================
# llama.cpp Server 啟動腳本
# ==============================================================================
#
# 📦 說明：
#   啟動 llama.cpp server 載入 MinerU VLM GGUF 模型
#   提供 OpenAI 相容 API 供 MinerU vlm-http-client 使用
#
# 🔧 使用方式：
#   /opt/convertx/start-llama-server.sh
#
# 📌 環境變數：
#   LLAMA_SERVER_HOST - 監聽地址（預設：127.0.0.1）
#   LLAMA_SERVER_PORT - 監聽端口（預設：11785）
#   LLAMA_CTX_SIZE    - Context size（預設：4096）
#
# ==============================================================================

set -e

# 顏色輸出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[OK]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }
log_check() { echo -e "${CYAN}[CHECK]${NC} $1"; }

# 模型路徑
VLM_MODEL_DIR="/opt/convertx/models/vlm/mineru2.5-2509-1.2b"
MAIN_MODEL="$VLM_MODEL_DIR/MinerU2.5-2509-1.2B.Q6_K.gguf"
MMPROJ_MODEL="$VLM_MODEL_DIR/MinerU2.5-2509-1.2B.mmproj-Q8_0.gguf"
LLAMA_PATH="/usr/local/bin/llama-server"

# 伺服器設定
HOST="${LLAMA_SERVER_HOST:-127.0.0.1}"
PORT="${LLAMA_SERVER_PORT:-11785}"
CTX_SIZE="${LLAMA_CTX_SIZE:-4096}"

# ==============================================================================
# 依賴檢查函數
# ==============================================================================
check_dependencies() {
    log_check "檢查 llama-server 依賴..."
    
    # 檢查執行檔
    if [ ! -f "$LLAMA_PATH" ]; then
        log_error "llama-server 執行檔不存在: $LLAMA_PATH"
        log_warn ""
        log_warn "💡 解決方案："
        log_warn "   1️⃣  使用 Docker 環境（推薦）"
        log_warn "   2️⃣  從 llama.cpp 官方 Release 下載"
        log_warn "   3️⃣  從源碼編譯 llama.cpp"
        exit 1
    fi
    
    # 檢查執行權限
    if [ ! -x "$LLAMA_PATH" ]; then
        log_warn "llama-server 無執行權限，嘗試修正..."
        chmod +x "$LLAMA_PATH" || {
            log_error "無法修正權限"
            exit 1
        }
    fi
    
    # 檢查動態連結庫
    if command -v ldd &> /dev/null; then
        local LDD_OUTPUT
        LDD_OUTPUT=$(ldd "$LLAMA_PATH" 2>&1)
        
        if echo "$LDD_OUTPUT" | grep -q "not found"; then
            log_error "llama-server 缺少以下動態連結庫:"
            echo "$LDD_OUTPUT" | grep "not found" | while read -r line; do
                local LIB_NAME=$(echo "$line" | awk '{print $1}')
                log_error "  • $LIB_NAME"
            done
            echo ""
            log_warn "┌─────────────────────────────────────────────────────────────┐"
            log_warn "│ 💡 這是因為 llama-server 需要與其編譯時產生的                 │"
            log_warn "│    動態連結庫（如 libmtmd.so）一起使用。                      │"
            log_warn "├─────────────────────────────────────────────────────────────┤"
            log_warn "│ 解決方案：                                                   │"
            log_warn "│ 1️⃣  使用 Docker 環境（已包含所有依賴）                        │"
            log_warn "│ 2️⃣  從 llama.cpp 官方 Release 下載完整版本                   │"
            log_warn "│ 3️⃣  從源碼編譯並複製所有 .so 檔案到 /usr/local/lib           │"
            log_warn "└─────────────────────────────────────────────────────────────┘"
            exit 1
        fi
    fi
    
    # 嘗試執行 --version 驗證
    if ! "$LLAMA_PATH" --version &>/dev/null; then
        local ERROR_OUTPUT
        ERROR_OUTPUT=$("$LLAMA_PATH" --version 2>&1 || true)
        
        if echo "$ERROR_OUTPUT" | grep -q "cannot open shared object file"; then
            local MISSING_LIB=$(echo "$ERROR_OUTPUT" | grep -oP 'error while loading shared libraries: \K\S+' || echo "unknown")
            log_error "llama-server 無法載入動態連結庫: $MISSING_LIB"
            log_warn "請確保所有必要的 .so 檔案都在 /usr/local/lib 或 LD_LIBRARY_PATH 中"
            exit 1
        fi
        
        log_error "llama-server 執行失敗"
        exit 1
    fi
    
    log_success "llama-server 依賴檢查通過"
}

# ==============================================================================
# 主程式
# ==============================================================================

# 執行依賴檢查
check_dependencies

# 檢查模型是否存在
if [ ! -f "$MAIN_MODEL" ]; then
    log_error "找不到主模型：$MAIN_MODEL"
    log_info "💡 請先下載模型：./scripts/download-vlm-gguf.sh"
    exit 1
fi

if [ ! -f "$MMPROJ_MODEL" ]; then
    log_error "找不到視覺投影器：$MMPROJ_MODEL"
    log_info "💡 請先下載模型：./scripts/download-vlm-gguf.sh"
    exit 1
fi

log_info "🚀 啟動 llama.cpp server..."
log_info "   主模型：$(basename $MAIN_MODEL)"
log_info "   視覺投影器：$(basename $MMPROJ_MODEL)"
log_info "   監聽：$HOST:$PORT"
log_info "   Context Size：$CTX_SIZE"
echo ""

exec "$LLAMA_PATH" \
    -m "$MAIN_MODEL" \
    --mmproj "$MMPROJ_MODEL" \
    --host "$HOST" \
    --port "$PORT" \
    -c "$CTX_SIZE" \
    -ngl 0 \
    --log-disable
