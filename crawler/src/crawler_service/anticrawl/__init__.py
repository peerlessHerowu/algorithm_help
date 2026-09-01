"""反爬策略层：限流、熔断、UA 轮转、Cookie 管理、AntiCrawlManager 总入口"""

from .circuit_breaker import CircuitBreaker, CircuitOpenError, CircuitState
from .cookie_store import RedisCookieStore
from .manager import AntiCrawlManager, NoOpProxyProvider, ProxyProvider
from .rate_limiter import TokenBucketRateLimiter
from .ua_rotator import UARotator

__all__ = [
    "AntiCrawlManager",
    "CircuitBreaker",
    "CircuitOpenError",
    "CircuitState",
    "NoOpProxyProvider",
    "ProxyProvider",
    "RedisCookieStore",
    "TokenBucketRateLimiter",
    "UARotator",
]
