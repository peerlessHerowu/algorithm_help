package com.algorithm.help.content.enrichment.pipeline.steps;

import com.algorithm.help.ai.SmartRouter;
import com.algorithm.help.ai.model.AiRequest;
import com.algorithm.help.ai.model.AiResponse;
import com.algorithm.help.content.enrichment.TeachingSequence;
import com.algorithm.help.content.enrichment.TeachingSequenceRepository;
import com.algorithm.help.content.enrichment.pipeline.EnrichmentContext;
import com.algorithm.help.content.enrichment.pipeline.EnrichmentResult;
import com.algorithm.help.content.enrichment.pipeline.EnrichmentStep;
import com.algorithm.help.content.prompt.PromptTemplateEngine;
import com.algorithm.help.entity.Problem;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

/**
 * 走流程生成步骤：为算法题生成逐步演示的 TeachingSequence JSON
 * <p>
 * Order 8，在 QualityScore(7) 之后执行。
 * 非核心步骤：失败时降级跳过，不影响主解析内容。
 * <p>
 * 生成的序列存入 teaching_sequences 表，供前端走流程 Tab 使用。
 */
@Slf4j
@Component
@Order(8)
@RequiredArgsConstructor
public class WalkthroughStep implements EnrichmentStep {

    private static final String PROMPT_PATH = "walkthrough/standard.txt";
    private static final ObjectMapper MAPPER = new ObjectMapper();

    private final SmartRouter smartRouter;
    private final PromptTemplateEngine templateEngine;
    private final TeachingSequenceRepository sequenceRepo;

    @Override
    public String getName() {
        return "walkthrough";
    }

    @Override
    public boolean isApplicable(EnrichmentContext ctx) {
        // 必须有题目信息 + 已生成内容（有 polishedContent）
        return ctx.getProblem() != null
                && ctx.getPolishedContent() != null
                && !ctx.getPolishedContent().isBlank();
    }

    @Override
    public EnrichmentResult process(EnrichmentContext ctx) {
        Problem problem = ctx.getProblem();
        int level = ctx.getTargetLevel();

        // 如果已存在就绪的序列，跳过重新生成
        if (sequenceRepo.existsByProblemIdAndLevelAndScenarioType(
                problem.getId(), level, "standard")) {
            log.info("走流程序列已存在, problemId={}, level=L{}", problem.getId(), level);
            return EnrichmentResult.ok();
        }

        log.info("走流程生成开始, problemId={}, level=L{}", problem.getId(), level);
        long startMs = System.currentTimeMillis();

        // 1. 构造 Prompt
        String prompt = buildPrompt(ctx);

        // 2. 调用 AI 生成 JSON
        AiRequest request = new AiRequest()
                .setType(AiRequest.RequestType.CHAT)
                .setContent(prompt)
                .setProblem(problem);

        AiResponse response = smartRouter.route(request);
        String rawOutput = response.getContent();

        if (rawOutput == null || rawOutput.isBlank()) {
            log.warn("走流程 AI 输出为空, problemId={}", problem.getId());
            return EnrichmentResult.fail("走流程 AI 输出为空");
        }

        // 3. 提取并校验 JSON
        String jsonStr = extractJson(rawOutput);
        if (jsonStr == null) {
            log.warn("走流程 JSON 提取失败, problemId={}, rawLength={}", problem.getId(), rawOutput.length());
            return EnrichmentResult.fail("走流程 JSON 提取失败");
        }

        ValidationResult validation = validateSequenceJson(jsonStr);
        if (!validation.valid()) {
            log.warn("走流程 JSON 校验失败, problemId={}, reason={}", problem.getId(), validation.reason());
            return EnrichmentResult.fail("走流程 JSON 校验失败: " + validation.reason());
        }

        // 4. 解析 totalSteps
        int totalSteps = extractTotalSteps(jsonStr);

        // 5. 持久化
        long now = Instant.now().toEpochMilli();
        TeachingSequence seq = new TeachingSequence()
                .setId(UUID.randomUUID().toString())
                .setProblemId(problem.getId())
                .setEnrichedId(ctx.getEnrichedId())
                .setLevel(level)
                .setScenarioType("standard")
                .setTitle(problem.getTitle() + " — L" + level + " 逐步演示")
                .setTotalSteps(totalSteps)
                .setDurationMs(totalSteps * 4000)  // 估算：每步约 4 秒
                .setSequenceJson(jsonStr)
                .setStatus("ready")
                .setCreatedAt(now)
                .setUpdatedAt(now);

        sequenceRepo.save(seq);
        log.info("走流程生成完成, problemId={}, level=L{}, steps={}, cost={}ms",
                problem.getId(), level, totalSteps, System.currentTimeMillis() - startMs);
        return EnrichmentResult.ok();
    }

