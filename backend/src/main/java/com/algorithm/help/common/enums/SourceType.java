package com.algorithm.help.common.enums;

/**
 * 题解来源类型枚举
 */
public enum SourceType {

    /** 用户手动输入 */
    USER_INPUT,

    /** URL 导入 */
    URL_IMPORT,

    /** 费曼模式对话转化 */
    FEYNMAN_OUTPUT,

    /** 系统采集/AI生成 */
    CRAWLED
}
