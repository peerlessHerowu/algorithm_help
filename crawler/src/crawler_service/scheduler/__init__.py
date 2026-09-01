"""定时任务调度模块

基于 APScheduler 4.x AsyncScheduler 实现定时采集调度，支持：
- 全平台增量同步（每日 3:00）
- 题解采集（每周一 4:00）
- 失败任务自动重试（每 4 小时）
- 手动触发/暂停/恢复控制
"""

from .jobs import (
    SCHEDULE_FAILED_RETRY,
    SCHEDULE_FULL_PLATFORM_SYNC,
    SCHEDULE_SOLUTION_SYNC,
    pause_job,
    resume_job,
    setup_scheduler,
    shutdown_scheduler,
    start_scheduler,
    trigger_job,
)

__all__ = [
    "SCHEDULE_FAILED_RETRY",
    "SCHEDULE_FULL_PLATFORM_SYNC",
    "SCHEDULE_SOLUTION_SYNC",
    "setup_scheduler",
    "start_scheduler",
    "shutdown_scheduler",
    "trigger_job",
    "pause_job",
    "resume_job",
]
