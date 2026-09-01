package com.algorithm.help.content.generator;

import com.algorithm.help.ai.SmartRouter;
import com.algorithm.help.ai.model.AiRequest;
import com.algorithm.help.ai.model.AiResponse;
import com.algorithm.help.ai.model.GenerateOptions;
import com.algorithm.help.content.prompt.PromptTemplateEngine;
import com.algorithm.help.entity.Problem;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * 分级内容生成器
 * <p>
 * 根据 level 选择对应模板 → 填充变量 → 调用 SmartRouter → 解析响应
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class LeveledGenerator {

    /** 各级别对应的模板路径 */
    private static final Map<Integer, String> TEMPLATE_MAP = Map.of(
        1, "explanation/L1-intuition.md",
        2, "explanation/L2-beginner.md",
        3, "explanation/L3-intermediate.md",
        4, "explanation/L4-advanced.md",
        5, "explanation/L5-expert.md"
    );

    private final PromptTemplateEngine templateEngine;
    private final SmartRouter router;
    private final ObjectMapper objectMapper;

    /**
     * 根据题目和级别生成分级内容
     *
     * @param problem 算法题目
     * @param level   级别（1-5）
     * @return 解析后的分级内容
     */
    public LeveledContent generate(Problem problem, int level) {
        validateLevel(level);
        String prompt = renderPrompt(problem, level);
        AiResponse response = callAi(prompt, problem, level);
        return parseResponse(response, level, problem.getTitle());
    }

    /**
     * 校验级别范围
     */
    private void validateLevel(int level) {
        if (level < 1 || level > 5) {
            throw new IllegalArgumentException("级别必须在 1-5 之间，当前: " + level);
        }
    }

    /**
     * 渲染 prompt 模板：填充题目变量
     */
    private String renderPrompt(Problem problem, int level) {
        String templatePath = TEMPLATE_MAP.get(level);
        Map<String, String> variables = buildVariables(problem, level);
        return templateEngine.render(templatePath, variables);
    }

    /**
     * 构建模板变量映射
     */
    private Map<String, String> buildVariables(Problem problem, int level) {
        Map<String, String> vars = new HashMap<>();
        vars.put("title", problem.getTitle());
        vars.put("description", problem.getDescription() != null ? problem.getDescription() : "");
        vars.put("constraints", problem.getConstraints() != null ? problem.getConstraints() : "");
        vars.put("examples", problem.getExamples() != null ? problem.getExamples() : "");
        vars.put("tags", problem.getTags() != null ? problem.getTags() : "");
        vars.put("level", String.valueOf(level));
        return vars;
    }

    /**
     * 调用 SmartRouter 获取 AI 响应
     */
    private AiResponse callAi(String prompt, Problem problem, int level) {
        AiRequest request = new AiRequest()
            .setType(AiRequest.RequestType.LEVELED_EXPLANATION)
            .setProblem(problem)
            .setContent(prompt)
            .setOptions(new GenerateOptions().setLevel(level));

        log.info("生成 L{} 内容: problemId={}, title={}", level, problem.getId(), problem.getTitle());
        return router.route(request);
    }

    /**
     * 解析 AI 响应为 LeveledContent
     */
    private LeveledContent parseResponse(AiResponse response, int level, String title) {
        String rawJson = response.getContent();
        LeveledContent content = new LeveledContent()
            .setLevel(level)
            .setTitle(title)
            .setRawJson(rawJson);

        try {
            JsonNode root = objectMapper.readTree(rawJson);
            if (level <= 2) {
                parseSections(root, content);
            } else {
                parseApproaches(root, content);
            }
            if (level >= 4) {
                parseProofs(root, content);
            }
            if (level >= 5) {
                parseReferences(root, content);
            }
            content.setParseSuccess(true);
        } catch (Exception e) {
            log.warn("JSON 解析失败 (L{}): {}", level, e.getMessage());
            content.setParseSuccess(false);
        }
        return content;
    }

    /**
     * 解析 sections（L1-L2 使用）
     */
    private void parseSections(JsonNode root, LeveledContent content) {
        JsonNode sectionsNode = root.get("sections");
        if (sectionsNode == null || !sectionsNode.isArray()) {
            return;
        }
        List<LeveledContent.Section> sections = new ArrayList<>();
        for (JsonNode node : sectionsNode) {
            sections.add(new LeveledContent.Section()
                .setHeading(textOf(node, "heading"))
                .setContent(textOf(node, "content"))
                .setContentType(textOf(node, "contentType")));
        }
        content.setSections(sections);
    }

    /**
     * 解析 approaches（L3-L5 使用）
     */
    private void parseApproaches(JsonNode root, LeveledContent content) {
        JsonNode approachesNode = root.get("approaches");
        if (approachesNode == null || !approachesNode.isArray()) {
            return;
        }
        List<LeveledContent.Approach> approaches = new ArrayList<>();
        for (JsonNode node : approachesNode) {
            LeveledContent.Approach approach = new LeveledContent.Approach()
                .setName(textOf(node, "name"))
                .setIdea(textOf(node, "idea"))
                .setTimeComplexity(textOf(node, "timeComplexity"))
                .setSpaceComplexity(textOf(node, "spaceComplexity"))
                .setCode(textOf(node, "code"));
            // 解析 steps 列表
            JsonNode stepsNode = node.get("steps");
            if (stepsNode != null && stepsNode.isArray()) {
                List<String> steps = objectMapper.convertValue(
                    stepsNode, new TypeReference<List<String>>() {});
                approach.setSteps(steps);
            }
            approaches.add(approach);
        }
        content.setApproaches(approaches);
    }

    /**
     * 解析 proofs（L4-L5 使用）
     */
    private void parseProofs(JsonNode root, LeveledContent content) {
        JsonNode proofsNode = root.get("proofs");
        if (proofsNode != null) {
            content.setProofs(objectMapper.convertValue(proofsNode, Object.class));
        }
    }

    /**
     * 解析 references（L5 使用）
     */
    private void parseReferences(JsonNode root, LeveledContent content) {
        JsonNode refsNode = root.get("references");
        if (refsNode == null || !refsNode.isArray()) {
            return;
        }
        List<LeveledContent.Reference> refs = new ArrayList<>();
        for (JsonNode node : refsNode) {
            refs.add(new LeveledContent.Reference()
                .setAuthors(textOf(node, "authors"))
                .setTitle(textOf(node, "title"))
                .setYear(textOf(node, "year"))
                .setVenue(textOf(node, "venue"))
                .setRelevance(textOf(node, "relevance")));
        }
        content.setReferences(refs);
    }

    /**
     * 安全地获取 JsonNode 的文本值
     */
    private String textOf(JsonNode parent, String field) {
        JsonNode node = parent.get(field);
        return node != null && !node.isNull() ? node.asText() : null;
    }
}
