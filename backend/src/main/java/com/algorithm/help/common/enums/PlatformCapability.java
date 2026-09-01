package com.algorithm.help.common.enums;

/**
 * 平台采集能力枚举
 * 声明各平台支持的功能
 */
public enum PlatformCapability {

    /** 题目采集 */
    PROBLEM_FETCH,

    /** 题解采集 */
    SOLUTION_FETCH,

    /** 官方 Editorial 采集 */
    EDITORIAL_FETCH,

    /** 评论采集 */
    COMMENT_FETCH,

    /** 公司标签 */
    COMPANY_TAGS,

    /** 频率数据 */
    FREQUENCY_DATA,

    /** 难度评级（如 Codeforces rating） */
    DIFFICULTY_RATING,

    /** 竞赛题目 */
    CONTEST_PROBLEMS
}
