package com.algorithm.help.interactive.importer;

import com.algorithm.help.ai.SmartRouter;
import com.algorithm.help.ai.model.AiRequest;
import com.algorithm.help.content.prompt.PromptTemplateEngine;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;

import java.time.Duration;
import java.util.Map;

/**
 * URL 内容导入服务
 * <p>
 * 抓取网页 → Readability 提取正文 → AI 审查 → AI 精炼
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ContentImportService {

    private final WebClient.Builder webClientBuilder;
    private final PromptTemplateEngine templateEngine;
    private final SmartRouter smartRouter;

    /**
     * 导入 URL 内容并精炼
     */
    public ImportResult importFromUrl(String url) {
        ImportResult result = new ImportResult().setSourceUrl(url);
        try {
            // 1. 抓取网页
            String html = fetchHtml(url);
            // 2. 提取正文
            String content = extractContent(html);
            result.setRawContent(content);
            // 3. AI 审查
            String reviewResult = aiReview(content);
            result.setReviewResult(reviewResult);
            // 4. AI 精炼
            String refined = aiRefine(content);
            result.setRefinedContent(refined);
            result.setSuccess(true);
        } catch (Exception e) {
            log.error("URL 导入失败: url={}, error={}", url, e.getMessage());
            result.setSuccess(false);
            result.setError(e.getMessage());
        }
        return result;
    }

    /**
     * 抓取网页 HTML（超时 10s）
     */
    private String fetchHtml(String url) {
        return webClientBuilder.build()
                .get().uri(url)
                .retrieve()
                .bodyToMono(String.class)
                .timeout(Duration.ofSeconds(10))
                .block();
    }

    /**
     * 简化版 Readability：移除脚本/样式，提取 body 文本
     */
    private String extractContent(String html) {
        if (html == null) return "";
        // 移除 script 和 style 标签
        String cleaned = html.replaceAll("(?s)<script[^>]*>.*?</script>", "");
        cleaned = cleaned.replaceAll("(?s)<style[^>]*>.*?</style>", "");
        // 移除所有 HTML 标签
        cleaned = cleaned.replaceAll("<[^>]+>", " ");
        // 压缩空白
        cleaned = cleaned.replaceAll("\\s+", " ").trim();
        return cleaned.length() > 5000 ? cleaned.substring(0, 5000) : cleaned;
    }

    /**
     * AI 审查内容正确性
     */
    private String aiReview(String content) {
        try {
            String prompt = templateEngine.render("interactive/import-review.md", Map.of(
                    "content", content
            ));
            AiRequest request = new AiRequest()
                    .setType(AiRequest.RequestType.DETECT_ERRORS)
                    .setContent(prompt);
            return smartRouter.route(request).getContent();
        } catch (Exception e) {
            log.warn("AI 审查失败: {}", e.getMessage());
            return null;
        }
    }

    /**
     * AI 精炼为标准格式
     */
    private String aiRefine(String content) {
        try {
            String prompt = templateEngine.render("interactive/import-refine.md", Map.of(
                    "content", content
            ));
            AiRequest request = new AiRequest()
                    .setType(AiRequest.RequestType.CHAT)
                    .setContent(prompt);
            return smartRouter.route(request).getContent();
        } catch (Exception e) {
            log.warn("AI 精炼失败: {}", e.getMessage());
            return content;
        }
    }
}
