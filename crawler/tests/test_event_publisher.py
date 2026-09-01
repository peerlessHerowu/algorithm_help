"""EventPublisher 单元测试"""

import pytest
from unittest.mock import AsyncMock, patch

from crawler_service.events.publisher import (
    CRAWL_EVENTS,
    CONTENT_EVENTS,
    EventPublisher,
)
from crawler_service.utils.trace import set_trace_id


class FakeTask:
    """模拟 CrawlTask 实体"""

    def __init__(self, id=1001, platform="leetcode_global",
                 status="COMPLETED", project="algorithm-help"):
        self.id = id
        self.platform = platform
        self.status = status
        self.project = project


@pytest.fixture
def mock_redis():
    """创建 mock Redis 客户端"""
    redis = AsyncMock()
    redis.xadd = AsyncMock(return_value=b"1234567890-0")
    return redis


@pytest.fixture
def publisher(mock_redis):
    """创建 EventPublisher 实例"""
    return EventPublisher(mock_redis)


@pytest.mark.asyncio
async def test_publish_task_status_changed(publisher, mock_redis):
    """测试发布任务状态变更事件"""
    set_trace_id("test-trace-001")
    task = FakeTask(id=12345, platform="codeforces", status="RUNNING")

    await publisher.publish_task_status_changed(task)

    mock_redis.xadd.assert_called_once()
    call_args = mock_redis.xadd.call_args
    stream_name = call_args[0][0]
    message = call_args[0][1]

    assert stream_name == CRAWL_EVENTS
    assert message["event_type"] == "TASK_STATUS_CHANGED"
    assert message["task_id"] == "12345"
    assert message["platform"] == "codeforces"
    assert message["status"] == "RUNNING"
    assert message["project"] == "algorithm-help"
    assert message["trace_id"] == "test-trace-001"
    # timestamp 应该是合法的 UTC 毫秒时间戳字符串
    ts = int(message["timestamp"])
    assert ts > 1_700_000_000_000  # 2023 年之后


@pytest.mark.asyncio
async def test_publish_content_standardized_new(publisher, mock_redis):
    """测试发布内容标准化事件 - 新建内容需要 AI 加工"""
    set_trace_id("test-trace-002")
    content = {"platform_id": "99999", "title": "Two Sum"}

    await publisher.publish_content_standardized(
        content, "create_new", "algorithm-help"
    )

    mock_redis.xadd.assert_called_once()
    call_args = mock_redis.xadd.call_args
    stream_name = call_args[0][0]
    message = call_args[0][1]

    assert stream_name == CONTENT_EVENTS
    assert message["event_type"] == "CONTENT_STANDARDIZED"
    assert message["content_type"] == "PROBLEM"
    assert message["content_id"] == "99999"
    assert message["action"] == "STANDARDIZED"
    assert message["needs_ai_enrich"] == "true"
    assert message["project"] == "algorithm-help"
    assert message["trace_id"] == "test-trace-002"


@pytest.mark.asyncio
async def test_publish_content_standardized_update(publisher, mock_redis):
    """测试发布内容标准化事件 - 更新已有内容不需要 AI 加工"""
    set_trace_id("test-trace-003")
    content = {"platform_id": "88888", "title": "Three Sum"}

    await publisher.publish_content_standardized(
        content, "update_existing", "algorithm-help"
    )

    call_args = mock_redis.xadd.call_args
    message = call_args[0][1]
    assert message["needs_ai_enrich"] == "false"


@pytest.mark.asyncio
async def test_publish_content_standardized_enum_dedup(publisher, mock_redis):
    """测试 dedup_result 为枚举类型时的处理"""
    from enum import Enum

    class DeduResult(str, Enum):
        CREATE_NEW = "create_new"
        UPDATE_EXISTING = "update_existing"

    set_trace_id("test-trace-004")
    content = {"platform_id": "77777"}

    await publisher.publish_content_standardized(
        content, DeduResult.CREATE_NEW, "math-helper"
    )

    call_args = mock_redis.xadd.call_args
    message = call_args[0][1]
    assert message["needs_ai_enrich"] == "true"
    assert message["project"] == "math-helper"


@pytest.mark.asyncio
async def test_trace_id_auto_generated(mock_redis):
    """测试未设置 trace_id 时自动生成"""
    # 使用新的 contextvars 上下文以确保 trace_id 为空
    import contextvars
    ctx = contextvars.copy_context()

    publisher = EventPublisher(mock_redis)
    task = FakeTask()

    # 在新上下文中执行，确保 trace_id 被自动生成
    await publisher.publish_task_status_changed(task)

    call_args = mock_redis.xadd.call_args
    message = call_args[0][1]
    # trace_id 应该是非空的 32 字符 hex
    assert len(message["trace_id"]) == 32
