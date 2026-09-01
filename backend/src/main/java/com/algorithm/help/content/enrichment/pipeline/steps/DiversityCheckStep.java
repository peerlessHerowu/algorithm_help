package com.algorithm.help.content.enrichment.pipeline.steps;

import com.algorithm.help.content.enrichment.EnrichedSolution;
import com.algorithm.help.content.enrichment.EnrichedSolutionRepository;
import com.algorithm.help.content.enrichment.EnrichedStatus;
import com.algorithm.help.content.enrichment.pipeline.EnrichmentContext;
import com.algorithm.help.content.enrichment.pipeline.EnrichmentResult;
import com.algorithm.help.content.enrichment.pipeline.EnrichmentStep;
import com.algorithm.help.content.enrichment.util.SimilarityUtil;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * 差异化检查步骤：确保新生成内容与已有同题同级别解析有足够差异
 * <p>
 * 对比策略：
 * - 标题 Jaccard 相似度 >= 0.7 → 拒绝
 * - 核心内容余弦相似度 >= 0.6 → 拒绝
 * <p>
 * 非核心步骤，失败时降级跳过（允许发布）。
 */
@Slf4j
@Component
@Order(6)
@RequiredArgsConstructor
public class DiversityCheckStep implements EnrichmentStep {

    /** 标题相似度阈值 */
    private static final double TITLE_SIMILARITY_THRESHOLD = 0.7;

    /** 内容相似度阈值 */
    private static final double CONTENT_SIMILARITY_THRESHOLD = 0.6;

    private final EnrichedSolutionRepository enrichedRepo;

    @Override
    public String getName() {
        return "diversity-check";
    }

    @Override
    public boolean isApplicable(EnrichmentContext ctx) {
        // 需要有题目和润色后的内容才能对比
        return ctx.getProblem() != null && ctx.getPolishedContent() != null;
    }

    @Override
    public EnrichmentResult process(EnrichmentContext ctx) {
        String problemId = ctx.getProblem().getId();
        int level = ctx.getTargetLevel();

        log.info("差异化检查开始：problem={}, level={}", problemId, level);

        // 查询同题同级别已发布的记录
        List<EnrichedSolution> existing = enrichedRepo
                .findByProblemIdAndLevelAndStatusOrderBySortOrderAsc(
                        problemId, level, EnrichedStatus.PUBLISHED);

        if (existing.isEmpty()) {
            log.info("差异化检查：无已有记录，直接通过");
            return EnrichmentResult.ok();
        }

        // 提取当前内容的标题和核心段落
        String currentTitle = extractTitle(ctx);
        String currentCore = extractCoreParagraph(ctx);

        // 逐条比较
        for (EnrichedSolution record : existing) {
            String rejectReason = checkSimilarity(record, currentTitle, currentCore);
            if (rejectReason != null) {
                log.warn("差异化检查不通过：{}", rejectReason);
                return EnrichmentResult.fail(rejectReason);
            }
        }

        log.info("差异化检查通过：与 {} 条已有记录均有足够差异", existing.size());
        return EnrichmentResult.ok();
    }

    @Override
    public boolean isCritical() {
        return false;
    }

    /**
     * 与单条已有记录比较相似度
     *
     * @return 拒绝原因，null 表示通过
     */
    private String checkSimilarity(EnrichedSolution record, String currentTitle, String currentCore) {
        // 标题 Jaccard 相似度检查
        double titleSim = SimilarityUtil.jaccardSimilarity(currentTitle, record.getTitle());
        if (titleSim >= TITLE_SIMILARITY_THRESHOLD) {
            return String.format("与已有解析 %s 标题相似度过高 (%.2f >= %.2f)",
                    record.getId(), titleSim, TITLE_SIMILARITY_THRESHOLD);
        }

        // 核心内容余弦相似度检查
        String existingCore = extractCoreParagraphFromContent(record.getContent());
        double contentSim = SimilarityUtil.cosineSimilarity(currentCore, existingCore);
        if (contentSim >= CONTENT_SIMILARITY_THRESHOLD) {
            return String.format("与已有解析 %s 核心思路相似度过高 (%.2f >= %.2f)",
                    record.getId(), contentSim, CONTENT_SIMILARITY_THRESHOLD);
        }

        return null;
    }

    /**
     * 从上下文提取标题（取润色内容的第一行作为标题）
     */
    private String extractTitle(EnrichmentContext ctx) {
        String content = ctx.getPolishedContent();
        if (content == null) return "";
        String[] lines = content.split("\n");
        for (String line : lines) {
            String trimmed = line.trim();
            if (!trimmed.isEmpty()) {
                // 去掉 Markdown 标题标记
                return trimmed.replaceFirst("^#+\\s*", "");
            }
        }
        return "";
    }

    /**
     * 从上下文提取核心思路段落（前 500 字符，排除标题和代码块）
     */
    private String extractCoreParagraph(EnrichmentContext ctx) {
        return extractCoreParagraphFromContent(ctx.getPolishedContent());
    }

    /**
     * 从内容文本中提取核心段落用于相似度对比
     */
    private String extractCoreParagraphFromContent(String content) {
        if (content == null || content.isBlank()) return "";

        StringBuilder core = new StringBuilder();
        boolean inCodeBlock = false;

        for (String line : content.split("\n")) {
            // 跳过代码块
            if (line.trim().startsWith("```")) {
                inCodeBlock = !inCodeBlock;
                continue;
            }
            if (inCodeBlock) continue;

            // 跳过标题行
            if (line.trim().startsWith("#")) continue;

            String trimmed = line.trim();
            if (!trimmed.isEmpty()) {
                core.append(trimmed).append(" ");
                if (core.length() >= 500) break;
            }
        }

        return core.toString().trim();
    }
}
