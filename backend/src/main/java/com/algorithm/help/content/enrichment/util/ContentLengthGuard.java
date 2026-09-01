package com.algorithm.help.content.enrichment.util;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.util.Map;

/**
 * AI 输出长度保护
 * <p>
 * 按级别限制 PolishStep 输出的最大字节数：
 * - L1: 5KB
 * - L2-L3: 30KB
 * - L4-L5: 50KB
 * <p>
 * 超出时截断到最近完整段落并添加警告，不中断管线。
 *
 * Requirements: 31.1, 31.2
 */
@Slf4j
@Component
public class ContentLengthGuard {

    private static final Map<Integer, Integer> DEFAULT_MAX_BYTES = Map.of(
            1, 5 * 1024,
            2, 30 * 1024,
            3, 30 * 1024,
            4, 50 * 1024,
            5, 50 * 1024
    );

    @Value("${content.enrichment.guard.l1-max-bytes:5120}")
    private int l1MaxBytes;

    @Value("${content.enrichment.guard.l2l3-max-bytes:30720}")
    private int l2l3MaxBytes;

    @Value("${content.enrichment.guard.l4l5-max-bytes:51200}")
    private int l4l5MaxBytes;

    /**
     * 检查并截断超长内容
     *
     * @param content AI 输出内容
     * @param level   目标级别 1-5
     * @return 截断后的内容（可能与输入相同）
     */
    public GuardResult guard(String content, int level) {
        if (content == null || content.isEmpty()) {
            return GuardResult.unchanged(content);
        }

        int maxBytes = getMaxBytes(level);
        byte[] bytes = content.getBytes(StandardCharsets.UTF_8);

        if (bytes.length <= maxBytes) {
            return GuardResult.unchanged(content);
        }

        // 截断到最近的完整段落
        String truncated = truncateAtParagraph(content, maxBytes);
        String warning = String.format(
                "AI 输出超出 L%d 限制(%dKB > %dKB)，已截断到最近段落",
                level, bytes.length / 1024, maxBytes / 1024);
        log.warn(warning);

        return GuardResult.truncated(truncated, warning);
    }

    private int getMaxBytes(int level) {
        return switch (level) {
            case 1 -> l1MaxBytes;
            case 2, 3 -> l2l3MaxBytes;
            case 4, 5 -> l4l5MaxBytes;
            default -> l2l3MaxBytes;
        };
    }

    /**
     * 截断到最近的完整段落边界（双换行 \n\n）
     */
    private String truncateAtParagraph(String content, int maxBytes) {
        // 先按字节截断
        byte[] bytes = content.getBytes(StandardCharsets.UTF_8);
        String rough = new String(bytes, 0, maxBytes, StandardCharsets.UTF_8);

        // 寻找最后一个段落分隔符
        int lastParagraph = rough.lastIndexOf("\n\n");
        if (lastParagraph > maxBytes / 2) {
            return rough.substring(0, lastParagraph).trim() + "\n\n[内容已截断]";
        }

        // 没有合适段落分隔 → 按最后一个换行截断
        int lastNewline = rough.lastIndexOf('\n');
        if (lastNewline > maxBytes / 2) {
            return rough.substring(0, lastNewline).trim() + "\n\n[内容已截断]";
        }

        // 都没有 → 直接截断
        return rough.trim() + "\n\n[内容已截断]";
    }

    /**
     * 截断结果
     */
    public record GuardResult(String content, String warning, boolean wasTruncated) {
        public static GuardResult unchanged(String content) {
            return new GuardResult(content, null, false);
        }

        public static GuardResult truncated(String content, String warning) {
            return new GuardResult(content, warning, true);
        }
    }
}
