package com.algorithm.help.content.enrichment.pipeline.steps;

import com.algorithm.help.content.enrichment.EnrichedSolutionRepository;
import com.algorithm.help.content.enrichment.EnrichedStatus;
import com.algorithm.help.content.enrichment.pipeline.EnrichmentContext;
import com.algorithm.help.content.enrichment.pipeline.EnrichmentResult;
import com.algorithm.help.content.enrichment.pipeline.EnrichmentStep;
import com.algorithm.help.content.enrichment.util.BlacklistLoader;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import java.util.Map;
import java.util.regex.Pattern;

/**
 * 质量评分步骤：对 enriched 内容进行多维度加权评分并执行自动审核
 * <p>
 * 通用维度（L2-L5）：
 * - 结构完整性 25%：有标题、摘要、内容、Markdown 标题
 * - 代码正确性 25%：至少 2 种语言、语法看起来合理
 * - 内容丰富度 20%：长度达标、有示例
 * - 无跳步检查 15%：无逻辑跳跃，有步骤说明
 * - 多语言覆盖 15%：覆盖的语言数量
 * <p>
 * L1 特殊维度（无代码）：
 * - 结构完整性 35%
 * - 内容丰富度 30%
 * - 无跳步检查 20%
 * - 表达清晰度 15%：语言简洁、有类比说明
 * <p>
 * 自动审核逻辑：score >= 0.6 + 无黑名单 + 代码语法正确 → PUBLISHED
 * <p>
 * 非核心步骤，失败时使用默认分 0.5。
 */
@Slf4j
@Component
@Order(7)
@RequiredArgsConstructor
public class QualityScoreStep implements EnrichmentStep {

    /** 自动发布阈值 */
    private static final float AUTO_PUBLISH_THRESHOLD = 0.6f;

    /** 各级别内容最小长度（字符数） */
    private static final Map<Integer, Integer> MIN_CONTENT_LENGTH = Map.of(
            1, 200,
            2, 500,
            3, 800,
            4, 1200,
            5, 1500
    );

    /** 代码语法基础检查正则 */
    private static final Pattern CODE_SYNTAX_PATTERN = Pattern.compile(
            "(def |class |function |public |private |func |import |from |return )",
            Pattern.MULTILINE
    );

    private final BlacklistLoader blacklistLoader;
    private final EnrichedSolutionRepository enrichedRepo;

    @Override
    public String getName() {
        return "quality-score";
    }

    @Override
    public boolean isApplicable(EnrichmentContext ctx) {
        return ctx.getPolishedContent() != null;
    }

    @Override
    public EnrichmentResult process(EnrichmentContext ctx) {
        int level = ctx.getTargetLevel();
        log.info("质量评分开始：level={}", level);

        float score = (level == 1) ? scoreL1(ctx) : scoreGeneral(ctx);
        ctx.setQualityScore(score);
        log.info("质量评分完成：score={}", score);

        // 执行自动审核
        performAutoReview(ctx, score);

        return EnrichmentResult.ok();
    }

    @Override
    public boolean isCritical() {
        return false;
    }

    // ===== 通用评分（L2-L5）=====

    /**
     * 通用 5 维度加权评分
     */
    private float scoreGeneral(EnrichmentContext ctx) {
        float structure = scoreStructure(ctx) * 0.25f;
        float codeCorrectness = scoreCodeCorrectness(ctx) * 0.25f;
        float richness = scoreContentRichness(ctx) * 0.20f;
        float noSkip = scoreNoSkip(ctx) * 0.15f;
        float multiLang = scoreMultiLangCoverage(ctx) * 0.15f;

        return clamp(structure + codeCorrectness + richness + noSkip + multiLang);
    }

    // ===== L1 特殊评分 =====

    /**
     * L1 评分：无代码维度，侧重清晰度和内容丰富度
     */
    private float scoreL1(EnrichmentContext ctx) {
        float structure = scoreStructure(ctx) * 0.35f;
        float richness = scoreContentRichness(ctx) * 0.30f;
        float noSkip = scoreNoSkip(ctx) * 0.20f;
        float clarity = scoreClarity(ctx) * 0.15f;

        return clamp(structure + richness + noSkip + clarity);
    }

