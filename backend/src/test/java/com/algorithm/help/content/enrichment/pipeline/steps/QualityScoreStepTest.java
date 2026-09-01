package com.algorithm.help.content.enrichment.pipeline.steps;

import com.algorithm.help.content.enrichment.EnrichedSolutionRepository;
import com.algorithm.help.content.enrichment.EnrichedStatus;
import com.algorithm.help.content.enrichment.pipeline.EnrichmentContext;
import com.algorithm.help.content.enrichment.pipeline.EnrichmentResult;
import com.algorithm.help.content.enrichment.util.BlacklistLoader;
import com.algorithm.help.entity.Problem;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.HashMap;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * QualityScoreStep 单元测试
 */
class QualityScoreStepTest {

    private BlacklistLoader blacklistLoader;
    private EnrichedSolutionRepository enrichedRepo;
    private QualityScoreStep step;

    @BeforeEach
    void setUp() {
        blacklistLoader = mock(BlacklistLoader.class);
        enrichedRepo = mock(EnrichedSolutionRepository.class);
        step = new QualityScoreStep(blacklistLoader, enrichedRepo);
    }

    @Test
    @DisplayName("步骤名称为 quality-score")
    void getName_returnsQualityScore() {
        assertEquals("quality-score", step.getName());
    }

    @Test
    @DisplayName("非核心步骤")
    void isCritical_returnsFalse() {
        assertFalse(step.isCritical());
    }

    @Test
    @DisplayName("无内容时 isApplicable 返回 false")
    void isApplicable_noContent_returnsFalse() {
        EnrichmentContext ctx = new EnrichmentContext().setTargetLevel(3);
        assertFalse(step.isApplicable(ctx));
    }

    @Test
    @DisplayName("有内容时 isApplicable 返回 true")
    void isApplicable_hasContent_returnsTrue() {
        EnrichmentContext ctx = new EnrichmentContext()
                .setPolishedContent("content")
                .setTargetLevel(3);
        assertTrue(step.isApplicable(ctx));
    }

    @Test
    @DisplayName("评分在 [0,1] 范围内")
    void process_scoreInRange() {
        EnrichmentContext ctx = buildRichContext(3);
        when(blacklistLoader.findBlacklistedWord(anyString())).thenReturn(null);
        when(enrichedRepo.countByProblemIdAndLevelAndStatus(anyString(), anyInt(), any()))
                .thenReturn(1L);

        EnrichmentResult result = step.process(ctx);

        assertFalse(result.isFailed());
        assertTrue(ctx.getQualityScore() >= 0f);
        assertTrue(ctx.getQualityScore() <= 1f);
    }

    @Test
    @DisplayName("L1 评分不含代码维度")
    void process_l1_noCodeDimension() {
        EnrichmentContext ctx = buildL1Context();
        when(blacklistLoader.findBlacklistedWord(anyString())).thenReturn(null);
        when(enrichedRepo.countByProblemIdAndLevelAndStatus(anyString(), anyInt(), any()))
                .thenReturn(0L);

        step.process(ctx);

        // L1 无代码也应有合理分数（结构+内容+无跳步+清晰度）
        assertTrue(ctx.getQualityScore() > 0f);
    }

    @Test
    @DisplayName("内容丰富时分数较高")
    void process_richContent_higherScore() {
        EnrichmentContext ctx = buildRichContext(3);
        when(blacklistLoader.findBlacklistedWord(anyString())).thenReturn(null);
        when(enrichedRepo.countByProblemIdAndLevelAndStatus(anyString(), anyInt(), any()))
                .thenReturn(1L);

        step.process(ctx);

        // 丰富内容应有较高分数
        assertTrue(ctx.getQualityScore() >= 0.5f);
    }

