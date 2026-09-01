"""Redis 连接封装单元测试"""

import asyncio
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from crawler_service.database.redis_client import (
    _mask_url,
    close_redis_pool,
    get_redis,
    get_redis_client,
    redis_health_check,
    reset_redis_pool,
)


# ---- _mask_url 工具函数测试 ----


class TestMaskUrl:
    def test_mask_url_with_password(self):
        url = "redis://:mypassword@localhost:6379/0"
        result = _mask_url(url)
        assert "mypassword" not in result
        assert "***@localhost:6379/0" in result

    def test_mask_url_without_password(self):
        url = "redis://localhost:6379/0"
        result = _mask_url(url)
        assert result == url

    def test_mask_url_with_user_and_password(self):
        url = "redis://user:pass@host:6379/1"
        result = _mask_url(url)
        assert "pass" not in result
        assert "***@host:6379/1" in result


# ---- get_redis 依赖注入测试 ----


class TestGetRedis:
    @pytest.fixture(autouse=True)
    async def cleanup(self):
        """每个测试后重置连接池"""
        yield
        await reset_redis_pool()

    @patch("crawler_service.database.redis_client.get_settings")
    async def test_get_redis_yields_client(self, mock_settings):
        """验证 get_redis 是一个异步生成器，yield Redis 实例"""
        mock_settings.return_value = MagicMock(
            redis=MagicMock(url="redis://localhost:6379/0", max_connections=5)
        )
        gen = get_redis()
        client = await gen.__anext__()
        # 验证返回的是 Redis 实例
        from redis.asyncio import Redis
        assert isinstance(client, Redis)
        # 清理
        try:
            await gen.__anext__()
        except StopAsyncIteration:
            pass

    @patch("crawler_service.database.redis_client.get_settings")
    async def test_get_redis_client_returns_instance(self, mock_settings):
        """验证 get_redis_client 返回 Redis 实例"""
        mock_settings.return_value = MagicMock(
            redis=MagicMock(url="redis://localhost:6379/0", max_connections=5)
        )
        client = await get_redis_client()
        from redis.asyncio import Redis
        assert isinstance(client, Redis)
        await client.aclose()


# ---- 连接池单例测试 ----


class TestPoolSingleton:
    @pytest.fixture(autouse=True)
    async def cleanup(self):
        yield
        await reset_redis_pool()

    @patch("crawler_service.database.redis_client.get_settings")
    async def test_pool_is_singleton(self, mock_settings):
        """验证连接池是全局单例，多次调用返回同一实例"""
        mock_settings.return_value = MagicMock(
            redis=MagicMock(url="redis://localhost:6379/0", max_connections=5)
        )
        from crawler_service.database.redis_client import _get_pool

        pool1 = await _get_pool()
        pool2 = await _get_pool()
        assert pool1 is pool2

    @patch("crawler_service.database.redis_client.get_settings")
    async def test_reset_clears_pool(self, mock_settings):
        """验证 reset 后创建新的连接池"""
        mock_settings.return_value = MagicMock(
            redis=MagicMock(url="redis://localhost:6379/0", max_connections=5)
        )
        from crawler_service.database.redis_client import _get_pool

        pool1 = await _get_pool()
        await reset_redis_pool()
        pool2 = await _get_pool()
        assert pool1 is not pool2


# ---- 健康检查测试 ----


class TestHealthCheck:
    @pytest.fixture(autouse=True)
    async def cleanup(self):
        yield
        await reset_redis_pool()

    @patch("crawler_service.database.redis_client.get_settings")
    @patch("crawler_service.database.redis_client.Redis")
    async def test_health_check_success(self, mock_redis_cls, mock_settings):
        """健康检查成功时返回 True"""
        mock_settings.return_value = MagicMock(
            redis=MagicMock(url="redis://localhost:6379/0", max_connections=5)
        )
        mock_client = AsyncMock()
        mock_client.ping.return_value = True
        mock_client.aclose = AsyncMock()
        mock_redis_cls.return_value = mock_client

        result = await redis_health_check()
        assert result is True

    @patch("crawler_service.database.redis_client.get_settings")
    @patch("crawler_service.database.redis_client.Redis")
    async def test_health_check_failure(self, mock_redis_cls, mock_settings):
        """健康检查失败时返回 False"""
        mock_settings.return_value = MagicMock(
            redis=MagicMock(url="redis://localhost:6379/0", max_connections=5)
        )
        mock_client = AsyncMock()
        mock_client.ping.side_effect = ConnectionError("无法连接")
        mock_client.aclose = AsyncMock()
        mock_redis_cls.return_value = mock_client

        result = await redis_health_check()
        assert result is False
