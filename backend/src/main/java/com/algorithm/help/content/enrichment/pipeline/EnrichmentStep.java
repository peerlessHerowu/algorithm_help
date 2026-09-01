package com.algorithm.help.content.enrichment.pipeline;

/**
 * 管线步骤接口，所有可插拔步骤实现此接口
 */
public interface EnrichmentStep {

    /** 步骤名称（用于配置开关和进度展示） */
    String getName();

    /** 判断该步骤是否适用于当前上下文 */
    boolean isApplicable(EnrichmentContext ctx);

    /** 执行处理逻辑 */
    EnrichmentResult process(EnrichmentContext ctx);

    /** 是否为核心步骤（核心步骤失败则整体失败） */
    default boolean isCritical() {
        return false;
    }
}
