package com.algorithm.help.common.enums;

import lombok.AllArgsConstructor;
import lombok.Getter;

/**
 * 解释级别枚举（1-5 级）
 */
@Getter
@AllArgsConstructor
public enum Level {
    L1(1, "直觉理解 - 零代码纯类比"),
    L2(2, "入门级 - 具体例子+伪代码"),
    L3(3, "中级 - 模式框架+多解法对比"),
    L4(4, "高级 - 边界分析+复杂度证明"),
    L5(5, "专家级 - 论文引用+数学推导");

    private final int value;
    private final String description;

    public static Level fromValue(int value) {
        for (Level level : values()) {
            if (level.value == value) return level;
        }
        throw new IllegalArgumentException("无效的级别值: " + value);
    }
}
