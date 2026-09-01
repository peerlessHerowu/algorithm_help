package com.algorithm.help.graph.service;

import com.algorithm.help.graph.dto.GraphDTO;
import com.algorithm.help.graph.dto.RecommendItem;
import com.algorithm.help.graph.entity.GraphEdge;
import com.algorithm.help.graph.entity.GraphNode;
import com.algorithm.help.graph.enums.NodeType;
import com.algorithm.help.graph.enums.RelationType;
import com.algorithm.help.graph.repository.GraphEdgeRepository;
import com.algorithm.help.graph.repository.GraphNodeRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.core.ValueOperations;

import java.util.Collections;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.when;

/**
 * GraphService 单元测试
 * <p>
 * 覆盖：子图查询、推荐下一题、最短路径
 */
@ExtendWith(MockitoExtension.class)
class GraphServiceTest {

    @Mock
    private GraphNodeRepository nodeRepo;
    @Mock
    private GraphEdgeRepository edgeRepo;
    @Mock
    private RedisTemplate<String, Object> redisTemplate;
    @Mock
    private ValueOperations<String, Object> valueOps;

    @InjectMocks
    private GraphService graphService;

    @BeforeEach
    void setUp() {
        lenient().when(redisTemplate.opsForValue()).thenReturn(valueOps);
        lenient().when(valueOps.get(anyString())).thenReturn(null);
    }

    // ==================== querySubgraph 测试 ====================

    @Test
    void querySubgraph_depth1_返回直接相邻节点和边() {
        // 准备：A --edge1--> B, A --edge2--> C
        GraphNode nodeA = buildNode("A", "节点A", NodeType.PATTERN);
        GraphNode nodeB = buildNode("B", "节点B", NodeType.PROBLEM);
        GraphNode nodeC = buildNode("C", "节点C", NodeType.PROBLEM);

        GraphEdge edgeAB = buildEdge("e1", "A", "B", RelationType.FOLLOW_UP, 0.8);
        GraphEdge edgeAC = buildEdge("e2", "A", "C", RelationType.SIMILAR_PATTERN, 0.6);

        // A 的出边
        when(edgeRepo.findBySourceIdIn(List.of("A"))).thenReturn(List.of(edgeAB, edgeAC));
        // A 的入边
        when(edgeRepo.findByTargetId("A")).thenReturn(Collections.emptyList());
        // 批量加载节点
        when(nodeRepo.findByIdIn(anyList())).thenReturn(List.of(nodeA, nodeB, nodeC));

        GraphDTO result = graphService.querySubgraph("A", 1);

        assertThat(result.getNodes()).hasSize(3);
        assertThat(result.getEdges()).hasSize(2);
        assertThat(result.getNodes()).extracting(GraphNode::getId)
                .containsExactlyInAnyOrder("A", "B", "C");
    }

    @Test
    void querySubgraph_depth2_扩展两层() {
        // 准备：A --> B --> D, A --> C（两层图）
        GraphEdge edgeAB = buildEdge("e1", "A", "B", RelationType.FOLLOW_UP, 0.8);
        GraphEdge edgeAC = buildEdge("e2", "A", "C", RelationType.VARIANT, 0.6);
        GraphEdge edgeBD = buildEdge("e3", "B", "D", RelationType.HARDER_VERSION, 0.9);

        // 使用 answer 统一处理所有 findBySourceIdIn 调用
        when(edgeRepo.findBySourceIdIn(anyList())).thenAnswer(invocation -> {
            List<String> ids = invocation.getArgument(0);
            if (ids.size() == 1 && ids.contains("A")) {
                return List.of(edgeAB, edgeAC);
            }
            if (ids.contains("B") || ids.contains("C")) {
                return List.of(edgeBD);
            }
            return Collections.emptyList();
        });
        when(edgeRepo.findByTargetId("A")).thenReturn(Collections.emptyList());
        when(edgeRepo.findByTargetId("B")).thenReturn(Collections.emptyList());
        when(edgeRepo.findByTargetId("C")).thenReturn(Collections.emptyList());

        // 批量加载节点（包含 A, B, C, D）
        when(nodeRepo.findByIdIn(anyList())).thenReturn(List.of(
                buildNode("A", "节点A", NodeType.PATTERN),
                buildNode("B", "节点B", NodeType.PROBLEM),
                buildNode("C", "节点C", NodeType.PROBLEM),
                buildNode("D", "节点D", NodeType.PROBLEM)
        ));

        GraphDTO result = graphService.querySubgraph("A", 2);

        assertThat(result.getNodes()).hasSize(4);
        assertThat(result.getNodes()).extracting(GraphNode::getId)
                .containsExactlyInAnyOrder("A", "B", "C", "D");
        assertThat(result.getEdges()).hasSizeGreaterThanOrEqualTo(3);
    }

