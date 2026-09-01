package com.algorithm.help.common.enums;

import lombok.Getter;
import lombok.RequiredArgsConstructor;

/**
 * 数据采集平台枚举
 * 用于标识采集数据的来源平台
 */
@Getter
@RequiredArgsConstructor
public enum Platform {

    LEETCODE_GLOBAL("leetcode-global", "LeetCode 国际站"),
    LEETCODE_CN("leetcode-cn", "力扣中文站"),
    CODEFORCES("codeforces", "Codeforces"),
    NOWCODER("nowcoder", "牛客网"),
    ATCODER("atcoder", "AtCoder"),
    LUOGU("luogu", "洛谷");

    /** 配置文件中的 key */
    private final String code;

    /** 平台中文名 */
    private final String label;
}
