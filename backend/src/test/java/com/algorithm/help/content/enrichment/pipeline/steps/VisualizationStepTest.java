package com.algorithm.help.content.enrichment.pipeline.steps;

import com.algorithm.help.content.enrichment.pipeline.EnrichmentContext;
import com.algorithm.help.content.enrichment.pipeline.EnrichmentResult;
import com.algorithm.help.entity.Problem;
import com.algorithm.help.service.DiagramService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/**
 * VisualizationStep 单元测试
 */
class VisualizationStepTest {

    private DiagramService diagramService;
    private VisualizationStep step;

    @BeforeEach
    void setUp() {
        diagramService = mock(DiagramService.class);
        step = new VisualizationStep(diagramService);
    }

    @Test
    @DisplayName("步骤名称为 visualization")
    void getName_returnsVisualization() {
        assertEquals("visualization", step.getName());
    }

    @Test
    @DisplayName("非核心步骤")
    void isCritical_returnsFalse() {
        assertFalse(step.isCritical());
    }

    @Test
    @DisplayName("无题目信息时 isApplicable 返回 false")
    void isApplicable_noProblem_returnsFalse() {
        EnrichmentContext ctx = new EnrichmentContext().setTargetLevel(3);
        assertFalse(step.isApplicable(ctx));
    }

    @Test
    @DisplayName("有题目信息时 isApplicable 返回 true")
    void isApplicable_hasProblem_returnsTrue() {
        EnrichmentContext ctx = buildContext();
        assertTrue(step.isApplicable(ctx));
    }

    @Test
    @DisplayName("DiagramService 返回内容时设置 visualization 并返回成功")
    void process_diagramGenerated_setsVisualization() {
        EnrichmentContext ctx = buildContext();
        String mermaidCode = "graph TD\n  A-->B\n  B-->C";

        when(diagramService.generateForProblem(any(Problem.class)))
                .thenReturn(mermaidCode);

        EnrichmentResult result = step.process(ctx);

        assertFalse(result.isFailed());
        assertEquals(mermaidCode, ctx.getVisualization());
    }

    @Test
    @DisplayName("DiagramService 返回空内容时返回失败")
    void process_emptyDiagram_returnsFail() {
        EnrichmentContext ctx = buildContext();

        when(diagramService.generateForProblem(any(Problem.class)))
                .thenReturn("");

        EnrichmentResult result = step.process(ctx);

        assertTrue(result.isFailed());
        assertEquals("图解生成结果为空", result.getError());
        assertNull(ctx.getVisualization());
    }

    @Test
    @DisplayName("DiagramService 返回 null 时返回失败")
    void process_nullDiagram_returnsFail() {
        EnrichmentContext ctx = buildContext();

        when(diagramService.generateForProblem(any(Problem.class)))
                .thenReturn(null);

        EnrichmentResult result = step.process(ctx);

        assertTrue(result.isFailed());
        assertNull(ctx.getVisualization());
    }

    // ===== 辅助方法 =====

    private EnrichmentContext buildContext() {
        Problem problem = new Problem();
        problem.setId("two-sum");
        problem.setTitle("Two Sum");
        problem.setTags("[\"hash-table\"]");

        return new EnrichmentContext()
                .setProblem(problem)
                .setTargetLevel(3);
    }
}
