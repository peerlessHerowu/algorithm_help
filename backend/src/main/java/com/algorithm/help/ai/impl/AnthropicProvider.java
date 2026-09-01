package com.algorithm.help.ai.impl;

import com.algorithm.help.ai.AIProvider;
import com.algorithm.help.ai.model.AiResponse;
import com.algorithm.help.ai.model.ChatMessage;
import com.algorithm.help.ai.model.GenerateOptions;
import com.algorithm.help.common.exception.AiProviderException;
import com.algorithm.help.config.AiProviderConfig;
import com.algorithm.help.entity.Problem;
import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;

import java.time.Duration;
import java.util.List;
import java.util.Map;

/**
 * Anthropic Provider，通过 WebClient 调用 Anthropic Messages API
 */
@Slf4j
@Component
public class AnthropicProvider implements AIProvider {

    private static final String API_BASE_URL = "https://api.anthropic.com";

    private final WebClient webClient;
    private final AiProviderConfig.AnthropicConfig config;

    public AnthropicProvider(AiProviderConfig aiProviderConfig) {
        this.config = aiProviderConfig.getAnthropic();
        this.webClient = WebClient.builder()
            .baseUrl(API_BASE_URL)
            .build();
    }

    @PostConstruct
    public void init() {
        if (config.getApiKey() == null || config.getApiKey().isBlank()) {
            log.warn("Anthropic API Key 未配置，该 Provider 将不可用");
        }
    }

    @Override
    public AiResponse generateExplanation(Problem problem, GenerateOptions options) {
        String prompt = "请用 Level " + options.getLevel() + " 的深度解释算法题:\n"
            + "标题: " + problem.getTitle() + "\n描述: " + problem.getDescription();
        return chat(prompt);
    }

    @Override
    public AiResponse transformUserInput(String userInput, Problem problem) {
        String prompt = "将用户思路转化为结构化答案。\n题目: " + problem.getTitle()
            + "\n用户输入: " + userInput;
        return chat(prompt);
    }

    @Override
    public String generateDiagram(String algorithmType, String diagramType, String inputData) {
        String prompt = "生成 Mermaid 图表代码。\n算法类型: " + algorithmType
            + "\n图表类型: " + diagramType + "\n输入数据: " + inputData;
        return chat(prompt).getContent();
    }

    @Override
    public AiResponse interactiveChat(List<ChatMessage> context, String message) {
        List<Map<String, String>> messages = new java.util.ArrayList<>(
            context.stream()
                .map(m -> Map.of("role", m.getRole(), "content", m.getContent()))
                .toList()
        );
        messages.add(Map.of("role", "user", "content", message));
        return callApi(messages);
    }

    @Override
    public AiResponse detectErrors(String content) {
        String prompt = "检测以下内容中的错误并给出修正建议:\n" + content;
        return chat(prompt);
    }

    @Override
    public AiResponse generateLeveledExplanation(String topic, int level) {
        String prompt = "请用 Level " + level + " 的深度解释: " + topic;
        return chat(prompt);
    }

    @Override
    public boolean isAvailable() {
        return config.getApiKey() != null && !config.getApiKey().isBlank();
    }

    @Override
    public String getName() {
        return "anthropic";
    }

    /** 单轮对话快捷方法 */
    private AiResponse chat(String prompt) {
        checkApiKey();
        List<Map<String, String>> messages = List.of(
            Map.of("role", "user", "content", prompt)
        );
        return callApi(messages);
    }

    /** 检查 API Key 是否已配置 */
    private void checkApiKey() {
        if (config.getApiKey() == null || config.getApiKey().isBlank()) {
            throw new AiProviderException("Anthropic API Key 未配置");
        }
    }

    /** 调用 Anthropic /v1/messages 接口 */
    @SuppressWarnings("unchecked")
    private AiResponse callApi(List<Map<String, String>> messages) {
        checkApiKey();
        long start = System.currentTimeMillis();
        try {
            Map<String, Object> body = Map.of(
                "model", config.getModel(),
                "max_tokens", 4096,
                "messages", messages
            );
            Map<String, Object> response = webClient.post()
                .uri("/v1/messages")
                .contentType(MediaType.APPLICATION_JSON)
                .header("x-api-key", config.getApiKey())
                .header("anthropic-version", "2023-06-01")
                .bodyValue(body)
                .retrieve()
                .bodyToMono(Map.class)
                .block(Duration.ofMillis(config.getTimeout()));

            String content = extractContent(response);
            long duration = System.currentTimeMillis() - start;
            return AiResponse.of(content, getName(), duration);
        } catch (AiProviderException e) {
            throw e;
        } catch (Exception e) {
            throw new AiProviderException("Anthropic 调用失败: " + e.getMessage(), e);
        }
    }

    /** 从 Anthropic 响应中提取文本内容 */
    @SuppressWarnings("unchecked")
    private String extractContent(Map<String, Object> response) {
        if (response == null) return "";
        List<Map<String, Object>> contentBlocks = (List<Map<String, Object>>) response.get("content");
        if (contentBlocks == null || contentBlocks.isEmpty()) return "";
        return (String) contentBlocks.get(0).getOrDefault("text", "");
    }
}
