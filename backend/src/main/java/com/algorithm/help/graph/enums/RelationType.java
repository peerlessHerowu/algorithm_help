package com.algorithm.help.graph.enums;

import lombok.AllArgsConstructor;
import lombok.Getter;

/**
 * 图谱边关系类型枚举
 */
@Getter
@AllArgsConstructor
public enum RelationType {
    PREREQUISITE("前置知识"),
    VARIANT("变体"),
    SIMILAR_PATTERN("同模式"),
    FOLLOW_UP("进阶"),
    HARDER_VERSION("困难版本"),
    MATH_FOUNDATION("数学基础"),
    PAPER_REFERENCE("论文引用"),
    APPLICATION_OF("应用实例");

    private final String description;
}
