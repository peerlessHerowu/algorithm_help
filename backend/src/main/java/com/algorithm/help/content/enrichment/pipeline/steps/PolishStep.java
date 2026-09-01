package com.algorithm.help.content.enrichment.pipeline.steps;

import com.algorithm.help.ai.SmartRouter;
import com.algorithm.help.ai.model.AiRequest;
import com.algorithm.help.ai.model.AiResponse;
import com.algorithm.help.content.enrichment.pipeline.EnrichmentContext;
import com.algorithm.help.content.enrichment.pipeline.EnrichmentResult;
import com.algorithm.help.content.enrichment.pipeline.EnrichmentStep;
import com.algorithm.help.content.enrichment.util.ContentSanitizer;
import com.algorithm.help.content.enrichment.util.ContentLengthGuard;
import com.algorithm.help.content.prompt.PromptTemplateEngine;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/**
 * 润色步骤：基于筛选后的素材 + Prompt 模板，生成结构化的高质量解析内容
 * <p>
 * 核心步骤，失败则整体失败。
 * 输出包含 polishedContent、timeComplexity、spaceComplexity。
 */
@Slf4j
@Component
@Order(3)
@RequiredArgsConstructor
public class PolishStep implements EnrichmentStep {

    private static final String TEMPLATE_PREFIX = "enrichment/polish-L";
    private static final String TEMPLATE_SUFFIX = ".txt";

    /** 匹配时间复杂度标记 */
    private static final Pattern TIME_COMPLEXITY_PATTERN =
            Pattern.compile("\\[TIME_COMPLEXITY]\\s*(.+?)\\s*(?:\\[|$)", Pattern.MULTILINE);
    /** 匹配空间复杂度标记 */
    private static final Pattern SPACE_COMPLEXITY_PATTERN =
            Pattern.compile("\\[SPACE_COMPLEXITY]\\s*(.+?)\\s*(?:\\[|$)", Pattern.MULTILINE);

    private final SmartRouter smartRouter;
    private final PromptTemplateEngine templateEngine;
    private final ContentSanitizer contentSanitizer;
    private final ContentLengthGuard contentLengthGuard;

    @Override
    public String getName() {
        return "polish";
    }

    @Override
    public boolean isApplicable(EnrichmentContext ctx) {
        // 有筛选后的素材才能润色
        return ctx.getFilteredSources() != null && !ctx.getFilteredSources().isEmpty();
    }

    @Override
    public EnrichmentResult process(EnrichmentContext ctx) {
        int level = ctx.getTargetLevel();
        String sourcesText = buildFilteredSourcesText(ctx.getFilteredSources());
        String problemInfo = buildProblemInfo(ctx);

        // 加载对应级别的 Prompt 模板
        String templatePath = TEMPLATE_PREFIX + level + TEMPLATE_SUFFIX;
        String prompt = templateEngine.render(templatePath, Map.of(
                "problemTitle", problemInfo,
                "sourcesContent", sourcesText
        ));

        // 调用 AI 生成润色内容
        AiRequest request = new AiRequest()
                .setType(AiRequest.RequestType.CHAT)
                .setContent(prompt)
                .setProblem(ctx.getProblem());

        AiResponse response = smartRouter.route(request);
        String aiOutput = response.getContent();

        if (aiOutput == null || aiOutput.isBlank()) {
            return EnrichmentResult.fail("AI 润色输出为空");
        }

        // 解析并设置结果
        parseAndSetResult(ctx, aiOutput);

        log.info("润色步骤完成, level=L{}, provider={}, outputLength={}",
                level, response.getProvider(), aiOutput.length());
        return EnrichmentResult.ok();
    }

    @Override
    public boolean isCritical() {
        return true;
    }

    /**
     * 解析 AI 输出，提取 polishedContent 和复杂度信息
     */
    private void parseAndSetResult(EnrichmentContext ctx, String aiOutput) {
        // 提取时间复杂度
        String timeComplexity = extractPattern(aiOutput, TIME_COMPLEXITY_PATTERN);
        if (timeComplexity != null) {
            ctx.setTimeComplexity(timeComplexity.trim());
        }

        // 提取空间复杂度
        String spaceComplexity = extractPattern(aiOutput, SPACE_COMPLEXITY_PATTERN);
        if (spaceComplexity != null) {
            ctx.setSpaceComplexity(spaceComplexity.trim());
        }

        // 清理标记后的内容作为 polishedContent
        String content = removeComplexityMarkers(aiOutput);
        // 入库前 HTML 清洗（双重防护：后端清洗 + 前端 DOMPurify）
        content = contentSanitizer.sanitize(content.trim());

        // 长度保护：截断超长输出
        ContentLengthGuard.GuardResult guardResult = contentLengthGuard.guard(content, ctx.getTargetLevel());
        content = guardResult.content();
        if (guardResult.wasTruncated()) {
            ctx.getWarnings().add(guardResult.warning());
        }

        ctx.setPolishedContent(content);
    }

    /**
     * 从 AI 输出中提取正则匹配内容
     */
    private String extractPattern(String text, Pattern pattern) {
        Matcher matcher = pattern.matcher(text);
        if (matcher.find()) {
            return matcher.group(1);
        }
        return null;
    }

    /**
     * 移除复杂度标记行，保留纯内容
     */
    private String removeComplexityMarkers(String text) {
        return text
                .replaceAll("(?m)^\\[TIME_COMPLEXITY].*$", "")
                .replaceAll("(?m)^\\[SPACE_COMPLEXITY].*$", "")
                .replaceAll("\n{3,}", "\n\n");
    }

    /**
     * 构建筛选后素材的文本
     */
    private String buildFilteredSourcesText(List<Map<String, Object>> sources) {
        return sources.stream()
                .map(s -> {
                    String title = getField(s, "title");
                    String content = getField(s, "content");
                    String author = getField(s, "author");
                    return "### " + title + " (by " + author + ")\n" + content;
                })
                .collect(Collectors.joining("\n\n---\n\n"));
    }

    /**
     * 构建题目信息摘要
     */
    private String buildProblemInfo(EnrichmentContext ctx) {
        if (ctx.getProblem() == null) return "未知题目";

        StringBuilder sb = new StringBuilder();
        String titleCn = ctx.getProblem().getTitleCn();
        String title = ctx.getProblem().getTitle();
        sb.append(titleCn != null && !titleCn.isBlank() ? titleCn : title);

        if (ctx.getProblem().getDifficulty() != null) {
            sb.append(" (").append(ctx.getProblem().getDifficulty()).append(")");
        }
        return sb.toString();
    }

    private String getField(Map<String, Object> map, String key) {
        Object val = map.get(key);
        return val != null ? val.toString() : "";
    }
}
