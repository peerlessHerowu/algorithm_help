package com.algorithm.help.common.enums;

import lombok.AllArgsConstructor;
import lombok.Getter;

/**
 * 图解类型枚举（13 种）
 */
@Getter
@AllArgsConstructor
public enum DiagramType {
    POINTER_ANIMATION("指针移动动画"),
    NODE_LINK("节点连线图"),
    TREE_GRAPH("树形结构图"),
    NODE_EDGE_GRAPH("节点边图"),
    TABLE_FILL("表格填充图"),
    DECISION_TREE("决策树"),
    BAR_ANIMATION("条形图动画"),
    WINDOW_SLIDE("窗口滑动"),
    RANGE_SHRINK("区间收缩"),
    TREE_ARRAY_DUAL("树+数组对照"),
    FOREST("森林图"),
    CHAR_ALIGNMENT("字符对齐图"),
    FLOWCHART("通用流程图");

    private final String description;
}
