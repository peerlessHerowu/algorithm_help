package com.algorithm.help.common.security;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.regex.Pattern;

/**
 * Prompt Injection 防护组件
 * 移除/替换用户输入中的 prompt injection 标记
 */
@Slf4j
@Component
public class PromptSanitizer {

    /** 被阻止的 prompt injection 模式 */
    private static final List<Pattern> BLOCKED_PATTERNS = List.of(
            Pattern.compile("(?i)ignore\\s+(previous|above|all)\\s+instructions"),
            Pattern.compile("(?i)you\\s+are\\s+now\\s+"),
            Pattern.compile("(?i)system\\s*:\\s*"),
            Pattern.compile("(?i)\\[INST\\]"),
            Pattern.compile("(?i)<<SYS>>"),
            Pattern.compile("(?i)</s>"),
            Pattern.compile("(?i)\\bACT\\s+AS\\b"),
            Pattern.compile("(?i)forget\\s+everything")
    );

    /**
     * 清理用户输入，移除 prompt injection 标记
     * @param input 用户原始输入
     * @return 清理后的安全字符串
     */
    public String sanitize(String input) {
        if (input == null || input.isBlank()) {
            return input;
        }
        String result = input;
        for (Pattern pattern : BLOCKED_PATTERNS) {
            if (pattern.matcher(result).find()) {
                log.warn("检测到 prompt injection 模式: {}", pattern.pattern());
                result = pattern.matcher(result).replaceAll("[BLOCKED]");
            }
        }
        return result;
    }

    /**
     * 检查 AI 输出是否包含系统提示泄露
     * @return true 表示输出安全
     */
    public boolean isOutputSafe(String output) {
        if (output == null) return true;
        String lower = output.toLowerCase();
        return !lower.contains("system prompt")
                && !lower.contains("you are an ai")
                && !lower.contains("openai api");
    }
}
