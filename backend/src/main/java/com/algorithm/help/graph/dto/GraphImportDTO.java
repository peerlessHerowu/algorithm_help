package com.algorithm.help.graph.dto;

import com.algorithm.help.graph.entity.GraphEdge;
import com.algorithm.help.graph.entity.GraphNode;
import lombok.Data;

import java.util.List;

/**
 * 图谱批量导入请求体
 */
@Data
public class GraphImportDTO {

    /** 待导入节点列表 */
    private List<GraphNode> nodes;

    /** 待导入边列表 */
    private List<GraphEdge> edges;
}
