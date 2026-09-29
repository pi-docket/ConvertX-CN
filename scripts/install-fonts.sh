#!/usr/bin/env bash
# ==============================================================================
# ConvertX-CN 字型安裝腳本
# ==============================================================================
# 用途：安裝所有系統字型和自訂字型
# 執行環境：Docker build stage (fonts)
# ==============================================================================

set -euo pipefail

# 顏色輸出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}🔤 [INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}✅ [SUCCESS]${NC} $1"; }
log_warn() { echo -e "${YELLOW}⚠️ [WARN]${NC} $1"; }
log_error() { echo -e "${RED}❌ [ERROR]${NC} $1"; }

# 目錄定義
CUSTOM_FONTS_DIR="/usr/share/fonts/truetype/custom"
PDFMATHTRANSLATE_FONTS_DIR="/root/.cache/babeldoc/fonts"

# ==============================================================================
# 系統字型（APT）
# ==============================================================================
install_system_fonts() {
    log_info "安裝系統字型..."
    apt-get update --fix-missing
    apt-get install -y --no-install-recommends \
        fonts-noto-cjk \
        fonts-noto-cjk-extra \
        fonts-noto-core \
        fonts-noto-color-emoji \
        fonts-liberation \
        fonts-dejavu-core \
        fonts-dejavu-extra \
        fonts-freefont-ttf \
        fonts-droid-fallback
    rm -rf /var/lib/apt/lists/*
    log_success "系統字型安裝完成"
}

# ==============================================================================
# 複製自訂字型
# ==============================================================================
install_custom_fonts() {
    log_info "安裝自訂字型..."
    
    # 創建目錄
    mkdir -p "${CUSTOM_FONTS_DIR}"
    mkdir -p "${PDFMATHTRANSLATE_FONTS_DIR}"
    
    # 檢查並複製字型
    local FONTS_SRC="${1:-/app/fonts}"
    
    if [ -d "${FONTS_SRC}" ]; then
        log_info "複製字型從 ${FONTS_SRC}..."
        
        # 複製所有 TTF 字型
        find "${FONTS_SRC}" -type f \( -name "*.ttf" -o -name "*.TTF" -o -name "*.otf" -o -name "*.OTF" \) \
            -exec cp -v {} "${CUSTOM_FONTS_DIR}/" \; 2>/dev/null || true
        
        # 設定權限
        chmod 644 "${CUSTOM_FONTS_DIR}"/* 2>/dev/null || true
        
        # 統計
        local COUNT
        COUNT=$(find "${CUSTOM_FONTS_DIR}" -type f | wc -l)
        log_success "已複製 ${COUNT} 個自訂字型"
    else
        log_warn "字型來源目錄 ${FONTS_SRC} 不存在"
    fi
}

# ==============================================================================
# 同步字型到 PDFMathTranslate cache 目錄
# ==============================================================================
sync_pdfmathtranslate_fonts() {
    log_info "同步字型到 PDFMathTranslate cache 目錄..."
    
    mkdir -p "${PDFMATHTRANSLATE_FONTS_DIR}"
    
    # 複製關鍵字型到 PDFMathTranslate cache
    local fonts=(
        "GoNotoKurrent-Regular.ttf"
        "SourceHanSerifCN-Regular.ttf"
        "SourceHanSerifTW-Regular.ttf"
        "SourceHanSerifJP-Regular.ttf"
        "SourceHanSerifKR-Regular.ttf"
        "BiauKai.ttf"
    )
    
    for font in "${fonts[@]}"; do
        if [ -f "${CUSTOM_FONTS_DIR}/${font}" ]; then
            cp "${CUSTOM_FONTS_DIR}/${font}" "${PDFMATHTRANSLATE_FONTS_DIR}/"
            log_info "  已同步: ${font}"
        fi
    done
    
    log_success "PDFMathTranslate 字型同步完成"
}

# ==============================================================================
# 更新字型快取
# ==============================================================================
update_font_cache() {
    log_info "更新字型快取..."
    fc-cache -fv
    log_success "字型快取更新完成"
}

# ==============================================================================
# 驗證字型安裝
# ==============================================================================
verify_fonts() {
    log_info "驗證字型安裝..."
    
    echo "系統字型目錄統計:"
    echo "  /usr/share/fonts: $(find /usr/share/fonts -type f \( -name '*.ttf' -o -name '*.otf' \) | wc -l) 個字型"
    echo "  ${CUSTOM_FONTS_DIR}: $(find "${CUSTOM_FONTS_DIR}" -type f 2>/dev/null | wc -l) 個字型"
    echo "  ${PDFMATHTRANSLATE_FONTS_DIR}: $(find "${PDFMATHTRANSLATE_FONTS_DIR}" -type f 2>/dev/null | wc -l) 個字型"
    
    # 列出自訂字型
    if [ -d "${CUSTOM_FONTS_DIR}" ]; then
        echo ""
        echo "自訂字型清單:"
        ls -la "${CUSTOM_FONTS_DIR}/" 2>/dev/null || echo "  (無)"
    fi
    
    # 驗證關鍵字型
    echo ""
    echo "關鍵字型驗證:"
    local required_fonts=(
        "Noto Sans CJK"
        "Source Han Serif"
        "Liberation"
    )
    
    for font in "${required_fonts[@]}"; do
        if fc-list | grep -qi "${font}"; then
            echo "  ✅ ${font}: 已安裝"
        else
            echo "  ⚠️ ${font}: 未找到"
        fi
    done
    
    log_success "字型驗證完成"
}

# ==============================================================================
# 主程式
# ==============================================================================
main() {
    log_info "=========================================="
    log_info "開始安裝字型"
    log_info "=========================================="
    
    install_system_fonts
    install_custom_fonts "${1:-/app/fonts}"
    sync_pdfmathtranslate_fonts
    update_font_cache
    verify_fonts
    
    log_success "=========================================="
    log_success "所有字型安裝完成！"
    log_success "=========================================="
}

# 執行（可接收字型來源目錄參數）
main "$@"
