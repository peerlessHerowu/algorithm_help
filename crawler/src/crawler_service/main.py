"""FastAPI 应用入口

创建 FastAPI app 实例，注册路由、启动 APScheduler、初始化适配器发现、连接池。
集成 structlog 结构化日志（JSON 格式，含 trace_id/platform/task_id）。
配置 OpenAPI/Swagger 自动文档。

Validates: Requirements 22.2, 12.2
"""

import logging
import sys
from contextlib import asynccontextmanager

import structlog
import uvicorn
from fastapi import FastAPI

from .config import get_settings, start_config_watcher
from .utils.trace import TraceMiddleware, get_current_trace_id


# ---- structlog 配置 ----


def _configure_structlog() -> None:
    """配置 structlog 结构化日志（JSON 格式）

    每条日志包含 trace_id、platform、task_id 等上下文字段。
    """
    # 添加 trace_id 注入处理器
    def add_trace_id(logger, method_name, event_dict):
        """自动注入当前协程的 trace_id"""
        if "trace_id" not in event_dict:
            event_dict["trace_id"] = get_current_trace_id()
        return event_dict

    structlog.configure(
        processors=[
            structlog.contextvars.merge_contextvars,
            structlog.stdlib.filter_by_level,
            structlog.stdlib.add_logger_name,
            structlog.stdlib.add_log_level,
            structlog.stdlib.PositionalArgumentsFormatter(),
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.processors.StackInfoRenderer(),
            add_trace_id,
            structlog.processors.format_exc_info,
            structlog.processors.UnicodeDecoder(),
            structlog.processors.JSONRenderer(),
        ],
        wrapper_class=structlog.stdlib.BoundLogger,
        context_class=dict,
        logger_factory=structlog.stdlib.LoggerFactory(),
        cache_logger_on_first_use=True,
    )

    # 配置标准库 logging 使用 structlog
    logging.basicConfig(
        format="%(message)s",
        stream=sys.stdout,
        level=logging.INFO,
    )


# ---- Lifespan 生命周期 ----


@asynccontextmanager
async def lifespan(app: FastAPI):
    """FastAPI lifespan 管理：启动时初始化资源，关闭时清理。

    Startup:
      1. 配置 structlog 结构化日志
      2. 启动配置文件热更新监听
      3. 初始化 DB 连接池
      4. 初始化 Redis 连接池
      5. 初始化 MinIO（确保 bucket 存在）
      6. 适配器自动发现
      7. 配置并启动 APScheduler
      8. 注入 API 层依赖

    Shutdown:
      1. 关闭 APScheduler
      2. 关闭 DB 引擎连接池
      3. 关闭 Redis 连接池
    """
    logger = structlog.get_logger()

    # ---- Startup ----
    _configure_structlog()
    logger.info("python-crawler-service 启动中...")

    # 1. 加载配置 + 启动文件热更新
    settings = get_settings()
    start_config_watcher()

    # 2. 初始化 DB 连接池（延迟创建，首次 get_engine 时自动初始化）
    from .database.session import get_engine, get_session_factory, dispose_engine

    get_engine()
    logger.info("数据库连接池已初始化")

    # 3. 初始化 Redis 连接池
    from .database.redis_client import get_redis_client, close_redis_pool

    redis_client = await get_redis_client()
    logger.info("Redis 连接池已初始化")

    # 4. 初始化 MinIO（确保 bucket 存在）
    from .storage.minio_client import MinioStorage

    minio_storage = MinioStorage()
    minio_storage.ensure_buckets()
    logger.info("MinIO 存储已初始化")

    # 5. 适配器自动发现
    from .adapters import discover_adapters

    discover_adapters()
    logger.info("适配器发现完成")

    # 6. 配置并启动 APScheduler
    from .scheduler import setup_scheduler, start_scheduler, shutdown_scheduler

    await setup_scheduler(config=settings)
    await start_scheduler()
    logger.info("APScheduler 定时调度器已启动")

    # 7. 注入 API 层依赖（crawl router 的全局实例）
    # 注意：CrawlOrchestrator 完整初始化需要所有子系统就绪，
    # 此处先传 None，后续可在所有子系统初始化后补充注入
    from .api.crawl import set_dependencies

    set_dependencies(orchestrator=None, task_repo=None)
    logger.info("API 层依赖注入完成（orchestrator 待后续完整注入）")

    logger.info("python-crawler-service 启动完成")

    yield

    # ---- Shutdown ----
    logger.info("python-crawler-service 关闭中...")
    await shutdown_scheduler()
    await dispose_engine()
    await redis_client.aclose()
    await close_redis_pool()
    logger.info("python-crawler-service 已关闭")


# ---- FastAPI App 实例 ----

app = FastAPI(
    title="Python Crawler Service",
    description=(
        "算法深度理解引擎 - 数据采集微服务。"
        "支持 LeetCode、Codeforces、牛客网、AtCoder 等多平台异步采集，"
        "插件化适配器架构，含反爬策略、数据标准化管线、Redis Stream 事件发布。"
    ),
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    lifespan=lifespan,
)

# 注册 TraceMiddleware（读取/生成 X-Trace-Id 请求头）
app.add_middleware(TraceMiddleware)

# 注册所有 Router
from .api.crawl import router as crawl_router
from .api.config_api import router as config_router
from .api.quality import router as quality_router
from .api.health import router as health_router

app.include_router(crawl_router)
app.include_router(config_router)
app.include_router(quality_router)
app.include_router(health_router)


# ---- uvicorn CLI 入口 ----

if __name__ == "__main__":
    uvicorn.run(
        "crawler_service.main:app",
        host="0.0.0.0",
        port=8200,
        reload=True,
        log_level="info",
    )
