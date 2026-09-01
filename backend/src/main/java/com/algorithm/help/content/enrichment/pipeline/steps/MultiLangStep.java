package com.algorithm.help.content.enrichment.pipeline.steps;

import com.algorithm.help.content.codegen.CodeSnippet;
import com.algorithm.help.content.codegen.MultiLangCodeGenerator;
import com.algorithm.help.content.enrichment.pipeline.EnrichmentContext;
import com.algorithm.help.content.enrichment.pipeline.EnrichmentResult;
import com.algorithm.help.content.enrichment.pipeline.EnrichmentStep;
import com.algorithm.help.content.generator.LeveledContent.Approach;
import com.algorithm.help.entity.Problem;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * 多语言代码补全步骤：检查 ctx.codeImplementations 中缺失的语言，调用 AI 补全
 * <p>
 * 非核心步骤，失败时降级跳过（只保留已有语言代码）。
 * L1 级别不含代码，直接跳过。
 */
@Slf4j
@Component
@Order(4)
public class MultiLangStep implements EnrichmentStep {

    /** 目标语言列表（从配置读取） */
    private final Set<String> targetLanguages;

    private final MultiLangCodeGenerator codeGenerator;

    public MultiLangStep(MultiLangCodeGenerator codeGenerator,
                         @org.springframework.beans.factory.annotation.Value("${ai.generation.default-languages:python,java,go,cpp}")
                         java.util.List<String> configuredLanguages) {
        this.codeGenerator = codeGenerator;
        this.targetLanguages = new java.util.HashSet<>(configuredLanguages);
    }

    @Override
    public String getName() {
        return "multi-lang";
    }

    @Override
    public boolean isApplicable(EnrichmentContext ctx) {
        // L1 级别不含代码，跳过多语言补全
        return ctx.getTargetLevel() != 1;
    }

    @Override
    public EnrichmentResult process(EnrichmentContext ctx) {
        Map<String, String> existing = ctx.getCodeImplementations();
        Set<String> missingLanguages = findMissingLanguages(existing);

        if (missingLanguages.isEmpty()) {
            log.info("多语言步骤：所有目标语言已存在，无需补全");
            return EnrichmentResult.ok();
        }

        log.info("多语言步骤：需要补全 {} 种语言: {}", missingLanguages.size(), missingLanguages);

        Approach approach = buildApproachFromContext(ctx);
        Problem problem = ctx.getProblem();

        List<CodeSnippet> snippets = codeGenerator.generateForApproach(approach, problem);

        // 将生成结果中属于缺失语言的片段写入上下文
        int added = 0;
        for (CodeSnippet snippet : snippets) {
            if (missingLanguages.contains(snippet.getLanguage()) && snippet.getCode() != null) {
                existing.put(snippet.getLanguage(), snippet.getCode());
                added++;
            }
        }

        log.info("多语言步骤完成：成功补全 {}/{} 种语言", added, missingLanguages.size());

        if (added == 0) {
            return EnrichmentResult.fail("所有缺失语言均生成失败");
        }
        return EnrichmentResult.ok();
    }

    @Override
    public boolean isCritical() {
        return false;
    }

    /**
     * 找出目标语言中尚未存在的语言
     */
    private Set<String> findMissingLanguages(Map<String, String> existing) {
        if (existing == null || existing.isEmpty()) {
            return targetLanguages;
        }
        Set<String> missing = new HashSet<>(targetLanguages);
        missing.removeAll(existing.keySet());
        return missing;
    }

    /**
     * 从上下文中构建 Approach 对象供 MultiLangCodeGenerator 使用
     */
    private Approach buildApproachFromContext(EnrichmentContext ctx) {
        Approach approach = new Approach();
        approach.setName(buildApproachName(ctx));
        approach.setIdea(extractIdea(ctx));
        approach.setTimeComplexity(ctx.getTimeComplexity());
        approach.setSpaceComplexity(ctx.getSpaceComplexity());
        return approach;
    }

    /**
     * 构建解法名称：优先使用题目标题
     */
    private String buildApproachName(EnrichmentContext ctx) {
        if (ctx.getProblem() == null) return "算法实现";
        String titleCn = ctx.getProblem().getTitleCn();
        String title = ctx.getProblem().getTitle();
        return (titleCn != null && !titleCn.isBlank()) ? titleCn : (title != null ? title : "算法实现");
    }

    /**
     * 从润色后的内容中提取核心思路（取前 500 字符作为摘要）
     */
    private String extractIdea(EnrichmentContext ctx) {
        String content = ctx.getPolishedContent();
        if (content == null || content.isBlank()) return "";
        return content.length() > 500 ? content.substring(0, 500) : content;
    }
}
