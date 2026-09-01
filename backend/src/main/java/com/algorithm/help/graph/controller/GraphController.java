package com.algorithm.help.graph.controller;

import com.algorithm.help.common.ApiResponse;
import com.algorithm.help.graph.dto.GraphDTO;
import com.algorithm.help.graph.dto.GraphImportDTO;
import com.algorithm.help.graph.dto.GraphImportResult;
import com.algorithm.help.graph.entity.GraphEdge;
import com.algorithm.help.graph.entity.GraphNode;
import com.algorithm.help.graph.repository.GraphEdgeRepository;
import com.algorithm.help.graph.repository.GraphNodeRepository;
import com.algorithm.help.graph.service.GraphService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.*;
import java.util.stream.Collectors;

/**
 * 知识图谱 API 控制器
 * <p>
 * 提供子图查询、最短路径、批量导入/导出等端点
 */
@RestController
@RequestMapping("/api/graph")
@RequiredArgsConstructor
public class GraphController {

    private final GraphService graphService;
    private final GraphNodeRepository nodeRepo;
    private final GraphEdgeRepository edgeRepo;

    /**
     * 查询子图（BFS 向外扩展 depth 层）
     */
    @GetMapping("/subgraph")
    public ApiResponse<GraphDTO> getSubgraph(
            @RequestParam String nodeId,
            @RequestParam(defaultValue = "2") int depth) {
        GraphDTO result = graphService.querySubgraph(nodeId, depth);
        return ApiResponse.success(result);
    }

    /**
     * 查询两节点间最短路径
     */
    @GetMapping("/shortest-path")
    public ApiResponse<List<GraphNode>> getShortestPath(
            @RequestParam String from,
            @RequestParam String to) {
        List<GraphNode> path = graphService.shortestPath(from, to);
        return ApiResponse.success(path);
    }

    /**
     * JSON 批量导入图谱数据（节点 + 边）
     * <p>
     * 导入时校验引用完整性：边的 sourceId/targetId 必须在数据库或本批次节点中存在
     */
    @PostMapping("/import")
    public ApiResponse<GraphImportResult> importGraph(@RequestBody GraphImportDTO dto) {
        GraphImportResult result = doImport(dto);
        return ApiResponse.success(result);
    }

    /**
     * JSON 导出完整图谱
     */
    @GetMapping("/export")
    public ApiResponse<GraphDTO> exportGraph() {
        List<GraphNode> allNodes = nodeRepo.findAll();
        List<GraphEdge> allEdges = edgeRepo.findAll();
        return ApiResponse.success(new GraphDTO(allNodes, allEdges));
    }

    /**
     * 批量创建节点
     */
    @PostMapping("/nodes")
    public ApiResponse<List<GraphNode>> batchCreateNodes(@RequestBody List<GraphNode> nodes) {
        List<GraphNode> saved = nodeRepo.saveAll(nodes);
        return ApiResponse.success(saved);
    }

    /**
     * 批量创建边（校验引用完整性）
     */
    @PostMapping("/edges")
    public ApiResponse<GraphImportResult> batchCreateEdges(@RequestBody List<GraphEdge> edges) {
        GraphImportDTO dto = new GraphImportDTO();
        dto.setNodes(Collections.emptyList());
        dto.setEdges(edges);
        GraphImportResult result = doImport(dto);
        return ApiResponse.success(result);
    }

    // ==================== 私有方法 ====================

    /**
     * 执行导入逻辑：先保存节点，再校验边的引用完整性后保存
     */
    private GraphImportResult doImport(GraphImportDTO dto) {
        List<GraphNode> nodes = dto.getNodes() != null ? dto.getNodes() : Collections.emptyList();
        List<GraphEdge> edges = dto.getEdges() != null ? dto.getEdges() : Collections.emptyList();

        // 保存节点
        List<GraphNode> savedNodes = nodeRepo.saveAll(nodes);

        // 构建合法节点 ID 集合（数据库已有 + 本批次导入）
        Set<String> validNodeIds = buildValidNodeIds(savedNodes);

        // 校验边引用完整性并保存
        return validateAndSaveEdges(edges, validNodeIds, savedNodes.size());
    }

    /**
     * 构建有效节点 ID 集合：数据库现有 + 本批次新增
     */
    private Set<String> buildValidNodeIds(List<GraphNode> batchNodes) {
        Set<String> ids = nodeRepo.findAll().stream()
                .map(GraphNode::getId)
                .collect(Collectors.toSet());
        batchNodes.forEach(n -> ids.add(n.getId()));
        return ids;
    }

    /**
     * 校验边引用完整性，跳过非法边并记录错误
     */
    private GraphImportResult validateAndSaveEdges(
            List<GraphEdge> edges, Set<String> validIds, int nodesImported) {
        List<GraphEdge> validEdges = new ArrayList<>();
        List<String> errors = new ArrayList<>();

        for (GraphEdge edge : edges) {
            String err = checkEdgeRef(edge, validIds);
            if (err == null) {
                validEdges.add(edge);
            } else {
                errors.add(err);
            }
        }

        edgeRepo.saveAll(validEdges);

        return new GraphImportResult()
                .setNodesImported(nodesImported)
                .setEdgesImported(validEdges.size())
                .setErrorsSkipped(errors.size())
                .setErrorDetails(errors);
    }

    /**
     * 检查单条边的引用完整性，返回 null 表示通过，否则返回错误描述
     */
    private String checkEdgeRef(GraphEdge edge, Set<String> validIds) {
        if (edge.getSourceId() == null || !validIds.contains(edge.getSourceId())) {
            return String.format("边 sourceId='%s' 引用的节点不存在", edge.getSourceId());
        }
        if (edge.getTargetId() == null || !validIds.contains(edge.getTargetId())) {
            return String.format("边 targetId='%s' 引用的节点不存在", edge.getTargetId());
        }
        return null;
    }
}
