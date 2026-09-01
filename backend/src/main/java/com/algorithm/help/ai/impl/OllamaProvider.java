package com.algorithm.help.ai.impl;

import com.algorithm.help.ai.AIProvider;
import com.algorithm.help.ai.model.AiResponse;
import com.algorithm.help.ai.model.ChatMessage;
import com.algorithm.help.ai.model.GenerateOptions;
import com.algorithm.help.common.exception.AiProviderException;
import com.algorithm.help.config.AiProviderConfig;
import com.algorithm.help.entity.Problem;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;

import java.time.Duration;
import java.util.List;
import java.util.Map;

/**
 * Ollama 本地模型 Provider，通过 HTTP 调用本地 Ollama 服务
 */
@Slf4j
@Component
public class OllamaProvider implements AIProvider {

    private final WebClient webClient;
    private final AiProviderConfig.OllamaConfig config;

    public OllamaProvider(AiProviderConfig aiProviderConfig) {
        this.config = aiProviderConfig.getOllama();
        this.webClient = WebClient.builder()
            .baseUrl("http://" + config.getHost() + ":11434")
            .build();
    }

    @Override
    public AiResponse generateExplanation(Problem problem, GenerateOptions options) {
        String prompt = buildExplanationPrompt(problem, options);
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
        List<Map<String, String>> messages = context.stream()
            .map(m -> Map.of("role", m.getRole(), "content", m.getContent()))
            .toList();
        var allMessages = new java.util.ArrayList<>(messages);
        allMessages.add(Map.of("role", "user", "content", message));
        return callChatApi(allMessages);
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
        try {
            webClient.get()
                .uri("/api/tags")
                .retrieve()
                .bodyToMono(String.class)
                .block(Duration.ofSeconds(3));
            return true;
        } catch (Exception e) {
            log.debug("Ollama 服务不可用: {}", e.getMessage());
            return false;
        }
    }

    @Override
    public String getName() {
        return "ollama";
    }

    /** 单轮对话快捷方法 */
    private AiResponse chat(String prompt) {
        List<Map<String, String>> messages = List.of(
            Map.of("role", "user", "content", prompt)
        );
        return callChatApi(messages);
    }

    /** 调用 Ollama /api/chat 接口 */
    @SuppressWarnings("unchecked")
    private AiResponse callChatApi(List<Map<String, String>> messages) {
        long start = System.currentTimeMillis();
        try {
            Map<String, Object> body = Map.of(
                "model", config.getModel(),
                "messages", messages,
                "stream", false
            );
            Map<String, Object> response = webClient.post()
                .uri("/api/chat")
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue(body)
                .retrieve()
                .bodyToMono(Map.class)
                .block(Duration.ofMillis(config.getTimeout()));

            String content = extractContent(response);
            long duration = System.currentTimeMillis() - start;
            return AiResponse.of(content, getName(), duration);
        } catch (Exception e) {
            throw new AiProviderException("Ollama 调用失败: " + e.getMessage(), e);
        }
    }

    /** 从响应中提取内容 */
    @SuppressWarnings("unchecked")
    private String extractContent(Map<String, Object> response) {
        if (response == null) return "";
        Map<String, Object> message = (Map<String, Object>) response.get("message");
        if (message == null) return "";
        return (String) message.getOrDefault("content", "");
    }

    private String buildExplanationPrompt(Problem problem, GenerateOptions options) {
        return "请用 Level " + options.getLevel() + " 的深度解释算法题:\n"
            + "标题: " + problem.getTitle() + "\n"
            + "描述: " + problem.getDescription();
    }
}
