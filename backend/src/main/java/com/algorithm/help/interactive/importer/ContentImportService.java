package com.algorithm.help.interactive.importer;

import com.algorithm.help.ai.SmartRouter;
import com.algorithm.help.ai.model.AiRequest;
import com.algorithm.help.common.security.UrlValidator;
import com.algorithm.help.content.prompt.PromptTemplateEngine;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;

import java.time.Duration;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * URL 内容导入服务
 * <p>
 * 流程：URL 白名单校验 → 抓取 HTML → 提取标题 + 正文 → AI 审查 → AI 精炼
 *
 * @author algorithm-help
 * @since 1.0.0
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ContentImportService {

    /** 正文长度上限（防止超出 AI token 限制） */
    private static final int MAX_CONTENT_LENGTH = 8000;
    /** 抓取超时 */
    private static final int FETCH_TIMEOUT_SECONDS = 15;

    private final WebClient.Builder webClientBuilder;
    private final PromptTemplateEngine templateEngine;
    private final SmartRouter smartRouter;
    private final UrlValidator urlValidator;

    /**
     * 导入 URL 内容并精炼
     *
     * @param url 目标网址
     * @return 导入结果（含原始内容、AI 审查结果、精炼内容）
     */
    public ImportResult importFromUrl(String url) {
        log.info("开始导入 URL: {}", url);
        ImportResult result = new ImportResult().setSourceUrl(url);
        try {
            // 1. URL 安全校验（SSRF 防护）
            if (!urlValidator.isSafeUrl(url)) {
                result.setSuccess(false).setError("URL 不安全，不允许访问内网地址");
                return result;
            }

            // 2. 抓取 HTML
            String html = fetchHtml(url);
            if (html == null || html.isBlank()) {
                result.setSuccess(false).setError("无法抓取内容，请检查链接是否有效");
                return result;
            }

            // 3. 提取标题
            String title = extractTitle(html);
            result.setTitle(title);

            // 4. 提取正文
            String content = extractContent(html);
            result.setRawContent(content);

            // 5. AI 审查（异步，不阻塞导入）
            String reviewResult = aiReview(content);
            result.setReviewResult(reviewResult);

            // 6. AI 精炼（可选，如审查推荐 IMPORT 或 IMPORT_WITH_REVIEW）
            if (shouldRefine(reviewResult)) {
                String refined = aiRefine(content);
                result.setRefinedContent(refined);
            }

            result.setSuccess(true);
            log.info("URL 导入成功: url={}, titleLen={}, contentLen={}",
                    url, title != null ? title.length() : 0, content.length());
        } catch (Exception e) {
            log.error("URL 导入失败: url={}, error={}", url, e.getMessage());
            result.setSuccess(false).setError("导入失败：" + e.getMessage());
        }
        return result;
    }

    // ======================== 私有方法 ========================

    /**
     * 抓取网页 HTML
     */
    private String fetchHtml(String url) {
        try {
            return webClientBuilder.build()
                    .get().uri(url)
                    .header("User-Agent",
                            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36")
                    .retrieve()
                    .bodyToMono(String.class)
                    .timeout(Duration.ofSeconds(FETCH_TIMEOUT_SECONDS))
                    .block();
        } catch (Exception e) {
            log.warn("抓取 HTML 失败: url={}, error={}", url, e.getMessage());
            return null;
        }
    }

    /**
     * 提取页面标题
     */
    private String extractTitle(String html) {
        // 优先提取 og:title
        Matcher ogTitle = Pattern.compile("<meta[^>]+property=['\"]og:title['\"][^>]+content=['\"]([^'\"]+)['\"]",
                Pattern.CASE_INSENSITIVE).matcher(html);
        if (ogTitle.find()) return ogTitle.group(1).trim();

        // 回退到 <title> 标签
        Matcher titleMatcher = Pattern.compile("<title[^>]*>([^<]+)</title>",
                Pattern.CASE_INSENSITIVE).matcher(html);
        if (titleMatcher.find()) return titleMatcher.group(1).trim();

        return null;
    }

    /**
     * 提取正文（优先提取 article/main 内容区，回退到 body）
     */
    private String extractContent(String html) {
        if (html == null) return "";

        // 优先提取语义标签内容
        String content = extractTagContent(html, "article");
        if (content.length() < 200) content = extractTagContent(html, "main");
        if (content.length() < 200) content = extractTagContent(html, "div[^>]*class=['\"][^'\"]*content[^'\"]*['\"]");
        // 回退到整体 body
        if (content.length() < 200) content = extractBody(html);

        // 清理 HTML 标签和多余空白
        content = content.replaceAll("(?s)<script[^>]*>.*?</script>", " ");
        content = content.replaceAll("(?s)<style[^>]*>.*?</style>", " ");
        content = content.replaceAll("(?s)<nav[^>]*>.*?</nav>", " ");
        content = content.replaceAll("(?s)<footer[^>]*>.*?</footer>", " ");
        content = content.replaceAll("<[^>]+>", " ");
        content = content.replaceAll("&[a-zA-Z]+;", " ");
        content = content.replaceAll("\\s+", " ").trim();

        // 截取上限
        return content.length() > MAX_CONTENT_LENGTH
                ? content.substring(0, MAX_CONTENT_LENGTH) + "...(内容已截取)"
                : content;
    }

    private String extractTagContent(String html, String tagPattern) {
        Pattern p = Pattern.compile("<(" + tagPattern + ")[^>]*>(.*?)</\\w+>",
                Pattern.CASE_INSENSITIVE | Pattern.DOTALL);
        Matcher m = p.matcher(html);
        if (m.find()) return m.group(2);
        return "";
    }

    private String extractBody(String html) {
        Matcher m = Pattern.compile("(?s)<body[^>]*>(.*?)</body>",
                Pattern.CASE_INSENSITIVE).matcher(html);
        return m.find() ? m.group(1) : html;
    }

    /**
     * AI 审查内容质量
     */
    private String aiReview(String content) {
        try {
            String prompt = templateEngine.render("interactive/import-review.md",
                    Map.of("content", content.length() > 3000 ? content.substring(0, 3000) : content));
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
            String truncated = content.length() > 4000 ? content.substring(0, 4000) : content;
            String prompt = templateEngine.render("interactive/import-refine.md",
                    Map.of("content", truncated));
            AiRequest request = new AiRequest()
                    .setType(AiRequest.RequestType.CHAT)
                    .setContent(prompt);
            return smartRouter.route(request).getContent();
        } catch (Exception e) {
            log.warn("AI 精炼失败: {}", e.getMessage());
            return content;
        }
    }

    /**
     * 根据审查结果判断是否需要精炼
     */
    private boolean shouldRefine(String reviewResult) {
        if (reviewResult == null) return true;
        return !reviewResult.contains("\"REJECT\"");
    }
}
