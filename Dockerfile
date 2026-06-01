# ==============================================================================
# ConvertX-CN 官方 Docker Image
# 版本：v0.1.26 - CPU-only 輕量版
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
LABEL org.opencontainers.image.version="v0.1.26"
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

# 4.3 核心轉換工具（不包含 Ghostscript，稍後從源碼編譯）
RUN apt-get update --fix-missing && \
  apt-get install -y --no-install-recommends \
  assimp-utils dcraw dvisvgm graphicsmagick \
  mupdf-tools poppler-utils potrace qpdf && \
  rm -rf /var/lib/apt/lists/*

# 4.3.1 編譯安裝 Ghostscript 10.06.0（解決 OCRmyPDF 與舊版 GS 的相容性問題）
# ⚠️ 重要：Ghostscript 10.0.0-10.02.0 有嚴重 regression，會導致 OCRmyPDF 失敗
# 📦 從官方源碼編譯，確保使用最新穩定版
# 📝 使用 Ghostscript 內建庫避免 "Mixing local libtiff with shared libjpeg" 錯誤
ARG GHOSTSCRIPT_VERSION=10.06.0
RUN set -ex && \
  apt-get update --fix-missing && \
  apt-get install -y --no-install-recommends \
  build-essential pkg-config libfreetype-dev libfontconfig1-dev zlib1g-dev && \
  cd /tmp && \
  curl -fsSL --retry 3 --retry-delay 5 \
  "https://github.com/ArtifexSoftware/ghostpdl-downloads/releases/download/gs10060/ghostscript-${GHOSTSCRIPT_VERSION}.tar.gz" \
  -o ghostscript.tar.gz && \
  tar -xzf ghostscript.tar.gz && \
  cd ghostscript-${GHOSTSCRIPT_VERSION} && \
  ./configure --prefix=/usr/local \
  --disable-cups \
  --without-x && \
  make -j$(nproc) && \
  make install && \
  ldconfig && \
  cd / && rm -rf /tmp/ghostscript* && \
  apt-get remove -y build-essential pkg-config && \
  apt-get autoremove -y && \
  rm -rf /var/lib/apt/lists/* && \
  echo "✅ Ghostscript $(gs --version) 編譯安裝完成"

# 確保新的 gs 在 PATH 最前面
ENV PATH="/usr/local/bin:${PATH}"

# 4.4 dasel（JSON/YAML/TOML 轉換）
RUN set -ex && \
  ARCH=$(uname -m) && \
  if [ "$ARCH" = "aarch64" ]; then DASEL_ARCH="linux_arm64"; \
  else DASEL_ARCH="linux_amd64"; fi && \
  curl -sSLf --retry 3 --retry-delay 5 --retry-all-errors \
  "https://github.com/TomWright/dasel/releases/download/v2.8.1/dasel_${DASEL_ARCH}" \
  -o /usr/local/bin/dasel && \
  chmod +x /usr/local/bin/dasel

# 4.5 resvg（跨架構支援）
# 📦 版本 v0.46.0 - 2026-01 官方最新穩定版
# 💡 v0.46.0 新功能：改進 SVG 渲染、更好的文字處理
# 🔗 https://github.com/linebender/resvg/releases/tag/v0.46.0
# 🌍 跨架構策略：
#   - AMD64: 官方預編譯 binary
#   - ARM64: 嘗試 source build，失敗則跳過並警告
ARG RESVG_VERSION=0.46.0
RUN set -ex && \
  mkdir -p /opt/convertx/disabled-engines && \
  ARCH=$(uname -m) && \
  if [ "$ARCH" = "aarch64" ]; then \
  echo "🔧 [ARM64] 嘗試從源碼編譯 resvg..." && \
  apt-get update --fix-missing && \
  apt-get install -y --no-install-recommends build-essential curl && \
  if command -v rustc >/dev/null 2>&1; then \
  echo "✅ Rust 已安裝"; \
  else \
  echo "📦 安裝 Rust..." && \
  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --profile minimal && \
  export PATH="$HOME/.cargo/bin:$PATH"; \
  fi && \
  export PATH="$HOME/.cargo/bin:$PATH" && \
  if cargo install resvg --version ${RESVG_VERSION} --locked 2>/dev/null; then \
  cp "$HOME/.cargo/bin/resvg" /usr/local/bin/resvg && \
  chmod +x /usr/local/bin/resvg && \
  echo "✅ [ARM64] resvg v${RESVG_VERSION} 源碼編譯完成"; \
  else \
  echo "⚠️ [ARM64] resvg source build failed, feature disabled" && \
  echo "resvg" > /opt/convertx/disabled-engines/resvg && \
  echo "RESVG_DISABLED=1" >> /etc/environment; \
  fi && \
  rm -rf "$HOME/.cargo" "$HOME/.rustup" && \
  apt-get remove -y build-essential && apt-get autoremove -y && \
  rm -rf /var/lib/apt/lists/*; \
  else \
  curl -sSLf --retry 3 --retry-delay 5 --retry-all-errors \
  "https://github.com/linebender/resvg/releases/download/v${RESVG_VERSION}/resvg-linux-x86_64.tar.gz" \
  -o /tmp/resvg.tar.gz && \
  tar -xzf /tmp/resvg.tar.gz -C /tmp/ && \
  mv /tmp/resvg /usr/local/bin/resvg && \
  chmod +x /usr/local/bin/resvg && \
  rm -rf /tmp/resvg.tar.gz && \
  echo "✅ [AMD64] resvg v${RESVG_VERSION} 官方 binary 安裝完成"; \
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

# 4.8 FFmpeg 7.1.1 - 官方靜態編譯版
# 📦 版本 7.1.1 - 2025-03 官方最新穩定版
# 💡 v7.x 新功能：VVC (H.266) 解碼支援、改進 AV1 編碼、新濾鏡
# ⚠️ apt 版本過舊（約 5.x），改用官方靜態編譯確保最新功能
# 🔗 https://ffmpeg.org/releases/
ARG FFMPEG_VERSION=7.1.1
RUN set -ex && \
  apt-get update --fix-missing && \
  apt-get install -y --no-install-recommends libva2 xz-utils ca-certificates curl && \
  rm -rf /var/lib/apt/lists/* && \
  ARCH=$(uname -m) && \
  STATIC_INSTALL_OK=0 && \
  if [ "$ARCH" = "aarch64" ]; then \
  FFMPEG_URLS="https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-arm64-static.tar.xz https://www.johnvansickle.com/ffmpeg/releases/ffmpeg-release-arm64-static.tar.xz https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-linuxarm64-gpl.tar.xz"; \
  else \
  FFMPEG_URLS="https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz"; \
  fi && \
  echo "📦 下載 FFmpeg ${FFMPEG_VERSION} 靜態編譯版（架構: ${ARCH}）..." && \
  for FFMPEG_URL in ${FFMPEG_URLS}; do \
  echo "🔄 嘗試下載 FFmpeg: ${FFMPEG_URL}"; \
  rm -rf /tmp/ffmpeg /tmp/ffmpeg.tar.xz; \
  if curl -fL --connect-timeout 15 --max-time 600 --retry 4 --retry-delay 3 --retry-all-errors "${FFMPEG_URL}" -o /tmp/ffmpeg.tar.xz; then \
  mkdir -p /tmp/ffmpeg; \
  if tar -xJf /tmp/ffmpeg.tar.xz -C /tmp/ffmpeg --strip-components=1; then \
  if [ -x /tmp/ffmpeg/ffmpeg ] && [ -x /tmp/ffmpeg/ffprobe ]; then \
  cp /tmp/ffmpeg/ffmpeg /usr/local/bin/ffmpeg; \
  cp /tmp/ffmpeg/ffprobe /usr/local/bin/ffprobe; \
  elif [ -x /tmp/ffmpeg/bin/ffmpeg ] && [ -x /tmp/ffmpeg/bin/ffprobe ]; then \
  cp /tmp/ffmpeg/bin/ffmpeg /usr/local/bin/ffmpeg; \
  cp /tmp/ffmpeg/bin/ffprobe /usr/local/bin/ffprobe; \
  else \
  echo "⚠️ 已下載但未找到 ffmpeg/ffprobe 可執行檔，嘗試下一個來源"; \
  continue; \
  fi; \
  chmod +x /usr/local/bin/ffmpeg /usr/local/bin/ffprobe; \
  STATIC_INSTALL_OK=1; \
  echo "✅ FFmpeg 靜態版本安裝成功（來源: ${FFMPEG_URL}）"; \
  break; \
  fi; \
  fi; \
  done && \
  if [ "${STATIC_INSTALL_OK}" -ne 1 ] && [ "$ARCH" = "aarch64" ]; then \
  echo "⚠️ ARM64 靜態 FFmpeg 多來源下載皆失敗，改用 apt 安裝 ffmpeg/ffprobe"; \
  apt-get update --fix-missing && \
  apt-get install -y --no-install-recommends ffmpeg && \
  rm -rf /var/lib/apt/lists/*; \
  fi && \
  if [ "${STATIC_INSTALL_OK}" -ne 1 ] && [ "$ARCH" != "aarch64" ]; then \
  echo "❌ FFmpeg 靜態版本下載失敗（AMD64 不啟用 apt fallback）"; \
  exit 1; \
  fi && \
  if ! command -v ffmpeg >/dev/null 2>&1 || ! command -v ffprobe >/dev/null 2>&1; then \
  echo "❌ FFmpeg 或 FFprobe 安裝失敗"; \
  exit 1; \
  fi && \
  rm -rf /tmp/ffmpeg* && \
  echo "✅ FFmpeg $(ffmpeg -version 2>&1 | head -1) 安裝完成"

# 4.9 圖像處理工具（Inkscape, libheif, libjxl 等 - ImageMagick 和 vips 獨立安裝）
RUN apt-get update --fix-missing && \
  apt-get install -y --no-install-recommends \
  inkscape libheif-examples libjxl-tools xauth xvfb && \
  rm -rf /var/lib/apt/lists/* && \
  # 驗證 xvfb-run 可用
  which xvfb-run && echo "✅ xvfb-run 安裝成功"

# 4.9.1 ImageMagick 7 - 從源碼編譯安裝
# 📦 版本 7.1.1-47 - 官方最新穩定版
# 💡 v7.x 新功能：HEIF/AVIF 支援增強、JXL 改進、更好的色彩管理
# 💡 命令工具：`magick`（取代 v6.x 的 `convert`）
# 🔗 https://github.com/ImageMagick/ImageMagick/releases
# 🌍 跨架構：AMD64/ARM64 均從源碼編譯
# ⚠️ 使用兩個 RUN 層：第一層編譯安裝，第二層清理（避免依賴被誤刪）
ARG IMAGEMAGICK_VERSION=7.1.1-47
# 第一層：安裝依賴 + 編譯 + 安裝
RUN set -ex && \
  apt-get update --fix-missing && \
  # 運行時依賴（libraw20 是 Debian Bookworm 的版本，libltdl7 是模塊支援必需）
  apt-get install -y --no-install-recommends \
  libpng16-16 libjpeg62-turbo libtiff6 libwebp7 libwebpmux3 libwebpdemux2 \
  libheif1 libjxl0.7 libraw20 libopenjp2-7 \
  libfreetype6 libfontconfig1 libxml2 \
  liblcms2-2 libzip4 libbz2-1.0 libzstd1 libgomp1 libltdl7 && \
  # 編譯時依賴（libltdl-dev 是 ImageMagick 模塊支援必需）
  apt-get install -y --no-install-recommends \
  build-essential pkg-config \
  libpng-dev libjpeg-dev libtiff-dev libwebp-dev \
  libheif-dev libjxl-dev libraw-dev libopenjp2-7-dev \
  libfreetype-dev libfontconfig1-dev libxml2-dev \
  liblcms2-dev libzip-dev libbz2-dev libzstd-dev libltdl-dev && \
  # 下載源碼
  cd /tmp && \
  echo "📦 下載 ImageMagick ${IMAGEMAGICK_VERSION}..." && \
  curl -fsSL --retry 3 --retry-delay 5 \
  "https://github.com/ImageMagick/ImageMagick/archive/refs/tags/${IMAGEMAGICK_VERSION}.tar.gz" \
  -o imagemagick.tar.gz && \
  tar -xzf imagemagick.tar.gz && \
  cd ImageMagick-${IMAGEMAGICK_VERSION} && \
  # 配置（使用 LDFLAGS 確保運行時能找到庫）
  echo "🔧 配置 ImageMagick..." && \
  ./configure --prefix=/usr/local \
  LDFLAGS="-Wl,-rpath,/usr/local/lib" \
  --with-modules \
  --enable-shared \
  --enable-hdri \
  --with-quantum-depth=16 \
  --with-heic \
  --with-jxl \
  --with-raw \
  --with-webp \
  --with-openjp2 \
  --with-freetype \
  --with-fontconfig \
  --without-x \
  --disable-docs && \
  # 編譯安裝
  echo "🔨 編譯 ImageMagick..." && \
  make -j$(nproc) && \
  make install && \
  # 更新動態連結庫快取
  ldconfig /usr/local/lib && \
  # 驗證安裝
  echo "🔍 驗證 ImageMagick 安裝..." && \
  ls -la /usr/local/bin/magick && \
  /usr/local/bin/magick --version && \
  # 清理源碼
  cd / && rm -rf /tmp/imagemagick* /tmp/ImageMagick* && \
  rm -rf /usr/local/share/doc/ImageMagick* && \
  rm -rf /usr/local/share/ImageMagick*/www && \
  echo "✅ ImageMagick 編譯安裝完成"

