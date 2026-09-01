package com.algorithm.help.content.enrichment.pipeline;

import com.algorithm.help.entity.Problem;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

/**
 * EnrichmentPipeline 单元测试
 */
class EnrichmentPipelineTest {

    private EnrichmentConfig config;

    @BeforeEach
    void setUp() {
        config = new EnrichmentConfig();
        config.setEnabled(true);
    }

    @Test
    @DisplayName("所有步骤成功时管线返回成功")
    void allStepsSucceed_returnsSuccess() {
        List<EnrichmentStep> steps = List.of(
                createStep("step-a", true, false, EnrichmentResult.ok()),
                createStep("step-b", true, false, EnrichmentResult.ok())
        );
        EnrichmentPipeline pipeline = new EnrichmentPipeline(steps, config);
        EnrichmentContext ctx = buildContext();

        EnrichmentPipelineResult result = pipeline.execute(ctx);

        assertTrue(result.isSuccess());
        assertNotNull(result.getContext());
        assertTrue(result.getContext().getWarnings().isEmpty());
    }

    @Test
    @DisplayName("非核心步骤失败时降级跳过并记录警告")
    void nonCriticalStepFails_degradesWithWarning() {
        List<EnrichmentStep> steps = List.of(
                createStep("error-check", true, false, EnrichmentResult.fail("AI 超时")),
                createStep("polish", true, false, EnrichmentResult.ok())
        );
        EnrichmentPipeline pipeline = new EnrichmentPipeline(steps, config);
        EnrichmentContext ctx = buildContext();

        EnrichmentPipelineResult result = pipeline.execute(ctx);

        assertTrue(result.isSuccess());
        assertEquals(1, result.getContext().getWarnings().size());
        assertTrue(result.getContext().getWarnings().get(0).contains("error-check"));
        assertTrue(result.getContext().getWarnings().get(0).contains("降级跳过"));
    }

    @Test
    @DisplayName("核心步骤失败时管线整体失败")
    void criticalStepFails_pipelineFails() {
        List<EnrichmentStep> steps = List.of(
                createStep("source-filter", true, true, EnrichmentResult.fail("无可用题解")),
                createStep("polish", true, false, EnrichmentResult.ok())
        );
        EnrichmentPipeline pipeline = new EnrichmentPipeline(steps, config);
        EnrichmentContext ctx = buildContext();

        EnrichmentPipelineResult result = pipeline.execute(ctx);

        assertFalse(result.isSuccess());
        assertEquals("source-filter", result.getFailedStep());
        assertEquals("无可用题解", result.getError());
    }

    @Test
    @DisplayName("步骤被配置禁用时跳过")
    void disabledStep_skipped() {
        // 禁用 step-a
        EnrichmentConfig.StepConfig stepConfig = new EnrichmentConfig.StepConfig();
        stepConfig.setEnabled(false);
        config.getSteps().put("step-a", stepConfig);

        List<EnrichmentStep> steps = List.of(
                createStep("step-a", true, true, EnrichmentResult.fail("不该执行")),
                createStep("step-b", true, false, EnrichmentResult.ok())
        );
        EnrichmentPipeline pipeline = new EnrichmentPipeline(steps, config);
        EnrichmentContext ctx = buildContext();

        EnrichmentPipelineResult result = pipeline.execute(ctx);

        assertTrue(result.isSuccess());
    }

    @Test
    @DisplayName("步骤 isApplicable 返回 false 时跳过")
    void stepNotApplicable_skipped() {
        List<EnrichmentStep> steps = List.of(
                createStep("multi-lang", false, false, EnrichmentResult.fail("不该执行")),
                createStep("polish", true, false, EnrichmentResult.ok())
        );
        EnrichmentPipeline pipeline = new EnrichmentPipeline(steps, config);
        EnrichmentContext ctx = buildContext();

        EnrichmentPipelineResult result = pipeline.execute(ctx);

        assertTrue(result.isSuccess());
        assertTrue(result.getContext().getWarnings().isEmpty());
    }

    @Test
    @DisplayName("管线总开关关闭时所有步骤被跳过")
    void pipelineDisabled_allStepsSkipped() {
        config.setEnabled(false);

        List<EnrichmentStep> steps = List.of(
                createStep("step-a", true, true, EnrichmentResult.fail("不该执行"))
        );
        EnrichmentPipeline pipeline = new EnrichmentPipeline(steps, config);
        EnrichmentContext ctx = buildContext();

        EnrichmentPipelineResult result = pipeline.execute(ctx);

        assertTrue(result.isSuccess());
    }

    @Test
    @DisplayName("步骤抛出异常时被捕获并视为失败")
    void stepThrowsException_caughtAsFailed() {
        EnrichmentStep throwingStep = new EnrichmentStep() {
            @Override
            public String getName() { return "throwing-step"; }
            @Override
            public boolean isApplicable(EnrichmentContext ctx) { return true; }
            @Override
            public EnrichmentResult process(EnrichmentContext ctx) {
                throw new RuntimeException("NPE");
            }
            @Override
            public boolean isCritical() { return false; }
        };

        List<EnrichmentStep> steps = List.of(throwingStep);
        EnrichmentPipeline pipeline = new EnrichmentPipeline(steps, config);
        EnrichmentContext ctx = buildContext();

        EnrichmentPipelineResult result = pipeline.execute(ctx);

        assertTrue(result.isSuccess());
        assertEquals(1, result.getContext().getWarnings().size());
        assertTrue(result.getContext().getWarnings().get(0).contains("NPE"));
    }

    @Test
    @DisplayName("核心步骤抛出异常时管线整体失败")
    void criticalStepThrowsException_pipelineFails() {
        EnrichmentStep throwingStep = new EnrichmentStep() {
            @Override
            public String getName() { return "critical-step"; }
            @Override
            public boolean isApplicable(EnrichmentContext ctx) { return true; }
            @Override
            public EnrichmentResult process(EnrichmentContext ctx) {
                throw new RuntimeException("DB 连接失败");
            }
            @Override
            public boolean isCritical() { return true; }
        };

        List<EnrichmentStep> steps = List.of(throwingStep);
        EnrichmentPipeline pipeline = new EnrichmentPipeline(steps, config);
        EnrichmentContext ctx = buildContext();

        EnrichmentPipelineResult result = pipeline.execute(ctx);

        assertFalse(result.isSuccess());
        assertEquals("critical-step", result.getFailedStep());
    }

    // ===== 辅助方法 =====

    private EnrichmentContext buildContext() {
        Problem problem = new Problem();
        problem.setId("two-sum");
        problem.setTitle("Two Sum");

        return new EnrichmentContext()
                .setProblem(problem)
                .setSources(new ArrayList<>())
                .setTargetLevel(3)
                .setConfig(config);
    }

    private EnrichmentStep createStep(String name, boolean applicable, boolean critical, EnrichmentResult result) {
        return new EnrichmentStep() {
            @Override
            public String getName() { return name; }
            @Override
            public boolean isApplicable(EnrichmentContext ctx) { return applicable; }
            @Override
            public EnrichmentResult process(EnrichmentContext ctx) { return result; }
            @Override
            public boolean isCritical() { return critical; }
        };
    }
}
