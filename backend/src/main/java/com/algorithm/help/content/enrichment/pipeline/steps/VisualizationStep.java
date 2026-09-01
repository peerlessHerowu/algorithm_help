package com.algorithm.help.content.enrichment.pipeline.steps;

import com.algorithm.help.content.enrichment.pipeline.EnrichmentContext;
import com.algorithm.help.content.enrichment.pipeline.EnrichmentResult;
import com.algorithm.help.content.enrichment.pipeline.EnrichmentStep;
import com.algorithm.help.entity.Problem;
import com.algorithm.help.service.DiagramService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

/**
 * 可视化步骤：为算法生成 Mermaid 图或 ASCII 图，辅助理解
 * <p>
 * 非核心步骤，失败时降级跳过（不生成图解）。
 * 复用已有 DiagramService 进行图表生成。
 */
@Slf4j
@Component
@Order(5)
@RequiredArgsConstructor
public class VisualizationStep implements EnrichmentStep {

    private final DiagramService diagramService;

    @Override
    public String getName() {
        return "visualization";
    }

    @Override
    public boolean isApplicable(EnrichmentContext ctx) {
        // 需要有题目信息才能生成图解
        return ctx.getProblem() != null;
    }

    @Override
    public EnrichmentResult process(EnrichmentContext ctx) {
        Problem problem = ctx.getProblem();
        log.info("可视化步骤开始：题目={}", problem.getTitle());

        String diagram = diagramService.generateForProblem(problem);

        if (diagram == null || diagram.isBlank()) {
            log.warn("可视化步骤：DiagramService 返回空内容");
            return EnrichmentResult.fail("图解生成结果为空");
        }

        ctx.setVisualization(diagram);
        log.info("可视化步骤完成：生成图解长度={}", diagram.length());
        return EnrichmentResult.ok();
    }

    @Override
    public boolean isCritical() {
        return false;
    }
}
