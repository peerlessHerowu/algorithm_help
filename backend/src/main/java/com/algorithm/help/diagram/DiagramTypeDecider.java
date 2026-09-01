package com.algorithm.help.diagram;

import com.algorithm.help.common.enums.DiagramType;
import org.springframework.stereotype.Component;

import java.util.Map;

/**
 * 图解类型决策器：根据算法类型自动选择最合适的图表类型
 */
@Component
public class DiagramTypeDecider {

    private static final Map<String, DiagramType> RULES = Map.ofEntries(
        Map.entry("array", DiagramType.POINTER_ANIMATION),
        Map.entry("two-pointers", DiagramType.POINTER_ANIMATION),
        Map.entry("linked-list", DiagramType.NODE_LINK),
        Map.entry("tree", DiagramType.TREE_GRAPH),
        Map.entry("graph", DiagramType.NODE_EDGE_GRAPH),
        Map.entry("dp", DiagramType.TABLE_FILL),
        Map.entry("dynamic-programming", DiagramType.TABLE_FILL),
        Map.entry("backtracking", DiagramType.DECISION_TREE),
        Map.entry("sorting", DiagramType.BAR_ANIMATION),
        Map.entry("sliding-window", DiagramType.WINDOW_SLIDE),
        Map.entry("binary-search", DiagramType.RANGE_SHRINK),
        Map.entry("heap", DiagramType.TREE_ARRAY_DUAL),
        Map.entry("union-find", DiagramType.FOREST),
        Map.entry("string", DiagramType.CHAR_ALIGNMENT)
    );

    /**
     * 根据算法类型决定图表类型，无法识别时默认返回 FLOWCHART
     */
    public DiagramType decide(String algorithmType) {
        if (algorithmType == null) return DiagramType.FLOWCHART;
        return RULES.getOrDefault(algorithmType.toLowerCase(), DiagramType.FLOWCHART);
    }
}
