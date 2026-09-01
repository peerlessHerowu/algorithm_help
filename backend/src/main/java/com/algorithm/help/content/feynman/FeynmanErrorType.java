package com.algorithm.help.content.feynman;

/**
 * 反向费曼错误分类类型
 * <p>
 * 按认知复杂度从低到高排列：
 * EASY档：LOGIC + NUMERIC
 * MEDIUM档：BOUNDARY + COMPLEXITY
 * HARD档：CONCEPT
 */
public enum FeynmanErrorType {

    /** 逻辑错误：条件判断、循环终止等 */
    LOGIC("逻辑错误", "条件判断、循环终止、分支遗漏等"),

    /** 数值错误：整数溢出、精度丢失等 */
    NUMERIC("数值错误", "整数溢出、精度丢失、取模运算错误等"),

    /** 边界错误：数组越界、空输入、极端值等 */
    BOUNDARY("边界错误", "数组越界、空输入、极端值处理遗漏等"),

    /** 复杂度错误：时间/空间复杂度超标 */
    COMPLEXITY("复杂度错误", "时间复杂度超标、空间浪费、不必要的重复计算等"),

    /** 概念错误：算法原理理解偏差 */
    CONCEPT("概念错误", "算法原理误解、数据结构选型错误、问题建模偏差等");

    private final String displayName;
    private final String description;

    FeynmanErrorType(String displayName, String description) {
        this.displayName = displayName;
        this.description = description;
    }

    public String getDisplayName() {
        return displayName;
    }

    public String getDescription() {
        return description;
    }
}
