package com.algorithm.help.content.enrichment.pipeline;

/**
 * 异步任务状态枚举
 * <p>
 * 合法状态转换路径：
 * PENDING → PROCESSING → COMPLETED
 * PENDING → PROCESSING → FAILED
 * PENDING → CANCELLED
 * PENDING → PROCESSING → CANCELLED
 */
public enum TaskState {
    PENDING,
    PROCESSING,
    COMPLETED,
    FAILED,
    CANCELLED
}
