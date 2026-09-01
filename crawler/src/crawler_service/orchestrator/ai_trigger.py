"""
AI 加工触发与成本控制

实现 AI 调用的限流（令牌桶，每分钟 10 次）、优先级队列、每日预算控制。
失败标记 FAILED 不阻塞采集，支持手动重触发。

Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.5, 20.1, 20.2, 20.3, 20.4, 20.5
"""

import asyncio
import heapq
import time
from dataclasses import dataclass, field
from enum import IntEnum
from typing import Optional

import httpx
import structlog

from ..anticrawl.rate_limiter import TokenBucketRateLimiter
from ..config import AiConfig
from ..database.repository import RawSourceRepository

logger = structlog.get_logger()


class AiPriority(IntEnum):
    """AI 加工优先级（数值越小优先级越高）"""

    HOT = 1       # 热门题（高赞/高频）
    NORMAL = 2    # 新增普通题
    UPDATE = 3    # 更新已有题


@dataclass(order=True)
class AiTask:
    """AI 加工任务条目，支持优先级排序"""

    priority: int
    enqueue_time: float = field(compare=False)
    raw_source_id: int = field(compare=False)
    retry_count: int = field(default=0, compare=False)


class AiTriggerService:
    """
    AI 加工触发服务

    职责：
    1. 令牌桶限流（每分钟 batch_rate_limit 次，默认 10）
    2. 优先级队列：HOT > NORMAL > UPDATE
    3. 每日预算控制（达到上限暂停队列，次日重置）
    4. 失败标记 FAILED，不阻塞采集流程
    5. 支持手动 retry_ai 重触发
    """

    def __init__(
        self,
        ai_config: AiConfig,
        raw_repo: RawSourceRepository,
    ):
        """
        :param ai_config: AI 服务配置（base_url、batch_rate_limit、daily_budget）
        :param raw_repo: 原始数据仓储（用于更新 process_status）
        """
        self._config = ai_config
        self._raw_repo = raw_repo

        # 令牌桶限流：每分钟 batch_rate_limit 次
        self._rate_limiter = TokenBucketRateLimiter(
            rate=ai_config.batch_rate_limit, period=60.0
        )

        # 优先级队列（最小堆，AiPriority 数值越小优先级越高）
        self._queue: list[AiTask] = []
        self._queue_lock = asyncio.Lock()

        # 每日预算
        self._daily_budget = ai_config.daily_budget
        self._daily_used = 0
        self._budget_reset_date = self._today()

        # 控制标志
        self._running = False
        self._process_task: Optional[asyncio.Task] = None

    @property
    def queue_size(self) -> int:
        """当前队列中待处理任务数"""
        return len(self._queue)

    @property
    def daily_used(self) -> int:
        """当日已使用 AI 调用次数"""
        return self._daily_used

    @property
    def daily_remaining(self) -> int:
        """当日剩余 AI 调用次数"""
        self._check_budget_reset()
        return max(0, self._daily_budget - self._daily_used)

    @property
    def is_budget_exhausted(self) -> bool:
        """每日预算是否已耗尽"""
        self._check_budget_reset()
        return self._daily_used >= self._daily_budget

    async def trigger_ai_enrichment(
        self, raw_source_id: int, priority: AiPriority = AiPriority.NORMAL
    ) -> None:
        """
        将 AI 加工任务加入优先级队列。

        :param raw_source_id: 原始数据 ID
        :param priority: 优先级（HOT/NORMAL/UPDATE）
        """
        task = AiTask(
            priority=priority.value,
            enqueue_time=time.time(),
            raw_source_id=raw_source_id,
        )
        async with self._queue_lock:
            heapq.heappush(self._queue, task)
        logger.info(
            "AI 加工任务入队",
            raw_source_id=raw_source_id,
            priority=priority.name,
            queue_size=self.queue_size,
        )

    async def retry_ai(self, raw_source_id: int) -> bool:
        """
        手动重触发 FAILED 状态的 AI 加工。

        :param raw_source_id: 原始数据 ID
        :return: 是否成功入队
        """
        # 以高优先级重新入队
        task = AiTask(
            priority=AiPriority.HOT.value,
            enqueue_time=time.time(),
            raw_source_id=raw_source_id,
            retry_count=1,
        )
        async with self._queue_lock:
            heapq.heappush(self._queue, task)
        logger.info("AI 加工手动重触发", raw_source_id=raw_source_id)
        return True

    async def process_queue(self) -> int:
        """
        消费优先级队列中的 AI 加工任务。

        遵循限流和预算控制：
        - 每次消费前通过令牌桶 acquire() 等待
        - 预算耗尽时暂停直到次日重置

        :return: 本次处理的任务数
        """
        processed = 0

        while True:
            # 检查预算
            self._check_budget_reset()
            if self.is_budget_exhausted:
                logger.warning(
                    "每日 AI 预算已耗尽，暂停队列处理",
                    daily_used=self._daily_used,
                    daily_budget=self._daily_budget,
                )
                break

            # 取出最高优先级任务
            task = await self._pop_task()
            if task is None:
                break  # 队列为空

            # 限流等待
            await self._rate_limiter.acquire()

            # 执行 AI 调用
            success = await self._call_ai_service(task.raw_source_id)

            if success:
                self._daily_used += 1
                processed += 1
            else:
                # 失败标记 FAILED，不阻塞后续处理
                await self._mark_failed(task.raw_source_id, "AI 加工调用失败")

        return processed

    async def start(self) -> None:
        """启动后台队列处理循环"""
        if self._running:
            return
        self._running = True
        self._process_task = asyncio.create_task(self._background_loop())
        logger.info("AI 加工队列后台处理已启动")

    async def stop(self) -> None:
        """停止后台队列处理"""
        self._running = False
        if self._process_task and not self._process_task.done():
            self._process_task.cancel()
            try:
                await self._process_task
            except asyncio.CancelledError:
                pass
        logger.info("AI 加工队列后台处理已停止")

    async def _background_loop(self) -> None:
        """后台循环：定期消费队列"""
        while self._running:
            try:
                await self.process_queue()
            except Exception as e:
                logger.error("AI 队列处理异常", error=str(e))
            # 队列为空或预算耗尽时等待一段时间再检查
            await asyncio.sleep(5.0)

    async def _pop_task(self) -> Optional[AiTask]:
        """从优先级队列弹出最高优先级任务"""
        async with self._queue_lock:
            if not self._queue:
                return None
            return heapq.heappop(self._queue)

    async def _call_ai_service(self, raw_source_id: int) -> bool:
        """
        通过 HTTP 调用 algorithm-ai 服务触发 AI 加工。

        :param raw_source_id: 原始数据 ID
        :return: 调用是否成功
        """
        url = f"{self._config.base_url}/api/v1/ai/enrich"
        payload = {"raw_source_id": raw_source_id}

        try:
            async with httpx.AsyncClient(timeout=self._config.timeout) as client:
                resp = await client.post(url, json=payload)
                resp.raise_for_status()
            logger.info("AI 加工调用成功", raw_source_id=raw_source_id)
            # 更新状态为 PROCESSING（由 AI 服务完成后回调更新为 COMPLETED）
            await self._raw_repo.update_status(raw_source_id, "PROCESSING")
            return True
        except httpx.HTTPStatusError as e:
            logger.warning(
                "AI 加工 HTTP 错误",
                raw_source_id=raw_source_id,
                status_code=e.response.status_code,
            )
            return False
        except Exception as e:
            logger.warning(
                "AI 加工调用异常",
                raw_source_id=raw_source_id,
                error=str(e),
            )
            return False

    async def _mark_failed(self, raw_source_id: int, reason: str) -> None:
        """
        标记 raw_source 为 FAILED 状态，不阻塞采集。

        :param raw_source_id: 原始数据 ID
        :param reason: 失败原因
        """
        try:
            await self._raw_repo.update_status(raw_source_id, "FAILED", reason)
            logger.warning(
                "AI 加工标记 FAILED",
                raw_source_id=raw_source_id,
                reason=reason,
            )
        except Exception as e:
            logger.error(
                "更新 FAILED 状态异常",
                raw_source_id=raw_source_id,
                error=str(e),
            )

    def _check_budget_reset(self) -> None:
        """检查是否跨日，需要重置每日预算"""
        today = self._today()
        if today != self._budget_reset_date:
            self._daily_used = 0
            self._budget_reset_date = today
            logger.info("每日 AI 预算已重置", date=today)

    @staticmethod
    def _today() -> str:
        """获取当前日期字符串（用于预算重置判断）"""
        return time.strftime("%Y-%m-%d", time.gmtime())

    def update_config(self, ai_config: AiConfig) -> None:
        """
        动态更新 AI 配置（支持热更新）。

        :param ai_config: 新的 AI 配置
        """
        self._config = ai_config
        self._daily_budget = ai_config.daily_budget
        # 重建限流器
        self._rate_limiter = TokenBucketRateLimiter(
            rate=ai_config.batch_rate_limit, period=60.0
        )
        logger.info(
            "AI 配置已更新",
            batch_rate_limit=ai_config.batch_rate_limit,
            daily_budget=ai_config.daily_budget,
        )
