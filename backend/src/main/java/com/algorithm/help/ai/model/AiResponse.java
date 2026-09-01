package com.algorithm.help.ai.model;

import lombok.Data;
import lombok.experimental.Accessors;

/**
 * AI 响应模型
 */
@Data
@Accessors(chain = true)
public class AiResponse {
    private String content;
    private String provider;
    private long durationMs;
    private boolean fromCache;

    public static AiResponse of(String content, String provider, long durationMs) {
        return new AiResponse()
            .setContent(content)
            .setProvider(provider)
            .setDurationMs(durationMs)
            .setFromCache(false);
    }

    public static AiResponse cached(String content) {
        return new AiResponse()
            .setContent(content)
            .setProvider("cache")
            .setDurationMs(0)
            .setFromCache(true);
    }
}
