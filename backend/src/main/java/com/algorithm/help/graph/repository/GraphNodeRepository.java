package com.algorithm.help.graph.repository;

import com.algorithm.help.graph.entity.GraphNode;
import com.algorithm.help.graph.enums.NodeType;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

/**
 * 图谱节点数据访问层
 */
public interface GraphNodeRepository extends JpaRepository<GraphNode, String> {

    List<GraphNode> findByType(NodeType type);

    List<GraphNode> findByCategory(String category);

    List<GraphNode> findByIdIn(List<String> ids);
}
