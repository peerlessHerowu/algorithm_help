"""
Redis 连接池管理（基于 redis-py async）

提供 Singleton 连接池、FastAPI 依赖注入函数、健康检查。
"""

import asyncio
from typing import AsyncGenerator, Optional

import structlog
from redis.asyncio import ConnectionPool, Redis

from crawler_service.config import get_settings

logger = structlog.get_logger()

# ---- 全局单例连接池 ----

_pool: Optional[ConnectionPool] = None
_pool_lock = asyncio.Lock()


async def _get_pool() -> ConnectionPool:
    """获取全局 Redis 连接池单例（协程安全）"""
    global _pool
    if _pool is None:
        async with _pool_lock:
            if _pool is None:
                settings = get_settings()
                _pool = ConnectionPool.from_url(
                    settings.redis.url,
                    max_connections=settings.redis.max_connections,
                    decode_responses=True,
                )
                logger.info(
                    "Redis 连接池已创建",
                    url=_mask_url(settings.redis.url),
                    max_connections=settings.redis.max_connections,
                )
    return _pool


async def get_redis() -> AsyncGenerator[Redis, None]:
    """
    FastAPI 依赖注入函数，用于 Depends。

    Usage:
        @router.get("/example")
        async def example(redis: Redis = Depends(get_redis)):
            await redis.ping()
    """
    pool = await _get_pool()
    client = Redis(connection_pool=pool)
    try:
        yield client
    finally:
        await client.aclose()


async def get_redis_client() -> Redis:
    """
    直接获取 Redis 客户端实例（非生成器，用于非 FastAPI 场景）。

    调用方负责在不需要时调用 aclose()。
    """
    pool = await _get_pool()
    return Redis(connection_pool=pool)


# ---- 健康检查 ----


async def redis_health_check() -> bool:
    """
    Redis 健康检查：执行 PING 命令。

    Returns:
        True 表示连接正常，False 表示连接异常。
    """
    try:
        pool = await _get_pool()
        client = Redis(connection_pool=pool)
        try:
            result = await client.ping()
            return result is True
        finally:
            await client.aclose()
    except Exception as e:
        logger.warning("Redis 健康检查失败", error=str(e))
        return False


# ---- 生命周期管理 ----


async def close_redis_pool() -> None:
    """关闭全局连接池（应用关闭时调用）"""
    global _pool
    if _pool is not None:
        await _pool.disconnect()
        _pool = None
        logger.info("Redis 连接池已关闭")


async def reset_redis_pool() -> None:
    """重置连接池（测试用）"""
    global _pool
    if _pool is not None:
        await _pool.disconnect()
    _pool = None


# ---- 工具函数 ----


def _mask_url(url: str) -> str:
    """隐藏 URL 中的密码信息，用于日志输出"""
    if "@" in url:
        # redis://:password@host:port/db → redis://***@host:port/db
        prefix, suffix = url.split("@", 1)
        scheme_end = prefix.find("://")
        if scheme_end != -1:
            return f"{prefix[:scheme_end + 3]}***@{suffix}"
    return url
