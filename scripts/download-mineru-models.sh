#!/bin/bash
# ==============================================================================
# MinerU Pipeline 模型下載腳本
# 用於 Docker build 階段下載 PDF-Extract-Kit-1.0
# ==============================================================================
#
# 📦 模型說明：
#   - PDF-Extract-Kit-1.0: Pipeline 模型（佈局分析 + OCR + 表格）
#   - 這是 MinerU 基礎模型，無論使用哪種後端都需要
#
# 📌 VLM 模型說明：
#   - VLM GGUF 模型已預先提交到 Git（使用 LFS）
#   - Docker 通過 COPY 指令複製，不需要額外下載
#   - 路徑：/opt/convertx/models/vlm/mineru2.5-2509-1.2b/
#
# ==============================================================================

set -e

ARCH=$(uname -m)
MODELS_DIR="${MINERU_MODELS_DIR:-/opt/convertx/models/mineru}"

if [ "$ARCH" = "aarch64" ]; then
    echo "⚠️ ARM64：跳過 MinerU 模型下載"
    exit 0
fi

echo "📦 下載 MinerU Pipeline 模型到 ${MODELS_DIR}..."

python3 <<'PYTHON'
from huggingface_hub import snapshot_download
import os

models_dir = os.environ.get('MINERU_MODELS_DIR', '/opt/convertx/models/mineru')
os.makedirs(models_dir, exist_ok=True)

# 下載 Pipeline 模型 (PDF-Extract-Kit-1.0)
# 📦 包含：DocLayout-YOLO + OCR + Table + MFD 模型
print(f'📥 下載 PDF-Extract-Kit-1.0 到 {models_dir}...')
snapshot_download(
    repo_id='opendatalab/PDF-Extract-Kit-1.0',
    local_dir=f'{models_dir}/PDF-Extract-Kit-1.0',
    local_dir_use_symlinks=False,
    resume_download=True
)
print('✅ PDF-Extract-Kit-1.0 下載完成')

# 驗證模型完整性
print('\n📋 模型下載驗證：')
import os.path

pipeline_path = f'{models_dir}/PDF-Extract-Kit-1.0'

if os.path.isdir(pipeline_path):
    files = os.listdir(pipeline_path)
    print(f'  ✅ Pipeline 模型: {len(files)} 個檔案/目錄')
else:
    print(f'  ❌ Pipeline 模型不存在')
    exit(1)

# 提示 VLM 模型信息
vlm_path = '/opt/convertx/models/vlm/mineru2.5-2509-1.2b'
gguf_model = f'{vlm_path}/MinerU2.5-2509-1.2B.Q6_K.gguf'
mmproj_model = f'{vlm_path}/MinerU2.5-2509-1.2B.mmproj-Q8_0.gguf'

print('\n📌 VLM GGUF 模型狀態：')
if os.path.isfile(gguf_model) and os.path.isfile(mmproj_model):
    gguf_size = os.path.getsize(gguf_model) / 1024 / 1024
    mmproj_size = os.path.getsize(mmproj_model) / 1024 / 1024
    print(f'  ✅ 主模型: MinerU2.5-2509-1.2B.Q6_K.gguf ({gguf_size:.1f} MB)')
    print(f'  ✅ 視覺投影器: MinerU2.5-2509-1.2B.mmproj-Q8_0.gguf ({mmproj_size:.1f} MB)')
    print('  💡 VLM 模型已通過 Git LFS 提交，無需額外下載')
else:
    print('  ⚠️ VLM GGUF 模型尚未就位（將在 COPY 階段載入）')

print('\n✅ MinerU 模型下載腳本執行完成')
PYTHON

echo "✅ MinerU Pipeline 模型下載完成"
