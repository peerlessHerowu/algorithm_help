package com.algorithm.help.graph.dto;

import com.algorithm.help.graph.entity.GraphEdge;
import com.algorithm.help.graph.entity.GraphNode;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * 子图查询结果 DTO，包含节点和边
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class GraphDTO {

    /** 子图中的节点列表 */
    private List<GraphNode> nodes;

    /** 子图中的边列表 */
    private List<GraphEdge> edges;
}
