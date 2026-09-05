package com.algorithm.help.content.enrichment.pipeline.steps;

import com.algorithm.help.content.enrichment.pipeline.EnrichmentContext;
import com.algorithm.help.content.enrichment.pipeline.EnrichmentResult;
import com.algorithm.help.content.enrichment.pipeline.EnrichmentStep;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import java.util.*;
import java.util.stream.Collectors;

/**
 * 素材筛选步骤：对原始爬取题解进行质量评分、多样性去重、按级别选取
 * <p>
 * 升级版筛选策略（参考 19-内容质量与素材引擎设计.md）：
 * <ol>
 *   <li>过滤：content 长度 < 200 字的低质量素材</li>
 *   <li>综合评分 = crawl_quality * 0.4 + 归一化票数 * 0.3 + 内容长度得分 * 0.3</li>
 *   <li>解法多样性：优先选取不同 approach_tag 的素材（避免多条"哈希表"解法）</li>
 *   <li>按级别控制数量：L1=2条，L2-L3=3条，L4-L5=4条</li>
 * </ol>
 * 非核心步骤：素材可选，失败时降级（PolishStep 走 nosource 路径）。
 */
@Slf4j
@Component
@Order(2)
public class SourceFilterStep implements EnrichmentStep {

    /** 素材内容最短字符数，低于此值认为质量太低 */
    private static final int MIN_CONTENT_LENGTH = 200;

    @Override
    public String getName() {
        return "source-filter";
    }

    @Override
    public boolean isApplicable(EnrichmentContext ctx) {
        return ctx.getSources() != null && !ctx.getSources().isEmpty();
    }

    @Override
    public EnrichmentResult process(EnrichmentContext ctx) {
        List<Map<String, Object>> sources = ctx.getSources();
        int level = ctx.getTargetLevel();

        // Step 1: 过滤内容过短的低质量素材
        List<Map<String, Object>> candidates = sources.stream()
                .filter(s -> {
                    String content = getStr(s, "content");
                    return content != null && content.length() >= MIN_CONTENT_LENGTH;
                })
                .collect(Collectors.toList());

        if (candidates.isEmpty()) {
            log.warn("所有素材内容过短（< {} 字），退回全量 {} 条", MIN_CONTENT_LENGTH, sources.size());
            candidates = new ArrayList<>(sources);
        }

        // Step 2: 综合评分排序
        candidates.sort((a, b) -> Double.compare(computeScore(b, level), computeScore(a, level)));

        // Step 3: 解法多样性去重（不选同一 approach_tag 的多条）
        int maxCount = getMaxCountForLevel(level);
        List<Map<String, Object>> filtered = deduplicateByApproach(candidates, maxCount);

        if (filtered.isEmpty()) {
            return EnrichmentResult.fail("筛选后无可用素材");
        }

        ctx.setFilteredSources(filtered);
        log.info("素材筛选完成: 原始 {} 条 → 候选 {} 条 → 筛选后 {} 条, level=L{}",
                sources.size(), candidates.size(), filtered.size(), level);
        return EnrichmentResult.ok();
    }

    /**
     * 非核心步骤：筛选失败时 PolishStep 会降级到 nosource 模式
     */
    @Override
    public boolean isCritical() {
        return false;
    }

    // ── 私有方法 ──────────────────────────────────────────────────────────

    /**
     * 综合质量评分
     * <ul>
     *   <li>crawl_quality（预评分 0-1）：权重 40%</li>
     *   <li>票数对数归一化（上限 log10(10001)/5）：权重 30%</li>
     *   <li>内容长度得分（适合级别的长度范围）：权重 30%</li>
     * </ul>
     */
    private double computeScore(Map<String, Object> source, int level) {
        // crawl_quality 字段（爬取时预打分）
        double quality = toDouble(source.get("crawl_quality"), 0.5);

        // 票数归一化（对数，上限约 4.0 对应 10000 票）
        double votes = toDouble(source.get("votes"), 0);
        double voteScore = Math.min(1.0, Math.log10(votes + 1) / 4.0);

        // 内容长度适配级别
        int contentLen = getStr(source, "content") != null
                ? getStr(source, "content").length() : 0;
        double lengthScore = computeLengthScore(contentLen, level);

        return quality * 0.4 + voteScore * 0.3 + lengthScore * 0.3;
    }

    /**
     * 内容长度得分：L1/L2 倾向短文（500-2000字），L4/L5 倾向长文（2000+字）
     */
    private double computeLengthScore(int len, int level) {
        int[] preferred = switch (level) {
            case 1 -> new int[]{300, 1500};
            case 2 -> new int[]{500, 2500};
            case 3 -> new int[]{800, 4000};
            case 4 -> new int[]{1500, 6000};
            case 5 -> new int[]{2000, 8000};
            default -> new int[]{500, 3000};
        };
        if (len < preferred[0]) {
            return (double) len / preferred[0];
        } else if (len <= preferred[1]) {
            return 1.0;
        } else {
            // 超长文章轻微惩罚
            return Math.max(0.7, 1.0 - (len - preferred[1]) / 10000.0);
        }
    }

    /**
     * 解法多样性去重：每个 approach_tag 只选一条得分最高的
     * approach_tag 为 null 的素材按"无标签"聚类，最多取 2 条
     */
    private List<Map<String, Object>> deduplicateByApproach(
            List<Map<String, Object>> sorted, int maxCount) {

        List<Map<String, Object>> result = new ArrayList<>();
        Set<String> seenTags = new HashSet<>();
        int nullTagCount = 0;

        for (Map<String, Object> s : sorted) {
            if (result.size() >= maxCount) break;

            String tag = getStr(s, "approach_tag");
            if (tag == null || tag.isBlank()) {
                // 无标签素材最多取 2 条
                if (nullTagCount < 2) {
                    result.add(s);
                    nullTagCount++;
                }
            } else if (seenTags.add(tag)) {
                // 每个解法标签只取第一条（已按评分排序，第一条最优）
                result.add(s);
            }
        }

        // 如果去重后数量不足，从剩余中补充
        if (result.size() < maxCount) {
            for (Map<String, Object> s : sorted) {
                if (result.size() >= maxCount) break;
                if (!result.contains(s)) {
                    result.add(s);
                }
            }
        }

        return result;
    }

    private int getMaxCountForLevel(int level) {
        return switch (level) {
            case 1 -> 2;
            case 2, 3 -> 3;
            case 4, 5 -> 4;
            default -> 3;
        };
    }

    private String getStr(Map<String, Object> map, String key) {
        Object val = map.get(key);
        return val != null ? val.toString() : null;
    }

    private double toDouble(Object val, double defaultVal) {
        if (val instanceof Number n) return n.doubleValue();
        if (val instanceof String s) {
            try { return Double.parseDouble(s); } catch (NumberFormatException e) { /* ignore */ }
        }
        return defaultVal;
    }
}
