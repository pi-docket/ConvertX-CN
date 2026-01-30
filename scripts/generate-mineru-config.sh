#!/bin/bash
# ==============================================================================
# MinerU 配置檔產生腳本
# 用於 Docker build 階段產生 mineru.json
# 支援 Pipeline 和 VLM 模型配置
# ==============================================================================
#
# 📦 配置說明：
#   - models-dir.pipeline: PDF-Extract-Kit-1.0 路徑
#   - models-dir.vlm: VLM 模型路徑（自動偵測 MinerU2.5 或 MinerU-VLM）
#   - model-source: 'local' = 完全離線，'huggingface' = 線上補充
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

# 自動偵測 VLM 模型路徑
# 優先順序：MinerU2.5-2509-1.2B > MinerU-VLM > 空（會嘗試線上下載）
vlm_path = ''
vlm_candidates = [
    f'{mineru_models_dir}/MinerU2.5-2509-1.2B',
    f'{mineru_models_dir}/MinerU-VLM',
]
for candidate in vlm_candidates:
    if os.path.isdir(candidate):
        vlm_path = candidate
        print(f'✅ 偵測到 VLM 模型: {os.path.basename(candidate)}')
        break

if not vlm_path:
    print('⚠️ 未偵測到 VLM 模型，auto 模式可能需要線上下載')

# MinerU 2.7+ 配置
# - pipeline: PDF-Extract-Kit-1.0 模型路徑
# - vlm: VLM 模型路徑（用於 hybrid/auto 模式）
# 
# model-source 說明：
# - 'local': 完全離線，只使用本地模型
# - 'huggingface': 缺少的模型會從 HuggingFace 下載
# - 'modelscope': 中國大陸用戶，從 ModelScope 下載
config = {
    'models-dir': {
        'pipeline': f'{mineru_models_dir}/PDF-Extract-Kit-1.0',
        'vlm': vlm_path
    },
    # 設為 'local' 以確保完全離線
    # 如果 VLM 模型存在，則離線運行；否則需要手動設為 'huggingface'
    'model-source': 'local' if vlm_path else 'huggingface',
    'config_version': '1.3.1',
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
print(f'  VLM: {config["models-dir"]["vlm"] or "(無，將使用線上下載)"}')
print(f'  Model Source: {config["model-source"]}')
print('✅ mineru.json 已產生')
PYTHON

echo "✅ MinerU 配置檔產生完成"
