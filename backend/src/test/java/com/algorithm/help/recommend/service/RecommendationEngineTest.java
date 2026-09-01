package com.algorithm.help.recommend.service;

import com.algorithm.help.graph.dto.RecommendItem;
import com.algorithm.help.graph.entity.GraphNode;
import com.algorithm.help.graph.entity.UserProgress;
import com.algorithm.help.graph.enums.CompletionStatus;
import com.algorithm.help.graph.enums.NodeType;
import com.algorithm.help.graph.repository.GraphNodeRepository;
import com.algorithm.help.graph.repository.GraphUserProgressRepository;
import com.algorithm.help.graph.service.GraphService;
import com.algorithm.help.recommend.dto.WeakPatternDTO;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.core.ValueOperations;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * RecommendationEngine 单元测试
 */
@ExtendWith(MockitoExtension.class)
class RecommendationEngineTest {

    @Mock
    private GraphService graphService;
    @Mock
    private GraphUserProgressRepository progressRepo;
    @Mock
    private GraphNodeRepository nodeRepo;
    @Mock
    private RedisTemplate<String, Object> redisTemplate;
    @Mock
    private ValueOperations<String, Object> valueOps;

    @InjectMocks
    private RecommendationEngine engine;

    @BeforeEach
    void setUp() {
        lenient().when(redisTemplate.opsForValue()).thenReturn(valueOps);
    }

    @Test
    void recommend_缓存命中时直接返回() {
        // 模拟 Redis 缓存命中
        List<RecommendItem> cached = List.of(
                new RecommendItem().setNodeId("p1").setName("Two Sum").setScore(1.0));
        when(valueOps.get("recommend:user1")).thenReturn(cached);

        List<RecommendItem> result = engine.recommend("user1");

        assertThat(result).hasSize(1);
        assertThat(result.get(0).getNodeId()).isEqualTo("p1");
    }

    @Test
    void recommend_排除已完成题目() {
        // 缓存未命中
        when(valueOps.get("recommend:user1")).thenReturn(null);

        // 用户已完成 problem-1
        UserProgress completed = new UserProgress()
                .setUserId("user1").setProblemId("problem-1")
                .setPatternId("pattern-dp").setStatus(CompletionStatus.COMPLETED)
                .setAttempts(5).setCorrectCount(4);
        when(progressRepo.findByUserId("user1")).thenReturn(List.of(completed));

        // GraphService 推荐了 problem-1（已完成）和 problem-2（未完成）
        when(graphService.recommendNext("problem-1")).thenReturn(List.of(
                new RecommendItem().setNodeId("problem-1").setName("已完成题").setScore(0.9)
                        .setNodeType(NodeType.PROBLEM).setReason("进阶"),
                new RecommendItem().setNodeId("problem-2").setName("新题").setScore(0.8)
                        .setNodeType(NodeType.PROBLEM).setReason("进阶")
        ));
        // 薄弱模式查询不返回结果（正确率 80% > 60%）
        when(nodeRepo.findById("pattern-dp")).thenReturn(
                Optional.of(new GraphNode().setId("pattern-dp").setName("动态规划")));

        List<RecommendItem> result = engine.recommend("user1");

        // 不应包含已完成的 problem-1
        assertThat(result).noneMatch(r -> r.getNodeId().equals("problem-1"));
        assertThat(result).anyMatch(r -> r.getNodeId().equals("problem-2"));
    }

    @Test
    void recommend_薄弱模式加成1point5x() {
        when(valueOps.get("recommend:user2")).thenReturn(null);

        // 用户有薄弱模式：正确率 40% < 60%
        UserProgress weakProgress = new UserProgress()
                .setUserId("user2").setProblemId("problem-3")
                .setPatternId("pattern-greedy").setStatus(CompletionStatus.IN_PROGRESS)
                .setAttempts(10).setCorrectCount(4);
        when(progressRepo.findByUserId("user2")).thenReturn(List.of(weakProgress));

        when(nodeRepo.findById("pattern-greedy")).thenReturn(
                Optional.of(new GraphNode().setId("pattern-greedy").setName("贪心")));

        // 薄弱模式推荐
        when(graphService.recommendNext("pattern-greedy")).thenReturn(List.of(
                new RecommendItem().setNodeId("problem-5").setName("贪心题")
                        .setNodeType(NodeType.PROBLEM).setScore(0.8).setReason("同模式")
        ));

        List<RecommendItem> result = engine.recommend("user2");

        // 薄弱模式加成：0.8 * 1.5 ≈ 1.2
        assertThat(result).anyMatch(r ->
                r.getNodeId().equals("problem-5") && Math.abs(r.getScore() - 1.2) < 0.001);
    }

    @Test
    void recommend_结果写入缓存() {
        when(valueOps.get("recommend:user3")).thenReturn(null);
        when(progressRepo.findByUserId("user3")).thenReturn(List.of());

        engine.recommend("user3");

        // 验证缓存写入被调用
        verify(valueOps).set(eq("recommend:user3"), any(), eq(6L), eq(java.util.concurrent.TimeUnit.HOURS));
    }

    @Test
    void identifyWeakPatterns_正确率低于60percent返回() {
        // 薄弱模式：正确率 30%
        UserProgress weak = new UserProgress()
                .setUserId("user1").setProblemId("p1")
                .setPatternId("pattern-dp").setStatus(CompletionStatus.IN_PROGRESS)
                .setAttempts(10).setCorrectCount(3);
        // 正常模式：正确率 90%
        UserProgress strong = new UserProgress()
                .setUserId("user1").setProblemId("p2")
                .setPatternId("pattern-two-pointer").setStatus(CompletionStatus.MASTERED)
                .setAttempts(10).setCorrectCount(9);
        when(progressRepo.findByUserId("user1")).thenReturn(List.of(weak, strong));
        when(nodeRepo.findById("pattern-dp")).thenReturn(
                Optional.of(new GraphNode().setId("pattern-dp").setName("动态规划")));

        List<WeakPatternDTO> result = engine.identifyWeakPatterns("user1");

        assertThat(result).hasSize(1);
        assertThat(result.get(0).getPatternId()).isEqualTo("pattern-dp");
        assertThat(result.get(0).getAccuracy()).isEqualTo(0.3);
        assertThat(result.get(0).getPatternName()).isEqualTo("动态规划");
    }

    @Test
    void identifyWeakPatterns_无尝试记录不算薄弱() {
        // attempts 为 0 不参与计算
        UserProgress noAttempt = new UserProgress()
                .setUserId("user1").setProblemId("p1")
                .setPatternId("pattern-dp").setStatus(CompletionStatus.NOT_STARTED)
                .setAttempts(0).setCorrectCount(0);
        when(progressRepo.findByUserId("user1")).thenReturn(List.of(noAttempt));

        List<WeakPatternDTO> result = engine.identifyWeakPatterns("user1");

        assertThat(result).isEmpty();
    }
}
