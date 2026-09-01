"""
HTTP 错误处理策略单元测试

验证：
- 429 → 读取 Retry-After 等待重试
- 403 → Cookie 刷新重试一次
- 5xx → 指数退避重试
- 重试耗尽 → 抛出 HttpRetriesExhaustedError 并记录完整错误链
- 非可重试状态码直接抛出

Validates: Requirements 13.2, 13.3, 13.4, 13.5
"""

import asyncio
from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest

from crawler_service.orchestrator.http_error_handler import (
    HttpErrorHandler,
    HttpRetriesExhaustedError,
)


# ---- 辅助函数 ----


def _make_response(status_code: int, headers: dict | None = None) -> httpx.Response:
    """构造模拟 HTTP 响应"""
    response = httpx.Response(
        status_code=status_code,
        headers=headers or {},
        request=httpx.Request("GET", "https://example.com"),
    )
    return response


def _make_status_error(status_code: int, headers: dict | None = None) -> httpx.HTTPStatusError:
    """构造 HTTPStatusError"""
    response = _make_response(status_code, headers)
    return httpx.HTTPStatusError(
        f"HTTP {status_code}",
        request=response.request,
        response=response,
    )


@pytest.fixture
def cookie_store():
    """模拟 Cookie 存储"""
    store = AsyncMock()
    store.refresh = AsyncMock(return_value="refreshed_cookie")
    return store


@pytest.fixture
def handler(cookie_store):
    """创建 HttpErrorHandler 实例"""
    return HttpErrorHandler(
        cookie_store=cookie_store,
        retry_max=3,
        base_delay_ms=10,  # 测试中使用极短延迟
        max_429_retries=2,
    )


# ---- 正常请求测试 ----


@pytest.mark.asyncio
async def test_success_no_retry(handler):
    """正常请求不需要重试"""
    func = AsyncMock(return_value="ok")
    result = await handler.execute(func, platform="leetcode_global")
    assert result == "ok"
    func.assert_called_once()


# ---- 429 Too Many Requests 测试 ----


@pytest.mark.asyncio
async def test_429_retry_with_retry_after_header(handler):
    """429 响应带 Retry-After 头时按头值等待后重试"""
    error_429 = _make_status_error(429, headers={"Retry-After": "1"})
    call_count = 0

    async def func():
        nonlocal call_count
        call_count += 1
        if call_count == 1:
            raise error_429
        return "success_after_retry"

    with patch("asyncio.sleep", new_callable=AsyncMock) as mock_sleep:
        result = await handler.execute(func, platform="leetcode_global")

    assert result == "success_after_retry"
    assert call_count == 2
    # 验证等待了 Retry-After 指定的秒数
    mock_sleep.assert_called_with(1.0)


@pytest.mark.asyncio
async def test_429_default_retry_after_when_no_header(handler):
    """429 响应无 Retry-After 头时使用默认 60 秒"""
    error_429 = _make_status_error(429, headers={})
    call_count = 0

    async def func():
        nonlocal call_count
        call_count += 1
        if call_count == 1:
            raise error_429
        return "ok"

    with patch("asyncio.sleep", new_callable=AsyncMock) as mock_sleep:
        result = await handler.execute(func, platform="codeforces")

    assert result == "ok"
    mock_sleep.assert_called_with(60.0)


@pytest.mark.asyncio
async def test_429_retries_exhausted(handler):
    """429 重试耗尽时抛出 HttpRetriesExhaustedError"""
    error_429 = _make_status_error(429, headers={"Retry-After": "1"})

    async def always_429():
        raise error_429

    with patch("asyncio.sleep", new_callable=AsyncMock):
        with pytest.raises(HttpRetriesExhaustedError) as exc_info:
            await handler.execute(always_429, platform="leetcode_global")

    assert "429 重试耗尽" in str(exc_info.value)
    assert len(exc_info.value.error_chain) == 3  # max_429_retries=2, 触发 > 2 时有 3 条记录
    for entry in exc_info.value.error_chain:
        assert entry["status_code"] == 429
        assert entry["action"] == "wait_retry_after"


# ---- 403 Forbidden 测试 ----


@pytest.mark.asyncio
async def test_403_cookie_refresh_and_retry(handler, cookie_store):
    """403 触发 Cookie 刷新后重试成功"""
    error_403 = _make_status_error(403)
    call_count = 0

    async def func():
        nonlocal call_count
        call_count += 1
        if call_count == 1:
            raise error_403
        return "ok_after_refresh"

    result = await handler.execute(func, platform="leetcode_cn")

    assert result == "ok_after_refresh"
    assert call_count == 2
    cookie_store.refresh.assert_called_once_with("leetcode_cn")


