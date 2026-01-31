# ==============================================================================
# ConvertX-CN API Server Dockerfile（輕量代理模式）
# ==============================================================================
#
# 📦 說明：
#   - 這是 ConvertX-CN API Server 的輕量 Dockerfile
#   - 使用 Rust 編譯，提供 REST API
#   - ⚡ 代理模式：API Server 不直接調用轉換工具
#   - 🔄 所有轉換請求轉發給 Web UI（convertx:3000）
#   - 💡 體積極小（約 10MB），不需要安裝任何轉換工具
#
# 🏗️ 架構：
#
#   ┌─────────────────┐     ┌──────────────────┐     ┌──────────────────┐
#   │   外部程式/腳本   │────▶│   API Server     │────▶│   Web UI         │
#   │   (REST API)    │     │   (輕量代理)      │     │   (已有工具)      │
#   └─────────────────┘     └──────────────────┘     └──────────────────┘
#
# 🔧 建置方式：
#   docker build -f api-server/Dockerfile -t convertx-api ./api-server
#
# ==============================================================================

# Stage 1: Build
FROM rust:1.75-bookworm AS builder

WORKDIR /app

# Copy Cargo files first for dependency caching
COPY Cargo.toml Cargo.lock* ./

# Create a dummy main.rs to build dependencies
RUN mkdir src && \
    echo "fn main() {}" > src/main.rs && \
    cargo build --release && \
    rm -rf src

# Copy actual source code
COPY src ./src

# Build the actual application
RUN touch src/main.rs && cargo build --release

# Stage 2: Runtime（極簡版 - 只需要 glibc）
FROM debian:bookworm-slim AS runtime

WORKDIR /app

# 只安裝最基礎的依賴
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Copy the compiled binary
COPY --from=builder /app/target/release/convertx-api /usr/local/bin/convertx-api

# Set environment variables
ENV RAS_API_PORT=7890
ENV CONVERTX_BACKEND_URL=http://convertx:3000

# Expose API port
EXPOSE 7890/tcp

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:7890/api/v1/health || exit 1

# Run the API server
ENTRYPOINT ["/usr/local/bin/convertx-api"]
