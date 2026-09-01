package com.algorithm.help.content.relation;

import com.algorithm.help.ai.SmartRouter;
import com.algorithm.help.ai.model.AiRequest;
import com.algorithm.help.ai.model.AiResponse;
import com.algorithm.help.content.prompt.PromptTemplateEngine;
import com.algorithm.help.entity.Problem;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import lombok.experimental.Accessors;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.Collections;
import java.util.List;
import java.util.Map;

/**
 * 关联关系提取器
 * <p>
 * 从 AI 生成的解析内容中提取关联题目 ID 和模式标签。
 * AI 调用失败时降级返回空列表，不抛异常。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class RelationExtractor {

    private static final String TEMPLATE_PATH = "relation/extract-relations.md";

    private final PromptTemplateEngine templateEngine;
    private final SmartRouter smartRouter;
    private final ObjectMapper objectMapper;

    /**
     * 从生成的解析内容中提取关联题目 ID 和模式标签
     *
     * @param problem     当前题目
     * @param explanation 解析内容文本
     * @return 提取的关联关系列表，失败时返回空列表
     */
    public List<ExtractedRelation> extractRelations(Problem problem, String explanation) {
        try {
            String prompt = buildPrompt(problem, explanation);
            AiResponse response = callAi(prompt);
            return parseResponse(response.getContent());
        } catch (Exception e) {
            log.warn("关联关系提取失败，降级返回空列表: problemId={}, error={}",
                    problem.getId(), e.getMessage());
            return Collections.emptyList();
        }
    }

    /**
     * 构建 Prompt：渲染模板并填充变量
     */
    private String buildPrompt(Problem problem, String explanation) {
        Map<String, String> variables = Map.of(
                "problemId", problem.getId(),
                "title", problem.getTitle(),
                "difficulty", problem.getDifficulty().name(),
                "tags", problem.getTags() != null ? problem.getTags() : "[]",
                "explanation", explanation
        );
        return templateEngine.render(TEMPLATE_PATH, variables);
    }

    /**
     * 调用 AI 路由器获取关联关系分析结果
     */
    private AiResponse callAi(String prompt) {
        AiRequest request = new AiRequest()
                .setType(AiRequest.RequestType.CHAT)
                .setContent(prompt);
        return smartRouter.route(request);
    }

    /**
     * 解析 AI 返回的 JSON 响应
     */
    private List<ExtractedRelation> parseResponse(String content) {
        try {
            // 提取 JSON 部分（兼容 markdown 代码块包裹）
            String json = extractJson(content);
            JsonNode root = objectMapper.readTree(json);
            JsonNode relations = root.get("relations");
            if (relations == null || !relations.isArray()) {
                return Collections.emptyList();
            }
            return objectMapper.convertValue(relations,
                    new TypeReference<List<ExtractedRelation>>() {});
        } catch (Exception e) {
            log.warn("AI 响应 JSON 解析失败: {}", e.getMessage());
            return Collections.emptyList();
        }
    }

    /**
     * 从可能带有 markdown 代码块的内容中提取纯 JSON
     */
    private String extractJson(String content) {
        String trimmed = content.trim();
        // 处理 ```json ... ``` 包裹
        if (trimmed.startsWith("```")) {
            int start = trimmed.indexOf('\n');
            int end = trimmed.lastIndexOf("```");
            if (start > 0 && end > start) {
                return trimmed.substring(start + 1, end).trim();
            }
        }
        // 处理 { 开头的纯 JSON
        int braceStart = trimmed.indexOf('{');
        int braceEnd = trimmed.lastIndexOf('}');
        if (braceStart >= 0 && braceEnd > braceStart) {
            return trimmed.substring(braceStart, braceEnd + 1);
        }
        return trimmed;
    }

    /**
     * AI 提取的关联关系数据结构
     */
    @Data
    @Accessors(chain = true)
    public static class ExtractedRelation {
        /** 目标题目 ID */
        private String targetProblemId;
        /** 关联类型：prerequisite / similar_pattern / follow_up */
        private String relationType;
        /** 模式标签列表 */
        private List<String> patternTags;
        /** 关联原因 */
        private String reason;
        /** 置信度 0-1 */
        private Float confidence;
    }
}
