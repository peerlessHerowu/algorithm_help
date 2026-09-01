package com.algorithm.help.content.enrichment.util;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

/**
 * ContentSanitizer 单元测试
 * 验证 HTML 清洗正确移除危险内容，保留安全 Markdown/HTML
 */
class ContentSanitizerTest {

    private ContentSanitizer sanitizer;

    @BeforeEach
    void setUp() {
        sanitizer = new ContentSanitizer();
    }

    @Test
    void sanitize_nullInput_returnsNull() {
        assertNull(sanitizer.sanitize(null));
    }

    @Test
    void sanitize_blankInput_returnsBlank() {
        assertEquals("  ", sanitizer.sanitize("  "));
    }

    @Test
    void sanitize_safeMarkdown_unchanged() {
        String safe = "## 哈希表解法\n\n使用 HashMap 存储已遍历元素。\n\n```java\nMap<Integer,Integer> map = new HashMap<>();\n```";
        assertEquals(safe, sanitizer.sanitize(safe));
    }

    @Test
    void sanitize_removesScriptTags() {
        String input = "正常内容<script>alert('xss')</script>后续内容";
        String result = sanitizer.sanitize(input);
        assertFalse(result.contains("<script"));
        assertFalse(result.contains("alert"));
        assertTrue(result.contains("正常内容"));
        assertTrue(result.contains("后续内容"));
    }

    @Test
    void sanitize_removesScriptCaseInsensitive() {
        String input = "内容<SCRIPT>alert(1)</SCRIPT>安全";
        String result = sanitizer.sanitize(input);
        assertFalse(result.contains("SCRIPT"));
        assertFalse(result.contains("alert"));
    }

    @Test
    void sanitize_removesOnEventHandlers() {
        String input = "<img src=\"pic.png\" onerror=\"alert(1)\" />";
        String result = sanitizer.sanitize(input);
        assertFalse(result.contains("onerror"));
        assertFalse(result.contains("alert"));
        assertTrue(result.contains("src=\"pic.png\""));
    }

    @Test
    void sanitize_removesJavascriptUrl() {
        String input = "<a href=\"javascript:alert(1)\">点击</a>";
        String result = sanitizer.sanitize(input);
        assertFalse(result.contains("javascript:"));
    }

    @Test
    void sanitize_removesIframeTag() {
        String input = "安全内容<iframe src=\"evil.com\">嵌入</iframe>后续";
        String result = sanitizer.sanitize(input);
        assertFalse(result.contains("<iframe"));
        assertFalse(result.contains("evil.com"));
    }

    @Test
    void sanitize_preservesNormalHtmlLinks() {
        String input = "<a href=\"https://leetcode.com/problems/two-sum\">题目链接</a>";
        assertEquals(input, sanitizer.sanitize(input));
    }

    @Test
    void sanitize_preservesCodeBlocks() {
        String input = "```python\ndef twoSum(nums, target):\n    pass\n```";
        assertEquals(input, sanitizer.sanitize(input));
    }

    @Test
    void containsDangerousContent_scriptTag_true() {
        assertTrue(sanitizer.containsDangerousContent("<script>alert(1)</script>"));
    }

    @Test
    void containsDangerousContent_safeContent_false() {
        assertFalse(sanitizer.containsDangerousContent("## 正常 Markdown 标题\n\n安全内容"));
    }

    @Test
    void containsDangerousContent_eventHandler_true() {
        assertTrue(sanitizer.containsDangerousContent("<div onmouseover=\"steal()\">hover</div>"));
    }

    @Test
    void containsDangerousContent_javascriptUrl_true() {
        assertTrue(sanitizer.containsDangerousContent("<a href=\"javascript:void(0)\">link</a>"));
    }
}
