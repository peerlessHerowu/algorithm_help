package com.algorithm.help.content.generator;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * AI 响应解析器：将 AI 返回的文本解析为 LeveledContent 结构化对象
 * <p>
 * 处理策略：
 * 1. 先尝试提取 JSON（处理 markdown 代码块、多余文字包裹等情况）
 * 2. 根据 level 决定重点解析 sections 还是 approaches
 * 3. 解析失败不抛异常，返回 parseSuccess=false 的对象供人工处理
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class AiResponseParser {

    /** 匹配 ```json ... ``` 或 ``` ... ``` 包裹的内容 */
    private static final Pattern CODE_BLOCK = Pattern.compile(
            "```(?:json)?\\s*\\n?(.*?)\\n?```", Pattern.DOTALL);

    private final ObjectMapper objectMapper;

    /**
     * 解析 AI 响应文本为 LeveledContent
     *
     * @param rawResponse AI 返回的原始响应文本
     * @param level       目标层级（1-5）
     * @return 结构化的分层内容对象
     */
    public LeveledContent parse(String rawResponse, int level) {
        if (rawResponse == null || rawResponse.isBlank()) {
            return buildFailure(rawResponse, level, "响应为空");
        }

        try {
            String json = extractJson(rawResponse);
            JsonNode root = objectMapper.readTree(json);
            return buildContent(root, rawResponse, level);
        } catch (Exception e) {
            log.warn("AI 响应解析失败, level={}, 原因: {}", level, e.getMessage());
            return buildFailure(rawResponse, level, e.getMessage());
        }
    }

    /**
     * 从原始文本中提取 JSON 部分
     * <p>
     * 优先匹配 ```json ... ``` 代码块，否则取第一个 { 到最后一个 } 之间的内容
     */
    private String extractJson(String raw) {
        // 优先提取 markdown 代码块中的 JSON
        Matcher matcher = CODE_BLOCK.matcher(raw);
        if (matcher.find()) {
            return matcher.group(1).trim();
        }

        // 兜底：取第一个 { 到最后一个 } 之间的内容
        int start = raw.indexOf('{');
        int end = raw.lastIndexOf('}');
        if (start >= 0 && end > start) {
            return raw.substring(start, end + 1);
        }

        // 无法提取，直接返回原文让 Jackson 尝试
        return raw.trim();
    }

    /**
     * 根据 level 决定解析策略，构建 LeveledContent
     */
    private LeveledContent buildContent(JsonNode root, String rawResponse, int level) {
        LeveledContent content = new LeveledContent()
                .setLevel(level)
                .setTitle(textOrNull(root, "title"))
                .setRawJson(rawResponse)
                .setParseSuccess(true);

        if (level <= 2) {
            content.setSections(parseSections(root));
        }
        if (level >= 3) {
            content.setApproaches(parseApproaches(root));
        }
        if (level >= 4) {
            parseProofs(root, content);
        }
        if (level >= 5) {
            content.setReferences(parseReferences(root));
        }
        return content;
    }

    /**
     * 解析 sections 字段（L1-L2）
     */
    private List<LeveledContent.Section> parseSections(JsonNode root) {
        JsonNode node = root.get("sections");
        if (node == null || !node.isArray()) {
            return List.of();
        }
        try {
            List<LeveledContent.Section> sections = new ArrayList<>();
            for (JsonNode item : node) {
                sections.add(new LeveledContent.Section()
                        .setHeading(textOrNull(item, "heading"))
                        .setContent(textOrNull(item, "content"))
                        .setContentType(textOrNull(item, "contentType")));
            }
            return sections;
        } catch (Exception e) {
            log.debug("sections 解析失败: {}", e.getMessage());
            return List.of();
        }
    }

    /**
     * 解析 approaches 字段（L3-L5）
     */
    private List<LeveledContent.Approach> parseApproaches(JsonNode root) {
        JsonNode node = root.get("approaches");
        if (node == null || !node.isArray()) {
            return List.of();
        }
        try {
            List<LeveledContent.Approach> approaches = new ArrayList<>();
            for (JsonNode item : node) {
                LeveledContent.Approach approach = new LeveledContent.Approach()
                        .setName(textOrNull(item, "name"))
                        .setIdea(textOrNull(item, "idea"))
                        .setTimeComplexity(textOrNull(item, "timeComplexity"))
                        .setSpaceComplexity(textOrNull(item, "spaceComplexity"))
                        .setCode(textOrNull(item, "code"));
                // 解析 steps 列表
                JsonNode stepsNode = item.get("steps");
                if (stepsNode != null && stepsNode.isArray()) {
                    approach.setSteps(objectMapper.convertValue(
                            stepsNode, new TypeReference<List<String>>() {}));
                }
                approaches.add(approach);
            }
            return approaches;
        } catch (Exception e) {
            log.debug("approaches 解析失败: {}", e.getMessage());
            return List.of();
        }
    }

    /**
     * 解析 proofs 字段（L4-L5）
     */
    private void parseProofs(JsonNode root, LeveledContent content) {
        JsonNode proofsNode = root.get("proofs");
        if (proofsNode != null) {
            content.setProofs(objectMapper.convertValue(proofsNode, Object.class));
        }
    }

    /**
     * 解析 references 字段（L5）
     */
    private List<LeveledContent.Reference> parseReferences(JsonNode root) {
        JsonNode node = root.get("references");
        if (node == null || !node.isArray()) {
            return List.of();
        }
        try {
            List<LeveledContent.Reference> refs = new ArrayList<>();
            for (JsonNode item : node) {
                refs.add(new LeveledContent.Reference()
                        .setAuthors(textOrNull(item, "authors"))
                        .setTitle(textOrNull(item, "title"))
                        .setYear(textOrNull(item, "year"))
                        .setVenue(textOrNull(item, "venue"))
                        .setRelevance(textOrNull(item, "relevance")));
            }
            return refs;
        } catch (Exception e) {
            log.debug("references 解析失败: {}", e.getMessage());
            return List.of();
        }
    }

    /**
     * 安全获取 JsonNode 的文本值
     */
    private String textOrNull(JsonNode node, String field) {
        JsonNode child = node.get(field);
        return (child != null && !child.isNull()) ? child.asText() : null;
    }

    /**
     * 构建解析失败的 LeveledContent，保留原始文本供人工处理
     */
    private LeveledContent buildFailure(String rawResponse, int level, String reason) {
        log.info("AI 响应标记为需人工处理, level={}, 原因: {}", level, reason);
        return new LeveledContent()
                .setLevel(level)
                .setRawJson(rawResponse)
                .setParseSuccess(false);
    }
}
