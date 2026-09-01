package com.algorithm.help.content.enrichment.pipeline;

import com.algorithm.help.entity.Problem;
import lombok.Data;
import lombok.experimental.Accessors;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * 管线上下文，贯穿整条管线的数据载体
 */
@Data
@Accessors(chain = true)
public class EnrichmentContext {

    /** 当前题目 */
    private Problem problem;

    /** top N 原始题解（通用 Map 结构，因 CrawledSolution 实体尚未建立） */
    private List<Map<String, Object>> sources;

    /** 筛选后的素材子集 */
    private List<Map<String, Object>> filteredSources;

    /** 目标级别（1-5） */
    private int targetLevel;

    /** Prompt 模板内容 */
    private String promptTemplate;

    /** 管线配置 */
    private EnrichmentConfig config;

    // ===== 管线中间产物 =====

    /** 润色后的 Markdown 内容 */
    private String polishedContent;

    /** 多语言代码实现 {"python":"...","java":"..."} */
    private Map<String, String> codeImplementations = new HashMap<>();

    /** 可视化内容（Mermaid/ASCII） */
    private String visualization;

    /** 时间复杂度，如 "O(n)" */
    private String timeComplexity;

    /** 空间复杂度，如 "O(n)" */
    private String spaceComplexity;

    /** 质量评分 0-1 */
    private float qualityScore;

    /** 管线执行过程中的警告信息 */
    private List<String> warnings = new ArrayList<>();
}
