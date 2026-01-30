#!/bin/bash
# ==============================================================================
# MinerU 模型下載腳本
# 用於 Docker build 階段下載 PDF-Extract-Kit-1.0 和 VLM 模型
# ==============================================================================
#
# 📦 模型清單：
#   1. PDF-Extract-Kit-1.0: Pipeline 模型（佈局分析 + OCR + 表格）
#   2. MinerU2.5-2509-1.2B: VLM 模型（用於 auto/hybrid 模式）
#      - 使用官方原版模型（非 GGUF，MinerU 不支援 GGUF）
#      - 大小約 2-3GB，包含完整 transformers 權重
#
# ⚠️ 重要：MinerU VLM 不支援 GGUF 格式！
#    MinerU 使用 transformers 框架載入模型，需要 .safetensors/.bin 格式
#    社群 GGUF 量化版本僅適用於 llama.cpp / ollama / vllm-gguf
#
# ==============================================================================

set -e

ARCH=$(uname -m)
MODELS_DIR="${MINERU_MODELS_DIR:-/opt/convertx/models/mineru}"

if [ "$ARCH" = "aarch64" ]; then
    echo "⚠️ ARM64：跳過 MinerU 模型下載"
    exit 0
fi

echo "📦 下載 MinerU 模型到 ${MODELS_DIR}..."

python3 <<'PYTHON'
from huggingface_hub import snapshot_download
import os

models_dir = os.environ.get('MINERU_MODELS_DIR', '/opt/convertx/models/mineru')
os.makedirs(models_dir, exist_ok=True)

# 1. 下載 Pipeline 模型 (PDF-Extract-Kit-1.0)
# 📦 包含：DocLayout-YOLO + OCR + Table + MFD 模型
print(f'📥 下載 PDF-Extract-Kit-1.0 到 {models_dir}...')
snapshot_download(
    repo_id='opendatalab/PDF-Extract-Kit-1.0',
    local_dir=f'{models_dir}/PDF-Extract-Kit-1.0',
    local_dir_use_symlinks=False,
    resume_download=True
)
print('✅ PDF-Extract-Kit-1.0 下載完成')

# 2. 下載 VLM 模型 (MinerU2.5-2509-1.2B)
# 📦 MinerU 2.7+ 官方推薦的 VLM 模型
# 💡 大小約 2-3GB（transformers 格式，非 GGUF）
# 💡 用於 auto/hybrid 模式的視覺語言理解
print(f'📥 下載 MinerU2.5-2509-1.2B VLM 模型到 {models_dir}...')
try:
    snapshot_download(
        repo_id='opendatalab/MinerU2.5-2509-1.2B',
        local_dir=f'{models_dir}/MinerU2.5-2509-1.2B',
        local_dir_use_symlinks=False,
        resume_download=True
    )
    print('✅ MinerU2.5-2509-1.2B VLM 模型下載完成')
except Exception as e:
    print(f'⚠️ VLM 模型下載失敗: {e}')
    # 嘗試下載備用 VLM 模型
    print('📥 嘗試下載備用 MinerU-VLM...')
    try:
        snapshot_download(
            repo_id='opendatalab/MinerU-VLM',
            local_dir=f'{models_dir}/MinerU-VLM',
            local_dir_use_symlinks=False,
            resume_download=True
        )
        print('✅ MinerU-VLM 備用模型下載完成')
    except Exception as e2:
        print(f'⚠️ 備用 VLM 下載也失敗: {e2}')
        print('💡 MinerU auto 模式將嘗試線上下載或降級為 pipeline 模式')

# 3. 驗證模型完整性
print('\n📋 模型下載驗證：')
import os.path

pipeline_path = f'{models_dir}/PDF-Extract-Kit-1.0'
vlm_path_1 = f'{models_dir}/MinerU2.5-2509-1.2B'
vlm_path_2 = f'{models_dir}/MinerU-VLM'

if os.path.isdir(pipeline_path):
    files = os.listdir(pipeline_path)
    print(f'  ✅ Pipeline 模型: {len(files)} 個檔案/目錄')
else:
    print(f'  ❌ Pipeline 模型不存在')

vlm_found = False
for vlm_path in [vlm_path_1, vlm_path_2]:
    if os.path.isdir(vlm_path):
        files = os.listdir(vlm_path)
        print(f'  ✅ VLM 模型 ({os.path.basename(vlm_path)}): {len(files)} 個檔案/目錄')
        vlm_found = True
        break

if not vlm_found:
    print(f'  ⚠️ VLM 模型未下載，auto 模式可能需要線上下載')

print('\n✅ MinerU 模型下載腳本執行完成')
PYTHON

echo "✅ MinerU 模型下載完成"