    @Test
    void querySubgraph_超过maxDepth时截断() {
        // depth=10 超过 MAX_DEPTH=5，应截断为 5
        // 只准备 1 层数据，验证不会出错
        GraphEdge edgeAB = buildEdge("e1", "A", "B", RelationType.FOLLOW_UP, 0.8);

        when(edgeRepo.findBySourceIdIn(List.of("A"))).thenReturn(List.of(edgeAB));
        when(edgeRepo.findByTargetId("A")).thenReturn(Collections.emptyList());
        // 第二层无出边
        when(edgeRepo.findBySourceIdIn(List.of("B"))).thenReturn(Collections.emptyList());
        when(edgeRepo.findByTargetId("B")).thenReturn(Collections.emptyList());

        when(nodeRepo.findByIdIn(anyList())).thenReturn(List.of(
                buildNode("A", "节点A", NodeType.PATTERN),
                buildNode("B", "节点B", NodeType.PROBLEM)
        ));

        // 传入 depth=10，不应抛异常，内部截断为 5
        GraphDTO result = graphService.querySubgraph("A", 10);

        assertThat(result.getNodes()).hasSize(2);
        assertThat(result.getEdges()).hasSize(1);
    }

    @Test
    void querySubgraph_缓存命中时直接返回() {
        // 模拟缓存中已有结果
        GraphDTO cached = new GraphDTO(
                List.of(buildNode("X", "缓存节点", NodeType.PATTERN)),
                Collections.emptyList()
        );
        when(valueOps.get("graph:subgraph:X:2")).thenReturn(cached);

        GraphDTO result = graphService.querySubgraph("X", 2);

        assertThat(result).isSameAs(cached);
        assertThat(result.getNodes()).hasSize(1);
        assertThat(result.getNodes().get(0).getName()).isEqualTo("缓存节点");
    }

    // ==================== recommendNext 测试 ====================

    @Test
    void recommendNext_按权重降序返回Top5() {
        String problemId = "problem:two-sum";

        // 准备 6 条推荐边（应只返回 Top 5）
        List<GraphEdge> edges = List.of(
                buildEdge("e1", problemId, "p2", RelationType.SIMILAR_PATTERN, 0.5),
                buildEdge("e2", problemId, "p3", RelationType.FOLLOW_UP, 0.9),
                buildEdge("e3", problemId, "p4", RelationType.HARDER_VERSION, 0.7),
                buildEdge("e4", problemId, "p5", RelationType.VARIANT, 0.6),
                buildEdge("e5", problemId, "p6", RelationType.SIMILAR_PATTERN, 0.3),
                buildEdge("e6", problemId, "p7", RelationType.FOLLOW_UP, 0.8)
        );
        when(edgeRepo.findBySourceIdOrTargetId(problemId, problemId)).thenReturn(edges);

        // Mock 每个目标节点
        when(nodeRepo.findById("p2")).thenReturn(Optional.of(buildNode("p2", "题目2", NodeType.PROBLEM)));
        when(nodeRepo.findById("p3")).thenReturn(Optional.of(buildNode("p3", "题目3", NodeType.PROBLEM)));
        when(nodeRepo.findById("p4")).thenReturn(Optional.of(buildNode("p4", "题目4", NodeType.PROBLEM)));
        when(nodeRepo.findById("p5")).thenReturn(Optional.of(buildNode("p5", "题目5", NodeType.PROBLEM)));
        when(nodeRepo.findById("p6")).thenReturn(Optional.of(buildNode("p6", "题目6", NodeType.PROBLEM)));
        when(nodeRepo.findById("p7")).thenReturn(Optional.of(buildNode("p7", "题目7", NodeType.PROBLEM)));

        List<RecommendItem> result = graphService.recommendNext(problemId);

        // 只取 Top 5
        assertThat(result).hasSize(5);
        // 验证按分数降序：FOLLOW_UP(0.9*1.2=1.08) > FOLLOW_UP(0.8*1.2=0.96) > HARDER_VERSION(0.7*1.1=0.77)
        assertThat(result.get(0).getScore()).isGreaterThan(result.get(1).getScore());
        assertThat(result.get(1).getScore()).isGreaterThan(result.get(2).getScore());
    }

