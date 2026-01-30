#!/bin/bash
# ==============================================================================
# MinerU 模型下載腳本
# 用於 Docker build 階段下載 PDF-Extract-Kit-1.0 和 VLM 模型
# ==============================================================================
#
# 📦 模型清單：
#   1. PDF-Extract-Kit-1.0: Pipeline 模型（佈局分析 + OCR + 表格）
#   2. VLM 模型（用於 vlm/hybrid 模式）
#      - GGUF 量化版本（Q8_0）: 約 531MB，效能好
#      - 需搭配 llama.cpp 服務器 + MinerU http-client 模式
#
# 💡 使用 GGUF 量化模型的優點：
#    - 檔案較小（531MB vs 2-3GB）
#    - 記憶體佔用較低
#    - 推理速度更快（使用 llama.cpp 優化）
#
# 🔧 GGUF 模型使用方式：
#    1. llama.cpp 服務器載入 GGUF 模型（提供 OpenAI API）
#    2. MinerU 使用 vlm-http-client 或 hybrid-http-client 模式連接
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
from huggingface_hub import hf_hub_download, snapshot_download
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

# 2. 下載 VLM GGUF 量化模型
# 📦 社群量化版本 Q8_0（約 531MB）
# 💡 需搭配 llama.cpp 服務器使用
gguf_dir = f'{models_dir}/MinerU-VLM-GGUF'
os.makedirs(gguf_dir, exist_ok=True)

print(f'📥 下載 MinerU2.5-2509-1.2B GGUF Q8_0 量化模型...')
try:
    # 下載主模型 Q8_0
    hf_hub_download(
        repo_id='mradermacher/MinerU2.5-2509-1.2B-GGUF',
        filename='MinerU2.5-2509-1.2B.Q8_0.gguf',
        local_dir=gguf_dir,
        local_dir_use_symlinks=False,
        resume_download=True
    )
    print('  ✅ 主模型 Q8_0 (531MB) 下載完成')
    
    # 下載多模態投影器 mmproj (視覺處理必需)
    hf_hub_download(
        repo_id='mradermacher/MinerU2.5-2509-1.2B-GGUF',
        filename='mmproj-MinerU2.5-2509-1.2B-f16.gguf',
        local_dir=gguf_dir,
        local_dir_use_symlinks=False,
        resume_download=True
    )
    print('  ✅ 多模態投影器 mmproj-f16 下載完成')
    print('✅ VLM GGUF 模型下載完成')
    
except Exception as e:
    print(f'⚠️ GGUF 模型下載失敗: {e}')
    print('💡 MinerU 將降級使用 pipeline 模式（純 OCR，不使用 VLM）')

# 3. 驗證模型完整性
print('\n📋 模型下載驗證：')
import os.path

pipeline_path = f'{models_dir}/PDF-Extract-Kit-1.0'
gguf_path = f'{models_dir}/MinerU-VLM-GGUF'

if os.path.isdir(pipeline_path):
    files = os.listdir(pipeline_path)
    print(f'  ✅ Pipeline 模型: {len(files)} 個檔案/目錄')
else:
    print(f'  ❌ Pipeline 模型不存在')

if os.path.isdir(gguf_path):
    files = os.listdir(gguf_path)
    gguf_files = [f for f in files if f.endswith('.gguf')]
    total_size = sum(os.path.getsize(os.path.join(gguf_path, f)) for f in gguf_files)
    print(f'  ✅ VLM GGUF 模型: {len(gguf_files)} 個 GGUF 檔案，共 {total_size / 1024 / 1024:.1f} MB')
    for f in gguf_files:
        size = os.path.getsize(os.path.join(gguf_path, f)) / 1024 / 1024
        print(f'     - {f}: {size:.1f} MB')
else:
    print(f'  ⚠️ VLM GGUF 模型未下載')

print('\n✅ MinerU 模型下載腳本執行完成')
PYTHON

echo "✅ MinerU 模型下載完成"
