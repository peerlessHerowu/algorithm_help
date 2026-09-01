package com.algorithm.help.content.enrichment.pipeline;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

/**
 * EnrichmentConfig 单元测试
 */
class EnrichmentConfigTest {

    @Test
    @DisplayName("管线总开关关闭时所有步骤禁用")
    void pipelineDisabled_allStepsDisabled() {
        EnrichmentConfig config = new EnrichmentConfig();
        config.setEnabled(false);

        assertFalse(config.isStepEnabled("any-step"));
    }

    @Test
    @DisplayName("未配置的步骤默认启用")
    void unconfiguredStep_defaultEnabled() {
        EnrichmentConfig config = new EnrichmentConfig();
        config.setEnabled(true);

        assertTrue(config.isStepEnabled("unknown-step"));
    }

    @Test
    @DisplayName("显式禁用的步骤返回 false")
    void explicitlyDisabledStep_returnsFalse() {
        EnrichmentConfig config = new EnrichmentConfig();
        config.setEnabled(true);

        EnrichmentConfig.StepConfig stepConfig = new EnrichmentConfig.StepConfig();
        stepConfig.setEnabled(false);
        config.getSteps().put("polish", stepConfig);

        assertFalse(config.isStepEnabled("polish"));
    }

    @Test
    @DisplayName("显式启用的步骤返回 true")
    void explicitlyEnabledStep_returnsTrue() {
        EnrichmentConfig config = new EnrichmentConfig();
        config.setEnabled(true);

        EnrichmentConfig.StepConfig stepConfig = new EnrichmentConfig.StepConfig();
        stepConfig.setEnabled(true);
        config.getSteps().put("error-check", stepConfig);

        assertTrue(config.isStepEnabled("error-check"));
    }

    @Test
    @DisplayName("默认配置值正确")
    void defaultValues_correct() {
        EnrichmentConfig config = new EnrichmentConfig();

        assertTrue(config.isEnabled());
        assertEquals(180, config.getTimeout());
        assertEquals(2, config.getMaxRetries());
        assertTrue(config.getSteps().isEmpty());
    }
}
