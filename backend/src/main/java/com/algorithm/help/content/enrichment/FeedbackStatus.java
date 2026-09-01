package com.algorithm.help.content.enrichment;

/**
 * 纠错反馈处理状态枚举
 */
public enum FeedbackStatus {
    /** 待处理 */
    PENDING,
    /** 已解决 */
    RESOLVED,
    /** 已忽略 */
    DISMISSED
}
