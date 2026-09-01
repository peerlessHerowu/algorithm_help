package com.algorithm.help.graph.repository;

import com.algorithm.help.graph.entity.GraphEdge;
import com.algorithm.help.graph.enums.RelationType;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

/**
 * 图谱边数据访问层
 */
public interface GraphEdgeRepository extends JpaRepository<GraphEdge, String> {

    List<GraphEdge> findBySourceId(String sourceId);

    List<GraphEdge> findByTargetId(String targetId);

    List<GraphEdge> findByRelationType(RelationType relationType);

    List<GraphEdge> findBySourceIdOrTargetId(String sourceId, String targetId);

    List<GraphEdge> findBySourceIdIn(List<String> sourceIds);

    List<GraphEdge> findBySourceIdAndRelationType(String sourceId, RelationType relationType);
}