    @Test
    void recommendNext_无关联边时返回空列表() {
        String problemId = "problem:isolated";

        // 没有推荐类型的边（只有 PREREQUISITE 不在推荐范围内）
        GraphEdge prereqEdge = buildEdge("e1", problemId, "p2", RelationType.PREREQUISITE, 0.9);
        when(edgeRepo.findBySourceIdOrTargetId(problemId, problemId)).thenReturn(List.of(prereqEdge));

        List<RecommendItem> result = graphService.recommendNext(problemId);

        assertThat(result).isEmpty();
    }

    // ==================== shortestPath 测试 ====================

    @Test
    void shortestPath_直接相连节点返回两节点路径() {
        String fromId = "A";
        String toId = "B";

        // A --> B 直接相连
        GraphEdge edgeAB = buildEdge("e1", "A", "B", RelationType.FOLLOW_UP, 0.8);
        when(edgeRepo.findBySourceIdOrTargetId("A", "A")).thenReturn(List.of(edgeAB));

        // 加载节点（返回可变列表，因为 GraphService 内部会排序）
        GraphNode nodeA = buildNode("A", "节点A", NodeType.PATTERN);
        GraphNode nodeB = buildNode("B", "节点B", NodeType.PROBLEM);
        when(nodeRepo.findByIdIn(anyList())).thenReturn(new java.util.ArrayList<>(List.of(nodeA, nodeB)));

        List<GraphNode> result = graphService.shortestPath(fromId, toId);

        assertThat(result).hasSize(2);
        assertThat(result.get(0).getId()).isEqualTo("A");
        assertThat(result.get(1).getId()).isEqualTo("B");
    }

    @Test
    void shortestPath_不可达时返回空列表() {
        String fromId = "A";
        String toId = "Z";

        // A 只连接到 B，B 没有其他连接，Z 不可达
        GraphEdge edgeAB = buildEdge("e1", "A", "B", RelationType.FOLLOW_UP, 0.8);
        when(edgeRepo.findBySourceIdOrTargetId("A", "A")).thenReturn(List.of(edgeAB));
        when(edgeRepo.findBySourceIdOrTargetId("B", "B")).thenReturn(Collections.emptyList());

        List<GraphNode> result = graphService.shortestPath(fromId, toId);

        assertThat(result).isEmpty();
    }

    @Test
    void shortestPath_相同节点返回单元素路径() {
        String nodeId = "A";

        GraphNode nodeA = buildNode("A", "节点A", NodeType.PATTERN);
        when(nodeRepo.findByIdIn(anyList())).thenReturn(new java.util.ArrayList<>(List.of(nodeA)));

        List<GraphNode> result = graphService.shortestPath(nodeId, nodeId);

        assertThat(result).hasSize(1);
        assertThat(result.get(0).getId()).isEqualTo("A");
    }

    // ==================== 辅助方法 ====================

    private GraphNode buildNode(String id, String name, NodeType type) {
        return new GraphNode()
                .setId(id)
                .setName(name)
                .setType(type)
                .setCategory("测试分类")
                .setDifficulty(3);
    }

    private GraphEdge buildEdge(String id, String sourceId, String targetId,
                                RelationType relationType, double weight) {
        return new GraphEdge()
                .setId(id)
                .setSourceId(sourceId)
                .setTargetId(targetId)
                .setRelationType(relationType)
                .setWeight(weight)
                .setDescription(relationType.getDescription());
    }
}
