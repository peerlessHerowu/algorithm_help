"""
Redis Cookie 管理器

负责各平台 Cookie 的存取和过期管理。
Key 格式：crawler:cookie:{platform}
支持 Cookie 过期自动刷新（TTL 续期）。
"""

import structlog
from redis.asyncio import Redis

logger = structlog.get_logger()


class RedisCookieStore:
    """Redis Cookie 管理器，负责各平台 Cookie 的存取和过期管理"""

    KEY_PREFIX = "crawler:cookie:"
    DEFAULT_TTL = 86400  # 24 小时

    def __init__(self, redis: Redis):
        self._redis = redis

    def _key(self, platform: str) -> str:
        """构建 Redis key"""
        return f"{self.KEY_PREFIX}{platform}"

    async def get(self, platform: str) -> str:
        """获取平台 Cookie，不存在返回空字符串"""
        key = self._key(platform)
        value = await self._redis.get(key)
        return value or ""

    async def set(self, platform: str, cookie: str, ttl: int | None = None) -> None:
        """设置平台 Cookie，带 TTL（秒）"""
        key = self._key(platform)
        expire = ttl if ttl is not None else self.DEFAULT_TTL
        await self._redis.set(key, cookie, ex=expire)
        logger.debug("Cookie 已设置", platform=platform, ttl=expire)

    async def refresh(self, platform: str, ttl: int | None = None) -> str:
        """
        刷新 Cookie TTL（续期），返回当前 Cookie 值。

        若 Cookie 已过期（不存在），返回空字符串。
        """
        key = self._key(platform)
        cookie = await self._redis.get(key)
        if cookie:
            expire = ttl if ttl is not None else self.DEFAULT_TTL
            await self._redis.expire(key, expire)
            logger.debug("Cookie TTL 已刷新", platform=platform, ttl=expire)
        return cookie or ""

    async def delete(self, platform: str) -> None:
        """删除平台 Cookie"""
        key = self._key(platform)
        await self._redis.delete(key)
        logger.debug("Cookie 已删除", platform=platform)

    async def exists(self, platform: str) -> bool:
        """检查平台 Cookie 是否存在（未过期）"""
        key = self._key(platform)
        return bool(await self._redis.exists(key))

    async def ttl(self, platform: str) -> int:
        """获取平台 Cookie 剩余 TTL（秒），不存在返回 -2，无过期返回 -1"""
        key = self._key(platform)
        return await self._redis.ttl(key)