    // ===== 各维度评分方法 =====

    /**
     * 结构完整性：检查标题、摘要、Markdown 层级结构
     */
    private float scoreStructure(EnrichmentContext ctx) {
        String content = ctx.getPolishedContent();
        float score = 0f;

        // 有内容
        if (content != null && !content.isBlank()) score += 0.2f;

        // 有 Markdown 标题（## 或 ###）
        if (content != null && content.contains("##")) score += 0.3f;

        // 有段落分隔（多个换行）
        if (content != null && content.contains("\n\n")) score += 0.2f;

        // 内容结构有序（检查是否有步骤编号或列表项）
        if (content != null && (content.contains("1.") || content.contains("- "))) score += 0.15f;

        // 有总结段落
        if (content != null && (content.contains("总结") || content.contains("小结")
                || content.contains("Summary"))) score += 0.15f;

        return Math.min(score, 1.0f);
    }

    /**
     * 代码正确性：检查是否有代码块、至少 2 种语言、语法合理
     */
    private float scoreCodeCorrectness(EnrichmentContext ctx) {
        Map<String, String> codes = ctx.getCodeImplementations();
        if (codes == null || codes.isEmpty()) return 0f;

        float score = 0f;

        // 至少有代码
        score += 0.3f;

        // 至少 2 种语言
        if (codes.size() >= 2) score += 0.3f;

        // 语法基础检查（代码中包含常见关键字）
        int validCount = 0;
        for (String code : codes.values()) {
            if (code != null && CODE_SYNTAX_PATTERN.matcher(code).find()) {
                validCount++;
            }
        }
        if (validCount > 0) score += 0.2f;
        if (validCount >= 2) score += 0.2f;

        return Math.min(score, 1.0f);
    }

    /**
     * 内容丰富度：长度、示例、图解
     */
    private float scoreContentRichness(EnrichmentContext ctx) {
        String content = ctx.getPolishedContent();
        if (content == null) return 0f;

        int level = ctx.getTargetLevel();
        int minLength = MIN_CONTENT_LENGTH.getOrDefault(level, 500);
        float score = 0f;

        // 长度达标
        if (content.length() >= minLength) score += 0.4f;
        else score += 0.4f * ((float) content.length() / minLength);

        // 有示例或图解
        if (content.contains("示例") || content.contains("例如")
                || content.contains("Example")) score += 0.3f;

        // 有可视化内容
        if (ctx.getVisualization() != null && !ctx.getVisualization().isBlank()) score += 0.3f;
        else if (content.contains("```mermaid") || content.contains("```")) score += 0.15f;

        return Math.min(score, 1.0f);
    }

    /**
     * 无跳步检查：内容有步骤说明、无逻辑跳跃
     */
    private float scoreNoSkip(EnrichmentContext ctx) {
        String content = ctx.getPolishedContent();
        if (content == null) return 0f;

        float score = 0f;

        // 有步骤编号（1. 2. 3. 或 Step 1 等）
        if (content.matches("(?s).*\\d+\\..*\\d+\\..*")) score += 0.4f;

        // 有过渡词汇（首先/然后/接下来/最后等）
        int transitions = countTransitionWords(content);
        if (transitions >= 3) score += 0.3f;
        else if (transitions >= 1) score += 0.15f;

        // 有解释性说明（因为/所以/由于/这样做的原因等）
        if (content.contains("因为") || content.contains("所以")
                || content.contains("由于") || content.contains("原因")
                || content.contains("because") || content.contains("therefore")) {
            score += 0.3f;
        }

        return Math.min(score, 1.0f);
    }

    /**
     * 表达清晰度（L1 专用）：语言简洁、有类比
     */
    private float scoreClarity(EnrichmentContext ctx) {
        String content = ctx.getPolishedContent();
        if (content == null) return 0f;

        float score = 0f;

        // 平均句长适中（非过长句子）
        String[] sentences = content.split("[。.!！?？]");
        if (sentences.length > 0) {
            int avgLen = content.length() / sentences.length;
            if (avgLen <= 80) score += 0.4f;
            else if (avgLen <= 120) score += 0.2f;
        }

        // 有类比说明
        if (content.contains("比如") || content.contains("就像")
                || content.contains("类似") || content.contains("想象")
                || content.contains("analogy") || content.contains("like")) {
            score += 0.3f;
        }

        // 有通俗解释
        if (content.contains("简单来说") || content.contains("通俗地说")
                || content.contains("直觉上") || content.contains("本质上")) {
            score += 0.3f;
        }

        return Math.min(score, 1.0f);
    }

