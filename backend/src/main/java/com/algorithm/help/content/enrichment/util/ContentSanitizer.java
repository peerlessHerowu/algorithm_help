package com.algorithm.help.content.enrichment.util;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.regex.Pattern;

/**
 * 内容安全清洗工具
 * <p>
 * 在 enriched 内容入库前执行基础 HTML 清洗（双重防护的后端层）：
 * - 移除 &lt;script&gt; 标签及其内容
 * - 移除 on* 事件处理器属性
 * - 移除 javascript: 协议 URL
 * - 移除 &lt;iframe&gt;/&lt;object&gt;/&lt;embed&gt; 等危险标签
 * <p>
 * 前端 DOMPurify 为第二层防护，后端清洗确保即使绕过前端也不会存储恶意内容。
 */
@Slf4j
@Component
public class ContentSanitizer {

    /** 匹配 <script>...</script> 标签（含内容） */
    private static final Pattern SCRIPT_TAG = Pattern.compile(
            "<script[^>]*>.*?</script>",
            Pattern.CASE_INSENSITIVE | Pattern.DOTALL
    );

    /** 匹配自闭合 <script .../> */
    private static final Pattern SCRIPT_SELF_CLOSE = Pattern.compile(
            "<script[^>]*/>",
            Pattern.CASE_INSENSITIVE
    );

    /** 匹配 <iframe>, <object>, <embed>, <applet> 标签（含内容） */
    private static final Pattern DANGEROUS_TAGS = Pattern.compile(
            "<(iframe|object|embed|applet|form|input|button)[^>]*>.*?</\\1>",
            Pattern.CASE_INSENSITIVE | Pattern.DOTALL
    );

    /** 匹配自闭合危险标签 */
    private static final Pattern DANGEROUS_SELF_CLOSE = Pattern.compile(
            "<(iframe|object|embed|applet|form|input|button)[^>]*/>",
            Pattern.CASE_INSENSITIVE
    );

    /** 匹配 on* 事件处理器属性（如 onclick="...", onerror='...'） */
    private static final Pattern EVENT_HANDLER = Pattern.compile(
            "\\s+on\\w+\\s*=\\s*([\"'])[^\"']*\\1",
            Pattern.CASE_INSENSITIVE
    );

    /** 匹配无引号的 on* 事件处理器 */
    private static final Pattern EVENT_HANDLER_UNQUOTED = Pattern.compile(
            "\\s+on\\w+\\s*=\\s*[^\\s>]+",
            Pattern.CASE_INSENSITIVE
    );

    /** 匹配 javascript: 协议 URL */
    private static final Pattern JAVASCRIPT_URL = Pattern.compile(
            "(href|src|action)\\s*=\\s*([\"'])\\s*javascript\\s*:[^\"']*\\2",
            Pattern.CASE_INSENSITIVE
    );

    /** 匹配无引号的 javascript: URL */
    private static final Pattern JAVASCRIPT_URL_UNQUOTED = Pattern.compile(
            "(href|src|action)\\s*=\\s*javascript\\s*:[^\\s>]*",
            Pattern.CASE_INSENSITIVE
    );

    /** 匹配 data: 协议（潜在 XSS 向量，保留 data:image 用于合法图片） */
    private static final Pattern DATA_URL_NON_IMAGE = Pattern.compile(
            "(href|src)\\s*=\\s*([\"'])\\s*data:(?!image/)[^\"']*\\2",
            Pattern.CASE_INSENSITIVE
    );

    /**
     * 清洗 HTML/Markdown 内容，移除危险元素
     *
     * @param content 待清洗的内容（可能包含 Markdown + 内嵌 HTML）
     * @return 清洗后的安全内容
     */
    public String sanitize(String content) {
        if (content == null || content.isBlank()) {
            return content;
        }

        String result = content;
        String original = content;

        // 移除 script 标签
        result = SCRIPT_TAG.matcher(result).replaceAll("");
        result = SCRIPT_SELF_CLOSE.matcher(result).replaceAll("");

        // 移除危险标签
        result = DANGEROUS_TAGS.matcher(result).replaceAll("");
        result = DANGEROUS_SELF_CLOSE.matcher(result).replaceAll("");

        // 移除 on* 事件处理器
        result = EVENT_HANDLER.matcher(result).replaceAll("");
        result = EVENT_HANDLER_UNQUOTED.matcher(result).replaceAll("");

        // 移除 javascript: URL
        result = JAVASCRIPT_URL.matcher(result).replaceAll("");
        result = JAVASCRIPT_URL_UNQUOTED.matcher(result).replaceAll("");

        // 移除非图片的 data: URL
        result = DATA_URL_NON_IMAGE.matcher(result).replaceAll("");

        // 记录清洗行为
        if (!result.equals(original)) {
            int removed = original.length() - result.length();
            log.warn("内容清洗：移除了 {} 个字符的潜在危险内容", removed);
        }

        return result;
    }

    /**
     * 检查内容是否包含潜在危险内容（不修改，仅检测）
     *
     * @param content 待检查的内容
     * @return true 表示包含危险内容
     */
    public boolean containsDangerousContent(String content) {
        if (content == null || content.isBlank()) {
            return false;
        }
        return SCRIPT_TAG.matcher(content).find()
                || SCRIPT_SELF_CLOSE.matcher(content).find()
                || EVENT_HANDLER.matcher(content).find()
                || EVENT_HANDLER_UNQUOTED.matcher(content).find()
                || JAVASCRIPT_URL.matcher(content).find()
                || JAVASCRIPT_URL_UNQUOTED.matcher(content).find();
    }
}
