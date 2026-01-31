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

# 模型路徑
VLM_MODEL_DIR="/opt/convertx/models/vlm/mineru2.5-2509-1.2b"
MAIN_MODEL="$VLM_MODEL_DIR/MinerU2.5-2509-1.2B.Q6_K.gguf"
MMPROJ_MODEL="$VLM_MODEL_DIR/MinerU2.5-2509-1.2B.mmproj-Q8_0.gguf"

# 伺服器設定
HOST="${LLAMA_SERVER_HOST:-127.0.0.1}"
PORT="${LLAMA_SERVER_PORT:-11785}"
CTX_SIZE="${LLAMA_CTX_SIZE:-4096}"

# 檢查模型是否存在
if [ ! -f "$MAIN_MODEL" ]; then
    echo "❌ 找不到主模型：$MAIN_MODEL"
    echo "💡 請先下載模型：./scripts/download-vlm-gguf.sh"
    exit 1
fi

if [ ! -f "$MMPROJ_MODEL" ]; then
    echo "❌ 找不到視覺投影器：$MMPROJ_MODEL"
    echo "💡 請先下載模型：./scripts/download-vlm-gguf.sh"
    exit 1
fi

# 檢查 llama-server 是否可用
if ! command -v llama-server &> /dev/null; then
    echo "❌ llama-server 未安裝"
    exit 1
fi

echo "🚀 啟動 llama.cpp server..."
echo "   主模型：$(basename $MAIN_MODEL)"
echo "   視覺投影器：$(basename $MMPROJ_MODEL)"
echo "   監聽：$HOST:$PORT"
echo "   Context Size：$CTX_SIZE"
echo ""

exec llama-server \
    -m "$MAIN_MODEL" \
    --mmproj "$MMPROJ_MODEL" \
    --host "$HOST" \
    --port "$PORT" \
    -c "$CTX_SIZE" \
    -ngl 0 \
    --log-disable
