package com.algorithm.help.export.impl;

import com.algorithm.help.export.Exporter;
import com.algorithm.help.export.dto.ExportOptions;
import com.algorithm.help.export.dto.ExportResult;
import com.algorithm.help.export.dto.ExportableContent;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;

/**
 * Notion 兼容 Markdown 导出器
 * <p>
 * 输出 Notion 可直接导入的 Markdown 格式，包含：
 * - Toggle block（使用 HTML details 标签，代码默认折叠）
 * - Callout block（使用引用 + emoji 语法显示复杂度信息）
 * - H1/H2/H3 层级结构
 */
@Slf4j
@Component
public class NotionExporter implements Exporter {

    private static final String FILE_NAME = "algorithm-notes-notion.md";
    private static final String CONTENT_TYPE = "text/markdown";

    @Override
    public ExportResult export(List<ExportableContent> contents, ExportOptions options) {
        log.info("开始 Notion 格式导出，共 {} 个题目", contents.size());

        var sb = new StringBuilder();
        appendHeader(sb);

        for (var content : contents) {
            appendContentSection(sb, content, options);
        }

        byte[] fileData = sb.toString().getBytes(StandardCharsets.UTF_8);
        return new ExportResult()
                .setFileName(FILE_NAME)
                .setFileData(fileData)
                .setContentType(CONTENT_TYPE)
                .setFileSizeBytes(fileData.length);
    }

    /**
     * 文档标题
     */
    private void appendHeader(StringBuilder sb) {
        sb.append("# 📚 算法学习笔记\n\n");
        sb.append("> 💡 **提示**\n");
        sb.append("> 本文档由算法深度理解引擎自动生成，可直接导入 Notion\n\n");
        sb.append("---\n\n");
    }

    /**
     * 追加单个题目的 Notion 格式内容
     */
    private void appendContentSection(StringBuilder sb, ExportableContent content,
                                      ExportOptions options) {
        appendSectionTitle(sb, content);
        appendDescription(sb, content);
        appendApproach(sb, content);
        appendCodeToggle(sb, content, options);
        appendComplexityCallout(sb, content);
        appendDiagram(sb, content, options);
        sb.append("\n---\n\n");
    }

    /**
     * 题目标题（H2），含模式和难度标签
     */
    private void appendSectionTitle(StringBuilder sb, ExportableContent content) {
        sb.append("## ").append(content.getProblemName());
        if (content.getPatternName() != null) {
            sb.append("  `").append(content.getPatternName()).append("`");
        }
        if (content.getDifficulty() != null) {
            sb.append("  ").append(difficultyEmoji(content.getDifficulty()));
        }
        sb.append("\n\n");
    }

    /**
     * 题目描述
     */
    private void appendDescription(StringBuilder sb, ExportableContent content) {
        if (content.getDescription() != null) {
            sb.append("### 题目描述\n\n");
            sb.append(content.getDescription()).append("\n\n");
        }
    }

    /**
     * 解题思路
     */
    private void appendApproach(StringBuilder sb, ExportableContent content) {
        if (content.getApproach() != null) {
            sb.append("### 💡 解题思路\n\n");
            sb.append(content.getApproach()).append("\n\n");
        }
    }

    /**
     * 代码实现 - 使用 Notion Toggle block（HTML details 标签，默认折叠）
     */
    private void appendCodeToggle(StringBuilder sb, ExportableContent content,
                                  ExportOptions options) {
        if (!options.isIncludeCode()) {
            return;
        }
        Map<String, String> codeMap = content.getCode();
        if (codeMap == null || codeMap.isEmpty()) {
            return;
        }

        sb.append("### 代码实现\n\n");
        for (String lang : options.getLanguages()) {
            String code = codeMap.get(lang);
            if (code != null) {
                appendSingleCodeToggle(sb, lang, code);
            }
        }
    }

    /**
     * 单个语言的 Toggle block（使用 HTML details/summary 标签）
     */
    private void appendSingleCodeToggle(StringBuilder sb, String lang, String code) {
        sb.append("<details>\n");
        sb.append("<summary>").append(languageLabel(lang)).append(" 实现</summary>\n\n");
        sb.append("```").append(lang).append("\n");
        sb.append(code).append("\n");
        sb.append("```\n\n");
        sb.append("</details>\n\n");
    }

    /**
     * 复杂度信息 - 使用 Notion Callout 语法（引用 + emoji）
     */
    private void appendComplexityCallout(StringBuilder sb, ExportableContent content) {
        if (content.getComplexity() == null) {
            return;
        }
        sb.append("> ⏱️ **复杂度分析**\n");
        // 将复杂度文本按行添加引用前缀
        String[] lines = content.getComplexity().split("\n");
        for (String line : lines) {
            sb.append("> ").append(line).append("\n");
        }
        sb.append("\n");
    }

    /**
     * Mermaid 图解（Notion 支持 Mermaid 代码块）
     */
    private void appendDiagram(StringBuilder sb, ExportableContent content,
                               ExportOptions options) {
        if (!options.isIncludeDiagrams() || content.getDiagramMermaid() == null) {
            return;
        }
        sb.append("### 📊 图解\n\n");
        sb.append("```mermaid\n");
        sb.append(content.getDiagramMermaid()).append("\n");
        sb.append("```\n\n");
    }

    /**
     * 难度等级转 emoji 标签
     */
    private String difficultyEmoji(int difficulty) {
        return switch (difficulty) {
            case 1 -> "🟢 简单";
            case 2 -> "🟡 中等偏易";
            case 3 -> "🟠 中等";
            case 4 -> "🔴 困难";
            case 5 -> "⚫ 极难";
            default -> "❓ 未知";
        };
    }

    /**
     * 语言标识符转可读标签
     */
    private String languageLabel(String lang) {
        return switch (lang.toLowerCase()) {
            case "java" -> "Java";
            case "python" -> "Python";
            case "javascript", "js" -> "JavaScript";
            case "typescript", "ts" -> "TypeScript";
            case "cpp", "c++" -> "C++";
            case "go" -> "Go";
            default -> lang;
        };
    }
}
