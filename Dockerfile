# ==============================================================================
# ConvertX-CN 官方 Docker Image
# 版本：v0.1.18 - CPU-only 輕量版
# ==============================================================================
#
# 📦 Image 說明：
#   - 這是 ConvertX-CN 官方 Docker Hub Image 的生產 Dockerfile
#   - ⚠️ 所有模型、字型、tokenizer 已在 build 階段完整預下載
#   - ⚠️ Runtime 完全離線運行（僅翻譯服務允許連網）
#   - 💡 此版本為 CPU-only，不含 PyTorch CUDA（Image 約 3-5GB）
#   - 🚀 需要 GPU 加速？請使用 Dockerfile.full 或自行安裝 PyTorch CUDA
#
# 🔒 Offline-first 設計原則：
#   1. Runtime（docker run 後）：
#      ❌ 禁止任何模型、字型、tokenizer、metadata 下載
#      ❌ MinerU / BabelDOC / PDFMathTranslate 不得嘗試連網
#      ✅ 只有翻譯服務（Google / DeepL / Azure / OpenAI）允許連網
#   2. Build time（docker build 時）：
#      ✅ 允許連網下載所有資源
#      ✅ 所有「可能會在 runtime 下載的東西」必須提前固定存放
#
# 🤖 預下載模型清單：
#   - PDFMathTranslate: DocLayout-YOLO ONNX（佈局分析）
#   - BabelDOC: DocLayout-YOLO + 字型資源 + tiktoken
#   - MinerU: PDF-Extract-Kit-1.0（Pipeline 模型）
#
# 🏗️ Multi-Stage Build 結構：
#   Stage 1 [base]           : Bun runtime 基礎
#   Stage 2 [install]        : Node 依賴安裝
#   Stage 3 [prerelease]     : 應用程式建構
#   Stage 4 [system-tools]   : APT 系統工具
#   Stage 5 [fonts]          : 字型安裝
#   Stage 6 [python-tools]   : Python CLI 工具
#   Stage 7 [models]         : 模型下載
#   Stage 8 [release]        : 最終 Image
#
# 🌍 Multi-Arch 支援：
#   - linux/amd64: 功能完整
#   - linux/arm64: 安全降級（不支援的工具會跳過）
#
# 📊 Image 大小：約 3-5 GB（CPU-only，不含 PyTorch CUDA）
#
# ==============================================================================

# ==============================================================================
# Stage 1: Base - Bun Runtime
# ==============================================================================
FROM debian:bookworm-slim AS base
LABEL org.opencontainers.image.source="https://github.com/pi-docket/ConvertX-CN"
LABEL org.opencontainers.image.description="ConvertX-CN - 完全離線化檔案轉換服務"
LABEL org.opencontainers.image.version="v0.1.18"
WORKDIR /app

# 設定非互動模式
ENV DEBIAN_FRONTEND=noninteractive

# 配置 APT 重試機制
RUN set -ex && \
  echo 'Acquire::Retries "5";' > /etc/apt/apt.conf.d/80-retries && \
  echo 'Acquire::http::Timeout "120";' >> /etc/apt/apt.conf.d/80-retries && \
  echo 'Acquire::https::Timeout "120";' >> /etc/apt/apt.conf.d/80-retries && \
  echo 'Acquire::ftp::Timeout "120";' >> /etc/apt/apt.conf.d/80-retries && \
  echo 'DPkg::Lock::Timeout "120";' >> /etc/apt/apt.conf.d/80-retries

