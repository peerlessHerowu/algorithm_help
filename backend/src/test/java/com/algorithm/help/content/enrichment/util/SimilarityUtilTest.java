package com.algorithm.help.content.enrichment.util;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

/**
 * SimilarityUtil 单元测试
 */
class SimilarityUtilTest {

    // ===== Jaccard 相似度测试 =====

    @Test
    @DisplayName("Jaccard: 完全相同的字符串 → 1.0")
    void jaccard_identicalStrings_returns1() {
        double sim = SimilarityUtil.jaccardSimilarity("hello world", "hello world");
        assertEquals(1.0, sim, 0.001);
    }

    @Test
    @DisplayName("Jaccard: 完全不同的字符串 → 0.0")
    void jaccard_completelyDifferent_returns0() {
        double sim = SimilarityUtil.jaccardSimilarity("hello world", "foo bar baz");
        assertEquals(0.0, sim, 0.001);
    }

    @Test
    @DisplayName("Jaccard: 部分重叠的字符串 → 介于 0-1 之间")
    void jaccard_partialOverlap_returnsBetween0And1() {
        double sim = SimilarityUtil.jaccardSimilarity("hello world foo", "hello world bar");
        // tokens: {hello, world, foo} vs {hello, world, bar}
        // intersection: {hello, world} = 2, union: {hello, world, foo, bar} = 4
        assertEquals(0.5, sim, 0.001);
    }

    @Test
    @DisplayName("Jaccard: null 输入 → 0.0")
    void jaccard_nullInput_returns0() {
        assertEquals(0.0, SimilarityUtil.jaccardSimilarity(null, "hello"));
        assertEquals(0.0, SimilarityUtil.jaccardSimilarity("hello", null));
        assertEquals(0.0, SimilarityUtil.jaccardSimilarity(null, null));
    }

    @Test
    @DisplayName("Jaccard: 空字符串 → 边界处理")
    void jaccard_emptyStrings() {
        assertEquals(1.0, SimilarityUtil.jaccardSimilarity("", ""));
        assertEquals(0.0, SimilarityUtil.jaccardSimilarity("hello", ""));
        assertEquals(0.0, SimilarityUtil.jaccardSimilarity("", "hello"));
    }

    // ===== 余弦相似度测试 =====

    @Test
    @DisplayName("Cosine: 完全相同的字符串 → 1.0")
    void cosine_identicalStrings_returns1() {
        double sim = SimilarityUtil.cosineSimilarity("hello world foo", "hello world foo");
        assertEquals(1.0, sim, 0.001);
    }

    @Test
    @DisplayName("Cosine: 完全不同的字符串 → 0.0")
    void cosine_completelyDifferent_returns0() {
        double sim = SimilarityUtil.cosineSimilarity("apple banana cherry", "dog elephant fox");
        assertEquals(0.0, sim, 0.001);
    }

    @Test
    @DisplayName("Cosine: 部分重叠 → 介于 0-1 之间")
    void cosine_partialOverlap_returnsBetween0And1() {
        double sim = SimilarityUtil.cosineSimilarity(
                "hash table solution two sum",
                "hash table approach two pointer");
        assertTrue(sim > 0.0 && sim < 1.0);
    }

    @Test
    @DisplayName("Cosine: null 输入 → 0.0")
    void cosine_nullInput_returns0() {
        assertEquals(0.0, SimilarityUtil.cosineSimilarity(null, "hello"));
        assertEquals(0.0, SimilarityUtil.cosineSimilarity("hello", null));
    }

    @Test
    @DisplayName("Cosine: 空字符串 → 边界处理")
    void cosine_emptyStrings() {
        assertEquals(1.0, SimilarityUtil.cosineSimilarity("", ""));
        assertEquals(0.0, SimilarityUtil.cosineSimilarity("hello", ""));
    }

    @Test
    @DisplayName("Cosine: 重复词汇增加相似度")
    void cosine_repeatedWords_higherSimilarity() {
        // 重复同样的词应该有更高相似度
        double sim1 = SimilarityUtil.cosineSimilarity("hash hash hash", "hash table search");
        double sim2 = SimilarityUtil.cosineSimilarity("hash", "hash table search");
        assertTrue(sim1 > 0);
        assertTrue(sim2 > 0);
    }
}
