package com.algorithm.help.content.enrichment.pipeline;

import lombok.Data;
import lombok.experimental.Accessors;

/**
 * 管线整体执行结果
 */
@Data
@Accessors(chain = true)
public class EnrichmentPipelineResult {

    /** 是否成功 */
    private boolean success;

    /** 失败时的步骤名称 */
    private String failedStep;

    /** 失败时的错误信息 */
    private String error;

    /** 成功时的最终上下文（包含所有中间产物） */
    private EnrichmentContext context;

    /** 构造成功结果 */
    public static EnrichmentPipelineResult success(EnrichmentContext ctx) {
        return new EnrichmentPipelineResult()
                .setSuccess(true)
                .setContext(ctx);
    }

    /** 构造失败结果（核心步骤失败） */
    public static EnrichmentPipelineResult failed(String stepName, String error) {
        return new EnrichmentPipelineResult()
                .setSuccess(false)
                .setFailedStep(stepName)
                .setError(error);
    }
}
