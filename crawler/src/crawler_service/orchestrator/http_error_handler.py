"""
HTTP 错误处理策略

分类处理不同 HTTP 状态码的错误并执行对应重试策略：
- 429 Too Many Requests → 读取 Retry-After 头等待后重试
- 403 Forbidden → 触发 Cookie 刷新后重试一次
- 5xx Server Error → 指数退避重试（base_delay * 2^n）
- 重试耗尽 → 抛出 HttpRetriesExhaustedError，记录完整错误链

Validates: Requirements 13.2, 13.3, 13.4, 13.5
"""

import asyncio
from typing import Any, Callable, Coroutine, Optional, TypeVar

import httpx
import structlog

from ..anticrawl.cookie_store import RedisCookieStore

logger = structlog.get_logger()

T = TypeVar("T")


class HttpRetriesExhaustedError(Exception):
    """重试耗尽异常，包含完整错误链"""

    def __init__(self, message: str, error_chain: list[dict]):
        """
        :param message: 错误描述
        :param error_chain: 完整错误链，每项包含 attempt/status_code/error/action
        """
        super().__init__(message)
        self.error_chain = error_chain


class HttpErrorHandler:
    """
    HTTP 错误分类处理器。

    针对 httpx.HTTPStatusError 按状态码分类处理：
    - 429: 读取 Retry-After 等待重试
    - 403: Cookie 刷新后重试一次
    - 5xx: 指数退避重试

    使用方式：
        handler = HttpErrorHandler(cookie_store, retry_max=3, base_delay_ms=1000)
        result = await handler.execute(async_func, platform="leetcode_global")
    """

    # Retry-After 最大等待秒数（防止恶意头导致无限等待）
    MAX_RETRY_AFTER_SECONDS = 300

    def __init__(
        self,
        cookie_store: RedisCookieStore,
        retry_max: int = 3,
        base_delay_ms: int = 1000,
        max_429_retries: int = 3,
    ):
        """
        :param cookie_store: Cookie 管理器（用于 403 刷新）
        :param retry_max: 5xx 最大重试次数
        :param base_delay_ms: 指数退避基础延迟（毫秒）
        :param max_429_retries: 429 最大重试次数
        """
        self._cookie_store = cookie_store
        self._retry_max = retry_max
        self._base_delay_ms = base_delay_ms
        self._max_429_retries = max_429_retries

    async def execute(
        self,
        func: Callable[[], Coroutine[Any, Any, T]],
        platform: str,
    ) -> T:
        """
        执行带 HTTP 错误处理的异步操作。

        按状态码分类处理：
        - 429: 读取 Retry-After 等待后重试（最多 max_429_retries 次）
        - 403: Cookie 刷新后重试一次
        - 5xx: 指数退避重试（最多 retry_max 次）
        - 其他 HTTP 错误: 直接抛出

        :param func: 异步可调用对象
        :param platform: 平台标识
        :return: func 的返回值
        :raises HttpRetriesExhaustedError: 重试耗尽
        :raises httpx.HTTPStatusError: 非可重试状态码
        """
        error_chain: list[dict] = []
        retries_429 = 0
        retries_5xx = 0
        retried_403 = False

        while True:
            try:
                return await func()
            except httpx.HTTPStatusError as e:
                status_code = e.response.status_code
                entry = {
                    "attempt": len(error_chain) + 1,
                    "status_code": status_code,
                    "error": str(e),
                }

                if status_code == 429:
                    entry["action"] = "wait_retry_after"
                    error_chain.append(entry)
                    retries_429 += 1
                    if retries_429 > self._max_429_retries:
                        raise HttpRetriesExhaustedError(
                            f"429 重试耗尽（{self._max_429_retries} 次）",
                            error_chain,
                        ) from e
                    await self._handle_429(e, platform)

                elif status_code == 403:
                    entry["action"] = "cookie_refresh_retry"
                    error_chain.append(entry)
                    if retried_403:
                        raise HttpRetriesExhaustedError(
                            "403 Cookie 刷新后仍失败",
                            error_chain,
                        ) from e
                    retried_403 = True
                    await self._handle_403(platform)

                elif 500 <= status_code < 600:
                    entry["action"] = f"exponential_backoff_attempt_{retries_5xx}"
                    error_chain.append(entry)
                    retries_5xx += 1
                    if retries_5xx > self._retry_max:
                        raise HttpRetriesExhaustedError(
                            f"5xx 重试耗尽（{self._retry_max} 次）",
                            error_chain,
                        ) from e
                    await self._handle_5xx(retries_5xx - 1, platform)

                else:
                    # 非可重试状态码，直接抛出
                    entry["action"] = "non_retryable"
                    error_chain.append(entry)
                    raise

    async def _handle_429(self, error: httpx.HTTPStatusError, platform: str) -> None:
        """处理 429 Too Many Requests：读取 Retry-After 头等待"""
        retry_after = self._parse_retry_after(error.response)
        logger.warning(
            "收到 429 限流，等待重试",
            platform=platform,
            retry_after_seconds=retry_after,
        )
        await asyncio.sleep(retry_after)

    async def _handle_403(self, platform: str) -> None:
        """处理 403 Forbidden：刷新 Cookie 后重试一次"""
        logger.warning("收到 403，刷新 Cookie 后重试", platform=platform)
        await self._cookie_store.refresh(platform)

    async def _handle_5xx(self, attempt: int, platform: str) -> None:
        """处理 5xx 服务器错误：指数退避等待"""
        delay_ms = self._base_delay_ms * (2 ** attempt)
        delay_s = delay_ms / 1000.0
        logger.warning(
            "收到 5xx 错误，指数退避重试",
            platform=platform,
            attempt=attempt + 1,
            delay_ms=delay_ms,
        )
        await asyncio.sleep(delay_s)

    def _parse_retry_after(self, response: httpx.Response) -> float:
        """
        解析 Retry-After 响应头。

        支持秒数格式（如 "120"）。
        若头不存在或解析失败，默认等待 60 秒。
        限制最大等待时间为 MAX_RETRY_AFTER_SECONDS。

        :param response: HTTP 响应
        :return: 等待秒数
        """
        retry_after_header = response.headers.get("Retry-After", "")
        if not retry_after_header:
            return 60.0

        try:
            seconds = float(retry_after_header)
            return min(max(seconds, 0), self.MAX_RETRY_AFTER_SECONDS)
        except (ValueError, TypeError):
            return 60.0
