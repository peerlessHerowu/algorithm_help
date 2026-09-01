"""pytest 全局 fixture 配置"""

import pytest

from crawler_service.metrics import reset_metrics_state


@pytest.fixture(autouse=True)
def _reset_metrics():
    """每个测试前后重置 Prometheus 内部告警状态，避免跨测试污染"""
    reset_metrics_state()
    yield
    reset_metrics_state()
