#!/bin/bash
# ==============================================================================
# 下載 MinerU VLM GGUF 模型
# ==============================================================================
#
# 📦 模型說明：
#   - 來源：mradermacher/MinerU2.5-2509-1.2B-GGUF
#   - 量化：Q6_K（主模型, ~482MB）+ Q8_0（視覺投影器, ~677MB）
#   - 總大小：約 1.16 GB
#   - 架構：qwen2vl（Vision-Language Model）
#
# 🔧 用於：
#   - Docker build 階段自動下載
#   - 本地開發手動執行
#
# ==============================================================================

set -e

ARCH=$(uname -m)

# Docker build 或本地開發使用不同路徑
if [ -d "/opt/convertx" ]; then
    # Docker 環境
    MODEL_DIR="/opt/convertx/models/vlm/mineru2.5-2509-1.2b"
else
    # 本地開發環境
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
    MODEL_DIR="$PROJECT_ROOT/models/vlm/mineru2.5-2509-1.2b"
fi

# ARM64 不支援
if [ "$ARCH" = "aarch64" ]; then
    echo "⚠️ ARM64：跳過 VLM GGUF 模型下載"
    exit 0
fi

# 模型資訊
HF_REPO="mradermacher/MinerU2.5-2509-1.2B-GGUF"
MAIN_MODEL="MinerU2.5-2509-1.2B.Q6_K.gguf"
MMPROJ_MODEL="MinerU2.5-2509-1.2B.mmproj-Q8_0.gguf"

echo "📦 MinerU VLM GGUF 模型下載器"
echo "================================"
echo "📁 目標目錄：$MODEL_DIR"
echo ""

# 確保目錄存在
mkdir -p "$MODEL_DIR"

# 使用 Python huggingface_hub 下載（Docker 環境已有）
python3 <<PYTHON
from huggingface_hub import hf_hub_download
import os

model_dir = "$MODEL_DIR"
repo_id = "$HF_REPO"

# 主模型
main_model = "$MAIN_MODEL"
main_path = os.path.join(model_dir, main_model)

if os.path.isfile(main_path):
    print(f"✅ 主模型已存在：{main_model}")
else:
    print(f"⬇️  下載主模型：{main_model} (~482 MB)")
    hf_hub_download(
        repo_id=repo_id,
        filename=main_model,
        local_dir=model_dir,
        local_dir_use_symlinks=False,
        resume_download=True
    )
    print(f"✅ 主模型下載完成")

# 視覺投影器
mmproj_model = "$MMPROJ_MODEL"
mmproj_path = os.path.join(model_dir, mmproj_model)

if os.path.isfile(mmproj_path):
    print(f"✅ 視覺投影器已存在：{mmproj_model}")
else:
    print(f"⬇️  下載視覺投影器：{mmproj_model} (~677 MB)")
    hf_hub_download(
        repo_id=repo_id,
        filename=mmproj_model,
        local_dir=model_dir,
        local_dir_use_symlinks=False,
        resume_download=True
    )
    print(f"✅ 視覺投影器下載完成")

# 驗證
print("")
print("📋 模型驗證：")
if os.path.isfile(main_path) and os.path.isfile(mmproj_path):
    main_size = os.path.getsize(main_path) / 1024 / 1024
    mmproj_size = os.path.getsize(mmproj_path) / 1024 / 1024
    print(f"  ✅ {main_model}: {main_size:.1f} MB")
    print(f"  ✅ {mmproj_model}: {mmproj_size:.1f} MB")
    print(f"  📊 總大小: {main_size + mmproj_size:.1f} MB")
else:
    print("  ❌ 模型驗證失敗")
    exit(1)

print("")
print("✅ VLM GGUF 模型下載完成！")
PYTHON

echo "================================"
echo "✅ 模型下載腳本執行完成"