# 安裝基礎工具
RUN set -ex && \
  apt-get update && \
  apt-get install -y --no-install-recommends \
  curl \
  unzip \
  ca-certificates && \
  rm -rf /var/lib/apt/lists/*

# 安裝 Bun（根據架構選擇版本）
ARG BUN_VERSION=1.3.6
RUN set -ex && \
  ARCH=$(uname -m) && \
  if [ "$ARCH" = "aarch64" ]; then \
  BUN_ASSET="bun-linux-aarch64.zip"; \
  else \
  BUN_ASSET="bun-linux-x64-baseline.zip"; \
  fi && \
  curl -fsSL --retry 3 --retry-delay 5 --retry-all-errors \
  -o /tmp/bun.zip \
  "https://github.com/oven-sh/bun/releases/download/bun-v${BUN_VERSION}/${BUN_ASSET}" && \
  unzip -j /tmp/bun.zip -d /usr/local/bin && \
  rm /tmp/bun.zip && \
  chmod +x /usr/local/bin/bun

# ==============================================================================
# Stage 2: Install - Node Dependencies
# ==============================================================================
FROM base AS install

# 開發依賴
RUN mkdir -p /temp/dev
COPY package.json bun.lock /temp/dev/
RUN cd /temp/dev && bun install --frozen-lockfile

# 生產依賴
RUN mkdir -p /temp/prod
COPY package.json bun.lock /temp/prod/
RUN cd /temp/prod && bun install --frozen-lockfile --production

# ==============================================================================
# Stage 3: Prerelease - Build App
# ==============================================================================
FROM base AS prerelease
WORKDIR /app
COPY --from=install /temp/dev/node_modules node_modules
COPY . .
RUN bun run build

# ==============================================================================
# Stage 4: System Tools（拆分為多個 RUN 以提升可調試性和 cache 效率）
# ==============================================================================
FROM base AS system-tools

# 4.1 配置 APT
RUN set -ex && \
  echo 'Acquire::Retries "5";' > /etc/apt/apt.conf.d/80-retries && \
  echo 'Acquire::http::Timeout "120";' >> /etc/apt/apt.conf.d/80-retries && \
  echo 'Acquire::https::Timeout "120";' >> /etc/apt/apt.conf.d/80-retries && \
  echo 'APT::Get::Assume-Yes "true";' >> /etc/apt/apt.conf.d/80-retries && \
  echo 'DPkg::Lock::Timeout "120";' >> /etc/apt/apt.conf.d/80-retries

# 4.2 基礎系統工具
RUN apt-get update --fix-missing && \
  apt-get install -y --no-install-recommends \
  locales ca-certificates curl wget unzip openssl git xz-utils && \
  rm -rf /var/lib/apt/lists/*

# 4.3 核心轉換工具
RUN apt-get update --fix-missing && \
  apt-get install -y --no-install-recommends \
  assimp-utils dcraw dvisvgm ghostscript graphicsmagick \
  mupdf-tools poppler-utils potrace qpdf && \
  rm -rf /var/lib/apt/lists/*

# 4.4 dasel（JSON/YAML/TOML 轉換）
RUN set -ex && \
  ARCH=$(uname -m) && \
  if [ "$ARCH" = "aarch64" ]; then DASEL_ARCH="linux_arm64"; \
  else DASEL_ARCH="linux_amd64"; fi && \
  curl -sSLf --retry 3 --retry-delay 5 --retry-all-errors \
  "https://github.com/TomWright/dasel/releases/download/v2.8.1/dasel_${DASEL_ARCH}" \
  -o /usr/local/bin/dasel && \
  chmod +x /usr/local/bin/dasel

# 4.5 resvg（僅 AMD64）
RUN set -ex && \
  ARCH=$(uname -m) && \
  if [ "$ARCH" = "aarch64" ]; then \
  echo "⚠️ resvg 無 ARM64 版本，跳過"; \
  else \
  curl -sSLf --retry 3 --retry-delay 5 --retry-all-errors \
  "https://github.com/linebender/resvg/releases/download/v0.44.0/resvg-linux-x86_64.tar.gz" \
  -o /tmp/resvg.tar.gz && \
  tar -xzf /tmp/resvg.tar.gz -C /tmp/ && \
  mv /tmp/resvg /usr/local/bin/resvg && \
  chmod +x /usr/local/bin/resvg && \
  rm -rf /tmp/resvg.tar.gz; \
  fi

# 4.6 deark（編譯安裝）
RUN apt-get update --fix-missing && \
  apt-get install -y --no-install-recommends build-essential && \
  cd /tmp && git clone --depth 1 https://github.com/jsummers/deark.git && \
  cd deark && make -j$(nproc) && \
  cp deark /usr/local/bin/deark && chmod +x /usr/local/bin/deark && \
  cd / && rm -rf /tmp/deark && \
  apt-get remove -y build-essential && apt-get autoremove -y && \
  rm -rf /var/lib/apt/lists/*

# 4.7 vtracer
RUN set -ex && \
  ARCH=$(uname -m) && \
  if [ "$ARCH" = "aarch64" ]; then \
  VTRACER_ASSET="vtracer-aarch64-unknown-linux-musl.tar.gz"; \
  else \
  VTRACER_ASSET="vtracer-x86_64-unknown-linux-musl.tar.gz"; \
  fi && \
  curl -L --retry 3 --retry-delay 5 --retry-all-errors \
  -o /tmp/vtracer.tar.gz \
  "https://github.com/visioncortex/vtracer/releases/download/0.6.4/${VTRACER_ASSET}" && \
  tar -xzf /tmp/vtracer.tar.gz -C /tmp/ && \
  mv /tmp/vtracer /usr/local/bin/vtracer && \
  chmod +x /usr/local/bin/vtracer && \
  rm -rf /tmp/vtracer.tar.gz

# 4.8 FFmpeg
RUN apt-get update --fix-missing && \
  apt-get install -y --no-install-recommends \
  ffmpeg libavcodec-extra libva2 && \
  rm -rf /var/lib/apt/lists/*

# 4.9 圖像處理工具（ImageMagick, Inkscape, vips 等）
RUN apt-get update --fix-missing && \
  apt-get install -y --no-install-recommends \
  imagemagick inkscape libheif-examples libjxl-tools \
  libvips-tools xauth xvfb && \
  rm -rf /var/lib/apt/lists/*

# 4.10 文件處理工具（Calibre, Pandoc）
RUN apt-get update --fix-missing && \
  apt-get install -y --no-install-recommends \
  calibre libemail-outlook-message-perl pandoc && \
  rm -rf /var/lib/apt/lists/*

# 4.11 LibreOffice
RUN apt-get update --fix-missing && \
  apt-get install -y --no-install-recommends libreoffice && \
  rm -rf /var/lib/apt/lists/*

# 4.12 TexLive 基礎
RUN apt-get update --fix-missing && \
  apt-get install -y --no-install-recommends \
  texlive-base texlive-latex-base texlive-latex-recommended \
  texlive-fonts-recommended texlive-xetex latexmk lmodern && \
  rm -rf /var/lib/apt/lists/*

# 4.13 TexLive 語言包
RUN apt-get update --fix-missing && \
  apt-get install -y --no-install-recommends \
  texlive-lang-cjk texlive-lang-german texlive-lang-french \
  texlive-lang-arabic texlive-lang-other && \
  rm -rf /var/lib/apt/lists/*

# 4.14 Tesseract OCR
RUN apt-get update --fix-missing && \
  apt-get install -y --no-install-recommends \
  tesseract-ocr tesseract-ocr-eng tesseract-ocr-chi-tra \
  tesseract-ocr-chi-sim tesseract-ocr-jpn tesseract-ocr-kor \
  tesseract-ocr-deu tesseract-ocr-fra && \
  rm -rf /var/lib/apt/lists/*

# 注意：ocrmypdf 改在 python-tools stage 用 pip 安裝，避免 pikepdf 版本衝突

# ==============================================================================
# Stage 5: Fonts（拆分安裝）
# ==============================================================================
FROM system-tools AS fonts

# 5.1 系統字型
RUN apt-get update --fix-missing && \
  apt-get install -y --no-install-recommends \
  fonts-noto-cjk fonts-noto-cjk-extra fonts-noto-core \
  fonts-noto-color-emoji fonts-liberation fonts-dejavu-core \
  fonts-dejavu-extra fonts-freefont-ttf fonts-droid-fallback && \
  rm -rf /var/lib/apt/lists/*

# 5.2 複製自訂字型
RUN mkdir -p /usr/share/fonts/truetype/custom
COPY fonts/ /usr/share/fonts/truetype/custom/

# 5.3 設定 BabelDOC 字型目錄
RUN mkdir -p /root/.cache/babeldoc/fonts && \
  for font in GoNotoKurrent-Regular.ttf SourceHanSerifCN-Regular.ttf \
  SourceHanSerifTW-Regular.ttf SourceHanSerifJP-Regular.ttf \
  SourceHanSerifKR-Regular.ttf BiauKai.ttf; do \
  [ -f "/usr/share/fonts/truetype/custom/${font}" ] && \
  cp "/usr/share/fonts/truetype/custom/${font}" /root/.cache/babeldoc/fonts/ || true; \
  done

# 5.4 更新字型快取
RUN fc-cache -fv

# ==============================================================================
# Stage 6: Python Tools（拆分安裝）
# ==============================================================================
FROM fonts AS python-tools

# 6.1 Python 基礎環境
RUN apt-get update --fix-missing && \
  apt-get install -y --no-install-recommends \
  python3 python3-pip python3-venv python3-numpy \
  python3-tinycss2 python3-opencv python3-img2pdf && \
  rm -rf /var/lib/apt/lists/*

# 6.2 uv 套件管理器
RUN pip3 install --no-cache-dir --break-system-packages uv

# 6.3 huggingface_hub
RUN uv pip install --system --break-system-packages --no-cache huggingface_hub

# 6.4 endesive（PDF 簽章）
RUN apt-get update --fix-missing && \
  apt-get install -y --no-install-recommends \
  build-essential swig libpcsclite-dev python3-dev && \
  uv pip install --system --break-system-packages --no-cache endesive && \
  apt-get remove -y build-essential swig python3-dev && \
  apt-get autoremove -y && \
  rm -rf /var/lib/apt/lists/*

# 6.5 markitdown
RUN uv pip install --system --break-system-packages --no-cache "markitdown[all]"

# 6.6 ocrmypdf（用 pip 安裝以確保 pikepdf 版本相容）
# 注意：不從 apt 安裝，避免與其他 Python 套件的 pikepdf 衝突
RUN uv pip install --system --break-system-packages --no-cache ocrmypdf

# 6.7 pdf2zh-next（PDFMathTranslate 2.0）
# 💡 使用新版 pdf2zh-next，基於 BabelDOC 後端
# 💡 命令格式：pdf2zh_next <file> --lang-out <lang> --output <dir> --<service>
# 📦 套件名稱：pdf2zh-next（不是 pdf2zh）
RUN uv pip install --system --break-system-packages --no-cache pdf2zh-next

# 6.8 babeldoc（pdf2zh-next 依賴，但可能需要獨立安裝）
RUN uv pip install --system --break-system-packages --no-cache babeldoc || \
  echo "⚠️ babeldoc 安裝可能有警告"

# 6.9 MinerU（僅 AMD64，CPU-only 模式）
# 💡 使用 mineru（不含 [all]）避免安裝 PyTorch CUDA（節省 ~5-8GB）
# 💡 MinerU 會自動使用 pipeline backend 在純 CPU 環境運行
# 💡 設置 CUDA_VISIBLE_DEVICES="" 強制使用 CPU
RUN set -ex && \
  ARCH=$(uname -m) && \
  if [ "$ARCH" = "aarch64" ]; then \
  echo "⚠️ ARM64：MinerU 不支援，跳過安裝"; \
  else \
  uv pip install --system --break-system-packages --no-cache -U mineru; \
  fi

# MinerU CPU-only 環境變數
ENV CUDA_VISIBLE_DEVICES=""
ENV MINERU_USE_CPU="1"

# 6.10 tiktoken
RUN uv pip install --system --break-system-packages --no-cache tiktoken

# 設定 PATH
ENV PATH="/root/.local/bin:/usr/local/bin:${PATH}"

# ==============================================================================
# Stage 7: Models Download（拆分下載）
# ==============================================================================
FROM python-tools AS models

# 設定模型目錄環境變數
ENV MINERU_MODELS_DIR="/opt/convertx/models/mineru"
ENV BABELDOC_CACHE_DIR="/root/.cache/babeldoc"

# 7.1 創建目錄結構
RUN mkdir -p /opt/convertx/models/mineru && \
  mkdir -p /root/.cache/babeldoc/models && \
  mkdir -p /root/.cache/babeldoc/fonts && \
  mkdir -p /root/.cache/babeldoc/cmap && \
  mkdir -p /root/.cache/babeldoc/tiktoken

# 7.2 複製預下載的 ONNX 模型
COPY models/ /root/.cache/babeldoc/models/

# 7.3 複製 MinerU 模型下載腳本
COPY scripts/download-mineru-models.sh /tmp/download-mineru-models.sh
RUN chmod +x /tmp/download-mineru-models.sh && /tmp/download-mineru-models.sh && rm -f /tmp/download-mineru-models.sh

# 7.4 產生 MinerU 配置檔
COPY scripts/generate-mineru-config.sh /tmp/generate-mineru-config.sh
RUN chmod +x /tmp/generate-mineru-config.sh && /tmp/generate-mineru-config.sh && rm -f /tmp/generate-mineru-config.sh

# 7.5 BabelDOC warmup
RUN set -ex && \
  export BABELDOC_CACHE_PATH="/root/.cache/babeldoc" && \
  if command -v babeldoc >/dev/null 2>&1; then \
  babeldoc --warmup 2>&1 || echo "⚠️ warmup 可能有警告"; \
  else \
  echo "⚠️ babeldoc 不可用，跳過 warmup"; \
  fi

# 7.6 下載 tiktoken 編碼
COPY scripts/download-tiktoken.sh /tmp/download-tiktoken.sh
RUN chmod +x /tmp/download-tiktoken.sh && /tmp/download-tiktoken.sh && rm -f /tmp/download-tiktoken.sh

# 7.7 清理下載快取
RUN rm -rf /tmp/hf_download_cache /root/.cache/huggingface \
  /root/.cache/pip /root/.cache/uv && \
  find /usr -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true

# ==============================================================================
# Stage 8: Final Release Image
# ==============================================================================
FROM python-tools AS release
WORKDIR /app

# 8.1 從 models stage 複製模型和配置
COPY --from=models /opt/convertx /opt/convertx
COPY --from=models /root/.cache/babeldoc /root/.cache/babeldoc
COPY --from=models /root/mineru.json /root/mineru.json

# 8.2 複製應用程式
COPY --from=install /temp/prod/node_modules node_modules
COPY --from=prerelease /app/public/ /app/public/
COPY --from=prerelease /app/dist /app/dist

# 8.3 確保字型目錄完整（fonts stage 已安裝，這裡確保 COPY 覆蓋）
RUN mkdir -p /usr/share/fonts/truetype/custom
COPY fonts/ /usr/share/fonts/truetype/custom/
COPY models/ /root/.cache/babeldoc/models/

# 8.4 更新字型快取
RUN fc-cache -fv

# ==============================================================================
# PDF 簽章憑證
# ==============================================================================
RUN mkdir -p /app/certs && \
  openssl req -x509 -newkey rsa:2048 \
  -keyout /tmp/key.pem -out /tmp/cert.pem \
  -days 3650 -nodes \
  -subj "/CN=PDF Packager Default/O=ConvertX-CN/C=TW" && \
  openssl pkcs12 -export \
  -inkey /tmp/key.pem -in /tmp/cert.pem \
  -out /app/certs/default.p12 \
  -passout pass: && \
  rm -f /tmp/key.pem /tmp/cert.pem && \
  chmod 644 /app/certs/default.p12

# ==============================================================================
# Locale 設定
# ==============================================================================
RUN sed -i 's/# en_US.UTF-8 UTF-8/en_US.UTF-8 UTF-8/' /etc/locale.gen && \
  sed -i 's/# zh_TW.UTF-8 UTF-8/zh_TW.UTF-8 UTF-8/' /etc/locale.gen && \
  sed -i 's/# zh_CN.UTF-8 UTF-8/zh_CN.UTF-8 UTF-8/' /etc/locale.gen && \
  sed -i 's/# ja_JP.UTF-8 UTF-8/ja_JP.UTF-8 UTF-8/' /etc/locale.gen && \
  sed -i 's/# ko_KR.UTF-8 UTF-8/ko_KR.UTF-8 UTF-8/' /etc/locale.gen && \
  sed -i 's/# de_DE.UTF-8 UTF-8/de_DE.UTF-8 UTF-8/' /etc/locale.gen && \
  sed -i 's/# fr_FR.UTF-8 UTF-8/fr_FR.UTF-8 UTF-8/' /etc/locale.gen && \
  locale-gen

# ==============================================================================
# 最終清理
# ==============================================================================
RUN rm -rf /usr/share/doc/texlive* && \
  rm -rf /usr/share/texlive/texmf-dist/doc && \
  rm -rf /usr/share/doc/* && \
  rm -rf /usr/share/man/* && \
  rm -rf /usr/share/info/* && \
  rm -rf /tmp/* && \
  rm -rf /var/tmp/*

# 複製驗證腳本
COPY scripts/verify-models.sh /app/scripts/verify-models.sh
COPY scripts/verify-installation.sh /app/scripts/verify-installation.sh
RUN chmod +x /app/scripts/*.sh

# 創建資料目錄
RUN mkdir -p data

# ==============================================================================
# 🔒 Runtime 離線驗證
# ==============================================================================
RUN echo "======================================" && \
  echo "🔒 Runtime 離線驗證" && \
  echo "======================================" && \
  ARCH=$(uname -m) && \
  VALIDATION_PASSED=true && \
  \
  # 驗證核心工具
  echo "🔍 驗證核心工具..." && \
  for cmd in ffmpeg convert gm vips inkscape pandoc soffice; do \
  if command -v ${cmd} >/dev/null 2>&1; then \
  echo "  ✅ ${cmd}: $(which ${cmd})"; \
  else \
  echo "  ❌ ${cmd}: 未找到" && VALIDATION_PASSED=false; \
  fi; \
  done && \
  \
  # 驗證 MinerU（僅 AMD64）
  echo "🔍 驗證 MinerU..." && \
  if [ "$ARCH" != "aarch64" ]; then \
  if command -v mineru >/dev/null 2>&1; then \
  echo "  ✅ mineru: $(which mineru)"; \
  else \
  echo "  ❌ mineru 不可執行" && VALIDATION_PASSED=false; \
  fi && \
  if [ -d "/opt/convertx/models/mineru/PDF-Extract-Kit-1.0" ]; then \
  echo "  ✅ MinerU 模型目錄存在"; \
  else \
  echo "  ❌ MinerU 模型目錄不存在" && VALIDATION_PASSED=false; \
  fi && \
  if [ -f "/root/mineru.json" ]; then \
  echo "  ✅ mineru.json 存在"; \
  else \
  echo "  ❌ mineru.json 不存在" && VALIDATION_PASSED=false; \
  fi; \
  else \
  echo "  ⚠️ ARM64：跳過 MinerU 驗證"; \
  fi && \
  \
  # 驗證 BabelDOC
  echo "🔍 驗證 BabelDOC..." && \
  if command -v babeldoc >/dev/null 2>&1; then \
  echo "  ✅ babeldoc: $(which babeldoc)"; \
  else \
  echo "  ⚠️ babeldoc 不可用"; \
  fi && \
  \
  # 驗證 pdf2zh
  echo "🔍 驗證 pdf2zh..." && \
  if command -v pdf2zh >/dev/null 2>&1; then \
  echo "  ✅ pdf2zh: $(which pdf2zh)"; \
  else \
  echo "  ⚠️ pdf2zh 不可用"; \
  fi && \
  \
  # 驗證 ImageMagick
  echo "🔍 驗證 ImageMagick..." && \
  if command -v convert >/dev/null 2>&1; then \
  echo "  ✅ ImageMagick: $(convert --version | head -1)"; \
  else \
  echo "  ❌ ImageMagick 未安裝" && VALIDATION_PASSED=false; \
  fi && \
  \
  # 驗證 ONNX 模型
  echo "🔍 驗證 ONNX 模型..." && \
  if [ -f "/root/.cache/babeldoc/models/doclayout_yolo_docstructbench_imgsz1024.onnx" ]; then \
  echo "  ✅ DocLayout-YOLO ONNX 存在"; \
  else \
  echo "  ⚠️ DocLayout-YOLO ONNX 不存在"; \
  fi && \
  \
  # 驗證字型
  echo "🔍 驗證字型..." && \
  FONTS_COUNT=$(ls /usr/share/fonts/truetype/custom/*.ttf 2>/dev/null | wc -l || echo "0") && \
  echo "  ✅ 自訂字型數量: ${FONTS_COUNT}" && \
  \
  echo "======================================" && \
  if [ "$VALIDATION_PASSED" = "true" ]; then \
  echo "✅ 離線驗證通過！"; \
  else \
  echo "❌ 離線驗證失敗！" && exit 1; \
  fi && \
  echo "======================================"

# ==============================================================================
# 🔐 Runtime 環境變數（強制離線模式）
# ==============================================================================

# 1️⃣ 系統 Locale
ENV LANG=zh_TW.UTF-8
ENV LC_ALL=zh_TW.UTF-8

# 2️⃣ Headless 環境
ENV QT_QPA_PLATFORM="offscreen"
ENV DISPLAY=":99"
ENV QTWEBENGINE_CHROMIUM_FLAGS="--no-sandbox"
ENV CALIBRE_USE_SYSTEM_THEME="0"

# 3️⃣ 翻譯服務設定（這是唯一允許連網的服務）
ENV PDFMATHTRANSLATE_SERVICE="google"
ENV BABELDOC_SERVICE="google"

# 4️⃣ 🔒 強制離線模式（禁止模型/資源下載）
# HuggingFace 完全離線
ENV HF_HOME="/nonexistent"
ENV HF_HUB_OFFLINE="1"
ENV TRANSFORMERS_OFFLINE="1"
ENV HF_DATASETS_OFFLINE="1"
ENV TRANSFORMERS_CACHE="/nonexistent"

# MinerU 強制本地模型
ENV MINERU_MODEL_SOURCE="local"
ENV MINERU_CONFIG="/root/mineru.json"
ENV MINERU_MODELS_DIR="/opt/convertx/models/mineru"

# BabelDOC 離線模式
ENV BABELDOC_OFFLINE="1"
ENV BABELDOC_CACHE_PATH="/root/.cache/babeldoc"

# 禁止 pip 安裝
ENV PIP_NO_INDEX="1"
ENV PIP_NO_CACHE_DIR="1"

# 5️⃣ PDF 簽章設定
ENV PDF_SIGN_P12_PATH="/app/certs/default.p12"
ENV PDF_SIGN_P12_PASSWORD=""
ENV PDF_SIGN_REASON="ConvertX-CN PDF Packager"
ENV PDF_SIGN_LOCATION="Taiwan"
ENV PDF_SIGN_CONTACT="convertx-cn@localhost"

# 6️⃣ 應用程式設定
ENV PANDOC_PDF_ENGINE=pdflatex
ENV NODE_ENV=production

# ==============================================================================
# 暴露端口 & 啟動
# ==============================================================================
EXPOSE 3000/tcp

ENTRYPOINT [ "bun", "run", "dist/src/index.js" ]
