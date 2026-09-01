"""
Prometheus 指标定义与埋点辅助函数

定义以下指标：
- crawl_requests_total: Counter，采集请求总数（labels: platform, status）
- crawl_duration_seconds: Histogram，采集耗时（labels: platform）
- circuit_breaker_state: Gauge，熔断器状态（labels: platform）
  0=closed, 1=open, 2=half_open
- rate_limiter_tokens: Gauge，限流器剩余令牌数（labels: platform）

告警逻辑：
- 采集失败率超 50% → ERROR 告警日志
- 单平台连续失败超 10 次 → 自动暂停该平台采集并告警

Validates: Requirements 12.1, 12.3, 12.4
"""

import time
from contextlib import asynccontextmanager
from typing import Optional

import structlog
from prometheus_client import Counter, Gauge, Histogram

logger = structlog.get_logger()

# ---- Prometheus 指标定义 ----

crawl_requests_total = Counter(
    "crawl_requests_total",
    "采集请求总数",
    labelnames=["platform", "status"],
)

crawl_duration_seconds = Histogram(
    "crawl_duration_seconds",
    "单次采集请求耗时（秒）",
    labelnames=["platform"],
    buckets=(0.1, 0.5, 1.0, 2.0, 5.0, 10.0, 30.0, 60.0),
)

circuit_breaker_state = Gauge(
    "circuit_breaker_state",
    "熔断器状态：0=closed, 1=open, 2=half_open",
    labelnames=["platform"],
)

rate_limiter_tokens = Gauge(
    "rate_limiter_tokens",
    "限流器当前剩余令牌数",
    labelnames=["platform"],
)


# ---- 熔断器状态映射 ----

_CIRCUIT_STATE_MAP = {
    "closed": 0,
    "open": 1,
    "half_open": 2,
}

# ---- 连续失败计数（用于告警判断） ----

_consecutive_failures: dict[str, int] = {}
_total_requests: dict[str, int] = {}
_failed_requests: dict[str, int] = {}
_paused_platforms: set[str] = set()

# 告警阈值
FAILURE_RATE_THRESHOLD = 0.5  # 50%
CONSECUTIVE_FAILURE_THRESHOLD = 10


# ---- 埋点辅助函数 ----


def record_crawl_success(platform: str) -> None:
    """记录采集成功

    更新 Counter 指标，重置连续失败计数。
    """
    crawl_requests_total.labels(platform=platform, status="success").inc()
    _consecutive_failures[platform] = 0
    _total_requests[platform] = _total_requests.get(platform, 0) + 1


def record_crawl_failure(platform: str) -> None:
    """记录采集失败

    更新 Counter 指标，累计连续失败计数。
    检查是否触发告警条件。
    """
    crawl_requests_total.labels(platform=platform, status="failure").inc()
    _consecutive_failures[platform] = _consecutive_failures.get(platform, 0) + 1
    _total_requests[platform] = _total_requests.get(platform, 0) + 1
    _failed_requests[platform] = _failed_requests.get(platform, 0) + 1
    _check_alerts(platform)


@asynccontextmanager
async def track_crawl_duration(platform: str):
    """异步上下文管理器：追踪采集耗时

    Usage:
        async with track_crawl_duration("leetcode_global"):
            await do_crawl()
    """
    start = time.monotonic()
    try:
        yield
    finally:
        elapsed = time.monotonic() - start
        crawl_duration_seconds.labels(platform=platform).observe(elapsed)


def update_circuit_breaker_state(platform: str, state: str) -> None:
    """更新熔断器状态指标

    :param platform: 平台标识
    :param state: 熔断器状态字符串（closed/open/half_open）
    """
    numeric_state = _CIRCUIT_STATE_MAP.get(state, 0)
    circuit_breaker_state.labels(platform=platform).set(numeric_state)


def update_rate_limiter_tokens(platform: str, tokens: float) -> None:
    """更新限流器令牌数指标

    :param platform: 平台标识
    :param tokens: 当前可用令牌数
    """
    rate_limiter_tokens.labels(platform=platform).set(tokens)


def _check_alerts(platform: str) -> None:
    """检查告警条件并触发对应动作

    - 失败率超 50% → ERROR 告警日志
    - 连续失败超 10 次 → 自动暂停 + 告警日志
    """
    consecutive = _consecutive_failures.get(platform, 0)
    total = _total_requests.get(platform, 0)
    failed = _failed_requests.get(platform, 0)

    # 连续失败超 10 次 → 自动暂停
    if consecutive >= CONSECUTIVE_FAILURE_THRESHOLD:
        if platform not in _paused_platforms:
            _paused_platforms.add(platform)
            logger.error(
                "平台连续失败超过阈值，自动暂停采集",
                platform=platform,
                consecutive_failures=consecutive,
                threshold=CONSECUTIVE_FAILURE_THRESHOLD,
            )

    # 失败率超 50%（至少 4 次请求后才判断，避免初始误报）
    if total >= 4 and failed / total > FAILURE_RATE_THRESHOLD:
        logger.error(
            "采集失败率超过阈值",
            platform=platform,
            failure_rate=f"{failed / total:.1%}",
            total_requests=total,
            failed_requests=failed,
            threshold=f"{FAILURE_RATE_THRESHOLD:.0%}",
        )


def is_platform_paused(platform: str) -> bool:
    """检查平台是否因连续失败被自动暂停

    :param platform: 平台标识
    :return: True 表示已暂停
    """
    return platform in _paused_platforms


def resume_platform(platform: str) -> None:
    """恢复已暂停的平台

    :param platform: 平台标识
    """
    _paused_platforms.discard(platform)
    _consecutive_failures[platform] = 0
    logger.info("平台采集已恢复", platform=platform)


def get_failure_rate(platform: str) -> Optional[float]:
    """获取指定平台的失败率

    :param platform: 平台标识
    :return: 失败率 (0.0~1.0)，无数据时返回 None
    """
    total = _total_requests.get(platform, 0)
    if total == 0:
        return None
    failed = _failed_requests.get(platform, 0)
    return failed / total


def get_consecutive_failures(platform: str) -> int:
    """获取指定平台的连续失败次数"""
    return _consecutive_failures.get(platform, 0)


def reset_metrics_state() -> None:
    """重置内部状态（用于测试）"""
    _consecutive_failures.clear()
    _total_requests.clear()
    _failed_requests.clear()
    _paused_platforms.clear()
