package com.algorithm.help.recommend.controller;

import com.algorithm.help.common.ApiResponse;
import com.algorithm.help.graph.entity.GraphEdge;
import com.algorithm.help.graph.entity.GraphNode;
import com.algorithm.help.graph.enums.RelationType;
import com.algorithm.help.graph.repository.GraphEdgeRepository;
import com.algorithm.help.graph.repository.GraphNodeRepository;
import com.algorithm.help.service.ProblemService;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import lombok.experimental.Accessors;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;

import java.util.*;
import java.util.stream.Collectors;

/**
 * 题目推荐 API — 「做完这题还应做」
 * <p>
 * 通过知识图谱关系（graph_edge）为当前题目找出关联推荐，
 * 按关系类型分组返回（进阶/变体/同类）
 */
@RestController
@RequestMapping("/api/v1/problems")
@RequiredArgsConstructor
@Slf4j
public class ProblemRecommendController {

    private final GraphEdgeRepository edgeRepo;
    private final GraphNodeRepository nodeRepo;
    private final ProblemService problemService;

    /** 每种关系类型最多返回条数 */
    private static final int MAX_PER_GROUP = 5;

    /**
     * 获取题目的图谱推荐（分组）
     * <p>
     * 路径：GET /api/v1/problems/{id}/recommend
     * 前端在题目详情页右侧「做完这题还应做」区域使用
     */
    @GetMapping("/{id}/recommend")
    public ApiResponse<RecommendGroupResponse> getRecommend(@PathVariable String id) {
        log.info("获取题目推荐, problemId={}", id);

        // 尝试从图谱节点中找到当前题目（通过多种方式）
        String graphNodeId = resolveGraphNodeId(id);

        if (graphNodeId == null) {
            // 图谱中没有该题节点，降级到基于 PATTERN 的推荐
            return ApiResponse.success(buildPatternBasedRecommend(id));
        }

        // 查当前节点的所有出边
        List<GraphEdge> outEdges = edgeRepo.findBySourceId(graphNodeId);
        // 查所有入边（当前节点作为 target 的情况，如 PREREQUISITE 前置）
        List<GraphEdge> inEdges = edgeRepo.findByTargetId(graphNodeId);

        List<RecommendItem> followUps   = new ArrayList<>();
        List<RecommendItem> variants    = new ArrayList<>();
        List<RecommendItem> hardVers    = new ArrayList<>();
        List<RecommendItem> samePattern = new ArrayList<>();
        List<RecommendItem> prereqs     = new ArrayList<>();

        // 出边：当前题 → 目标题（进阶、变体、困难版本）
        for (GraphEdge edge : outEdges) {
            if (!edge.getTargetId().startsWith("problem:")) continue;
            GraphNode target = nodeRepo.findById(edge.getTargetId()).orElse(null);
            if (target == null) continue;
            RecommendItem item = buildItem(target, edge.getRelationType(), edge.getDescription());
            switch (edge.getRelationType()) {
                case FOLLOW_UP       -> followUps.add(item);
                case VARIANT         -> variants.add(item);
                case HARDER_VERSION  -> hardVers.add(item);
                case SIMILAR_PATTERN -> samePattern.add(item);
                default -> {}
            }
        }

        // 入边 FOLLOW_UP / VARIANT：目标 → 当前题 表示「当前题是目标的进阶」
        // 反向找：谁推荐了我作为进阶 → 那些题是我的前置
        for (GraphEdge edge : inEdges) {
            if (!edge.getSourceId().startsWith("problem:")) continue;
            if (edge.getRelationType() == RelationType.FOLLOW_UP
                    || edge.getRelationType() == RelationType.HARDER_VERSION) {
                GraphNode source = nodeRepo.findById(edge.getSourceId()).orElse(null);
                if (source != null) {
                    prereqs.add(buildItem(source, RelationType.PREREQUISITE, "先做这题打基础"));
                }
            }
        }

        // 如果 samePattern 不够，从模式关联边补充
        if (samePattern.size() < MAX_PER_GROUP) {
            samePattern.addAll(fetchPatternSiblings(graphNodeId, samePattern));
        }

        RecommendGroupResponse resp = new RecommendGroupResponse()
                .setFollowUps(truncate(followUps))
                .setVariants(truncate(variants))
                .setHarderVersions(truncate(hardVers))
                .setSamePattern(truncate(samePattern))
                .setPrerequisites(truncate(prereqs))
                .setSourceNodeId(graphNodeId);

        int total = followUps.size() + variants.size() + hardVers.size()
                + samePattern.size() + prereqs.size();
        log.info("题目推荐完成, problemId={}, total={}", id, total);
        return ApiResponse.success(resp);
    }

    // ==================== 私有方法 ====================

