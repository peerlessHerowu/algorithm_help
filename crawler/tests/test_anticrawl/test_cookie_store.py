"""RedisCookieStore 单元测试（使用 fakeredis 模拟 Redis）"""

import pytest
from unittest.mock import AsyncMock, patch

from crawler_service.anticrawl.cookie_store import RedisCookieStore


class FakeRedis:
    """轻量级 Redis Mock，支持 get/set/delete/exists/ttl/expire"""

    def __init__(self):
        self._store: dict[str, str] = {}
        self._ttls: dict[str, int] = {}

    async def get(self, key: str) -> str | None:
        return self._store.get(key)

    async def set(self, key: str, value: str, ex: int | None = None) -> None:
        self._store[key] = value
        if ex is not None:
            self._ttls[key] = ex

    async def delete(self, key: str) -> int:
        removed = key in self._store
        self._store.pop(key, None)
        self._ttls.pop(key, None)
        return 1 if removed else 0

    async def exists(self, key: str) -> int:
        return 1 if key in self._store else 0

    async def ttl(self, key: str) -> int:
        if key not in self._store:
            return -2
        return self._ttls.get(key, -1)

    async def expire(self, key: str, seconds: int) -> bool:
        if key in self._store:
            self._ttls[key] = seconds
            return True
        return False


@pytest.fixture
def fake_redis():
    return FakeRedis()


@pytest.fixture
def store(fake_redis):
    return RedisCookieStore(fake_redis)


class TestRedisCookieStore:
    """RedisCookieStore 核心功能测试"""

    async def test_get_nonexistent_returns_empty(self, store):
        """不存在的 key 返回空字符串"""
        result = await store.get("leetcode_global")
        assert result == ""

    async def test_set_and_get(self, store):
        """set 后 get 能正确返回 Cookie"""
        await store.set("leetcode_global", "session=abc123")
        result = await store.get("leetcode_global")
        assert result == "session=abc123"

    async def test_set_with_custom_ttl(self, store, fake_redis):
        """set 支持自定义 TTL"""
        await store.set("codeforces", "token=xyz", ttl=3600)
        assert fake_redis._ttls["crawler:cookie:codeforces"] == 3600

    async def test_set_with_default_ttl(self, store, fake_redis):
        """set 默认 TTL 为 86400 秒"""
        await store.set("leetcode_cn", "sess=abc")
        assert fake_redis._ttls["crawler:cookie:leetcode_cn"] == 86400

    async def test_refresh_existing_cookie(self, store, fake_redis):
        """refresh 对已存在的 Cookie 续期并返回值"""
        await store.set("leetcode_global", "session=abc", ttl=100)
        result = await store.refresh("leetcode_global", ttl=7200)
        assert result == "session=abc"
        assert fake_redis._ttls["crawler:cookie:leetcode_global"] == 7200

    async def test_refresh_nonexistent_returns_empty(self, store):
        """refresh 不存在的 Cookie 返回空字符串"""
        result = await store.refresh("unknown_platform")
        assert result == ""

    async def test_refresh_default_ttl(self, store, fake_redis):
        """refresh 不指定 TTL 时使用默认值"""
        await store.set("codeforces", "t=1", ttl=100)
        await store.refresh("codeforces")
        assert fake_redis._ttls["crawler:cookie:codeforces"] == 86400

    async def test_delete(self, store):
        """delete 后 get 返回空字符串"""
        await store.set("leetcode_global", "session=abc")
        await store.delete("leetcode_global")
        result = await store.get("leetcode_global")
        assert result == ""

    async def test_exists_true(self, store):
        """exists 对已存在的 Cookie 返回 True"""
        await store.set("leetcode_global", "session=abc")
        assert await store.exists("leetcode_global") is True

    async def test_exists_false(self, store):
        """exists 对不存在的 Cookie 返回 False"""
        assert await store.exists("nonexistent") is False

    async def test_ttl_existing(self, store):
        """ttl 返回 Cookie 剩余时间"""
        await store.set("leetcode_global", "session=abc", ttl=3600)
        result = await store.ttl("leetcode_global")
        assert result == 3600

    async def test_ttl_nonexistent(self, store):
        """ttl 对不存在的 key 返回 -2"""
        result = await store.ttl("nonexistent")
        assert result == -2

    async def test_key_format(self, store, fake_redis):
        """验证 key 格式为 crawler:cookie:{platform}"""
        await store.set("leetcode_global", "cookie_val")
        assert "crawler:cookie:leetcode_global" in fake_redis._store

    async def test_multiple_platforms_isolated(self, store):
        """各平台 Cookie 互相隔离"""
        await store.set("leetcode_global", "cookie_a")
        await store.set("codeforces", "cookie_b")
        assert await store.get("leetcode_global") == "cookie_a"
        assert await store.get("codeforces") == "cookie_b"
