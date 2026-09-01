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
 * Markdown 格式导出器
 * <p>
 * 输出格式：标题 + 题目描述 + 思路分析 + 代码（按语言分节）+ 复杂度 + 图解 Mermaid 源码。
 * 多题目时在顶部生成目录索引（TOC）。
 */
@Slf4j
@Component
public class MarkdownExporter implements Exporter {

    private static final String FILE_NAME = "algorithm-notes.md";
    private static final String CONTENT_TYPE = "text/markdown";

    @Override
    public ExportResult export(List<ExportableContent> contents, ExportOptions options) {
        log.info("开始 Markdown 导出，共 {} 个题目", contents.size());

        var sb = new StringBuilder();
        appendTitle(sb);

        if (contents.size() > 1) {
            appendToc(sb, contents);
        }

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
     * 追加文档标题
     */
    private void appendTitle(StringBuilder sb) {
        sb.append("# 算法学习笔记\n\n");
    }

    /**
     * 生成目录索引（TOC），多题目时使用
     */
    private void appendToc(StringBuilder sb, List<ExportableContent> contents) {
        sb.append("## 目录\n\n");
        for (var content : contents) {
            String anchor = generateAnchor(content.getProblemName());
            sb.append("- [").append(content.getProblemName()).append("](#")
                    .append(anchor).append(")\n");
        }
        sb.append("\n---\n\n");
    }

    /**
     * 追加单个题目的完整 Markdown 内容
     */
    private void appendContentSection(StringBuilder sb, ExportableContent content,
                                      ExportOptions options) {
        appendSectionHeader(sb, content);
        appendDescription(sb, content);
        appendApproach(sb, content);
        appendCode(sb, content, options);
        appendComplexity(sb, content);
        appendDiagram(sb, content, options);
        sb.append("\n---\n\n");
    }

    /**
     * 题目标题行：## 题目名 (模式名 | 难度X)
     */
    private void appendSectionHeader(StringBuilder sb, ExportableContent content) {
        sb.append("## ").append(content.getProblemName());
        if (content.getPatternName() != null || content.getDifficulty() != null) {
            sb.append(" (");
            if (content.getPatternName() != null) {
                sb.append(content.getPatternName());
            }
            if (content.getDifficulty() != null) {
                if (content.getPatternName() != null) {
                    sb.append(" | ");
                }
                sb.append("难度").append(content.getDifficulty());
            }
            sb.append(")");
        }
        sb.append("\n\n");
    }

    /**
     * 题目描述
     */
    private void appendDescription(StringBuilder sb, ExportableContent content) {
        if (content.getDescription() != null) {
            sb.append("### 题目描述\n\n")
                    .append(content.getDescription()).append("\n\n");
        }
    }

    /**
     * 解题思路
     */
    private void appendApproach(StringBuilder sb, ExportableContent content) {
        if (content.getApproach() != null) {
            sb.append("### 解题思路\n\n")
                    .append(content.getApproach()).append("\n\n");
        }
    }

    /**
     * 代码实现（按语言分节）
     */
    private void appendCode(StringBuilder sb, ExportableContent content,
                            ExportOptions options) {
        if (!options.isIncludeCode()) {
            return;
        }
        Map<String, String> codeMap = content.getCode();
        if (codeMap == null || codeMap.isEmpty()) {
            return;
        }

        sb.append("### 代码实现\n\n");
        List<String> languages = options.getLanguages();
        for (String lang : languages) {
            String code = codeMap.get(lang);
            if (code != null) {
                sb.append("```").append(lang).append("\n")
                        .append(code).append("\n")
                        .append("```\n\n");
            }
        }
    }

    /**
     * 复杂度分析
     */
    private void appendComplexity(StringBuilder sb, ExportableContent content) {
        if (content.getComplexity() != null) {
            sb.append("### 复杂度分析\n\n")
                    .append(content.getComplexity()).append("\n\n");
        }
    }

    /**
     * Mermaid 图解
     */
    private void appendDiagram(StringBuilder sb, ExportableContent content,
                               ExportOptions options) {
        if (!options.isIncludeDiagrams()) {
            return;
        }
        if (content.getDiagramMermaid() == null) {
            return;
        }
        sb.append("### 图解\n\n")
                .append("```mermaid\n")
                .append(content.getDiagramMermaid()).append("\n")
                .append("```\n\n");
    }

    /**
     * 生成 Markdown 锚点（小写、空格转连字符、去除特殊字符）
     */
    private String generateAnchor(String text) {
        if (text == null) {
            return "";
        }
        return text.toLowerCase()
                .replaceAll("[^a-z0-9\\u4e00-\\u9fa5\\s-]", "")
                .replaceAll("\\s+", "-");
    }
}
