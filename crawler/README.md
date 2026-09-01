# Python Crawler Service

## 简介

Python 数据采集微服务（python-crawler-service），负责从多个算法平台自动采集题目和题解数据。该服务是从原 Java 爬虫模块（algorithm-help-crawler）完整重写而来的独立 Python 微服务，部署在项目根目录 `crawler/` 下（与 `backend/`、`frontend/` 平级）。

## 核心功能

- **多平台采集**：支持 LeetCode（国际站/中文站）、Codeforces、牛客网、AtCoder、洛谷
- **插件化适配器**：新增平台仅需在 `adapters/` 目录添加一个 `.py` 文件
- **反爬策略**：令牌桶限流、熔断器、UA 轮转、Cookie 管理、指数退避重试
- **数据标准化管线**：HTML→Markdown、图片下载、难度/标签映射、质量检查
- **异步架构**：asyncio + httpx 全链路异步，单进程高并发采集
- **事件驱动**：通过 Redis Stream 发布采集状态和内容事件
- **可观测性**：Prometheus 指标暴露 + structlog 结构化日志

## 技术栈

| 组件 | 技术 |
|------|------|
| Web 框架 | FastAPI |
| HTTP 客户端 | httpx (async) |
| HTML 解析 | BeautifulSoup4 + markdownify |
| 动态页面 | Playwright (async) |
| 数据库 | SQLAlchemy 2.0 + asyncmy |
| 缓存/事件 | redis-py (async) |
| 对象存储 | minio-py |
| 定时调度 | APScheduler 4.x |
| 监控 | prometheus_client |
| 日志 | structlog |
| 配置 | pydantic-settings + watchfiles |

## 项目结构

```
crawler/
├── Dockerfile              # 多阶段 Docker 构建
├── pyproject.toml          # 项目配置与依赖管理
├── README.md               # 本文件
├── config/                 # 配置文件目录
│   ├── settings.yaml       # 默认配置
│   └── settings.local.yaml # 本地覆盖配置（不提交 Git）
├── src/crawler_service/    # 源码目录
│   ├── main.py             # FastAPI 应用入口
│   ├── config.py           # Pydantic Settings 配置模型
│   ├── models/             # 数据模型（ORM 实体、枚举、DTO）
│   ├── adapters/           # 平台适配器插件目录
│   ├── anticrawl/          # 反爬策略层
│   ├── pipeline/           # 数据标准化管线
│   ├── orchestrator/       # 采集编排器
│   ├── scheduler/          # 定时任务调度
│   ├── events/             # Redis Stream 事件发布
│   ├── storage/            # MinIO 对象存储
│   ├── database/           # 数据库连接与仓储
│   ├── api/                # FastAPI REST API 路由
│   └── utils/              # 工具类（雪花 ID、trace）
└── tests/                  # 测试目录
```

## 快速开始

### 环境要求

- Python 3.11+
- MySQL 8.0
- Redis 7.x
- MinIO

### 本地开发

```bash
# 1. 安装依赖
cd crawler
pip install -e ".[dev]"

# 2. 安装 Playwright 浏览器
playwright install chromium

# 3. 复制本地配置
cp config/settings.yaml config/settings.local.yaml
# 编辑 settings.local.yaml 填写本地数据库/Redis/MinIO 连接信息

# 4. 启动服务
uvicorn crawler_service.main:app --reload --host 0.0.0.0 --port 8081
```

### Docker 部署

```bash
# 在项目根目录执行
docker compose up -d python-crawler-service
```

### API 文档

启动服务后访问：
- Swagger UI: http://localhost:8081/docs
- ReDoc: http://localhost:8081/redoc

## 与 Java Core 端的协作

- Java Core 通过 HTTP POST `/api/v1/crawl/trigger` 触发采集
- 采集结果通过 HTTP 写入 Java Core 端的 Problem/UserSolution 表
- 通过 Redis Stream 发布事件通知 Core 端进行后续处理
