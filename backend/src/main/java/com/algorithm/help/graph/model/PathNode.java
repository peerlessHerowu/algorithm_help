package com.algorithm.help.graph.model;

import com.algorithm.help.graph.enums.NodeType;
import lombok.Data;
import lombok.experimental.Accessors;

/**
 * 学习路径节点（嵌入 LearningPath 的 JSON 列中，非独立 JPA 实体）
 */
@Data
@Accessors(chain = true)
public class PathNode {

    /** 关联 GraphNode ID */
    private String nodeId;

    /** 节点类型：PATTERN / PROBLEM / MATH / PAPER */
    private NodeType nodeType;

    /** 顺序号 */
    private Integer order;

    /** 是否可选 */
    private boolean optional;

    /** 解锁条件描述 */
    private String unlockCondition;

    /** 里程碑名称（null 表示非里程碑） */
    private String milestone;
}
