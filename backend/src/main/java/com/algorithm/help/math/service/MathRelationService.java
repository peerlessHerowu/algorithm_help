package com.algorithm.help.math.service;

import com.algorithm.help.graph.entity.GraphEdge;
import com.algorithm.help.graph.entity.GraphNode;
import com.algorithm.help.graph.enums.RelationType;
import com.algorithm.help.graph.repository.GraphEdgeRepository;
import com.algorithm.help.graph.repository.GraphNodeRepository;
import com.algorithm.help.math.dto.MathRelationDTO;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * 数学关联服务
 * <p>
 * 查询算法模式与数学基础知识的关联关系，支持分级过滤
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class MathRelationService {

    private final GraphEdgeRepository edgeRepo;
    private final GraphNodeRepository nodeRepo;
    private final ObjectMapper objectMapper;

    /**
     * 查询算法模式的数学基础关联
     *
     * @param patternId 算法模式节点 ID
     * @param level     数学知识分级（null 表示不过滤）
     * @return 数学关联 DTO 列表
     */
    public List<MathRelationDTO> getMathRelations(String patternId, Integer level) {
        // 查询 MATH_FOUNDATION 类型的边
        List<GraphEdge> edges = edgeRepo.findBySourceIdAndRelationType(
                patternId, RelationType.MATH_FOUNDATION);

        if (edges.isEmpty()) {
            return Collections.emptyList();
        }

        // 提取目标节点 ID 并批量加载数学节点
        List<String> mathNodeIds = edges.stream()
                .map(GraphEdge::getTargetId)
                .collect(Collectors.toList());
        List<GraphNode> mathNodes = nodeRepo.findByIdIn(mathNodeIds);

        // 转换为 DTO 并按 level 过滤
        return mathNodes.stream()
                .map(this::toDTO)
                .filter(dto -> level == null || level.equals(dto.getLevel()))
                .collect(Collectors.toList());
    }

    /**
     * 将 GraphNode 转换为 MathRelationDTO，从 metadata JSON 解析引用和可视化类型
     */
    private MathRelationDTO toDTO(GraphNode node) {
        MathRelationDTO dto = new MathRelationDTO()
                .setNodeId(node.getId())
                .setName(node.getName())
                .setDescription(node.getDescription());

        parseMetadata(node.getMetadata(), dto);
        return dto;
    }

    /**
     * 解析 metadata JSON，提取 references、visualizationType、level
     */
    @SuppressWarnings("unchecked")
    private void parseMetadata(String metadata, MathRelationDTO dto) {
        if (metadata == null || metadata.isBlank()) {
            return;
        }
        try {
            Map<String, Object> map = objectMapper.readValue(
                    metadata, new TypeReference<>() {});

            Object refs = map.get("references");
            if (refs instanceof List<?>) {
                dto.setReferences((List<String>) refs);
            }

            Object vizType = map.get("visualizationType");
            if (vizType instanceof String) {
                dto.setVisualizationType((String) vizType);
            }

            Object lvl = map.get("level");
            if (lvl instanceof Integer) {
                dto.setLevel((Integer) lvl);
            } else if (lvl instanceof Number) {
                dto.setLevel(((Number) lvl).intValue());
            }
        } catch (Exception e) {
            log.warn("解析数学节点 metadata 失败: nodeId={}, error={}", dto.getNodeId(), e.getMessage());
        }
    }
}
