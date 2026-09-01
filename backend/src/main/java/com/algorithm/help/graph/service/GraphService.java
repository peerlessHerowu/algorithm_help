package com.algorithm.help.graph.service;

import com.algorithm.help.graph.dto.GraphDTO;
import com.algorithm.help.graph.dto.RecommendItem;
import com.algorithm.help.graph.entity.GraphEdge;
import com.algorithm.help.graph.entity.GraphNode;
import com.algorithm.help.graph.enums.RelationType;
import com.algorithm.help.graph.repository.GraphEdgeRepository;
import com.algorithm.help.graph.repository.GraphNodeRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;
import java.util.stream.Stream;

/**
 * 知识图谱核心查询服务
 * <p>
 * 提供子图查询、推荐下一题、最短路径等图谱拓扑分析能力
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class GraphService {

    private final GraphNodeRepository nodeRepo;
    private final GraphEdgeRepository edgeRepo;
    private final RedisTemplate<String, Object> redisTemplate;

    /** 子图缓存 TTL（小时） */
    private static final long SUBGRAPH_TTL_HOURS = 1;
    /** 路径缓存 TTL（分钟） */
    private static final long PATH_TTL_MINUTES = 30;
    /** 子图查询最大深度 */
    private static final int MAX_DEPTH = 5;
    /** 单次查询最大节点数 */
    private static final int MAX_NODES = 200;
    /** 推荐列表大小 */
    private static final int RECOMMEND_TOP_K = 5;

    private static final String SUBGRAPH_CACHE_KEY = "graph:subgraph:%s:%d";
    private static final String PATH_CACHE_KEY = "graph:path:%s:%s";

    // ==================== 子图查询 ====================

    /**
     * 查询以某节点为中心的子图（BFS 向外扩展 depth 层）
     *
     * @param nodeId 中心节点 ID
     * @param depth  扩展深度（最大 5）
     * @return 包含节点和边的子图 DTO
     */
    @SuppressWarnings("unchecked")
    public GraphDTO querySubgraph(String nodeId, int depth) {
        int safeDepth = Math.min(depth, MAX_DEPTH);
        String cacheKey = String.format(SUBGRAPH_CACHE_KEY, nodeId, safeDepth);

        // 检查缓存
        Object cached = redisTemplate.opsForValue().get(cacheKey);
        if (cached instanceof GraphDTO dto) {
            return dto;
        }

        // BFS 扩展
        GraphDTO result = bfsSubgraph(nodeId, safeDepth);

        // 写入缓存
        redisTemplate.opsForValue().set(cacheKey, result, SUBGRAPH_TTL_HOURS, TimeUnit.HOURS);
        return result;
    }

    /**
     * BFS 向外扩展收集节点和边
     */
    private GraphDTO bfsSubgraph(String startId, int depth) {
        Set<String> visitedNodes = new LinkedHashSet<>();
        Set<String> visitedEdges = new HashSet<>();
        Queue<String> queue = new LinkedList<>();

        queue.add(startId);
        visitedNodes.add(startId);

        List<GraphEdge> edges = new ArrayList<>();

        for (int d = 0; d < depth && !queue.isEmpty(); d++) {
            int layerSize = queue.size();
            List<String> layerIds = new ArrayList<>();
            for (int i = 0; i < layerSize; i++) {
                layerIds.add(queue.poll());
            }
            // 批量查询当前层所有节点的出边
            List<GraphEdge> layerEdges = collectLayerEdges(layerIds);
            for (GraphEdge edge : layerEdges) {
                if (visitedEdges.add(edge.getId())) {
                    edges.add(edge);
                }
                // 找到邻居节点
                String neighbor = getNeighbor(edge, layerIds);
                if (neighbor != null && !visitedNodes.contains(neighbor)) {
                    if (visitedNodes.size() >= MAX_NODES) break;
                    visitedNodes.add(neighbor);
                    queue.add(neighbor);
                }
            }
            if (visitedNodes.size() >= MAX_NODES) break;
        }

        // 批量加载节点
        List<GraphNode> nodes = nodeRepo.findByIdIn(new ArrayList<>(visitedNodes));
        return new GraphDTO(nodes, edges);
    }

    /**
     * 批量查询一层节点的所有关联边（出边 + 入边）
     */
    private List<GraphEdge> collectLayerEdges(List<String> nodeIds) {
        List<GraphEdge> outEdges = edgeRepo.findBySourceIdIn(nodeIds);
        // 入边也需要收集（无向遍历）
        List<GraphEdge> inEdges = new ArrayList<>();
        for (String id : nodeIds) {
            inEdges.addAll(edgeRepo.findByTargetId(id));
        }
        return Stream.concat(outEdges.stream(), inEdges.stream())
                .collect(Collectors.toList());
    }

    /**
     * 获取边的邻居节点（相对于当前层的节点）
     */
    private String getNeighbor(GraphEdge edge, List<String> currentLayerIds) {
        if (currentLayerIds.contains(edge.getSourceId())) {
            return edge.getTargetId();
        }
        if (currentLayerIds.contains(edge.getTargetId())) {
            return edge.getSourceId();
        }
        return null;
    }

    // ==================== 推荐下一题 ====================

    /**
     * "做了这题还应做"推荐：查找同模式/进阶/变体题目，按权重排序返回 Top 5
     *
     * @param problemId 当前题目节点 ID
     * @return Top 5 推荐列表
     */
    public List<RecommendItem> recommendNext(String problemId) {
        // 收集推荐关系类型的边
        List<GraphEdge> relatedEdges = findRecommendEdges(problemId);

        // 提取目标节点并构建推荐项
        List<RecommendItem> candidates = buildCandidates(relatedEdges, problemId);

        // 按分数降序排序，取 Top 5
        return candidates.stream()
                .sorted(Comparator.comparingDouble(RecommendItem::getScore).reversed())
                .limit(RECOMMEND_TOP_K)
                .collect(Collectors.toList());
    }

    /**
     * 查找与当前题目相关的推荐边（同模式/进阶/变体）
     */
    private List<GraphEdge> findRecommendEdges(String problemId) {
        Set<RelationType> recommendTypes = EnumSet.of(
                RelationType.SIMILAR_PATTERN,
                RelationType.FOLLOW_UP,
                RelationType.HARDER_VERSION,
                RelationType.VARIANT
        );

        List<GraphEdge> allEdges = edgeRepo.findBySourceIdOrTargetId(problemId, problemId);
        return allEdges.stream()
                .filter(e -> recommendTypes.contains(e.getRelationType()))
                .collect(Collectors.toList());
    }

    /**
     * 将推荐边转化为推荐项列表
     */
    private List<RecommendItem> buildCandidates(List<GraphEdge> edges, String currentId) {
        List<RecommendItem> items = new ArrayList<>();
        Set<String> seen = new HashSet<>();

        for (GraphEdge edge : edges) {
            String targetId = edge.getSourceId().equals(currentId)
                    ? edge.getTargetId() : edge.getSourceId();
            if (!seen.add(targetId)) continue;

            nodeRepo.findById(targetId).ifPresent(node -> {
                double score = calcRecommendScore(edge);
                String reason = buildReason(edge.getRelationType());
                items.add(new RecommendItem()
                        .setNodeId(node.getId())
                        .setNodeType(node.getType())
                        .setName(node.getName())
                        .setReason(reason)
                        .setScore(score)
                        .setPatternName(node.getCategory())
                        .setDifficulty(node.getDifficulty()));
            });
        }
        return items;
    }

    /**
     * 计算推荐分数：基于边权重和关系类型加权
     */
    private double calcRecommendScore(GraphEdge edge) {
        double baseWeight = edge.getWeight() != null ? edge.getWeight() : 0.5;
        double typeBonus = switch (edge.getRelationType()) {
            case FOLLOW_UP -> 1.2;
            case HARDER_VERSION -> 1.1;
            case SIMILAR_PATTERN -> 1.0;
            case VARIANT -> 0.9;
            default -> 0.5;
        };
        return baseWeight * typeBonus;
    }

    /**
     * 根据关系类型生成推荐理由
     */
    private String buildReason(RelationType type) {
        return switch (type) {
            case SIMILAR_PATTERN -> "同模式题目，巩固相同解题思路";
            case FOLLOW_UP -> "进阶题目，提升难度加深理解";
            case HARDER_VERSION -> "困难版本，挑战更复杂场景";
            case VARIANT -> "变体题目，拓展不同应用场景";
            default -> "相关推荐";
        };
    }

    // ==================== 最短路径 ====================

    /**
     * BFS 求两节点间最短路径，结果缓存到 Redis（TTL=30min）
     *
     * @param fromId 起始节点 ID
     * @param toId   目标节点 ID
     * @return 最短路径上的节点列表（含起止），不可达返回空列表
     */
    @SuppressWarnings("unchecked")
    public List<GraphNode> shortestPath(String fromId, String toId) {
        String cacheKey = String.format(PATH_CACHE_KEY, fromId, toId);

        // 检查缓存
        Object cached = redisTemplate.opsForValue().get(cacheKey);
        if (cached instanceof List<?> list) {
            return (List<GraphNode>) list;
        }

        // BFS 求最短路径
        List<String> pathIds = bfsShortestPath(fromId, toId);
        List<GraphNode> result = pathIds.isEmpty()
                ? Collections.emptyList()
                : nodeRepo.findByIdIn(pathIds);

        // 按路径顺序排序
        if (!result.isEmpty()) {
            Map<String, Integer> orderMap = new HashMap<>();
            for (int i = 0; i < pathIds.size(); i++) {
                orderMap.put(pathIds.get(i), i);
            }
            result.sort(Comparator.comparingInt(n -> orderMap.getOrDefault(n.getId(), 0)));
        }

        // 写入缓存
        redisTemplate.opsForValue().set(cacheKey, result, PATH_TTL_MINUTES, TimeUnit.MINUTES);
        return result;
    }

    /**
     * BFS 求最短路径，返回路径上的节点 ID 列表
     */
    private List<String> bfsShortestPath(String fromId, String toId) {
        if (fromId.equals(toId)) {
            return List.of(fromId);
        }

        Queue<String> queue = new LinkedList<>();
        Map<String, String> parent = new HashMap<>();
        Set<String> visited = new HashSet<>();

        queue.add(fromId);
        visited.add(fromId);
        parent.put(fromId, null);

        while (!queue.isEmpty()) {
            String current = queue.poll();
            List<GraphEdge> edges = edgeRepo.findBySourceIdOrTargetId(current, current);

            for (GraphEdge edge : edges) {
                String neighbor = edge.getSourceId().equals(current)
                        ? edge.getTargetId() : edge.getSourceId();
                if (visited.contains(neighbor)) continue;

                parent.put(neighbor, current);
                if (neighbor.equals(toId)) {
                    return reconstructPath(parent, toId);
                }
                visited.add(neighbor);
                queue.add(neighbor);
            }
        }
        // 不可达
        return Collections.emptyList();
    }

    /**
     * 从 parent map 回溯重建路径
     */
    private List<String> reconstructPath(Map<String, String> parent, String toId) {
        LinkedList<String> path = new LinkedList<>();
        String current = toId;
        while (current != null) {
            path.addFirst(current);
            current = parent.get(current);
        }
        return path;
    }
}
