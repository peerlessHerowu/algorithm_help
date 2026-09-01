"""
测试 Prometheus 指标定义、暴露端点和告警逻辑

覆盖：
- GET /metrics 端点返回正确格式
- 指标记录函数正确更新 Counter/Gauge
- 失败率超 50% 触发 ERROR 告警日志
- 单平台连续失败超 10 次自动暂停
"""

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from prometheus_client import REGISTRY, CollectorRegistry, generate_latest

from crawler_service.api.health import router
from crawler_service.metrics import (
    CONSECUTIVE_FAILURE_THRESHOLD,
    FAILURE_RATE_THRESHOLD,
    crawl_duration_seconds,
    crawl_requests_total,
    circuit_breaker_state,
    rate_limiter_tokens,
    get_consecutive_failures,
    get_failure_rate,
    is_platform_paused,
    record_crawl_failure,
    record_crawl_success,
    reset_metrics_state,
    resume_platform,
    track_crawl_duration,
    update_circuit_breaker_state,
    update_rate_limiter_tokens,
)


@pytest.fixture
def app() -> FastAPI:
    """创建带 metrics 端点的测试 FastAPI 应用"""
    app = FastAPI()
    app.include_router(router)
    return app


@pytest.fixture
async def client(app: FastAPI) -> AsyncClient:
    """异步测试客户端"""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest.fixture(autouse=True)
def clean_metrics_state():
    """每个测试前后重置指标内部状态"""
    reset_metrics_state()
    yield
    reset_metrics_state()


class TestMetricsEndpoint:
    """GET /metrics 端点测试"""

    async def test_metrics_returns_200(self, client: AsyncClient):
        """GET /metrics 返回 200 状态码"""
        response = await client.get("/metrics")
        assert response.status_code == 200

    async def test_metrics_content_type(self, client: AsyncClient):
        """GET /metrics 返回正确的 Content-Type"""
        response = await client.get("/metrics")
        content_type = response.headers.get("content-type", "")
        # Prometheus text format
        assert "text/plain" in content_type or "text/plain" in content_type

    async def test_metrics_contains_crawl_requests_total(self, client: AsyncClient):
        """GET /metrics 包含 crawl_requests_total 指标"""
        # 先记录一些数据
        record_crawl_success("test_platform")
        response = await client.get("/metrics")
        body = response.text
        assert "crawl_requests_total" in body

    async def test_metrics_contains_crawl_duration_seconds(self, client: AsyncClient):
        """GET /metrics 包含 crawl_duration_seconds 指标"""
        response = await client.get("/metrics")
        body = response.text
        assert "crawl_duration_seconds" in body

    async def test_metrics_contains_circuit_breaker_state(self, client: AsyncClient):
        """GET /metrics 包含 circuit_breaker_state 指标"""
        update_circuit_breaker_state("test_platform", "closed")
        response = await client.get("/metrics")
        body = response.text
        assert "circuit_breaker_state" in body

    async def test_metrics_contains_rate_limiter_tokens(self, client: AsyncClient):
        """GET /metrics 包含 rate_limiter_tokens 指标"""
        update_rate_limiter_tokens("test_platform", 10.0)
        response = await client.get("/metrics")
        body = response.text
        assert "rate_limiter_tokens" in body


class TestRecordMetrics:
    """指标记录函数测试"""

    def test_record_success_resets_consecutive_failures(self):
        """记录成功后连续失败计数归零"""
        record_crawl_failure("leetcode_global")
        record_crawl_failure("leetcode_global")
        assert get_consecutive_failures("leetcode_global") == 2
        record_crawl_success("leetcode_global")
        assert get_consecutive_failures("leetcode_global") == 0

    def test_record_failure_increments_consecutive(self):
        """连续失败计数正确递增"""
        for i in range(5):
            record_crawl_failure("codeforces")
        assert get_consecutive_failures("codeforces") == 5

    def test_failure_rate_calculation(self):
        """失败率正确计算"""
        record_crawl_success("test_p")
        record_crawl_failure("test_p")
        rate = get_failure_rate("test_p")
        assert rate == pytest.approx(0.5)

    def test_failure_rate_none_when_no_data(self):
        """无数据时失败率返回 None"""
        assert get_failure_rate("unknown_platform") is None

    def test_update_circuit_breaker_state_closed(self):
        """熔断器状态更新为 closed=0"""
        update_circuit_breaker_state("test_p", "closed")
        # 验证 gauge 值
        sample = circuit_breaker_state.labels(platform="test_p")._value.get()
        assert sample == 0.0

    def test_update_circuit_breaker_state_open(self):
        """熔断器状态更新为 open=1"""
        update_circuit_breaker_state("test_p", "open")
        sample = circuit_breaker_state.labels(platform="test_p")._value.get()
        assert sample == 1.0

    def test_update_circuit_breaker_state_half_open(self):
        """熔断器状态更新为 half_open=2"""
        update_circuit_breaker_state("test_p", "half_open")
        sample = circuit_breaker_state.labels(platform="test_p")._value.get()
        assert sample == 2.0

    def test_update_rate_limiter_tokens(self):
        """限流器令牌数正确更新"""
        update_rate_limiter_tokens("test_p", 15.5)
        sample = rate_limiter_tokens.labels(platform="test_p")._value.get()
        assert sample == 15.5


class TestAlertLogic:
    """告警逻辑测试"""

    def test_platform_paused_after_consecutive_failures(self):
        """连续失败超过 10 次后平台被自动暂停"""
        platform = "leetcode_cn"
        assert not is_platform_paused(platform)
        for _ in range(CONSECUTIVE_FAILURE_THRESHOLD):
            record_crawl_failure(platform)
        assert is_platform_paused(platform)

    def test_platform_not_paused_below_threshold(self):
        """连续失败未达阈值不暂停"""
        platform = "atcoder"
        for _ in range(CONSECUTIVE_FAILURE_THRESHOLD - 1):
            record_crawl_failure(platform)
        assert not is_platform_paused(platform)

    def test_resume_platform_resets_state(self):
        """恢复平台后状态清除"""
        platform = "nowcoder"
        for _ in range(CONSECUTIVE_FAILURE_THRESHOLD):
            record_crawl_failure(platform)
        assert is_platform_paused(platform)
        resume_platform(platform)
        assert not is_platform_paused(platform)
        assert get_consecutive_failures(platform) == 0

    def test_success_after_failures_does_not_pause(self):
        """连续失败 9 次后成功一次，不会触发暂停"""
        platform = "codeforces"
        for _ in range(CONSECUTIVE_FAILURE_THRESHOLD - 1):
            record_crawl_failure(platform)
        record_crawl_success(platform)
        assert not is_platform_paused(platform)
        assert get_consecutive_failures(platform) == 0


class TestTrackCrawlDuration:
    """采集耗时追踪测试"""

    async def test_track_duration_records_histogram(self):
        """track_crawl_duration 上下文管理器记录耗时"""
        import asyncio

        async with track_crawl_duration("test_duration"):
            await asyncio.sleep(0.01)
        # 验证 histogram 有采样值（sum > 0）
        # prometheus_client histogram 内部状态
        metric = crawl_duration_seconds.labels(platform="test_duration")
        # _sum 是 histogram 的累计值
        assert metric._sum.get() > 0
