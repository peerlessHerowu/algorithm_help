"""
Property Test: 事件消息格式完整性

**Validates: Requirements 11.2, 11.3, 11.4**

使用 hypothesis 生成随机任务数据，验证 EventPublisher 发布的消息始终满足：
1. event_type 字段为非空字符串
2. timestamp 字段为合法 UTC 毫秒整数（> 1700000000000，即 2023 年之后）
3. platform 字段为合法平台标识（属于 Platform 枚举）
4. trace_id 字段始终存在且非空
5. 所有必需字段（event_type, task_id/content_id, timestamp, trace_id）均存在
"""

import pytest
from unittest.mock import AsyncMock
from hypothesis import given, settings, assume
from hypothesis import strategies as st

from crawler_service.events.publisher import EventPublisher, CRAWL_EVENTS, CONTENT_EVENTS
from crawler_service.models.enums import Platform
from crawler_service.utils.trace import set_trace_id


# --- Strategies ---

# 合法平台标识策略
platform_strategy = st.sampled_from([p.value for p in Platform])

# 任务 ID 策略（雪花 ID 或普通正整数）
task_id_strategy = st.integers(min_value=1, max_value=2**63 - 1)

# 任务状态策略
status_strategy = st.sampled_from(["PENDING", "RUNNING", "COMPLETED", "FAILED", "CANCELLED"])

# 项目名策略
project_strategy = st.sampled_from(["algorithm-help", "math-helper"])

# trace_id 策略（模拟 UUID4 hex 格式，32 字符十六进制）
trace_id_strategy = st.text(
    alphabet="0123456789abcdef",
    min_size=32,
    max_size=32,
)

# content_id 策略（平台题目 ID，非空字符串）
content_id_strategy = st.text(
    alphabet=st.characters(whitelist_categories=("L", "N", "Pd")),
    min_size=1,
    max_size=50,
)

# dedup_result 策略
dedup_result_strategy = st.sampled_from([
    "create_new", "update_existing", "auto_map_confirmed", "auto_map_pending"
])

# 合法 Platform 枚举值集合（用于验证）
VALID_PLATFORMS = {p.value for p in Platform}


# --- Helper ---

class FakeTask:
    """模拟 CrawlTask 实体，由 hypothesis 生成随机数据"""

    def __init__(self, id: int, platform: str, status: str, project: str):
        self.id = id
        self.platform = platform
        self.status = status
        self.project = project


# --- Property Tests ---

