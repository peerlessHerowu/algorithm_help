package com.algorithm.help.content.enrichment.pipeline.steps;

import com.algorithm.help.content.enrichment.EnrichedSolution;
import com.algorithm.help.content.enrichment.EnrichedSolutionRepository;
import com.algorithm.help.content.enrichment.EnrichedStatus;
import com.algorithm.help.content.enrichment.SourceType;
import com.algorithm.help.content.enrichment.pipeline.EnrichmentContext;
import com.algorithm.help.content.enrichment.pipeline.EnrichmentResult;
import com.algorithm.help.entity.Problem;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.Collections;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * DiversityCheckStep 单元测试
 */
class DiversityCheckStepTest {

    private EnrichedSolutionRepository enrichedRepo;
    private DiversityCheckStep step;

    @BeforeEach
    void setUp() {
        enrichedRepo = mock(EnrichedSolutionRepository.class);
        step = new DiversityCheckStep(enrichedRepo);
    }

    @Test
    @DisplayName("步骤名称为 diversity-check")
    void getName_returnsDiversityCheck() {
        assertEquals("diversity-check", step.getName());
    }

    @Test
    @DisplayName("非核心步骤")
    void isCritical_returnsFalse() {
        assertFalse(step.isCritical());
    }

    @Test
    @DisplayName("无题目时 isApplicable 返回 false")
    void isApplicable_noProblem_returnsFalse() {
        EnrichmentContext ctx = new EnrichmentContext()
                .setPolishedContent("some content");
        assertFalse(step.isApplicable(ctx));
    }

    @Test
    @DisplayName("无内容时 isApplicable 返回 false")
    void isApplicable_noContent_returnsFalse() {
        EnrichmentContext ctx = new EnrichmentContext()
                .setProblem(buildProblem());
        assertFalse(step.isApplicable(ctx));
    }

    @Test
    @DisplayName("有题目和内容时 isApplicable 返回 true")
    void isApplicable_hasProblemAndContent_returnsTrue() {
        EnrichmentContext ctx = buildContext("# Some Title\nSome content here");
        assertTrue(step.isApplicable(ctx));
    }

    @Test
    @DisplayName("无已有记录时直接通过")
    void process_noExistingRecords_passes() {
        EnrichmentContext ctx = buildContext("# Hash Table\nUse hash table to solve");
        when(enrichedRepo.findByProblemIdAndLevelAndStatusOrderBySortOrderAsc(
                anyString(), anyInt(), any(EnrichedStatus.class)))
                .thenReturn(Collections.emptyList());

        EnrichmentResult result = step.process(ctx);
        assertFalse(result.isFailed());
    }

    @Test
    @DisplayName("标题相似度过高时拒绝")
    void process_titleTooSimilar_rejects() {
        EnrichmentContext ctx = buildContext("# Hash Table Solution\nUse hash table");

        EnrichedSolution existing = buildExisting("Hash Table Solution", "Different content here");
        when(enrichedRepo.findByProblemIdAndLevelAndStatusOrderBySortOrderAsc(
                anyString(), anyInt(), any(EnrichedStatus.class)))
                .thenReturn(List.of(existing));

        EnrichmentResult result = step.process(ctx);
        assertTrue(result.isFailed());
        assertTrue(result.getError().contains("标题相似度过高"));
    }

    @Test
    @DisplayName("内容相似度过高时拒绝")
    void process_contentTooSimilar_rejects() {
        // 用完全一样的内容段落测试
        String content = "使用哈希表在一次遍历中找到两数之和等于目标值的配对 "
                + "首先创建一个空的哈希表然后遍历数组中的每个元素";
        EnrichmentContext ctx = buildContext("# Different Title\n" + content);

        EnrichedSolution existing = buildExisting("Another Title", content);
        when(enrichedRepo.findByProblemIdAndLevelAndStatusOrderBySortOrderAsc(
                anyString(), anyInt(), any(EnrichedStatus.class)))
                .thenReturn(List.of(existing));

        EnrichmentResult result = step.process(ctx);
        assertTrue(result.isFailed());
        assertTrue(result.getError().contains("核心思路相似度过高"));
    }

    @Test
    @DisplayName("标题和内容均有足够差异时通过")
    void process_sufficientDifference_passes() {
        EnrichmentContext ctx = buildContext(
                "# Two Pointer Approach\nUse two pointers from both ends to find pair");

        EnrichedSolution existing = buildExisting(
                "Hash Table Solution",
                "Use a hash map to store visited elements and check complement");
        when(enrichedRepo.findByProblemIdAndLevelAndStatusOrderBySortOrderAsc(
                anyString(), anyInt(), any(EnrichedStatus.class)))
                .thenReturn(List.of(existing));

        EnrichmentResult result = step.process(ctx);
        assertFalse(result.isFailed());
    }

    // ===== 辅助方法 =====

    private Problem buildProblem() {
        Problem p = new Problem();
        p.setId("two-sum");
        p.setTitle("Two Sum");
        return p;
    }

    private EnrichmentContext buildContext(String content) {
        return new EnrichmentContext()
                .setProblem(buildProblem())
                .setTargetLevel(3)
                .setPolishedContent(content);
    }

    private EnrichedSolution buildExisting(String title, String content) {
        return new EnrichedSolution()
                .setId("existing-1")
                .setProblemId("two-sum")
                .setLevel(3)
                .setTitle(title)
                .setContent(content)
                .setSourceType(SourceType.COMMUNITY)
                .setSourceAuthor("test")
                .setSourceUrl("https://leetcode.com/test")
                .setStatus(EnrichedStatus.PUBLISHED);
    }
}
