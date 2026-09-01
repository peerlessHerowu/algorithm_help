package com.algorithm.help.event;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.scheduling.annotation.EnableScheduling;

import jakarta.annotation.PostConstruct;

/**
 * 事件消费配置 — 创建 Redis Stream Consumer Group
 * 启用 @Scheduled 定时任务
 */
@Slf4j
@Configuration
@EnableScheduling
@RequiredArgsConstructor
public class EventConsumerConfig {

    private final StringRedisTemplate redisTemplate;

    /** Stream 名称 */
    public static final String STREAM_KEY = "stream:content-events";

    /** Consumer Group 名称 */
    public static final String GROUP_NAME = "core-content-group";

    /** Consumer 名称（当前实例） */
    public static final String CONSUMER_NAME = "core-consumer-1";

    /**
     * 应用启动时尝试创建 Consumer Group
     * 如果 Stream 或 Group 已存在则忽略异常
     */
    @PostConstruct
    public void initConsumerGroup() {
        try {
            redisTemplate.opsForStream()
                    .createGroup(STREAM_KEY, GROUP_NAME);
            log.info("创建 Redis Stream Consumer Group: {} -> {}", STREAM_KEY, GROUP_NAME);
        } catch (Exception e) {
            // BUSYGROUP: Consumer Group 已存在，或 Stream 不存在
            log.debug("Consumer Group 已存在或 Stream 尚未创建: {}", e.getMessage());
        }
    }
}
