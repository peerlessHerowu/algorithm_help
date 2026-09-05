package com.algorithm.help.controller;

import com.algorithm.help.common.ApiResponse;
import com.algorithm.help.controller.dto.PatternDTO;
import com.algorithm.help.controller.dto.PatternDetailDTO;
import com.algorithm.help.entity.AlgorithmPattern;
import com.algorithm.help.graph.entity.GraphEdge;
import com.algorithm.help.graph.entity.GraphNode;
import com.algorithm.help.graph.enums.RelationType;
import com.algorithm.help.graph.repository.GraphEdgeRepository;
import com.algorithm.help.graph.repository.GraphNodeRepository;
import com.algorithm.help.service.PatternService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;

import java.util.*;
import java.util.stream.Collectors;

/**
 * 算法模式 API 控制器
 * <p>
 * 提供模式列表、详情、完整信息（含演进路径）
 */
@RestController
@RequestMapping("/api/v1/patterns")
@RequiredArgsConstructor
@Slf4j
public class PatternController {

    private final PatternService patternService;
    private final GraphEdgeRepository edgeRepo;
    private final GraphNodeRepository nodeRepo;

    /**
     * 获取所有算法模式列表
     */
    @GetMapping
    public ApiResponse<List<PatternDTO>> listPatterns() {
        List<PatternDTO> patterns = patternService.listPatterns().stream()
                .map(this::toDTO)
                .toList();
        return ApiResponse.success(patterns);
    }

    /**
     * 获取模式基础详情
     */
    @GetMapping("/{id}")
    public ApiResponse<PatternDTO> getPattern(@PathVariable String id) {
        // URL 传 two-pointers，库里存 pattern:two-pointers
        String lookupId = id.startsWith("pattern:") ? id : "pattern:" + id;
        AlgorithmPattern pattern = patternService.getById(lookupId);
        return ApiResponse.success(toDTO(pattern));
    }

    /**
     * 获取模式完整详情（含演进路径、图谱关系）
     * <p>
     * 用于 /patterns/[id] 详情页的完整展示，包括：
     * - 前置知识、进阶路径（来自 graph_edge 表）
     * - 关联图谱节点信息（题目名称、难度）
     */
    @GetMapping("/{id}/detail")
    public ApiResponse<PatternDetailDTO> getPatternDetail(@PathVariable String id) {
        log.info("获取模式完整详情, id={}", id);

        // 规范化 ID：允许传 "two-pointers" 或 "pattern:two-pointers"
        String plainId = id.startsWith("pattern:") ? id.substring(8) : id;
        String nodeId = "pattern:" + plainId;

        AlgorithmPattern pattern = patternService.getById(nodeId);

        // 从图谱查演进关系
        List<GraphEdge> allEdges = edgeRepo.findBySourceIdOrTargetId(nodeId, nodeId);

        // 前置知识（这个模式依赖的）
        List<PatternDetailDTO.RelatedPatternDTO> prerequisites = buildRelatedPatterns(
                allEdges, nodeId, RelationType.PREREQUISITE, true);

        // 进阶路径（掌握后可以学）
        List<PatternDetailDTO.RelatedPatternDTO> followUps = buildRelatedPatterns(
                allEdges, nodeId, RelationType.FOLLOW_UP, false);

        // 困难版本
        List<PatternDetailDTO.RelatedPatternDTO> harderVersions = buildRelatedPatterns(
                allEdges, nodeId, RelationType.HARDER_VERSION, false);

        // 同模式（相似模式）
        List<PatternDetailDTO.RelatedPatternDTO> similarPatterns = buildRelatedPatterns(
                allEdges, nodeId, RelationType.SIMILAR_PATTERN, false);

        PatternDetailDTO detail = new PatternDetailDTO()
                .setId(plainId)
                .setName(pattern.getName())
                .setCategory(pattern.getCategory())
                .setTemplate(pattern.getTemplate())
                .setSignals(pattern.getSignals())
                .setVariants(pattern.getVariants())
                .setRelatedProblems(pattern.getRelatedProblems())
                .setPrerequisites(prerequisites)
                .setFollowUps(followUps)
                .setHarderVersions(harderVersions)
                .setSimilarPatterns(similarPatterns);

        log.info("模式完整详情查询完成, id={}, prerequisites={}, followUps={}",
                plainId, prerequisites.size(), followUps.size());
        return ApiResponse.success(detail);
    }

    // ==================== 私有方法 ====================

    /**
     * 从边列表中提取指定类型的关联模式
     *
     * @param edges      该节点的所有边
     * @param nodeId     当前节点 ID
     * @param relType    边类型
     * @param asTarget   true=当前节点是 target（我是结果），false=当前节点是 source（我是出发点）
     */
    private List<PatternDetailDTO.RelatedPatternDTO> buildRelatedPatterns(
            List<GraphEdge> edges, String nodeId, RelationType relType, boolean asTarget) {

        List<String> relatedIds = edges.stream()
                .filter(e -> e.getRelationType() == relType)
                .map(e -> {
                    if (asTarget) {
                        // 前置：target=nodeId → 找 source（谁是我的前置）
                        return nodeId.equals(e.getTargetId()) ? e.getSourceId() : null;
                    } else {
                        // 进阶/困难：source=nodeId → 找 target（我能进阶到哪）
                        return nodeId.equals(e.getSourceId()) ? e.getTargetId() : null;
                    }
                })
                .filter(Objects::nonNull)
                .filter(rid -> rid.startsWith("pattern:"))
                .distinct()
                .collect(Collectors.toList());

        if (relatedIds.isEmpty()) return Collections.emptyList();

        // 批量查询节点信息
        Map<String, GraphNode> nodeMap = nodeRepo.findAllById(relatedIds).stream()
                .collect(Collectors.toMap(GraphNode::getId, n -> n));

        // 同时查对应的 AlgorithmPattern 获取分类
        List<String> prefixedIds = relatedIds; // 已经带 pattern: 前缀
        Map<String, AlgorithmPattern> patternMap = patternService.findByIds(prefixedIds).stream()
                .collect(Collectors.toMap(AlgorithmPattern::getId, p -> p));

        return relatedIds.stream().map(rid -> {
            GraphNode node = nodeMap.get(rid);
            AlgorithmPattern ap = patternMap.get(rid);  // 用带前缀 ID 查
            String pId = rid.replace("pattern:", "");
            return new PatternDetailDTO.RelatedPatternDTO()
                    .setId(pId)
                    .setName(node != null ? node.getName() : (ap != null ? ap.getName() : pId))
                    .setCategory(ap != null ? ap.getCategory() : "");
        }).collect(Collectors.toList());
    }

    private PatternDTO toDTO(AlgorithmPattern p) {
        return new PatternDTO()
                .setId(p.getId())
                .setName(p.getName())
                .setCategory(p.getCategory())
                .setTemplate(p.getTemplate())
                .setSignals(p.getSignals())
                .setVariants(p.getVariants())
                .setRelatedProblems(p.getRelatedProblems());
    }
}
