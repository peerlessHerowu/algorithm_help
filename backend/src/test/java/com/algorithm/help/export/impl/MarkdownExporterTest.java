package com.algorithm.help.export.impl;

import com.algorithm.help.export.dto.ExportOptions;
import com.algorithm.help.export.dto.ExportResult;
import com.algorithm.help.export.dto.ExportableContent;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * MarkdownExporter 单元测试
 */
class MarkdownExporterTest {

    private MarkdownExporter exporter;

    @BeforeEach
    void setUp() {
        exporter = new MarkdownExporter();
    }

    @Test
    void export_单题目输出正确格式() {
        var content = buildSampleContent();
        var options = new ExportOptions();

        ExportResult result = exporter.export(List.of(content), options);

        String md = new String(result.getFileData(), StandardCharsets.UTF_8);
        assertThat(result.getFileName()).isEqualTo("algorithm-notes.md");
        assertThat(result.getContentType()).isEqualTo("text/markdown");
        assertThat(result.getFileSizeBytes()).isGreaterThan(0);

        // 验证不包含目录（单题目时）
        assertThat(md).doesNotContain("## 目录");
        // 验证包含各部分
        assertThat(md).contains("# 算法学习笔记");
        assertThat(md).contains("## Two Sum (双指针 | 难度2)");
        assertThat(md).contains("### 题目描述");
        assertThat(md).contains("### 解题思路");
        assertThat(md).contains("### 代码实现");
        assertThat(md).contains("```java");
        assertThat(md).contains("```python");
        assertThat(md).contains("### 复杂度分析");
        assertThat(md).contains("### 图解");
        assertThat(md).contains("```mermaid");
    }

    @Test
    void export_多题目生成目录索引() {
        var content1 = buildSampleContent();
        var content2 = new ExportableContent()
                .setProblemId("p2")
                .setProblemName("三数之和")
                .setDescription("找出数组中三数之和为零的组合")
                .setApproach("排序后双指针")
                .setCode(Map.of("java", "// 三数之和实现"))
                .setComplexity("O(n^2)")
                .setPatternName("双指针")
                .setDifficulty(3);
        var options = new ExportOptions();

        ExportResult result = exporter.export(List.of(content1, content2), options);
        String md = new String(result.getFileData(), StandardCharsets.UTF_8);

        // 验证包含目录
        assertThat(md).contains("## 目录");
        assertThat(md).contains("- [Two Sum]");
        assertThat(md).contains("- [三数之和]");
    }

    @Test
    void export_includeCode为false时不输出代码() {
        var content = buildSampleContent();
        var options = new ExportOptions().setIncludeCode(false);

        ExportResult result = exporter.export(List.of(content), options);
        String md = new String(result.getFileData(), StandardCharsets.UTF_8);

        assertThat(md).doesNotContain("### 代码实现");
        assertThat(md).doesNotContain("```java");
    }

    @Test
    void export_includeDiagrams为false时不输出图解() {
        var content = buildSampleContent();
        var options = new ExportOptions().setIncludeDiagrams(false);

        ExportResult result = exporter.export(List.of(content), options);
        String md = new String(result.getFileData(), StandardCharsets.UTF_8);

        assertThat(md).doesNotContain("### 图解");
        assertThat(md).doesNotContain("```mermaid");
    }

    @Test
    void export_仅输出指定语言的代码() {
        var content = buildSampleContent();
        var options = new ExportOptions().setLanguages(List.of("java"));

        ExportResult result = exporter.export(List.of(content), options);
        String md = new String(result.getFileData(), StandardCharsets.UTF_8);

        assertThat(md).contains("```java");
        assertThat(md).doesNotContain("```python");
    }

    @Test
    void export_无diagram时不输出图解节() {
        var content = buildSampleContent().setDiagramMermaid(null);
        var options = new ExportOptions();

        ExportResult result = exporter.export(List.of(content), options);
        String md = new String(result.getFileData(), StandardCharsets.UTF_8);

        assertThat(md).doesNotContain("### 图解");
    }

    @Test
    void export_空内容列表输出仅标题() {
        var options = new ExportOptions();

        ExportResult result = exporter.export(List.of(), options);
        String md = new String(result.getFileData(), StandardCharsets.UTF_8);

        assertThat(md).isEqualTo("# 算法学习笔记\n\n");
    }

    @Test
    void export_patternName和difficulty均为null时不输出括号() {
        var content = new ExportableContent()
                .setProblemId("p1")
                .setProblemName("Simple Problem")
                .setDescription("desc");
        var options = new ExportOptions().setIncludeCode(false).setIncludeDiagrams(false);

        ExportResult result = exporter.export(List.of(content), options);
        String md = new String(result.getFileData(), StandardCharsets.UTF_8);

        assertThat(md).contains("## Simple Problem\n");
        assertThat(md).doesNotContain("(");
    }

    private ExportableContent buildSampleContent() {
        return new ExportableContent()
                .setProblemId("p1")
                .setProblemName("Two Sum")
                .setDescription("给定一个数组和目标值，找出两数之和等于目标值的索引")
                .setApproach("使用哈希表，一次遍历即可")
                .setCode(Map.of(
                        "java", "class Solution {\n    public int[] twoSum(int[] nums, int target) {\n        // ...\n    }\n}",
                        "python", "def two_sum(nums, target):\n    # ...\n    pass"
                ))
                .setComplexity("时间 O(n)，空间 O(n)")
                .setDiagramMermaid("graph TD\n    A[开始] --> B{遍历数组}\n    B --> C[查找哈希表]")
                .setPatternName("双指针")
                .setDifficulty(2);
    }
}
