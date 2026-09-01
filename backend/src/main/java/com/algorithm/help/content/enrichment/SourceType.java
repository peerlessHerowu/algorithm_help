package com.algorithm.help.content.enrichment;

/**
 * 解析来源类型枚举
 */
public enum SourceType {
    /** 社区题解 */
    COMMUNITY,
    /** 纯 AI 生成 */
    AI_ORIGINAL,
    /** 官方 Editorial */
    OFFICIAL,
    /** v1 迁移数据 */
    LEGACY_V1
}
