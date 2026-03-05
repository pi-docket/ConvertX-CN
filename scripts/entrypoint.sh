#!/bin/bash
# ==============================================================================
# ConvertX-CN 啟動腳本（pipeline-only）
# ==============================================================================

set -e

echo "=============================================="
echo "  ConvertX-CN 啟動中..."
echo "=============================================="
echo ""

echo "[INFO] 本地 LLM / llama.cpp 功能已移除"
echo "[INFO] MinerU 使用 pipeline 模式"
export MINERU_BACKEND="pipeline"
export VLM_AVAILABLE="false"
export VLM_FALLBACK="true"

echo "[INFO] 啟動 ConvertX-CN 主程式..."
exec bun run dist/src/index.js "$@"
