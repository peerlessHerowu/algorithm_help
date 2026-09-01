"""
Redis Stream 事件发布器

发布采集任务状态变更和内容标准化完成事件到 Redis Stream。
Stream 名称：stream:crawl-events（任务状态）、stream:content-events（内容事件）。
消息体格式：event_type、各 payload 字段、timestamp（UTC 毫秒）、trace_id。

Validates: Requirements 11.1, 11.2, 11.3, 11.4
"""

import time
from typing import Optional

import structlog
from redis.asyncio import Redis

from ..utils.trace import get_current_trace_id

logger = structlog.get_logger()

# Stream 名称常量
CRAWL_EVENTS = "stream:crawl-events"
CONTENT_EVENTS = "stream:content-events"


class EventPublisher:
    """Redis Stream 事件发布器

    负责将采集任务状态变更和内容标准化完成事件发布到 Redis Stream，
    供 Java Core 端消费处理。

    支持降级模式：redis=None 时所有发布操作为空操作（用于测试或 Redis 不可用时）。
    """

    def __init__(self, redis: Optional[Redis] = None):
        """
        :param redis: Redis 异步客户端实例，None 时为空操作模式
        """
        self._redis = redis

    async def publish_task_status_changed(self, task) -> None:
        """发布采集任务状态变更事件到 stream:crawl-events

        :param task: CrawlTask 实体
        """
        if self._redis is None:
            return

        message = {
            "event_type": "TASK_STATUS_CHANGED",
            "task_id": str(task.id),
            "platform": task.platform,
            "status": task.status,
            "project": task.project,
            "timestamp": str(int(time.time() * 1000)),
            "trace_id": get_current_trace_id(),
        }
        await self._redis.xadd(CRAWL_EVENTS, message)
        logger.debug(
            "事件已发布",
            stream=CRAWL_EVENTS,
            event_type="TASK_STATUS_CHANGED",
            task_id=str(task.id),
        )

    async def publish_content_standardized(
        self,
        content: dict,
        dedup_result: str,
        project: str,
    ) -> None:
        """发布内容标准化完成事件到 stream:content-events

        :param content: 标准化后的内容字典
        :param dedup_result: 去重结果值（create_new/update_existing/auto_map_*）
        :param project: 所属项目
        """
        if self._redis is None:
            return

        needs_ai = "true" if dedup_result == "create_new" else "false"
        message = {
            "event_type": "CONTENT_STANDARDIZED",
            "content_type": "PROBLEM",
            "content_id": str(content.get("platform_id", "")),
            "action": "STANDARDIZED",
            "needs_ai_enrich": needs_ai,
            "project": project,
            "timestamp": str(int(time.time() * 1000)),
            "trace_id": get_current_trace_id(),
        }
        await self._redis.xadd(CONTENT_EVENTS, message)
        logger.debug(
            "事件已发布",
            stream=CONTENT_EVENTS,
            event_type="CONTENT_STANDARDIZED",
            content_id=str(content.get("platform_id", "")),
        )
