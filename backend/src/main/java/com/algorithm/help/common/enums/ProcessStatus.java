package com.algorithm.help.common.enums;

/**
 * 原始数据处理状态枚举
 * 用于 RawSource 的处理流转
 */
public enum ProcessStatus {

    /** 待处理 */
    PENDING,

    /** 已处理 */
    PROCESSED,

    /** 处理失败 */
    FAILED
}
