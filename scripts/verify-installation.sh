#!/usr/bin/env bash
# ==============================================================================
# ConvertX-CN 安裝驗證腳本
# ==============================================================================
# 用途：在 Docker build 最終階段驗證所有工具和模型
# 執行環境：Docker build stage (final) 或 runtime 驗證
# ==============================================================================

set -euo pipefail

# 顏色輸出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}🔍 [INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}✅ [SUCCESS]${NC} $1"; }
log_warn() { echo -e "${YELLOW}⚠️ [WARN]${NC} $1"; }
log_error() { echo -e "${RED}❌ [ERROR]${NC} $1"; }

# 架構檢測
ARCH=$(uname -m)

# 計數器
PASS=0
FAIL=0
WARN=0
SKIP=0

# ==============================================================================
# 檢查工具函數
# ==============================================================================
check_command() {
    local cmd="$1"
    local name="$2"
    local required="${3:-true}"
    local arch_only="${4:-all}"
    
    # 架構檢查
    if [ "${arch_only}" != "all" ] && [ "${ARCH}" != "${arch_only}" ]; then
        echo "  ⏭️ ${name}: 跳過（僅 ${arch_only}）"
        ((SKIP++))
        return 0
    fi
    
    if command -v "${cmd}" >/dev/null 2>&1; then
        local path
        path=$(which "${cmd}")
        echo "  ✅ ${name}: ${path}"
        ((PASS++))
    else
        if [ "${required}" = "true" ]; then
            echo "  ❌ ${name}: 未找到（必要）"
            ((FAIL++))
        else
            echo "  ⚠️ ${name}: 未找到（可選）"
            ((WARN++))
        fi
    fi
}

check_file() {
    local path="$1"
    local name="$2"
    local required="${3:-true}"
    local arch_only="${4:-all}"
    
    # 架構檢查
    if [ "${arch_only}" != "all" ] && [ "${ARCH}" != "${arch_only}" ]; then
        echo "  ⏭️ ${name}: 跳過（僅 ${arch_only}）"
        ((SKIP++))
        return 0
    fi
    
    if [ -f "${path}" ]; then
        local size
        size=$(ls -lh "${path}" 2>/dev/null | awk '{print $5}')
        echo "  ✅ ${name}: ${size}"
        ((PASS++))
    else
        if [ "${required}" = "true" ]; then
            echo "  ❌ ${name}: 不存在"
            ((FAIL++))
        else
            echo "  ⚠️ ${name}: 不存在（可選）"
            ((WARN++))
        fi
    fi
}

check_dir() {
    local path="$1"
    local name="$2"
    local required="${3:-true}"
    local arch_only="${4:-all}"
    
    # 架構檢查
    if [ "${arch_only}" != "all" ] && [ "${ARCH}" != "${arch_only}" ]; then
        echo "  ⏭️ ${name}: 跳過（僅 ${arch_only}）"
        ((SKIP++))
        return 0
    fi
    
    if [ -d "${path}" ]; then
        local size
        size=$(du -sh "${path}" 2>/dev/null | awk '{print $1}')
        echo "  ✅ ${name}: ${size}"
        ((PASS++))
    else
        if [ "${required}" = "true" ]; then
            echo "  ❌ ${name}: 不存在"
            ((FAIL++))
        else
            echo "  ⚠️ ${name}: 不存在（可選）"
            ((WARN++))
        fi
    fi
}

# ==============================================================================
# 1. 核心系統工具
# ==============================================================================
verify_system_tools() {
    echo ""
    echo "📦 核心系統工具"
    echo "=============================================="
    
    check_command "ffmpeg" "FFmpeg"
    check_command "magick" "ImageMagick 7"
    check_command "gm" "GraphicsMagick"
    check_command "vips" "libvips"
    check_command "inkscape" "Inkscape"
    check_command "resvg" "resvg" "false" "x86_64"
    check_command "dvisvgm" "dvisvgm"
    check_command "xelatex" "XeLaTeX"
    check_command "soffice" "LibreOffice"
    check_command "pandoc" "Pandoc"
    check_command "ebook-convert" "Calibre"
    check_command "assimp" "Assimp"
    check_command "dasel" "dasel"
    check_command "msgconvert" "msgconvert"
    check_command "deark" "deark"
    check_command "vtracer" "vtracer"
    check_command "heif-convert" "libheif"
    check_command "djxl" "libjxl"
    check_command "ocrmypdf" "OCRmyPDF"
    check_command "tesseract" "Tesseract"
    check_command "potrace" "Potrace"
    check_command "qpdf" "qpdf"
    check_command "gs" "Ghostscript"
}

# ==============================================================================
# 2. Python 工具
# ==============================================================================
verify_python_tools() {
    echo ""
    echo "🐍 Python 工具"
    echo "=============================================="
    
    check_command "python3" "Python"
    check_command "pip3" "pip"
    check_command "uv" "uv"
    check_command "markitdown" "markitdown"
    check_command "pdf2zh" "PDFMathTranslate"
    check_command "babeldoc" "BabelDOC"
    check_command "mineru" "MinerU" "true" "x86_64"
}

