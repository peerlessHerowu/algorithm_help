package com.algorithm.help.common.enums;

/**
 * 采集任务状态枚举
 */
public enum CrawlTaskStatus {

    /** 待执行 */
    PENDING,

    /** 运行中 */
    RUNNING,

    /** 已完成 */
    COMPLETED,

    /** 失败 */
    FAILED,

    /** 已取消 */
    CANCELLED
}
