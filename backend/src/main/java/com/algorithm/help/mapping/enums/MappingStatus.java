package com.algorithm.help.mapping.enums;

/**
 * 平台映射状态枚举
 */
public enum MappingStatus {
    /** 已确认映射正确 */
    CONFIRMED,
    /** 待确认（自动匹配不确定时） */
    PENDING,
    /** 已拒绝（用户确认映射错误） */
    REJECTED
}
