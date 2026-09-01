package com.algorithm.help.graph.dto;

import com.algorithm.help.graph.enums.NodeType;
import lombok.Data;
import lombok.experimental.Accessors;

/**
 * 题目推荐项 DTO
 */
@Data
@Accessors(chain = true)
public class RecommendItem {

    /** 推荐节点 ID */
    private String nodeId;

    /** 节点类型 */
    private NodeType nodeType;

    /** 节点名称 */
    private String name;

    /** 推荐理由 */
    private String reason;

    /** 推荐分数（越高越优先） */
    private Double score;

    /** 所属模式名称 */
    private String patternName;

    /** 难度系数 1-5 */
    private Integer difficulty;
}