    @Override
    public boolean isCritical() {
        return false;  // 非核心步骤，失败不阻断主流程
    }

    // ── 私有方法 ──────────────────────────────────────────────────────────

    private String buildPrompt(EnrichmentContext ctx) {
        Problem problem = ctx.getProblem();
        String title = problem.getTitleCn() != null && !problem.getTitleCn().isBlank()
                ? problem.getTitleCn() : problem.getTitle();
        String difficulty = problem.getDifficulty() != null
                ? problem.getDifficulty().name() : "MEDIUM";

        // 从解析内容中提取前 500 字作为核心解法摘要（避免 token 过多）
        String polishedContent = ctx.getPolishedContent();
        String coreSolution = polishedContent.length() > 500
                ? polishedContent.substring(0, 500) + "..." : polishedContent;

        // 从题目 examples 中取第一个示例
        String exampleInput = extractFirstExample(problem);

        return templateEngine.render(PROMPT_PATH, Map.of(
                "problemTitle", title,
                "difficulty", difficulty,
                "level", String.valueOf(ctx.getTargetLevel()),
                "coreSolution", coreSolution,
                "exampleInput", exampleInput
        ));
    }

    /**
     * 从 AI 输出中提取 JSON（AI 可能在 JSON 前后有额外文字）
     */
    private String extractJson(String raw) {
        // 先尝试找 ```json ... ``` 代码块
        int jsonStart = raw.indexOf("```json");
        if (jsonStart >= 0) {
            int start = raw.indexOf('\n', jsonStart) + 1;
            int end = raw.indexOf("```", start);
            if (end > start) {
                return raw.substring(start, end).trim();
            }
        }

        // 再尝试直接找 { ... }
        int braceStart = raw.indexOf('{');
        if (braceStart >= 0) {
            int depth = 0;
            for (int i = braceStart; i < raw.length(); i++) {
                char c = raw.charAt(i);
                if (c == '{') depth++;
                else if (c == '}') {
                    depth--;
                    if (depth == 0) {
                        return raw.substring(braceStart, i + 1).trim();
                    }
                }
            }
        }
        return null;
    }

    /**
     * 校验 TeachingSequence JSON 基本结构
     */
    private ValidationResult validateSequenceJson(String json) {
        try {
            JsonNode root = MAPPER.readTree(json);

            if (!root.has("totalSteps"))
                return new ValidationResult(false, "缺少 totalSteps 字段");
            if (!root.has("steps") || !root.get("steps").isArray())
                return new ValidationResult(false, "缺少 steps 数组");

            int totalSteps = root.get("totalSteps").asInt();
            int actualSteps = root.get("steps").size();
            if (totalSteps != actualSteps)
                return new ValidationResult(false,
                        "totalSteps(" + totalSteps + ") 与实际步骤数(" + actualSteps + ")不一致");

            // 检查每个步骤的必要字段
            for (JsonNode step : root.get("steps")) {
                if (!step.has("step"))
                    return new ValidationResult(false, "步骤缺少 step 字段");
                if (!step.has("narration") || !step.get("narration").has("text"))
                    return new ValidationResult(false, "步骤缺少 narration.text");
            }

            return new ValidationResult(true, null);
        } catch (Exception e) {
            return new ValidationResult(false, "JSON 解析失败: " + e.getMessage());
        }
    }

    private int extractTotalSteps(String json) {
        try {
            JsonNode root = MAPPER.readTree(json);
            return root.get("totalSteps").asInt(0);
        } catch (Exception e) {
            return 0;
        }
    }

    private String extractFirstExample(Problem problem) {
        String examples = problem.getExamples();
        if (examples == null || examples.isBlank()) {
            return "输入：题目默认示例";
        }
        // 截取前 200 字的示例描述
        return examples.length() > 200 ? examples.substring(0, 200) + "..." : examples;
    }

    private record ValidationResult(boolean valid, String reason) {}
}
