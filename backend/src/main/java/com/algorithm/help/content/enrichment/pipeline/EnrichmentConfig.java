package com.algorithm.help.content.enrichment.pipeline;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

import java.util.HashMap;
import java.util.Map;

/**
 * 管线配置类，从 application.yml 的 content.enrichment 前缀读取
 */
@Data
@Component
@ConfigurationProperties(prefix = "content.enrichment")
public class EnrichmentConfig {

    /** 管线总开关 */
    private boolean enabled = true;

    /** 各步骤独立配置，key 为步骤名称 */
    private Map<String, StepConfig> steps = new HashMap<>();

    /** 管线整体超时（秒） */
    private int timeout = 180;

    /** 最大重试次数 */
    private int maxRetries = 2;

    /**
     * 判断某个步骤是否启用
     * <p>
     * 若步骤未在配置中出现，默认视为启用
     */
    public boolean isStepEnabled(String stepName) {
        if (!enabled) {
            return false;
        }
        StepConfig stepConfig = steps.get(stepName);
        return stepConfig == null || stepConfig.isEnabled();
    }

    /**
     * 单个步骤的配置
     */
    @Data
    public static class StepConfig {

        /** 步骤开关 */
        private boolean enabled = true;
    }
}