@pytest.mark.asyncio
async def test_403_only_retries_once(handler, cookie_store):
    """403 只重试一次，第二次仍 403 则抛出异常"""
    error_403 = _make_status_error(403)

    async def always_403():
        raise error_403

    with pytest.raises(HttpRetriesExhaustedError) as exc_info:
        await handler.execute(always_403, platform="leetcode_cn")

    assert "403 Cookie 刷新后仍失败" in str(exc_info.value)
    assert len(exc_info.value.error_chain) == 2
    cookie_store.refresh.assert_called_once()


# ---- 5xx Server Error 测试 ----


@pytest.mark.asyncio
async def test_5xx_exponential_backoff_retry(handler):
    """5xx 使用指数退避重试"""
    error_500 = _make_status_error(500)
    call_count = 0

    async def func():
        nonlocal call_count
        call_count += 1
        if call_count <= 2:
            raise error_500
        return "recovered"

    with patch("asyncio.sleep", new_callable=AsyncMock) as mock_sleep:
        result = await handler.execute(func, platform="codeforces")

    assert result == "recovered"
    assert call_count == 3
    # 验证指数退避延迟：第 1 次 10ms=0.01s, 第 2 次 20ms=0.02s
    sleep_calls = mock_sleep.call_args_list
    assert len(sleep_calls) == 2
    assert sleep_calls[0].args[0] == pytest.approx(0.01)  # base_delay * 2^0
    assert sleep_calls[1].args[0] == pytest.approx(0.02)  # base_delay * 2^1


@pytest.mark.asyncio
async def test_5xx_retries_exhausted(handler):
    """5xx 重试耗尽时抛出 HttpRetriesExhaustedError"""
    error_502 = _make_status_error(502)

    async def always_502():
        raise error_502

    with patch("asyncio.sleep", new_callable=AsyncMock):
        with pytest.raises(HttpRetriesExhaustedError) as exc_info:
            await handler.execute(always_502, platform="codeforces")

    assert "5xx 重试耗尽" in str(exc_info.value)
    # retry_max=3，所以总共 4 次尝试（1 初始 + 3 重试），第 4 次超过 retry_max 抛出
    assert len(exc_info.value.error_chain) == 4
    for entry in exc_info.value.error_chain:
        assert entry["status_code"] == 502


@pytest.mark.asyncio
async def test_5xx_various_status_codes(handler):
    """各种 5xx 状态码都触发指数退避"""
    for code in [500, 502, 503, 504]:
        error = _make_status_error(code)
        call_count = 0

        async def func():
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                raise error
            return "ok"

        with patch("asyncio.sleep", new_callable=AsyncMock):
            result = await handler.execute(func, platform="atcoder")

        assert result == "ok"


# ---- 非可重试状态码 ----


@pytest.mark.asyncio
async def test_non_retryable_status_code_raises_immediately(handler):
    """非可重试状态码（如 404）直接抛出"""
    error_404 = _make_status_error(404)

    async def func():
        raise error_404

    with pytest.raises(httpx.HTTPStatusError) as exc_info:
        await handler.execute(func, platform="leetcode_global")

    assert exc_info.value.response.status_code == 404


# ---- 错误链完整性 ----


@pytest.mark.asyncio
async def test_error_chain_records_all_attempts(handler):
    """错误链记录每次尝试的详细信息"""
    error_503 = _make_status_error(503)

    async def always_503():
        raise error_503

    with patch("asyncio.sleep", new_callable=AsyncMock):
        with pytest.raises(HttpRetriesExhaustedError) as exc_info:
            await handler.execute(always_503, platform="nowcoder")

    chain = exc_info.value.error_chain
    for i, entry in enumerate(chain):
        assert "attempt" in entry
        assert "status_code" in entry
        assert "error" in entry
        assert "action" in entry
        assert entry["attempt"] == i + 1


# ---- 混合场景 ----


@pytest.mark.asyncio
async def test_429_then_success(handler):
    """429 后重试成功"""
    error_429 = _make_status_error(429, headers={"Retry-After": "2"})
    attempts = []

    async def func():
        attempts.append(1)
        if len(attempts) <= 2:
            raise error_429
        return "finally_ok"

    with patch("asyncio.sleep", new_callable=AsyncMock):
        result = await handler.execute(func, platform="leetcode_global")

    assert result == "finally_ok"
    assert len(attempts) == 3


@pytest.mark.asyncio
async def test_retry_after_capped_at_max(handler):
    """Retry-After 值被限制在最大值以内"""
    # Retry-After 为 9999 秒，应被限制到 MAX_RETRY_AFTER_SECONDS (300)
    error_429 = _make_status_error(429, headers={"Retry-After": "9999"})
    call_count = 0

    async def func():
        nonlocal call_count
        call_count += 1
        if call_count == 1:
            raise error_429
        return "ok"

    with patch("asyncio.sleep", new_callable=AsyncMock) as mock_sleep:
        result = await handler.execute(func, platform="leetcode_global")

    assert result == "ok"
    mock_sleep.assert_called_with(300.0)
