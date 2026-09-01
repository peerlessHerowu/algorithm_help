package com.algorithm.help.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

import java.util.List;

/**
 * AI Provider 配置类，绑定 application.yml 中 ai.* 配置项
 */
@Configuration
@ConfigurationProperties(prefix = "ai")
@Data
public class AiProviderConfig {

    /** 默认使用的 AI 提供者 */
    private String defaultProvider;

    /** 提供者优先级列表 */
    private List<String> providerPriority;

    /** 生成默认参数 */
    private GenerationDefaults generation;

    /** Ollama 配置 */
    private OllamaConfig ollama;

    /** OpenAI 配置 */
    private OpenaiConfig openai;

    /** Anthropic 配置 */
    private AnthropicConfig anthropic;

    /**
     * 生成默认参数配置
     */
    @Data
    public static class GenerationDefaults {
        /** 默认解释层级 */
        private int defaultLevel = 3;

        /** 默认生成语言列表 */
        private List<String> defaultLanguages;

        /** 是否包含图表 */
        private boolean includeDiagrams = true;
    }

    /**
     * Ollama 本地模型配置
     */
    @Data
    public static class OllamaConfig {
        /** Ollama 服务地址 */
        private String host;

        /** 模型名称 */
        private String model;

        /** 超时时间（毫秒） */
        private int timeout;
    }


    /**
     * OpenAI 配置
     */
    @Data
    public static class OpenaiConfig {
        /** API 密钥 */
        private String apiKey;

        /** 基础 URL */
        private String baseUrl;

        /** 模型名称 */
        private String model;

        /** 超时时间（毫秒） */
        private int timeout;
    }

    /**
     * Anthropic 配置
     */
    @Data
    public static class AnthropicConfig {
        /** API 密钥 */
        private String apiKey;

        /** 模型名称 */
        private String model;

        /** 超时时间（毫秒） */
        private int timeout;
    }
}