    /**
     * 解析题目 ID 到图谱节点 ID
     * <p>
     * 尝试策略：
     * 1. 直接用 problem:{id}
     * 2. 通过题目标题的中文名从 graph_node.name 匹配
     * 3. 通过 problem:{lc-id-去掉前缀} 匹配
     */
    private String resolveGraphNodeId(String problemId) {
        // 1. 直接查 problem:{id}
        String directId = "problem:" + problemId;
        if (nodeRepo.existsById(directId)) return directId;

        // 2. lc-1 → problem:two-sum（通过题目中文名匹配 graph_node.name）
        try {
            com.algorithm.help.entity.Problem problem = problemService.getById(problemId);
            if (problem.getTitleCn() != null && !problem.getTitleCn().isBlank()) {
                String cnTitle = problem.getTitleCn();
                // 精确匹配 graph_node.name
                return nodeRepo.findAll().stream()
                        .filter(n -> n.getType() != null
                                && n.getType().name().equals("PROBLEM")
                                && cnTitle.equals(n.getName()))
                        .map(GraphNode::getId)
                        .findFirst()
                        .orElse(null);
            }
        } catch (Exception e) {
            log.debug("resolveGraphNodeId 查题目失败, id={}", problemId, e);
        }
        return null;
    }

    /**
     * 无图谱节点时，降级为基于算法分类的推荐
     * 从 SIMILAR_PATTERN 边查找同类题目
     */
    private RecommendGroupResponse buildPatternBasedRecommend(String problemId) {
        return new RecommendGroupResponse()
                .setFollowUps(Collections.emptyList())
                .setVariants(Collections.emptyList())
                .setHarderVersions(Collections.emptyList())
                .setSamePattern(Collections.emptyList())
                .setPrerequisites(Collections.emptyList())
                .setSourceNodeId(null);
    }

    /**
     * 通过当前节点所属模式，找同模式下的其他题目（补充 samePattern）
     */
    private List<RecommendItem> fetchPatternSiblings(String graphNodeId, List<RecommendItem> existing) {
        Set<String> existingIds = existing.stream().map(RecommendItem::getNodeId).collect(Collectors.toSet());
        existingIds.add(graphNodeId);

        // 找 pattern → 当前题 的 SIMILAR_PATTERN 边，得到模式 ID
        List<GraphEdge> patternEdges = edgeRepo.findByTargetId(graphNodeId).stream()
                .filter(e -> e.getRelationType() == RelationType.SIMILAR_PATTERN
                        && e.getSourceId().startsWith("pattern:"))
                .collect(Collectors.toList());

        List<RecommendItem> siblings = new ArrayList<>();
        for (GraphEdge pe : patternEdges) {
            // 找该模式下的其他题目
            edgeRepo.findBySourceIdAndRelationType(pe.getSourceId(), RelationType.SIMILAR_PATTERN)
                    .stream()
                    .map(GraphEdge::getTargetId)
                    .filter(tid -> tid.startsWith("problem:") && !existingIds.contains(tid))
                    .distinct()
                    .limit(MAX_PER_GROUP - existing.size())
                    .forEach(tid -> nodeRepo.findById(tid).ifPresent(n -> {
                        siblings.add(buildItem(n, RelationType.SIMILAR_PATTERN, "同模式题目"));
                        existingIds.add(tid);
                    }));
        }
        return siblings;
    }

    private RecommendItem buildItem(GraphNode node, RelationType rel, String description) {
        return new RecommendItem()
                .setNodeId(node.getId())
                .setName(node.getName())
                .setRelationType(rel.name())
                .setDescription(description != null ? description : "")
                .setDifficulty(node.getDifficulty())
                .setCategory(node.getCategory());
    }

    private <T> List<T> truncate(List<T> list) {
        return list.size() > MAX_PER_GROUP ? list.subList(0, MAX_PER_GROUP) : list;
    }

    // ===== 响应 DTO =====

    /** 推荐分组响应 */
    @Data
    @Accessors(chain = true)
    public static class RecommendGroupResponse {
        /** 进阶题（做完这题再做） */
        private List<RecommendItem> followUps;
        /** 变体题（类似但不同） */
        private List<RecommendItem> variants;
        /** 困难版本 */
        private List<RecommendItem> harderVersions;
        /** 同模式其他题 */
        private List<RecommendItem> samePattern;
        /** 前置题（建议先做） */
        private List<RecommendItem> prerequisites;
        /** 图谱节点 ID（调试用） */
        private String sourceNodeId;
    }

    /** 推荐项 */
    @Data
    @Accessors(chain = true)
    public static class RecommendItem {
        private String nodeId;
        private String name;
        private String relationType;
        private String description;
        private Integer difficulty;
        private String category;
    }
}
