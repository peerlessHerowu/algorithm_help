package com.algorithm.help.event;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.connection.stream.Consumer;
import org.springframework.data.redis.connection.stream.MapRecord;
import org.springframework.data.redis.connection.stream.ReadOffset;
import org.springframework.data.redis.connection.stream.StreamOffset;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.util.List;
import java.util.Map;

import static com.algorithm.help.event.EventConsumerConfig.*;

/**
 * Redis Stream 事件消费者
 * 轮询消费 stream:content-events，处理 CONTENT_STANDARDIZED 事件
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class ContentEventConsumer {

    private final StringRedisTemplate redisTemplate;
    private final AiEnrichService aiEnrichService;

    /** 最大重试次数 */
    private static final int MAX_RETRY = 3;

    /**
     * 每 5 秒轮询 Redis Stream 获取新消息
     */
    @Scheduled(fixedDelay = 5000)
    public void pollContentEvents() {
        try {
            List<MapRecord<String, Object, Object>> records = readFromStream();
            if (records == null || records.isEmpty()) {
                return;
            }
            for (MapRecord<String, Object, Object> record : records) {
                processRecord(record);
            }
        } catch (Exception e) {
            log.warn("轮询 content-events 异常: {}", e.getMessage());
        }
    }

    /**
     * 从 Redis Stream 读取消息（Consumer Group 模式）
     */
    @SuppressWarnings("unchecked")
    private List<MapRecord<String, Object, Object>> readFromStream() {
        return redisTemplate.opsForStream().read(
                Consumer.from(GROUP_NAME, CONSUMER_NAME),
                org.springframework.data.redis.connection.stream.StreamReadOptions.empty()
                        .count(10)
                        .block(Duration.ofSeconds(2)),
                StreamOffset.create(STREAM_KEY, ReadOffset.lastConsumed())
        );
    }

    /**
     * 处理单条消息，失败重试 3 次后记录死信日志
     */
    private void processRecord(MapRecord<String, Object, Object> record) {
        Map<Object, Object> body = record.getValue();
        String eventType = String.valueOf(body.getOrDefault("eventType", ""));
        String contentId = String.valueOf(body.getOrDefault("contentId", ""));
        String contentType = String.valueOf(body.getOrDefault("contentType", ""));

        log.debug("收到事件: type={}, contentId={}", eventType, contentId);

        if (!"CONTENT_STANDARDIZED".equals(eventType)) {
            acknowledge(record);
            return;
        }

        boolean success = processWithRetry(contentId, contentType);
        if (success) {
            acknowledge(record);
        } else {
            // 死信处理简化为日志记录
            log.error("事件处理失败（已达最大重试次数），死信记录: recordId={}, contentId={}",
                    record.getId(), contentId);
            acknowledge(record);
        }
    }

    /**
     * 带重试的事件处理
     */
    private boolean processWithRetry(String contentId, String contentType) {
        for (int attempt = 1; attempt <= MAX_RETRY; attempt++) {
            try {
                aiEnrichService.enrichContent(contentId, contentType);
                return true;
            } catch (Exception e) {
                log.warn("AI 加工失败 (attempt {}/{}): contentId={}, error={}",
                        attempt, MAX_RETRY, contentId, e.getMessage());
            }
        }
        return false;
    }

    /**
     * ACK 消息
     */
    private void acknowledge(MapRecord<String, Object, Object> record) {
        redisTemplate.opsForStream().acknowledge(STREAM_KEY, GROUP_NAME, record.getId());
    }
}
