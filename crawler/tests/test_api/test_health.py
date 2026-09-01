"""测试 trace_id 中间件与健康检查端点"""

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from crawler_service.api.health import router
from crawler_service.utils.trace import TraceMiddleware, TRACE_ID_HEADER


@pytest.fixture
def app() -> FastAPI:
    """创建带中间件和健康检查路由的测试 FastAPI 应用"""
    app = FastAPI()
    app.add_middleware(TraceMiddleware)
    app.include_router(router)
    return app


@pytest.fixture
async def client(app: FastAPI) -> AsyncClient:
    """异步测试客户端"""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


class TestHealthEndpoint:
    """健康检查端点测试"""

    async def test_health_returns_ok(self, client: AsyncClient):
        """GET /health 返回正确的 JSON 响应"""
        response = await client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"
        assert data["service"] == "python-crawler-service"

    async def test_health_response_has_trace_id_header(self, client: AsyncClient):
        """GET /health 响应包含 X-Trace-Id 头"""
        response = await client.get("/health")
        assert TRACE_ID_HEADER.lower() in [k.lower() for k in response.headers.keys()]
        trace_id = response.headers.get(TRACE_ID_HEADER) or response.headers.get(
            TRACE_ID_HEADER.lower()
        )
        assert trace_id is not None
        assert len(trace_id) == 32  # UUID4 hex 去横杠长度


class TestTraceMiddleware:
    """TraceMiddleware 中间件测试"""

    async def test_generates_trace_id_when_absent(self, client: AsyncClient):
        """请求未携带 X-Trace-Id 时，中间件自动生成"""
        response = await client.get("/health")
        trace_id = response.headers.get(TRACE_ID_HEADER) or response.headers.get(
            TRACE_ID_HEADER.lower()
        )
        assert trace_id is not None
        assert len(trace_id) == 32

    async def test_uses_provided_trace_id(self, client: AsyncClient):
        """请求携带 X-Trace-Id 时，中间件使用该值"""
        custom_trace_id = "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4"
        response = await client.get(
            "/health", headers={TRACE_ID_HEADER: custom_trace_id}
        )
        returned_trace_id = response.headers.get(
            TRACE_ID_HEADER
        ) or response.headers.get(TRACE_ID_HEADER.lower())
        assert returned_trace_id == custom_trace_id

    async def test_different_requests_get_different_trace_ids(
        self, client: AsyncClient
    ):
        """不同请求生成不同的 trace_id"""
        resp1 = await client.get("/health")
        resp2 = await client.get("/health")
        trace_id_1 = resp1.headers.get(TRACE_ID_HEADER) or resp1.headers.get(
            TRACE_ID_HEADER.lower()
        )
        trace_id_2 = resp2.headers.get(TRACE_ID_HEADER) or resp2.headers.get(
            TRACE_ID_HEADER.lower()
        )
        assert trace_id_1 != trace_id_2
