package com.algorithm.help.common.enums;

import lombok.AllArgsConstructor;
import lombok.Getter;

/**
 * 题目关联类型枚举
 */
@Getter
@AllArgsConstructor
public enum RelationType {
    PREREQUISITE("前置知识"),
    VARIANT("变体题"),
    SIMILAR_PATTERN("相似模式"),
    FOLLOW_UP("进阶题"),
    HARDER_VERSION("更难版本");

    private final String description;
}