    @Test
    @DisplayName("自动审核：高分+无黑名单+非首次 → PUBLISHED")
    void process_autoReview_published() {
        EnrichmentContext ctx = buildRichContext(3);
        when(blacklistLoader.findBlacklistedWord(anyString())).thenReturn(null);
        // 非首次：已有 PUBLISHED 记录
        when(enrichedRepo.countByProblemIdAndLevelAndStatus(anyString(), anyInt(), eq(EnrichedStatus.PUBLISHED)))
                .thenReturn(2L);

        step.process(ctx);

        assertTrue(ctx.getWarnings().stream()
                .anyMatch(w -> w.contains("auto-review:PUBLISHED")));
    }

    @Test
    @DisplayName("自动审核：含黑名单词汇 → PENDING_REVIEW")
    void process_autoReview_blacklisted() {
        EnrichmentContext ctx = buildRichContext(3);
        when(blacklistLoader.findBlacklistedWord(anyString())).thenReturn("加微信");
        when(enrichedRepo.countByProblemIdAndLevelAndStatus(anyString(), anyInt(), any()))
                .thenReturn(2L);

        step.process(ctx);

        assertTrue(ctx.getWarnings().stream()
                .anyMatch(w -> w.contains("命中黑名单词汇")));
    }

    @Test
    @DisplayName("自动审核：首次生成 → PENDING_REVIEW")
    void process_autoReview_firstGeneration() {
        EnrichmentContext ctx = buildRichContext(3);
        when(blacklistLoader.findBlacklistedWord(anyString())).thenReturn(null);
        // 首次：无已有 PUBLISHED 记录
        when(enrichedRepo.countByProblemIdAndLevelAndStatus(anyString(), anyInt(), eq(EnrichedStatus.PUBLISHED)))
                .thenReturn(0L);

        step.process(ctx);

        assertTrue(ctx.getWarnings().stream()
                .anyMatch(w -> w.contains("auto-review:PENDING_REVIEW")));
    }

    // ===== 辅助方法 =====

    private EnrichmentContext buildRichContext(int level) {
        Map<String, String> codes = new HashMap<>();
        codes.put("python", "def two_sum(nums, target):\n    hash_map = {}\n    for i, num in enumerate(nums):\n        return [hash_map[target-num], i]");
        codes.put("java", "public int[] twoSum(int[] nums, int target) {\n    Map<Integer, Integer> map = new HashMap<>();\n    return new int[]{0,1};\n}");
        codes.put("go", "func twoSum(nums []int, target int) []int {\n    return []int{0, 1}\n}");

        Problem problem = new Problem();
        problem.setId("two-sum");
        problem.setTitle("Two Sum");

        String content = "## 哈希表解法\n\n"
                + "### 核心思路\n\n"
                + "首先，我们需要理解题目要求。因为暴力解法时间复杂度为 O(n^2)，\n"
                + "所以我们使用哈希表来优化。\n\n"
                + "1. 创建一个空的哈希表\n"
                + "2. 遍历数组中的每个元素\n"
                + "3. 检查 target - current 是否在哈希表中\n\n"
                + "### 示例\n\n"
                + "例如，nums = [2,7,11,15], target = 9\n\n"
                + "### 总结\n\n"
                + "这种方法的时间复杂度为 O(n)，空间复杂度为 O(n)。";

        return new EnrichmentContext()
                .setProblem(problem)
                .setTargetLevel(level)
                .setPolishedContent(content)
                .setCodeImplementations(codes)
                .setVisualization("graph TD\n  A-->B");
    }

    private EnrichmentContext buildL1Context() {
        Problem problem = new Problem();
        problem.setId("two-sum");
        problem.setTitle("Two Sum");

        String content = "## 直觉理解\n\n"
                + "简单来说，这道题就像在一堆数字中找到两个好朋友。\n\n"
                + "想象你在超市购物，预算是 target 元。\n"
                + "你每看一个商品就想：有没有另一个商品刚好和它凑成 target？\n\n"
                + "1. 首先看第一个数字\n"
                + "2. 然后记住它\n"
                + "3. 接下来每看到新数字就查查有没有配对\n\n"
                + "### 总结\n\n"
                + "本质上就是一个'配对查找'的问题。";

        return new EnrichmentContext()
                .setProblem(problem)
                .setTargetLevel(1)
                .setPolishedContent(content);
    }
}
