# =============================================================================
# Python Crawler Service - 多阶段构建 Dockerfile
# 基于 python:3.11-slim + uv 包管理器 + Playwright 浏览器依赖
# =============================================================================

# ---------------------------------------------------------------------------
# Stage 1: builder - 安装 Python 依赖到虚拟环境
# ---------------------------------------------------------------------------
FROM python:3.11-slim AS builder

WORKDIR /build

# 安装 uv 包管理器
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

# 复制依赖描述文件
COPY pyproject.toml uv.lock ./

# 使用 uv 创建虚拟环境并安装生产依赖（不含 dev 依赖）
RUN uv venv /opt/venv && \
    uv pip install --python /opt/venv/bin/python --no-cache -r pyproject.toml

# ---------------------------------------------------------------------------
# Stage 2: runtime - 最小化运行时镜像
# ---------------------------------------------------------------------------
FROM python:3.11-slim AS runtime

# 安装 Playwright 浏览器所需的系统依赖（Chromium 最小化依赖集）
RUN apt-get update && apt-get install -y --no-install-recommends \
    libglib2.0-0 \
    libnss3 \
    libnspr4 \
    libdbus-1-3 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libxkbcommon0 \
    libatspi2.0-0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libpango-1.0-0 \
    libcairo2 \
    libasound2 \
    libx11-xcb1 \
    fonts-noto-cjk \
    && rm -rf /var/lib/apt/lists/*

# 从 builder 阶段复制虚拟环境
COPY --from=builder /opt/venv /opt/venv

# 设置虚拟环境路径
ENV PATH="/opt/venv/bin:$PATH" \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

# 安装 Playwright Chromium 浏览器（用于动态页面采集）
RUN playwright install chromium

# 创建非 root 用户
RUN groupadd -r crawler_user && useradd -r -g crawler_user -d /app -s /sbin/nologin crawler_user

WORKDIR /app

# 复制源代码和配置
COPY src/ ./src/
COPY config/ ./config/

# 设置目录权限
RUN chown -R crawler_user:crawler_user /app

# 切换到非 root 用户
USER crawler_user

EXPOSE 8200

# 启动 FastAPI 应用
CMD ["uvicorn", "crawler_service.main:app", "--host", "0.0.0.0", "--port", "8200"]
