#!/bin/bash
# ==============================================================================
# MinerU 配置檔產生腳本
# 用於 Docker build 階段產生 mineru.json
# 支援 Pipeline 模式（使用 GGUF 量化 VLM 模型需搭配 llama.cpp）
# ==============================================================================
#
# 📦 配置說明：
#   - models-dir.pipeline: PDF-Extract-Kit-1.0 路徑
#   - GGUF VLM 模型不在此配置，需獨立啟動 llama.cpp 服務器
#   - MinerU 使用 pipeline 後端（預設），或 vlm-http-client 連接外部服務
#
# 💡 GGUF 量化模型使用方式：
#    1. 使用 llama.cpp 或 ollama 載入 GGUF 模型提供 OpenAI API
#    2. 設定環境變數 MINERU_VLM_URL=http://localhost:8080/v1
#    3. MinerU 將自動使用 vlm-http-client 模式
#
# ==============================================================================

set -e

ARCH=$(uname -m)
MODELS_DIR="${MINERU_MODELS_DIR:-/opt/convertx/models/mineru}"

mkdir -p /opt/convertx

if [ "$ARCH" = "aarch64" ]; then
    echo '{"models-dir":{"pipeline":"","vlm":""},"model-source":"local","note":"ARM64 - MinerU not supported"}' > /opt/convertx/mineru.json
    cp /opt/convertx/mineru.json /root/mineru.json
    echo "⚠️ ARM64：產生空的 mineru.json"
    exit 0
fi

python3 <<'PYTHON'
import json
import os

mineru_models_dir = os.environ.get('MINERU_MODELS_DIR', '/opt/convertx/models/mineru')

# 檢查 GGUF 模型是否存在
gguf_dir = f'{mineru_models_dir}/MinerU-VLM-GGUF'
gguf_model_path = f'{gguf_dir}/MinerU2.5-2509-1.2B.Q8_0.gguf'
mmproj_path = f'{gguf_dir}/mmproj-MinerU2.5-2509-1.2B-f16.gguf'

gguf_available = os.path.isfile(gguf_model_path) and os.path.isfile(mmproj_path)

if gguf_available:
    print('✅ GGUF VLM 模型已就緒')
    print(f'   主模型: {gguf_model_path}')
    print(f'   視覺投影器: {mmproj_path}')
    print('')
    print('💡 使用 GGUF 模型的步驟：')
    print('   1. 啟動 llama.cpp 服務器：')
    print(f'      llama-server -m {gguf_model_path} --mmproj {mmproj_path} --port 8080')
    print('   2. 設定 MinerU 使用 http-client 模式：')
    print('      mineru -p input.pdf -o output -b vlm-http-client -u http://localhost:8080/v1')
else:
    print('⚠️ GGUF VLM 模型未找到')
    print('💡 將使用 pipeline 模式（純 OCR，不使用 VLM）')

# MinerU 2.7+ 配置
# 📌 重要：由於使用 GGUF 模型，VLM 路徑留空
# 📌 MinerU 將預設使用 pipeline 後端
# 📌 若要使用 VLM，需手動啟動 llama.cpp 並使用 http-client 模式
config = {
    'models-dir': {
        'pipeline': f'{mineru_models_dir}/PDF-Extract-Kit-1.0',
        'vlm': ''  # GGUF 模型不直接在此配置
    },
    'model-source': 'local',
    'config_version': '1.3.1',
    'gguf_models': {
        'model': gguf_model_path if gguf_available else '',
        'mmproj': mmproj_path if gguf_available else '',
        'note': 'GGUF models for llama.cpp server, not native MinerU'
    },
    'latex-delimiter-config': {
        'display': {'left': '@@', 'right': '@@'},
        'inline': {'left': '@', 'right': '@'}
    }
}

os.makedirs('/opt/convertx', exist_ok=True)

with open('/opt/convertx/mineru.json', 'w') as f:
    json.dump(config, f, indent=2)

with open('/root/mineru.json', 'w') as f:
    json.dump(config, f, indent=2)

print(f'\n📋 mineru.json 配置：')
print(f'  Pipeline: {config["models-dir"]["pipeline"]}')
print(f'  Model Source: {config["model-source"]}')
if gguf_available:
    print(f'  GGUF Model: {os.path.basename(gguf_model_path)} (需搭配 llama.cpp)')
print('✅ mineru.json 已產生')
PYTHON

echo "✅ MinerU 配置檔產生完成"
