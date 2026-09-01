package com.algorithm.help.math.dto;

import lombok.Data;
import lombok.experimental.Accessors;

import java.util.List;

/**
 * 数学关联 DTO
 * <p>
 * 描述算法模式与其数学基础知识的关联关系
 */
@Data
@Accessors(chain = true)
public class MathRelationDTO {

    /** 数学知识节点 ID */
    private String nodeId;

    /** 数学知识名称 */
    private String name;

    /** 数学知识描述 */
    private String description;

    /** 权威引用列表（如"CLRS 第15章 §15.3, p.379"） */
    private List<String> references;

    /** 可视化类型建议（如 RECURSIVE_TREE, DP_TABLE, MONTE_CARLO, STATE_MACHINE） */
    private String visualizationType;

    /** 数学知识分级（L1-L5） */
    private Integer level;
}
