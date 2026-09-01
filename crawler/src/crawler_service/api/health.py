"""健康检查与 Prometheus 指标端点"""

from fastapi import APIRouter
from fastapi.responses import PlainTextResponse
from prometheus_client import generate_latest, CONTENT_TYPE_LATEST

router = APIRouter(tags=["健康检查"])


@router.get("/health")
async def health_check() -> dict:
    """
    GET /health 健康检查端点。

    用于 Docker 健康检查和负载均衡探活。
    返回服务名称和状态。
    """
    return {"status": "ok", "service": "python-crawler-service"}


@router.get("/metrics")
async def metrics() -> PlainTextResponse:
    """
    GET /metrics Prometheus 指标暴露端点。

    返回 prometheus_client 收集的所有指标，格式为 Prometheus text exposition format。
    指标包含：
    - crawl_requests_total: 采集请求总数（按 platform/status 分组）
    - crawl_duration_seconds: 采集耗时直方图（按 platform 分组）
    - circuit_breaker_state: 熔断器状态（0=closed, 1=open, 2=half_open）
    - rate_limiter_tokens: 限流器剩余令牌数
    """
    return PlainTextResponse(
        content=generate_latest(),
        media_type=CONTENT_TYPE_LATEST,
    )
