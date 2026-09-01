package com.algorithm.help.content.enrichment.pipeline.steps;

import com.algorithm.help.content.enrichment.pipeline.EnrichmentContext;
import com.algorithm.help.content.enrichment.pipeline.EnrichmentResult;
import com.algorithm.help.content.enrichment.pipeline.EnrichmentStep;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * 素材筛选步骤：按目标级别从原始题解中筛选最匹配的子集
 * <p>
 * 核心步骤，失败则整体失败。
 * 筛选策略：
 * - L1: 取最简单、投票最高的 1-2 条（直觉解法优先）
 * - L2: 取中等难度、投票较高的 2-3 条
 * - L3: 取标准解法 3-4 条（平衡票数和内容丰富度）
 * - L4: 取包含优化思路、详细分析的 3-5 条
 * - L5: 取最复杂、最全面的 4-6 条（含进阶解法）
 */
@Slf4j
@Component
@Order(2)
public class SourceFilterStep implements EnrichmentStep {

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

        List<Map<String, Object>> filtered = filterByLevel(sources, level);

        if (filtered.isEmpty()) {
            return EnrichmentResult.fail("无法筛选出匹配级别 L" + level + " 的素材");
        }

        ctx.setFilteredSources(filtered);
        log.info("素材筛选完成: 输入 {} 条, 输出 {} 条, level=L{}",
                sources.size(), filtered.size(), level);
        return EnrichmentResult.ok();
    }

    @Override
    public boolean isCritical() {
        return true;
    }

    /**
     * 按级别筛选素材
     */
    private List<Map<String, Object>> filterByLevel(List<Map<String, Object>> sources, int level) {
        // 先按投票数排序（降序）
        List<Map<String, Object>> sorted = sources.stream()
                .sorted(Comparator.comparingInt(this::getVotes).reversed())
                .collect(Collectors.toList());

        int maxCount = getMaxCountForLevel(level);
        return selectByLevel(sorted, level, maxCount);
    }

    /**
     * 每个级别取多少条素材
     */
    private int getMaxCountForLevel(int level) {
        return switch (level) {
            case 1 -> 2;
            case 2 -> 3;
            case 3 -> 4;
            case 4 -> 5;
            case 5 -> 6;
            default -> 3;
        };
    }

    /**
     * 按级别策略选取素材
     * L1: 最简单、票最高的（短内容优先）
     * L2-L3: 中等长度、票数较高
     * L4-L5: 内容丰富、复杂度高（长内容优先）
     */
    private List<Map<String, Object>> selectByLevel(
            List<Map<String, Object>> sorted, int level, int maxCount) {

        if (level <= 2) {
            // L1/L2: 优先短内容、高票数
            return sorted.stream()
                    .sorted(Comparator.comparingInt(this::getContentLength))
                    .limit(maxCount)
                    .collect(Collectors.toList());
        } else if (level >= 4) {
            // L4/L5: 优先长内容、高票数
            return sorted.stream()
                    .sorted(Comparator.comparingInt(this::getContentLength).reversed())
                    .limit(maxCount)
                    .collect(Collectors.toList());
        } else {
            // L3: 按票数取前 N 条
            return sorted.stream()
                    .limit(maxCount)
                    .collect(Collectors.toList());
        }
    }

    private int getVotes(Map<String, Object> source) {
        Object votes = source.get("votes");
        if (votes instanceof Number n) return n.intValue();
        if (votes instanceof String s) {
            try { return Integer.parseInt(s); } catch (NumberFormatException e) { return 0; }
        }
        return 0;
    }

    private int getContentLength(Map<String, Object> source) {
        Object content = source.get("content");
        return content != null ? content.toString().length() : 0;
    }
}
