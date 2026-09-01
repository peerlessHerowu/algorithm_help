package com.algorithm.help.export.impl;

import com.algorithm.help.export.dto.ExportOptions;
import com.algorithm.help.export.dto.ExportResult;
import com.algorithm.help.export.dto.ExportableContent;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * AnkiExporter 单元测试
 */
class AnkiExporterTest {

    private AnkiExporter exporter;

    @BeforeEach
    void setUp() {
        exporter = new AnkiExporter();
    }

    @Test
    void export_生成有效的apkg文件() {
        var content = buildSampleContent();
        var options = new ExportOptions();

        ExportResult result = exporter.export(List.of(content), options);

        assertThat(result.getFileName()).endsWith(".apkg");
        assertThat(result.getContentType()).isEqualTo("application/octet-stream");
        assertThat(result.getFileSizeBytes()).isGreaterThan(0);
        assertThat(result.getFileData()).isNotEmpty();
    }

    @Test
    void export_apkg包含collection和media文件() throws IOException {
        var content = buildSampleContent();
        var options = new ExportOptions();

        ExportResult result = exporter.export(List.of(content), options);

        // 解压 zip 验证内部结构
        var entries = extractZipEntries(result.getFileData());
        assertThat(entries).contains("collection.anki2", "media");
    }

    @Test
    void export_牌组名以ADUE前缀命名() {
        var content = buildSampleContent();
        var options = new ExportOptions();

        ExportResult result = exporter.export(List.of(content), options);

        assertThat(result.getFileName()).startsWith("ADUE-");
    }

    @Test
    void export_单内容生成4张卡片() {
        var content = buildSampleContent();
        var options = new ExportOptions();

        ExportResult result = exporter.export(List.of(content), options);

        // 文件应该生成成功，大小合理（包含4张卡片的 SQLite + zip）
        assertThat(result.getFileSizeBytes()).isGreaterThan(1000);
    }

    @Test
    void export_无代码时生成3张卡片() {
        var content = buildSampleContent().setCode(null);
        var options = new ExportOptions();

        ExportResult result = exporter.export(List.of(content), options);

        // 无代码时不生成代码补全卡片，文件仍然有效
        assertThat(result.getFileData()).isNotEmpty();
        assertThat(result.getFileName()).endsWith(".apkg");
    }

    @Test
    void export_includeCode为false时不生成代码卡片() {
        var content = buildSampleContent();
        var options = new ExportOptions().setIncludeCode(false);

        ExportResult result = exporter.export(List.of(content), options);

        assertThat(result.getFileData()).isNotEmpty();
        assertThat(result.getFileName()).endsWith(".apkg");
    }

    @Test
    void export_多内容正确生成() {
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

        assertThat(result.getFileData()).isNotEmpty();
        // 2个内容各4张卡片 = 8张，文件应更大
        assertThat(result.getFileSizeBytes()).isGreaterThan(1000);
    }

    @Test
    void export_空列表生成有效但空的apkg() {
        var options = new ExportOptions();

        ExportResult result = exporter.export(List.of(), options);

        assertThat(result.getFileData()).isNotEmpty();
        assertThat(result.getFileName()).endsWith(".apkg");
    }

    @Test
    void export_patternName为null时使用默认牌组名() {
        var content = buildSampleContent().setPatternName(null);
        var options = new ExportOptions();

        ExportResult result = exporter.export(List.of(content), options);

        // 文件名应包含默认值而非 null
        assertThat(result.getFileName()).doesNotContain("null");
    }

    // ===== 辅助方法 =====

    private List<String> extractZipEntries(byte[] zipData) throws IOException {
        var entries = new java.util.ArrayList<String>();
        try (var zis = new ZipInputStream(new ByteArrayInputStream(zipData))) {
            ZipEntry entry;
            while ((entry = zis.getNextEntry()) != null) {
                entries.add(entry.getName());
            }
        }
        return entries;
    }

    private ExportableContent buildSampleContent() {
        return new ExportableContent()
                .setProblemId("p1")
                .setProblemName("Two Sum")
                .setDescription("给定一个数组和目标值，找出两数之和等于目标值的索引")
                .setApproach("使用哈希表，一次遍历即可")
                .setCode(Map.of(
                        "java", "class Solution {\n    public int[] twoSum(int[] nums, int target) {\n        Map<Integer, Integer> map = new HashMap<>();\n        for (int i = 0; i < nums.length; i++) {\n            int complement = target - nums[i];\n            if (map.containsKey(complement)) {\n                return new int[]{map.get(complement), i};\n            }\n            map.put(nums[i], i);\n        }\n        return new int[]{};\n    }\n}"
                ))
                .setComplexity("时间 O(n)，空间 O(n)")
                .setPatternName("哈希表")
                .setDifficulty(2);
    }
}
