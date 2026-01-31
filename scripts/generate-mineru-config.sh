#!/bin/bash
# ==============================================================================
# MinerU 配置檔產生腳本
# 用於 Docker build 階段產生 mineru.json
# ==============================================================================
#
# 📦 配置說明：
#   - models-dir.pipeline: PDF-Extract-Kit-1.0 路徑（純 OCR 模式）
#   - models-dir.vlm: VLM 模型路徑（高精度模式）
#   - VLM GGUF 模型透過 llama.cpp server 載入
#   - MinerU 使用 vlm-http-client 連接本地 llama.cpp server
#
# 💡 架構說明：
#   ┌─────────────────┐     ┌─────────────────┐
#   │   ConvertX      │────▶│     MinerU      │
#   └─────────────────┘     └────────┬────────┘
#                                    │
#                           vlm-http-client
#                                    │
#                                    ▼
#                          ┌─────────────────┐
#                          │  llama.cpp      │
#                          │  (GGUF VLM)     │
#                          └─────────────────┘
#
# ==============================================================================

set -e

ARCH=$(uname -m)
MODELS_DIR="${MINERU_MODELS_DIR:-/opt/convertx/models/mineru}"
VLM_MODELS_DIR="/opt/convertx/models/vlm/mineru2.5-2509-1.2b"

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
vlm_models_dir = '/opt/convertx/models/vlm/mineru2.5-2509-1.2b'

# 檢查 GGUF 模型是否存在
gguf_model_path = f'{vlm_models_dir}/MinerU2.5-2509-1.2B.Q6_K.gguf'
mmproj_path = f'{vlm_models_dir}/MinerU2.5-2509-1.2B.mmproj-Q8_0.gguf'

gguf_available = os.path.isfile(gguf_model_path) and os.path.isfile(mmproj_path)

if gguf_available:
    print('✅ GGUF VLM 模型已就緒（Q6_K 量化版）')
    print(f'   主模型: {os.path.basename(gguf_model_path)}')
    print(f'   視覺投影器: {os.path.basename(mmproj_path)}')
    print('')
    print('💡 VLM 模式將透過 llama.cpp server 提供：')
    print('   - llama.cpp server 監聽於 http://127.0.0.1:11785')
    print('   - MinerU 使用 vlm-http-client 後端連接')
else:
    print('⚠️ GGUF VLM 模型未找到，將使用 pipeline 純 OCR 模式')
    print(f'   預期路徑: {gguf_model_path}')
    print('💡 如需 VLM 高精度模式，請執行：')
    print('   ./scripts/download-vlm-gguf.sh')

# MinerU 2.7+ 配置
# ==============================================================================
# 📌 關鍵配置說明：
#
# 1. models-dir.pipeline: PDF-Extract-Kit-1.0
#    - 用於 pipeline 後端（純 OCR 模式）
#    - 準確率：82+
#    - 不需要 GPU
#
# 2. models-dir.vlm: 指向 pipeline 路徑（防止 "not configured" 錯誤）
#    - MinerU 設計上會讀取此路徑，即使不使用 VLM
#    - 實際 VLM 推理透過 vlm-http-client 連接外部服務
#    - 這裡設為 pipeline 路徑只是為了通過配置驗證
#
# 3. GGUF 模型：
#    - 由 llama.cpp server 載入
#    - 不走 MinerU 原生 transformers 路徑
#    - 透過 OpenAI 相容 API 提供服務
#
# ==============================================================================
config = {
    'models-dir': {
        'pipeline': f'{mineru_models_dir}/PDF-Extract-Kit-1.0',
        # 📌 重要：此路徑必須非空，否則會觸發 "vlm not configured" 錯誤
        # 📌 實際 VLM 推理走 http-client，不讀取此路徑的模型
        'vlm': f'{mineru_models_dir}/PDF-Extract-Kit-1.0'
    },
    'model-source': 'local',
    'config_version': '1.3.1',
    # GGUF 模型配置（供參考，llama.cpp 使用）
    'gguf-models': {
        'enabled': gguf_available,
        'model': gguf_model_path if gguf_available else '',
        'mmproj': mmproj_path if gguf_available else '',
        'server-url': 'http://127.0.0.1:11785/v1',
        'note': 'GGUF models loaded by llama.cpp server'
    },
    'latex-delimiter-config': {
        'display': {'left': '$$', 'right': '$$'},
        'inline': {'left': '$', 'right': '$'}
    }
}

os.makedirs('/opt/convertx', exist_ok=True)

with open('/opt/convertx/mineru.json', 'w') as f:
    json.dump(config, f, indent=2)

with open('/root/mineru.json', 'w') as f:
    json.dump(config, f, indent=2)

print(f'\n📋 mineru.json 配置：')
print(f'  Pipeline 模型: {config["models-dir"]["pipeline"]}')
print(f'  VLM 配置: {"已啟用 (GGUF + llama.cpp)" if gguf_available else "未啟用 (使用 pipeline)"}')
print(f'  Model Source: {config["model-source"]}')
print('✅ mineru.json 已產生')
PYTHON

echo "✅ MinerU 配置檔產生完成"