# 第二層：清理編譯依賴（獨立的 RUN 層，不會影響已編譯的二進制）
RUN set -ex && \
  apt-get remove -y --purge \
  build-essential pkg-config \
  libpng-dev libjpeg-dev libtiff-dev libwebp-dev \
  libheif-dev libjxl-dev libraw-dev libopenjp2-7-dev \
  libfreetype-dev libfontconfig1-dev libxml2-dev \
  liblcms2-dev libzip-dev libbz2-dev libzstd-dev libltdl-dev && \
  apt-get autoremove -y && \
  apt-get clean && \
  rm -rf /var/lib/apt/lists/* && \
  # 最終驗證（確保清理後仍可運行）
  ldconfig && \
  /usr/local/bin/magick --version && \
  echo "✅ ImageMagick 清理完成，仍可正常運行"

# 4.9.2 libvips 8.16.0 - 從源碼編譯安裝
# 📦 版本 8.16.0 - 官方穩定版（比 apt 的 8.14.x 新）
# 💡 v8.16 新功能：效能改進、更好的格式支援
# 🔗 https://github.com/libvips/libvips/releases
ARG LIBVIPS_VERSION=8.16.0
# 第一層：安裝依賴 + 編譯 + 安裝
RUN set -ex && \
  apt-get update --fix-missing && \
  # 運行時依賴（libfftw3-double3 是 Debian Bookworm 的正確套件名）
  apt-get install -y --no-install-recommends \
  libglib2.0-0 libexpat1 libpoppler-glib8 librsvg2-2 \
  libexif12 libgsf-1-114 liborc-0.4-0 \
  libcfitsio10 libopenslide0 libfftw3-double3 && \
  # 編譯時依賴
  apt-get install -y --no-install-recommends \
  build-essential pkg-config meson ninja-build \
  libglib2.0-dev libexpat1-dev \
  libpng-dev libjpeg-dev libtiff-dev libwebp-dev \
  libheif-dev libjxl-dev libraw-dev libopenjp2-7-dev \
  libpoppler-glib-dev librsvg2-dev liblcms2-dev \
  libexif-dev libgsf-1-dev liborc-0.4-dev \
  libcfitsio-dev libopenslide-dev libfftw3-dev && \
  # 下載源碼
  cd /tmp && \
  echo "📦 下載 libvips ${LIBVIPS_VERSION}..." && \
  curl -fsSL --retry 3 --retry-delay 5 \
  "https://github.com/libvips/libvips/releases/download/v${LIBVIPS_VERSION}/vips-${LIBVIPS_VERSION}.tar.xz" \
  -o vips.tar.xz && \
  tar -xJf vips.tar.xz && \
  cd vips-${LIBVIPS_VERSION} && \
  # 配置編譯
  meson setup build --prefix=/usr/local --buildtype=release \
  -Dc_link_args="-Wl,-rpath,/usr/local/lib" && \
  ninja -C build && \
  ninja -C build install && \
  ldconfig /usr/local/lib && \
  # 驗證
  vips --version && \
  # 清理源碼
  cd / && rm -rf /tmp/vips* && \
  rm -rf /usr/local/share/doc/vips && \
  echo "✅ libvips 編譯安裝完成"

# 第二層：清理編譯依賴
RUN set -ex && \
  apt-get remove -y --purge \
  build-essential pkg-config meson ninja-build \
  libglib2.0-dev libexpat1-dev \
  libpng-dev libjpeg-dev libtiff-dev libwebp-dev \
  libheif-dev libjxl-dev libraw-dev libopenjp2-7-dev \
  libpoppler-glib-dev librsvg2-dev liblcms2-dev \
  libexif-dev libgsf-1-dev liborc-0.4-dev \
  libcfitsio-dev libopenslide-dev libfftw3-dev && \
  apt-get autoremove -y && \
  apt-get clean && \
  rm -rf /var/lib/apt/lists/* && \
  ldconfig && \
  vips --version && \
  echo "✅ libvips 清理完成，仍可正常運行"

# 4.10 文件處理工具（Pandoc）
# 📦 Pandoc v3.8.3 - 從官方 GitHub 安裝最新穩定版
# 💡 新功能：asciidoc/pptx/xlsx 輸入支援、bbcode 輸出支援
ARG PANDOC_VERSION=3.8.3
RUN set -ex && \
  apt-get update --fix-missing && \
  apt-get install -y --no-install-recommends libemail-outlook-message-perl && \
  rm -rf /var/lib/apt/lists/* && \
  ARCH=$(uname -m) && \
  if [ "$ARCH" = "aarch64" ]; then \
  PANDOC_ARCH="arm64"; \
  else \
  PANDOC_ARCH="amd64"; \
  fi && \
  curl -fsSL --retry 3 --retry-delay 5 \
  "https://github.com/jgm/pandoc/releases/download/${PANDOC_VERSION}/pandoc-${PANDOC_VERSION}-linux-${PANDOC_ARCH}.tar.gz" \
  -o /tmp/pandoc.tar.gz && \
  tar -xzf /tmp/pandoc.tar.gz -C /tmp/ && \
  cp /tmp/pandoc-${PANDOC_VERSION}/bin/pandoc /usr/local/bin/pandoc && \
  chmod +x /usr/local/bin/pandoc && \
  rm -rf /tmp/pandoc* && \
  echo "✅ Pandoc v${PANDOC_VERSION} 安裝完成"

# 4.10.1 Calibre 官方二進制安裝
# 📦 版本 9.4.0 - 2026-02 官方最新穩定版（比 9.2.1 新）
# 💡 v9.4 新功能：改進 EPUB 轉換、更好的 DOCX 支援
# 🔗 https://github.com/kovidgoyal/calibre/releases/tag/v9.9.0
# ⚠️注意：官方 binary 自帶所有依賴，不依賴系統 libxml2 ABI
# ⚠️重要：Calibre 的 ebook-convert 在 PDF 生成時需要 QtWebEngine runtime 依賴
ARG CALIBRE_VERSION=9.9.0
RUN set -ex && \
  apt-get update --fix-missing && \
  apt-get install -y --no-install-recommends \
  libgl1 libegl1 libxkbcommon0 libxcb-cursor0 \
  libxcb-icccm4 libxcb-image0 libxcb-keysyms1 \
  libxcb-randr0 libxcb-render-util0 libxcb-shape0 \
  libopengl0 libxcb-xinerama0 libxcb-xkb1 xz-utils \
  libasound2 libnss3 libxcomposite1 libxrandr2 \
  libxi6 libxcursor1 libxdamage1 libxtst6 \
  libglib2.0-0 libdbus-1-3 libdrm2 libgbm1 \
  libatk1.0-0 libatk-bridge2.0-0 libcups2 \
  libgtk-3-0 libx11-xcb1 libxcb-dri3-0 libxshmfence1 && \
  rm -rf /var/lib/apt/lists/* && \
  ARCH=$(uname -m) && \
  if [ "$ARCH" = "aarch64" ]; then \
  CALIBRE_URL="https://github.com/kovidgoyal/calibre/releases/download/v${CALIBRE_VERSION}/calibre-${CALIBRE_VERSION}-arm64.txz"; \
  else \
  CALIBRE_URL="https://github.com/kovidgoyal/calibre/releases/download/v${CALIBRE_VERSION}/calibre-${CALIBRE_VERSION}-x86_64.txz"; \
  fi && \
  echo "📦 下載 Calibre ${CALIBRE_VERSION}..." && \
  curl -fsSL --retry 3 --retry-delay 5 "${CALIBRE_URL}" -o /tmp/calibre.txz && \
  mkdir -p /opt/calibre && \
  tar -xJf /tmp/calibre.txz -C /opt/calibre && \
  rm -f /tmp/calibre.txz && \
  ln -sf /opt/calibre/ebook-convert /usr/local/bin/ebook-convert && \
  ln -sf /opt/calibre/ebook-meta /usr/local/bin/ebook-meta && \
  ln -sf /opt/calibre/calibre /usr/local/bin/calibre && \
  echo "✅ Calibre $(ebook-convert --version 2>&1 | head -1) 安裝完成（含 QtWebEngine 依賴）"

# 4.11 LibreOffice 25.8.4 - 官方 deb 安裝
# 📦 版本 25.8.4 - 2026-01 官方最新穩定版
# 💡 v25.8 新功能：改進的 PDF 匯出、更好的 DOCX 相容性、新試算表函數
# ⚠️ apt 版本為 7.x/24.x，落後多個大版本
# 🔗 https://www.libreoffice.org/download/download-libreoffice/
ARG LIBREOFFICE_VERSION=25.8.4
RUN set -ex && \
  apt-get update --fix-missing && \
  apt-get install -y --no-install-recommends \
  libcairo2 libcups2 libdbus-glib-1-2 libglu1-mesa \
  libsm6 libxinerama1 libxrandr2 libxtst6 \
  procps fontconfig && \
  rm -rf /var/lib/apt/lists/* && \
  ARCH=$(uname -m) && \
  if [ "$ARCH" = "aarch64" ]; then \
  LO_ARCH="aarch64"; \
  LO_URL="https://download.documentfoundation.org/libreoffice/stable/${LIBREOFFICE_VERSION}/deb/aarch64/LibreOffice_${LIBREOFFICE_VERSION}_Linux_aarch64_deb.tar.gz"; \
  else \
  LO_ARCH="x86_64"; \
  LO_URL="https://download.documentfoundation.org/libreoffice/stable/${LIBREOFFICE_VERSION}/deb/x86_64/LibreOffice_${LIBREOFFICE_VERSION}_Linux_x86-64_deb.tar.gz"; \
  fi && \
  echo "📦 下載 LibreOffice ${LIBREOFFICE_VERSION} (${LO_ARCH})..." && \
  curl -fsSL --retry 3 --retry-delay 5 "${LO_URL}" -o /tmp/libreoffice.tar.gz && \
  mkdir -p /tmp/libreoffice && \
  tar -xzf /tmp/libreoffice.tar.gz -C /tmp/libreoffice --strip-components=1 && \
  dpkg -i /tmp/libreoffice/DEBS/*.deb || apt-get -f install -y && \
  rm -rf /tmp/libreoffice* && \
  ln -sf /opt/libreoffice*/program/soffice /usr/local/bin/soffice 2>/dev/null || true && \
  ln -sf /opt/libreoffice*/program/soffice /usr/local/bin/libreoffice 2>/dev/null || true && \
  echo "✅ LibreOffice $(soffice --version 2>&1 | head -1) 安裝完成"

