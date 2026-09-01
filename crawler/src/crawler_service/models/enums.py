"""枚举定义，与 Java Core 端保持语义一致"""

from enum import Enum


class Platform(str, Enum):
    """
    采集平台标识

    对应 Java 端：com.algorithm.help.common.enums.Platform
    """

    LEETCODE_GLOBAL = "LEETCODE_GLOBAL"
    LEETCODE_CN = "LEETCODE_CN"
    CODEFORCES = "CODEFORCES"
    NOWCODER = "NOWCODER"
    ATCODER = "ATCODER"
    LUOGU = "LUOGU"


class PlatformCapability(str, Enum):
    """平台支持的采集能力"""

    PROBLEM_FETCH = "PROBLEM_FETCH"
    SOLUTION_FETCH = "SOLUTION_FETCH"
    EDITORIAL_FETCH = "EDITORIAL_FETCH"
    COMMENT_FETCH = "COMMENT_FETCH"


class TaskType(str, Enum):
    """
    采集任务类型

    对应 Java 端：com.algorithm.help.common.enums.CrawlTaskType
    """

    PROBLEM_SYNC = "PROBLEM_SYNC"
    SOLUTION_SYNC = "SOLUTION_SYNC"
    SINGLE_FETCH = "SINGLE_FETCH"


class TaskStatus(str, Enum):
    """
    采集任务状态

    对应 Java 端：com.algorithm.help.common.enums.CrawlTaskStatus
    """

    PENDING = "PENDING"
    RUNNING = "RUNNING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    CANCELLED = "CANCELLED"


class TriggerType(str, Enum):
    """
    任务触发方式

    SCHEDULED: 定时调度触发
    MANUAL: 管理员 HTTP API 手动触发
    INCREMENTAL: 增量检测自动触发
    """

    SCHEDULED = "SCHEDULED"
    MANUAL = "MANUAL"
    INCREMENTAL = "INCREMENTAL"


class ProcessStatus(str, Enum):
    """
    原始数据处理状态

    标识 raw_source 记录的处理生命周期。
    对应数据库 raw_source.process_status 字段。
    """

    PENDING = "PENDING"
    PROCESSING = "PROCESSING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    INCOMPLETE = "INCOMPLETE"
    LOW_QUALITY = "LOW_QUALITY"


class ContentType(str, Enum):
    """采集内容类型"""

    PROBLEM = "PROBLEM"
    SOLUTION = "SOLUTION"
    EDITORIAL = "EDITORIAL"
    COMMENT = "COMMENT"


class Difficulty(str, Enum):
    """统一难度等级（三级）"""

    EASY = "EASY"
    MEDIUM = "MEDIUM"
    HARD = "HARD"