    /**
     * 多语言覆盖度评分
     */
    private float scoreMultiLangCoverage(EnrichmentContext ctx) {
        Map<String, String> codes = ctx.getCodeImplementations();
        if (codes == null || codes.isEmpty()) return 0f;

        int count = codes.size();
        if (count >= 4) return 1.0f;
        if (count >= 3) return 0.75f;
        if (count >= 2) return 0.5f;
        return 0.25f;
    }

    // ===== 自动审核逻辑 =====

    /**
     * 自动审核：满足条件则设为 PUBLISHED，否则 PENDING_REVIEW
     * <p>
     * 条件：score >= 0.6 + 无黑名单词汇 + 代码语法正确 + 非首次生成
     */
    private void performAutoReview(EnrichmentContext ctx, float score) {
        String content = ctx.getPolishedContent();

        // 检查黑名单
        String blacklistedWord = blacklistLoader.findBlacklistedWord(content);
        if (blacklistedWord != null) {
            log.warn("自动审核：命中黑名单词汇 [{}]，进入人工审核", blacklistedWord);
            ctx.getWarnings().add("命中黑名单词汇: " + blacklistedWord);
            return; // 保持 DRAFT/PENDING_REVIEW 状态，由调用方设置
        }

        // 检查代码语法
        boolean codeSyntaxValid = isCodeSyntaxValid(ctx);

        // 检查是否为首次生成（同题同级别无已有 PUBLISHED 记录则为首次）
        boolean isFirstGeneration = isFirstGeneration(ctx);

        // 自动发布判定（score >= 0.6 + 无黑名单 + 代码语法正确）
        if (score >= AUTO_PUBLISH_THRESHOLD && codeSyntaxValid) {
            log.info("自动审核通过：score={}, 无黑名单, 语法正确 → PUBLISHED", score);
            ctx.getWarnings().add("auto-review:PUBLISHED");
        } else {
            log.info("自动审核未通过：score={}, codeSyntax={} → PENDING_REVIEW",
                    score, codeSyntaxValid);
            ctx.getWarnings().add("auto-review:PENDING_REVIEW");
        }
    }

    /**
     * 代码语法基础验证
     */
    private boolean isCodeSyntaxValid(EnrichmentContext ctx) {
        Map<String, String> codes = ctx.getCodeImplementations();
        // L1 无代码，直接视为通过
        if (ctx.getTargetLevel() == 1) return true;
        if (codes == null || codes.isEmpty()) return false;

        // 至少有一种语言的代码包含常见关键字
        for (String code : codes.values()) {
            if (code != null && CODE_SYNTAX_PATTERN.matcher(code).find()) {
                return true;
            }
        }
        return false;
    }

    /**
     * 判断是否为首次生成（同题同级别无已有 PUBLISHED 记录）
     */
    private boolean isFirstGeneration(EnrichmentContext ctx) {
        if (ctx.getProblem() == null) return true;
        long count = enrichedRepo.countByProblemIdAndLevelAndStatus(
                ctx.getProblem().getId(), ctx.getTargetLevel(), EnrichedStatus.PUBLISHED);
        return count == 0;
    }

    // ===== 工具方法 =====

    /**
     * 统计过渡词汇出现次数
     */
    private int countTransitionWords(String content) {
        String[] transitions = {"首先", "然后", "接下来", "最后", "其次",
                "第一", "第二", "第三", "First", "Then", "Next", "Finally"};
        int count = 0;
        for (String word : transitions) {
            if (content.contains(word)) count++;
        }
        return count;
    }

    /**
     * 将分数限制在 [0, 1] 范围
     */
    private float clamp(float value) {
        return Math.max(0f, Math.min(1f, value));
    }
}