# 4.12 TexLive 基礎
RUN apt-get update --fix-missing && \
  apt-get install -y --no-install-recommends \
  texlive-base texlive-latex-base texlive-latex-recommended \
  texlive-fonts-recommended texlive-xetex latexmk lmodern && \
  rm -rf /var/lib/apt/lists/*

# 4.13 TexLive 語言包
RUN apt-get update --fix-missing && \
  apt-get install -y --no-install-recommends \
  texlive-lang-cjk texlive-lang-chinese texlive-lang-german texlive-lang-french \
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

# 6.1 Python 基礎環境 + libxml2/lxml 編譯依賴
# ⚠️ 重要：安裝 libxml2-dev 和 libxslt-dev 用於從源碼編譯 lxml
# 📝 這解決了 html5-parser 與 lxml 使用不同 libxml2 版本的衝突
RUN apt-get update --fix-missing && \
  apt-get install -y --no-install-recommends \
  python3 python3-pip python3-venv python3-numpy \
  python3-tinycss2 python3-opencv python3-img2pdf \
  libxml2-dev libxslt-dev python3-dev build-essential && \
  rm -rf /var/lib/apt/lists/*

# 6.2 uv 套件管理器
RUN pip3 install --no-cache-dir --break-system-packages uv

# 6.2.1 修復 lxml libxml2 衝突
# ⚠️ 關鍵修復：強制從源碼編譯 lxml，使用系統 libxml2
# 📝 這確保 html5-parser 和 lxml 使用相同的 libxml2 版本
# 📝 解決 Calibre HTML → EPUB 轉換的 RuntimeError
RUN set -ex && \
  echo "🔧 移除預編譯的 lxml（如果存在）..." && \
  pip3 uninstall -y lxml 2>/dev/null || true && \
  echo "🔧 從源碼編譯安裝 lxml..." && \
  pip3 install --no-cache-dir --break-system-packages --no-binary lxml lxml && \
  echo "✅ lxml 安裝完成，使用系統 libxml2"

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
# 💡 明確安裝 PyTorch CPU 版本，避免 torch 未定義錯誤
# 💡 使用官方 PyTorch CPU wheel（不含 CUDA）
# 💡 設置 CUDA_VISIBLE_DEVICES="" 強制使用 CPU
# 💡 同時安裝 doclayout-yolo（MinerU hybrid/layout pipeline 必需）
# 💡 安裝 mineru[pipeline] 以包含所有必要依賴（transformers, tokenizers 等）
RUN set -ex && \
  ARCH=$(uname -m) && \
  if [ "$ARCH" = "aarch64" ]; then \
  echo "⚠️ ARM64：MinerU 不支援，跳過安裝" && \
  echo "MINERU_DISABLED=1" >> /etc/environment && \
  mkdir -p /opt/convertx/disabled-engines && \
  echo "mineru" > /opt/convertx/disabled-engines/mineru; \
  else \
  echo "📦 安裝 PyTorch CPU 版本..." && \
  uv pip install --system --break-system-packages --no-cache \
  torch torchvision --index-url https://download.pytorch.org/whl/cpu && \
  echo "📦 安裝 MinerU（含 pipeline 依賴：transformers, tokenizers 等）..." && \
  uv pip install --system --break-system-packages --no-cache -U "mineru[pipeline]" && \
  echo "📦 安裝 doclayout-yolo（MinerU hybrid pipeline 必需）..." && \
  uv pip install --system --break-system-packages --no-cache doclayout-yolo && \
  echo "📦 安裝 ultralytics（MinerU YOLOv8 MFD 模型必需）..." && \
  uv pip install --system --break-system-packages --no-cache ultralytics && \
  echo "✅ PyTorch + MinerU[pipeline] + doclayout-yolo + ultralytics 安裝完成" && \
  python3 -c "from doclayout_yolo import YOLOv10; print('✅ doclayout_yolo 模組驗證成功')" && \
  python3 -c "from ultralytics import YOLO; print('✅ ultralytics 模組驗證成功')" && \
  python3 -c "import tokenizers; print('✅ tokenizers 模組驗證成功')" && \
  python3 -c "import transformers; print('✅ transformers 模組驗證成功')"; \
  fi

# MinerU CPU-only 環境變數（強制 CPU 模式）
ENV CUDA_VISIBLE_DEVICES=""
ENV MINERU_USE_CPU="1"
ENV MINERU_DEVICE_MODE="cpu"
ENV TORCH_DEVICE="cpu"

# 6.11 本地 llama.cpp / GGUF 功能已移除（保留編號避免註解序號跳動）

# 6.12 tiktoken
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

COPY scripts/entrypoint.sh /opt/convertx/entrypoint.sh
RUN chmod +x /opt/convertx/entrypoint.sh

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
  for cmd in ffmpeg magick gm vips inkscape pandoc; do \
  if command -v ${cmd} >/dev/null 2>&1; then \
  echo "  ✅ ${cmd}: $(which ${cmd})"; \
  else \
  echo "  ❌ ${cmd}: 未找到" && VALIDATION_PASSED=false; \
  fi; \
  done && \
  \
  # 驗證 LibreOffice (架構感知)
  echo "🔍 驗證 LibreOffice..." && \
  if command -v soffice >/dev/null 2>&1; then \
  echo "  ✅ soffice: $(which soffice)"; \
  else \
  if [ "$ARCH" = "aarch64" ]; then \
  echo "  ⚠️ ARM64：未安裝 LibreOffice，跳過檢查"; \
  else \
  echo "  ❌ soffice: 未找到" && VALIDATION_PASSED=false; \
  fi; \
  fi && \
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
  echo "  ✅ MinerU Pipeline 模型存在"; \
  else \
  echo "  ❌ MinerU Pipeline 模型不存在" && VALIDATION_PASSED=false; \
  fi && \
  if [ -f "/root/mineru.json" ]; then \
  echo "  ✅ mineru.json 存在"; \
  cat /root/mineru.json; \
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
  # 注：ImageMagick 已在核心工具中驗證，此處跳過重複檢查
  echo "✅ ImageMagick: 已在核心工具驗證中確認" && \
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
# 📌 MinerU 後端配置：
#   - pipeline: 純 OCR 模式（預設，穩定無需額外依賴）
#   - vlm-http-client: 連接 llama.cpp server（高精度 VLM 模式，需要設定環境變數啟用）
# 📌 VLM 模式說明（需設定 MINERU_BACKEND=vlm-http-client 啟用）：
#   - llama.cpp server 會按需自動啟動
#   - 載入 GGUF 格式 VLM 模型
#   - 提供 OpenAI 相容 API 供 MinerU 使用
ENV MINERU_BACKEND="pipeline"
ENV MINERU_VLM_URL="http://127.0.0.1:11785/v1"

# llama.cpp server 配置
ENV LLAMA_SERVER_HOST="127.0.0.1"
ENV LLAMA_SERVER_PORT="11785"

# VLM GGUF 模型路徑（供 llama.cpp server 使用）
ENV VLM_GGUF_MODEL="/opt/convertx/models/vlm/mineru2.5-2509-1.2b/MinerU2.5-2509-1.2B.Q6_K.gguf"
ENV VLM_GGUF_MMPROJ="/opt/convertx/models/vlm/mineru2.5-2509-1.2b/MinerU2.5-2509-1.2B.mmproj-Q8_0.gguf"

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

# 使用啟動腳本（自動啟動 llama.cpp + 主程式）
ENTRYPOINT [ "/opt/convertx/entrypoint.sh" ]