class TestEventFormatProperty:
    """Property 13: 事件消息格式完整性"""

    @given(
        task_id=task_id_strategy,
        platform=platform_strategy,
        status=status_strategy,
        project=project_strategy,
        trace_id=trace_id_strategy,
    )
    @settings(max_examples=200)
    @pytest.mark.asyncio
    async def test_task_status_event_format_completeness(
        self, task_id, platform, status, project, trace_id
    ):
        """
        验证 publish_task_status_changed 发布的消息格式完整性。

        **Validates: Requirements 11.2, 11.3, 11.4**

        属性：
        - event_type 始终为非空字符串
        - timestamp 为合法 UTC 毫秒（> 1700000000000）
        - platform 为合法平台标识
        - trace_id 始终存在且非空
        - 所有必需字段（event_type, task_id, timestamp, trace_id）均存在
        """
        # 设置 trace_id 上下文
        set_trace_id(trace_id)

        # 构造 mock Redis 捕获 xadd 调用
        mock_redis = AsyncMock()
        captured_messages = []

        async def capture_xadd(stream, message):
            captured_messages.append((stream, message))
            return b"1234567890-0"

        mock_redis.xadd = capture_xadd
        publisher = EventPublisher(mock_redis)

        # 构造随机 task
        task = FakeTask(id=task_id, platform=platform, status=status, project=project)

        # 执行发布
        await publisher.publish_task_status_changed(task)

        # 验证捕获到消息
        assert len(captured_messages) == 1
        stream, message = captured_messages[0]


        # 属性 1: event_type 为非空字符串
        assert "event_type" in message, "缺少 event_type 字段"
        assert isinstance(message["event_type"], str), "event_type 应为字符串"
        assert len(message["event_type"]) > 0, "event_type 不应为空"

        # 属性 2: timestamp 为合法 UTC 毫秒整数（> 1700000000000）
        assert "timestamp" in message, "缺少 timestamp 字段"
        ts = int(message["timestamp"])
        assert ts > 1_700_000_000_000, (
            f"timestamp {ts} 应大于 1700000000000（2023 年之后的 UTC 毫秒）"
        )

        # 属性 3: platform 为合法平台标识
        assert "platform" in message, "缺少 platform 字段"
        assert message["platform"] in VALID_PLATFORMS, (
            f"platform '{message['platform']}' 不是合法平台标识"
        )

        # 属性 4: trace_id 始终存在且非空
        assert "trace_id" in message, "缺少 trace_id 字段"
        assert isinstance(message["trace_id"], str), "trace_id 应为字符串"
        assert len(message["trace_id"]) > 0, "trace_id 不应为空"

        # 属性 5: 所有必需字段均存在
        required_fields = {"event_type", "task_id", "timestamp", "trace_id"}
        missing = required_fields - set(message.keys())
        assert not missing, f"缺少必需字段: {missing}"


    @given(
        content_id=content_id_strategy,
        dedup_result=dedup_result_strategy,
        project=project_strategy,
        trace_id=trace_id_strategy,
    )
    @settings(max_examples=200)
    @pytest.mark.asyncio
    async def test_content_event_format_completeness(
        self, content_id, dedup_result, project, trace_id
    ):
        """
        验证 publish_content_standardized 发布的消息格式完整性。

        **Validates: Requirements 11.2, 11.3, 11.4**

        属性：
        - event_type 始终为非空字符串
        - timestamp 为合法 UTC 毫秒（> 1700000000000）
        - trace_id 始终存在且非空
        - 所有必需字段（event_type, content_id, timestamp, trace_id）均存在
        """
        # 设置 trace_id 上下文
        set_trace_id(trace_id)

        # 构造 mock Redis 捕获 xadd 调用
        mock_redis = AsyncMock()
        captured_messages = []

        async def capture_xadd(stream, message):
            captured_messages.append((stream, message))
            return b"1234567890-0"

        mock_redis.xadd = capture_xadd
        publisher = EventPublisher(mock_redis)

        # 构造随机 content
        content = {"platform_id": content_id, "title": "Test Problem"}

        # 执行发布
        await publisher.publish_content_standardized(content, dedup_result, project)

        # 验证捕获到消息
        assert len(captured_messages) == 1
        stream, message = captured_messages[0]

        # 属性 1: event_type 为非空字符串
        assert "event_type" in message, "缺少 event_type 字段"
        assert isinstance(message["event_type"], str), "event_type 应为字符串"
        assert len(message["event_type"]) > 0, "event_type 不应为空"


        # 属性 2: timestamp 为合法 UTC 毫秒整数（> 1700000000000）
        assert "timestamp" in message, "缺少 timestamp 字段"
        ts = int(message["timestamp"])
        assert ts > 1_700_000_000_000, (
            f"timestamp {ts} 应大于 1700000000000（2023 年之后的 UTC 毫秒）"
        )

        # 属性 3: trace_id 始终存在且非空
        assert "trace_id" in message, "缺少 trace_id 字段"
        assert isinstance(message["trace_id"], str), "trace_id 应为字符串"
        assert len(message["trace_id"]) > 0, "trace_id 不应为空"

        # 属性 4: 所有必需字段均存在
        required_fields = {"event_type", "content_id", "timestamp", "trace_id"}
        missing = required_fields - set(message.keys())
        assert not missing, f"缺少必需字段: {missing}"
