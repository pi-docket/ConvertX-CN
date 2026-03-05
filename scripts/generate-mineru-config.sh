#!/bin/bash
# ==============================================================================
# MinerU 配置檔產生腳本（pipeline-only）
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
pipeline_path = f'{mineru_models_dir}/PDF-Extract-Kit-1.0'

config = {
    'models-dir': {
        'pipeline': pipeline_path,
        # 保持非空以相容 MinerU 配置驗證
        'vlm': pipeline_path,
    },
    'model-source': 'local',
    'config_version': '1.3.1',
    'local-llm-removed': True,
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

print('✅ pipeline-only mineru.json 已產生')
print(f'   Pipeline 模型路徑: {pipeline_path}')
PYTHON

echo "✅ MinerU 配置檔產生完成"
