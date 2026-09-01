package com.algorithm.help.content.enrichment.pipeline.steps;

import com.algorithm.help.ai.SmartRouter;
import com.algorithm.help.ai.model.AiRequest;
import com.algorithm.help.ai.model.AiResponse;
import com.algorithm.help.content.enrichment.pipeline.EnrichmentContext;
import com.algorithm.help.content.enrichment.pipeline.EnrichmentResult;
import com.algorithm.help.content.enrichment.pipeline.EnrichmentStep;
import com.algorithm.help.content.prompt.PromptTemplateEngine;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * 纠错步骤：AI 检查原始题解中的错误和不准确之处
 * <p>
 * 非核心步骤，失败时降级跳过，不阻断管线。
 * 检查结果以警告形式记录到上下文。
 */
@Slf4j
@Component
@Order(1)
@RequiredArgsConstructor
public class ErrorCheckStep implements EnrichmentStep {

    private static final String TEMPLATE_PATH = "enrichment/error-check.txt";

    private final SmartRouter smartRouter;
    private final PromptTemplateEngine templateEngine;

    @Override
    public String getName() {
        return "error-check";
    }

    @Override
    public boolean isApplicable(EnrichmentContext ctx) {
        // 有原始题解时才需要纠错
        return ctx.getSources() != null && !ctx.getSources().isEmpty();
    }

    @Override
    public EnrichmentResult process(EnrichmentContext ctx) {
        String sourcesText = buildSourcesText(ctx.getSources());
        String problemTitle = getProblemTitle(ctx);

        String prompt = templateEngine.render(TEMPLATE_PATH, Map.of(
                "problemTitle", problemTitle,
                "sourcesContent", sourcesText
        ));

        AiRequest request = new AiRequest()
                .setType(AiRequest.RequestType.DETECT_ERRORS)
                .setContent(prompt);

        AiResponse response = smartRouter.route(request);
        String result = response.getContent();

        // 将纠错结果记录到警告中（供后续步骤参考）
        if (result != null && !result.isBlank()) {
            ctx.getWarnings().add("error-check 发现: " + truncate(result, 500));
        }

        log.info("纠错步骤完成, provider={}", response.getProvider());
        return EnrichmentResult.ok();
    }

    @Override
    public boolean isCritical() {
        return false;
    }

    /**
     * 将原始题解列表拼接为文本摘要
     */
    private String buildSourcesText(List<Map<String, Object>> sources) {
        return sources.stream()
                .limit(3)
                .map(s -> {
                    String title = getStringField(s, "title");
                    String content = getStringField(s, "content");
                    return "### " + title + "\n" + truncate(content, 2000);
                })
                .collect(Collectors.joining("\n\n---\n\n"));
    }

    private String getProblemTitle(EnrichmentContext ctx) {
        if (ctx.getProblem() != null) {
            String cn = ctx.getProblem().getTitleCn();
            if (cn != null && !cn.isBlank()) return cn;
            return ctx.getProblem().getTitle();
        }
        return "未知题目";
    }

    private String getStringField(Map<String, Object> map, String key) {
        Object val = map.get(key);
        return val != null ? val.toString() : "";
    }

    private String truncate(String text, int maxLen) {
        if (text == null) return "";
        return text.length() > maxLen ? text.substring(0, maxLen) + "..." : text;
    }
}
