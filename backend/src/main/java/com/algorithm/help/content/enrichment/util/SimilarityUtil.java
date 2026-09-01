package com.algorithm.help.content.enrichment.util;

import java.util.*;
import java.util.stream.Collectors;

/**
 * 相似度计算工具类
 * <p>
 * 提供 Jaccard 相似度（基于分词）和余弦相似度（基于 TF 词频向量）的计算。
 * 用于差异化检查步骤判断新内容与已有内容的重复程度。
 */
public final class SimilarityUtil {

    private SimilarityUtil() {
    }

    /**
     * 计算两个字符串的 Jaccard 相似度
     * <p>
     * 分词策略：按空格和标点拆分为 token 集合，计算交集/并集比值。
     *
     * @param a 字符串 A
     * @param b 字符串 B
     * @return 相似度 [0, 1]
     */
    public static double jaccardSimilarity(String a, String b) {
        if (a == null || b == null) return 0.0;
        if (a.isBlank() && b.isBlank()) return 1.0;
        if (a.isBlank() || b.isBlank()) return 0.0;

        Set<String> tokensA = tokenize(a);
        Set<String> tokensB = tokenize(b);

        if (tokensA.isEmpty() && tokensB.isEmpty()) return 1.0;
        if (tokensA.isEmpty() || tokensB.isEmpty()) return 0.0;

        Set<String> intersection = new HashSet<>(tokensA);
        intersection.retainAll(tokensB);

        Set<String> union = new HashSet<>(tokensA);
        union.addAll(tokensB);

        return (double) intersection.size() / union.size();
    }

    /**
     * 计算两个字符串的余弦相似度
     * <p>
     * 基于简单词频向量（TF）计算余弦值。适用于内容段落级别的相似度比较。
     *
     * @param a 字符串 A
     * @param b 字符串 B
     * @return 相似度 [0, 1]
     */
    public static double cosineSimilarity(String a, String b) {
        if (a == null || b == null) return 0.0;
        if (a.isBlank() && b.isBlank()) return 1.0;
        if (a.isBlank() || b.isBlank()) return 0.0;

        Map<String, Integer> tfA = buildTermFrequency(a);
        Map<String, Integer> tfB = buildTermFrequency(b);

        if (tfA.isEmpty() && tfB.isEmpty()) return 1.0;
        if (tfA.isEmpty() || tfB.isEmpty()) return 0.0;

        // 计算点积
        double dotProduct = 0.0;
        for (Map.Entry<String, Integer> entry : tfA.entrySet()) {
            Integer countB = tfB.get(entry.getKey());
            if (countB != null) {
                dotProduct += (double) entry.getValue() * countB;
            }
        }

        // 计算模长
        double magnitudeA = magnitude(tfA);
        double magnitudeB = magnitude(tfB);

        if (magnitudeA == 0.0 || magnitudeB == 0.0) return 0.0;

        return dotProduct / (magnitudeA * magnitudeB);
    }

    /**
     * 分词：按空白字符和常见标点拆分，转为小写，过滤空串
     */
    static Set<String> tokenize(String text) {
        if (text == null || text.isBlank()) return Collections.emptySet();
        // 按非字母数字和非中文字符拆分（空白+ASCII标点+中文标点）
        String[] tokens = text.toLowerCase()
                .split("[\\s\\p{Punct}\\uFF01-\\uFF5E\\u3000-\\u303F\\u2000-\\u206F]+");
        return Arrays.stream(tokens)
                .filter(t -> !t.isBlank())
                .collect(Collectors.toSet());
    }

    /**
     * 构建词频映射
     */
    private static Map<String, Integer> buildTermFrequency(String text) {
        if (text == null || text.isBlank()) return Collections.emptyMap();
        String[] tokens = text.toLowerCase()
                .split("[\\s\\p{Punct}\\uFF01-\\uFF5E\\u3000-\\u303F\\u2000-\\u206F]+");
        Map<String, Integer> tf = new HashMap<>();
        for (String token : tokens) {
            if (!token.isBlank()) {
                tf.merge(token, 1, Integer::sum);
            }
        }
        return tf;
    }

    /**
     * 计算向量模长
     */
    private static double magnitude(Map<String, Integer> tf) {
        double sum = 0.0;
        for (int count : tf.values()) {
            sum += (double) count * count;
        }
        return Math.sqrt(sum);
    }
}