# ==============================================================================
# 3. 模型檔案
# ==============================================================================
verify_models() {
    echo ""
    echo "🤖 AI 模型"
    echo "=============================================="
    
    # MinerU 模型
    check_dir "/opt/convertx/models/mineru/PDF-Extract-Kit-1.0" "MinerU Pipeline" "true" "x86_64"
    check_file "/root/mineru.json" "MinerU 配置檔" "true" "x86_64"
    echo "  ℹ️ 本地 VLM / GGUF 模型檢查已移除（pipeline-only）"
    
    # BabelDOC 模型
    check_file "/root/.cache/babeldoc/models/doclayout_yolo_docstructbench_imgsz1024.onnx" "DocLayout-YOLO ONNX" "false"
    check_dir "/root/.cache/babeldoc" "BabelDOC 快取" "false"
}

# ==============================================================================
# 4. 字型
# ==============================================================================
verify_fonts() {
    echo ""
    echo "🔤 字型"
    echo "=============================================="
    
    check_file "/usr/share/fonts/truetype/custom/GoNotoKurrent-Regular.ttf" "Noto 通用字型"
    check_file "/usr/share/fonts/truetype/custom/SourceHanSerifCN-Regular.ttf" "思源宋體（簡體）"
    check_file "/usr/share/fonts/truetype/custom/SourceHanSerifTW-Regular.ttf" "思源宋體（繁體）"
    check_file "/usr/share/fonts/truetype/custom/SourceHanSerifJP-Regular.ttf" "思源宋體（日文）"
    check_file "/usr/share/fonts/truetype/custom/SourceHanSerifKR-Regular.ttf" "思源宋體（韓文）"
    check_file "/usr/share/fonts/truetype/custom/BiauKai.ttf" "標楷體" "false"
    
    # 系統字型
    echo ""
    echo "  系統字型統計:"
    local noto_count
    noto_count=$(fc-list | grep -ci "noto" || echo "0")
    echo "    - Noto 字型: ${noto_count} 個"
    
    local total_count
    total_count=$(fc-list | wc -l)
    echo "    - 總字型數: ${total_count} 個"
}

# ==============================================================================
# 5. OCR 語言
# ==============================================================================
verify_ocr_languages() {
    echo ""
    echo "📝 OCR 語言"
    echo "=============================================="
    
    local languages=("eng" "chi_tra" "chi_sim" "jpn" "kor" "deu" "fra")
    
    for lang in "${languages[@]}"; do
        if tesseract --list-langs 2>&1 | grep -q "^${lang}$"; then
            echo "  ✅ ${lang}: 已安裝"
            ((PASS++))
        else
            echo "  ❌ ${lang}: 未安裝"
            ((FAIL++))
        fi
    done
}

# ==============================================================================
# 6. Locale 設定
# ==============================================================================
verify_locales() {
    echo ""
    echo "🌍 Locale 設定"
    echo "=============================================="
    
    local locales=("en_US.UTF-8" "zh_TW.UTF-8" "zh_CN.UTF-8" "ja_JP.UTF-8" "ko_KR.UTF-8")
    
    for locale in "${locales[@]}"; do
        if locale -a 2>/dev/null | grep -q "${locale}"; then
            echo "  ✅ ${locale}: 已啟用"
            ((PASS++))
        else
            echo "  ⚠️ ${locale}: 未啟用"
            ((WARN++))
        fi
    done
}

# ==============================================================================
# 7. PDF 簽章
# ==============================================================================
verify_pdf_signing() {
    echo ""
    echo "🔐 PDF 簽章"
    echo "=============================================="
    
    check_file "/app/certs/default.p12" "預設憑證" "false"
}

# ==============================================================================
# 8. 離線模式驗證
# ==============================================================================
verify_offline_mode() {
    echo ""
    echo "🔒 離線模式環境變數"
    echo "=============================================="
    
    local vars=(
        "HF_HUB_OFFLINE"
        "TRANSFORMERS_OFFLINE"
        "MINERU_MODEL_SOURCE"
        "BABELDOC_OFFLINE"
    )
    
    for var in "${vars[@]}"; do
        local value="${!var:-}"
        if [ -n "${value}" ]; then
            echo "  ✅ ${var}=${value}"
            ((PASS++))
        else
            echo "  ⚠️ ${var}: 未設定"
            ((WARN++))
        fi
    done
}

# ==============================================================================
# 總結
# ==============================================================================
print_summary() {
    echo ""
    echo "=============================================="
    echo "📊 驗證總結"
    echo "=============================================="
    echo "  ✅ 通過: ${PASS}"
    echo "  ❌ 失敗: ${FAIL}"
    echo "  ⚠️ 警告: ${WARN}"
    echo "  ⏭️ 跳過: ${SKIP}"
    echo "=============================================="
    
    if [ "${FAIL}" -gt 0 ]; then
        log_error "驗證失敗！有 ${FAIL} 個必要項目未通過"
        return 1
    else
        log_success "驗證通過！"
        return 0
    fi
}

# ==============================================================================
# 主程式
# ==============================================================================
main() {
    log_info "=========================================="
    log_info "ConvertX-CN 安裝驗證"
    log_info "架構: ${ARCH}"
    log_info "=========================================="
    
    verify_system_tools
    verify_python_tools
    verify_models
    verify_fonts
    verify_ocr_languages
    verify_locales
    verify_pdf_signing
    verify_offline_mode
    
    print_summary
}

# 執行
main "$@"
