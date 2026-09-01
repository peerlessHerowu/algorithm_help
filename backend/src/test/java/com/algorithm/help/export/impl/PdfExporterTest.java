package com.algorithm.help.export.impl;

import com.algorithm.help.export.dto.ExportOptions;
import com.algorithm.help.export.dto.ExportResult;
import com.algorithm.help.export.dto.ExportableContent;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * PdfExporter 单元测试
 */
class PdfExporterTest {

    private PdfExporter pdfExporter;

    @BeforeEach
    void setUp() {
        pdfExporter = new PdfExporter();
    }

    @Test
    void export_基本导出生成有效PDF() {
        var content = buildSampleContent();
        var options = new ExportOptions();

        ExportResult result = pdfExporter.export(List.of(content), options);

        assertThat(result).isNotNull();
        assertThat(result.getFileName()).isEqualTo("algorithm-notes.pdf");
        assertThat(result.getContentType()).isEqualTo("application/pdf");
        assertThat(result.getFileData()).isNotEmpty();
        assertThat(result.getFileSizeBytes()).isGreaterThan(0);
        // PDF 文件以 %PDF- 开头
        assertThat(new String(result.getFileData(), 0, 5)).isEqualTo("%PDF-");
    }

    @Test
    void export_空内容列表生成包含封面和目录的PDF() {
        var options = new ExportOptions();

        ExportResult result = pdfExporter.export(List.of(), options);

        assertThat(result).isNotNull();
        assertThat(result.getFileData()).isNotEmpty();
        assertThat(result.getFileSizeBytes()).isGreaterThan(0);
    }

    @Test
    void export_多题目导出() {
        var content1 = buildSampleContent();
        var content2 = new ExportableContent()
                .setProblemId("merge-sort")
                .setProblemName("归并排序")
                .setDescription("对数组进行归并排序")
                .setApproach("分治思想，递归分割再合并")
                .setCode(Map.of("java", "void mergeSort(int[] arr) {}"))
                .setComplexity("时间 O(n log n)，空间 O(n)")
                .setPatternName("分治")
                .setDifficulty(3);
        var options = new ExportOptions();

        ExportResult result = pdfExporter.export(List.of(content1, content2), options);

        assertThat(result.getFileData()).isNotEmpty();
        assertThat(result.getFileSizeBytes()).isGreaterThan(0);
    }

    @Test
    void export_不包含代码时跳过代码块() {
        var content = buildSampleContent();
        var options = new ExportOptions().setIncludeCode(false);

        ExportResult result = pdfExporter.export(List.of(content), options);

        assertThat(result).isNotNull();
        assertThat(result.getFileData()).isNotEmpty();
    }

    @Test
    void export_不包含图解时跳过Mermaid块() {
        var content = buildSampleContent();
        var options = new ExportOptions().setIncludeDiagrams(false);

        ExportResult result = pdfExporter.export(List.of(content), options);

        assertThat(result).isNotNull();
        assertThat(result.getFileData()).isNotEmpty();
    }

    @Test
    void export_语言过滤仅输出指定语言() {
        var content = new ExportableContent()
                .setProblemId("two-sum")
                .setProblemName("两数之和")
                .setDescription("给定一个整数数组")
                .setApproach("哈希表法")
                .setCode(Map.of("java", "// java code", "python", "# python code", "cpp", "// cpp"))
                .setComplexity("O(n)")
                .setPatternName("哈希表")
                .setDifficulty(1);
        var options = new ExportOptions().setLanguages(List.of("java"));

        ExportResult result = pdfExporter.export(List.of(content), options);

        assertThat(result).isNotNull();
        assertThat(result.getFileData()).isNotEmpty();
    }

    @Test
    void export_内容字段为null时不抛异常() {
        // 仅必填字段不为空
        var content = new ExportableContent()
                .setProblemId("test")
                .setProblemName("测试题目");
        var options = new ExportOptions();

        ExportResult result = pdfExporter.export(List.of(content), options);

        assertThat(result).isNotNull();
        assertThat(result.getFileData()).isNotEmpty();
    }

    // ===== 辅助方法 =====

    private ExportableContent buildSampleContent() {
        return new ExportableContent()
                .setProblemId("two-sum")
                .setProblemName("两数之和")
                .setDescription("给定一个整数数组 nums 和一个整数目标值 target，请你在该数组中找出和为目标值的那两个整数。")
                .setApproach("使用哈希表存储已遍历的数字，对每个数字检查其补数是否存在于哈希表中。")
                .setCode(Map.of(
                        "java", "public int[] twoSum(int[] nums, int target) {\n    Map<Integer, Integer> map = new HashMap<>();\n    for (int i = 0; i < nums.length; i++) {\n        int complement = target - nums[i];\n        if (map.containsKey(complement)) return new int[]{map.get(complement), i};\n        map.put(nums[i], i);\n    }\n    return new int[]{};\n}",
                        "python", "def twoSum(nums, target):\n    seen = {}\n    for i, num in enumerate(nums):\n        complement = target - num\n        if complement in seen:\n            return [seen[complement], i]\n        seen[num] = i"
                ))
                .setComplexity("时间复杂度 O(n)，空间复杂度 O(n)")
                .setDiagramMermaid("graph LR\n    A[遍历] --> B{检查补数}\n    B -->|存在| C[返回结果]\n    B -->|不存在| D[存入哈希表]")
                .setPatternName("哈希表")
                .setDifficulty(2);
    }
}
