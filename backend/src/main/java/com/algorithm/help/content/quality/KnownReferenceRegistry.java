package com.algorithm.help.content.quality;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;

import java.io.InputStream;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * 已知权威来源注册表
 * <p>
 * 加载 known-references.json，提供引用模糊匹配能力
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class KnownReferenceRegistry {

    /** 匹配年份的正则 */
    private static final Pattern YEAR_PATTERN = Pattern.compile("\\b(19|20)\\d{2}\\b");

    /** 最低匹配阈值 */
    private static final double MATCH_THRESHOLD = 0.4;

    private final ObjectMapper objectMapper;

    private List<KnownReference> references = new ArrayList<>();

    @PostConstruct
    public void init() {
        loadReferences();
    }

    /**
     * 从 classpath 加载已知文献数据
     */
    private void loadReferences() {
        try {
            ClassPathResource resource = new ClassPathResource("data/known-references.json");
            InputStream is = resource.getInputStream();
            references = objectMapper.readValue(is, new TypeReference<>() {});
            log.info("加载已知权威来源 {} 条", references.size());
        } catch (Exception e) {
            log.error("加载 known-references.json 失败", e);
        }
    }

    /**
     * 对单条引用进行模糊匹配
     *
     * @param citation 引用文本，如 "Dijkstra, 1959" 或 "CLRS"
     * @return 校验结果
     */
    public ReferenceCheckResult match(String citation) {
        String normalized = citation.toLowerCase(Locale.ROOT).trim();
        String year = extractYear(normalized);

        ReferenceCheckResult bestResult = new ReferenceCheckResult()
                .setCitation(citation)
                .setVerified(false)
                .setConfidence(0.0);

        for (KnownReference ref : references) {
            double score = calculateMatchScore(normalized, year, ref);
            if (score > bestResult.getConfidence()) {
                bestResult.setConfidence(score)
                        .setMatchedReference(ref)
                        .setVerified(score >= MATCH_THRESHOLD);
            }
        }
        return bestResult;
    }

    /**
     * 批量校验引用列表
     *
     * @param citations 引用文本列表
     * @return 校验结果列表
     */
    public List<ReferenceCheckResult> checkAll(List<String> citations) {
        return citations.stream()
                .map(this::match)
                .toList();
    }

    /**
     * 计算引用文本与已知来源的匹配分数
     */
    private double calculateMatchScore(String normalized, String year, KnownReference ref) {
        double maxScore = 0.0;

        // 与正式名称匹配
        maxScore = Math.max(maxScore, scoreName(normalized, ref.getName().toLowerCase(Locale.ROOT), year));

        // 与每个别名匹配
        for (String alias : ref.getAliases()) {
            double aliasScore = scoreName(normalized, alias.toLowerCase(Locale.ROOT), year);
            maxScore = Math.max(maxScore, aliasScore);
        }
        return maxScore;
    }

    /**
     * 计算引用文本与目标名称的相似度
     * <p>
     * 策略：完全包含得高分，部分关键词匹配得中分，年份匹配加分
     */
    private double scoreName(String citation, String target, String citationYear) {
        // 完全包含
        if (citation.contains(target) || target.contains(citation)) {
            return 1.0;
        }

        // 关键词匹配：拆分目标名称为词，计算命中比例
        String[] targetWords = target.split("[\\s,\\-]+");
        int hits = 0;
        for (String word : targetWords) {
            if (word.length() >= 3 && citation.contains(word)) {
                hits++;
            }
        }
        double wordScore = targetWords.length > 0 ? (double) hits / targetWords.length : 0;

        // 年份额外加分
        String targetYear = extractYear(target);
        if (citationYear != null && citationYear.equals(targetYear)) {
            wordScore += 0.2;
        }

        return Math.min(wordScore, 1.0);
    }

    /**
     * 从文本中提取年份
     */
    private String extractYear(String text) {
        Matcher matcher = YEAR_PATTERN.matcher(text);
        return matcher.find() ? matcher.group() : null;
    }
}
