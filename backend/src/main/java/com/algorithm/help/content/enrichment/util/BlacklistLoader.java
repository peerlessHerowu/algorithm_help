package com.algorithm.help.content.enrichment.util;

import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.HashSet;
import java.util.Set;

/**
 * 黑名单词汇加载器
 * <p>
 * 在启动时从 classpath:config/content-blacklist.txt 加载黑名单词汇。
 * 用于 QualityScoreStep 自动审核时检查内容是否包含不当词汇。
 */
@Slf4j
@Component
public class BlacklistLoader {

    private static final String BLACKLIST_PATH = "config/content-blacklist.txt";

    private final Set<String> blacklistWords = new HashSet<>();

    @PostConstruct
    public void init() {
        loadBlacklist();
    }

    /**
     * 检查文本是否包含黑名单词汇
     *
     * @param text 待检查文本
     * @return 首个命中的黑名单词汇，无命中返回 null
     */
    public String findBlacklistedWord(String text) {
        if (text == null || text.isBlank()) return null;
        String lowerText = text.toLowerCase();
        for (String word : blacklistWords) {
            if (lowerText.contains(word.toLowerCase())) {
                return word;
            }
        }
        return null;
    }

    /**
     * 检查文本是否包含黑名单词汇
     */
    public boolean containsBlacklisted(String text) {
        return findBlacklistedWord(text) != null;
    }

    /**
     * 获取当前黑名单词汇数量（用于日志/监控）
     */
    public int size() {
        return blacklistWords.size();
    }

    /**
     * 从 classpath 加载黑名单文件
     */
    private void loadBlacklist() {
        try {
            ClassPathResource resource = new ClassPathResource(BLACKLIST_PATH);
            try (BufferedReader reader = new BufferedReader(
                    new InputStreamReader(resource.getInputStream(), StandardCharsets.UTF_8))) {
                String line;
                while ((line = reader.readLine()) != null) {
                    String trimmed = line.trim();
                    // 跳过空行和注释行
                    if (!trimmed.isEmpty() && !trimmed.startsWith("#")) {
                        blacklistWords.add(trimmed);
                    }
                }
            }
            log.info("黑名单词汇加载完成，共 {} 个词汇", blacklistWords.size());
        } catch (Exception e) {
            log.warn("黑名单词汇文件加载失败，将使用空黑名单: {}", e.getMessage());
        }
    }
}
