package com.algorithm.help.content.enrichment.pipeline;

import lombok.Getter;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.List;

/**
 * 管线编排器，按顺序执行所有已启用且适用的步骤
 * <p>
 * 步骤顺序：ErrorCheck → SourceFilter → Polish → MultiLang
 *          → Visualization → DiversityCheck → QualityScore
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class EnrichmentPipeline {

    @Getter
    private final List<EnrichmentStep> steps;
    private final EnrichmentConfig config;

    /**
     * 执行管线
     * <p>
     * 遍历所有步骤，跳过未启用和不适用的步骤。
     * 非核心步骤失败时降级跳过并记录警告；核心步骤失败则整体失败。
     */
    public EnrichmentPipelineResult execute(EnrichmentContext ctx) {
        log.info("开始执行 enrichment 管线, problemId={}, level={}",
                ctx.getProblem() != null ? ctx.getProblem().getId() : "null",
                ctx.getTargetLevel());

        for (EnrichmentStep step : steps) {
            if (!config.isStepEnabled(step.getName())) {
                log.debug("步骤 {} 已禁用，跳过", step.getName());
                continue;
            }
            if (!step.isApplicable(ctx)) {
                log.debug("步骤 {} 不适用于当前上下文，跳过", step.getName());
                continue;
            }

            log.info("执行步骤: {}", step.getName());
            EnrichmentResult result = executeStep(step, ctx);

            if (result.isFailed()) {
                if (step.isCritical()) {
                    log.error("核心步骤 {} 失败: {}", step.getName(), result.getError());
                    return EnrichmentPipelineResult.failed(step.getName(), result.getError());
                }
                // 非核心步骤降级跳过
                String warning = step.getName() + " 降级跳过: " + result.getError();
                ctx.getWarnings().add(warning);
                log.warn(warning);
            }
        }

        log.info("管线执行完成, warnings={}", ctx.getWarnings().size());
        return EnrichmentPipelineResult.success(ctx);
    }

    /**
     * 执行单个步骤，捕获未预期异常
     */
    private EnrichmentResult executeStep(EnrichmentStep step, EnrichmentContext ctx) {
        try {
            return step.process(ctx);
        } catch (Exception e) {
            log.error("步骤 {} 抛出异常: {}", step.getName(), e.getMessage(), e);
            return EnrichmentResult.fail(e.getMessage());
        }
    }
}
