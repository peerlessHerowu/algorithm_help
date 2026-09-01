package com.algorithm.help.ai;

import com.algorithm.help.ai.model.AiRequest;
import com.algorithm.help.ai.model.AiResponse;
import com.algorithm.help.common.exception.AiProviderException;
import com.algorithm.help.config.AiProviderConfig;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;

import java.util.Comparator;
import java.util.List;
import java.util.concurrent.TimeUnit;

/**
 * AI 智能路由器
 * <p>
 * 三层路由逻辑：Redis 缓存 → 按优先级遍历可用 Provider → 写入缓存
 * 包含简单的全局频率控制（Redis 计数器，后续 Task 36.1 升级为双池令牌桶）
 */
@Service
@Slf4j
public class SmartRouter {

    private static final String CACHE_PREFIX = "ai:explanation:";
    private static final String RATE_LIMIT_KEY = "ai:rate:global";
    private static final long CACHE_TTL_HOURS = 24;
    private static final int MAX_CALLS_PER_MINUTE = 60;

    private final List<AIProvider> providers;
    private final RedisTemplate<String, Object> redisTemplate;
    private final AiProviderConfig config;

    public SmartRouter(List<AIProvider> providers,
                       RedisTemplate<String, Object> redisTemplate,
                       AiProviderConfig config) {
        this.providers = providers;
        this.redisTemplate = redisTemplate;
        this.config = config;
    }

    /**
     * 路由 AI 请求：缓存 → 遍历 Provider → 写缓存
     */
    public AiResponse route(AiRequest request) {
        // 1. 检查缓存
        String cacheKey = buildCacheKey(request);
        if (cacheKey != null) {
            AiResponse cached = checkCache(cacheKey);
            if (cached != null) {
                log.debug("缓存命中: {}", cacheKey);
                return cached;
            }
        }

        // 2. 频率控制
        checkRateLimit();

        // 3. 按优先级尝试 Provider
        List<AIProvider> ordered = getOrderedProviders();
        Exception lastException = null;

        for (AIProvider provider : ordered) {
            if (!provider.isAvailable()) {
                log.debug("Provider 不可用，跳过: {}", provider.getName());
                continue;
            }
            try {
                log.info("尝试 Provider: {}", provider.getName());
                AiResponse response = dispatch(provider, request);
                // 4. 成功写入缓存
                if (cacheKey != null) {
                    writeCache(cacheKey, response);
                }
                return response;
            } catch (Exception e) {
                log.warn("Provider {} 调用失败: {}", provider.getName(), e.getMessage());
                lastException = e;
            }
        }

        throw new AiProviderException(
            "所有 AI Provider 均调用失败", lastException);
    }

    /**
     * 构建缓存 Key：
     * - EXPLANATION/LEVELED_EXPLANATION: ai:explanation:{problemId}:L{level}
     * - CHAT/DETECT_ERRORS: 不缓存（返回 null 跳过缓存）
     */
    private String buildCacheKey(AiRequest request) {
        // CHAT 和 DETECT_ERRORS 类型每次内容不同，不适合缓存
        if (request.getType() == AiRequest.RequestType.CHAT
                || request.getType() == AiRequest.RequestType.DETECT_ERRORS) {
            return null;
        }
        String problemId = request.getProblem() != null ? request.getProblem().getId() : "unknown";
        int level = request.getOptions() != null ? request.getOptions().getLevel() : 3;
        return CACHE_PREFIX + problemId + ":L" + level;
    }

    /**
     * 检查 Redis 缓存
     */
    private AiResponse checkCache(String cacheKey) {
        try {
            Object cached = redisTemplate.opsForValue().get(cacheKey);
            if (cached instanceof String content) {
                return AiResponse.cached(content);
            }
        } catch (Exception e) {
            log.warn("Redis 缓存读取失败，降级跳过: {}", e.getMessage());
        }
        return null;
    }

    /**
     * 写入 Redis 缓存，TTL 24 小时
     */
    private void writeCache(String cacheKey, AiResponse response) {
        try {
            redisTemplate.opsForValue().set(
                cacheKey, response.getContent(), CACHE_TTL_HOURS, TimeUnit.HOURS);
        } catch (Exception e) {
            log.warn("Redis 缓存写入失败，不影响主流程: {}", e.getMessage());
        }
    }

    /**
     * 简单的全局频率控制（Redis 计数器，后续升级为双池令牌桶）
     */
    private void checkRateLimit() {
        try {
            Long count = redisTemplate.opsForValue().increment(RATE_LIMIT_KEY);
            if (count != null && count == 1) {
                redisTemplate.expire(RATE_LIMIT_KEY, 1, TimeUnit.MINUTES);
            }
            if (count != null && count > MAX_CALLS_PER_MINUTE) {
                throw new AiProviderException("AI 调用频率超限，请稍后再试");
            }
        } catch (AiProviderException e) {
            throw e;
        } catch (Exception e) {
            log.warn("频率控制 Redis 操作失败，降级放行: {}", e.getMessage());
        }
    }

    /**
     * 按 config.providerPriority 排序 Provider
     */
    private List<AIProvider> getOrderedProviders() {
        List<String> priority = config.getProviderPriority();
        if (priority == null || priority.isEmpty()) {
            return providers;
        }
        return providers.stream()
            .sorted(Comparator.comparingInt(p -> {
                int idx = priority.indexOf(p.getName());
                return idx < 0 ? Integer.MAX_VALUE : idx;
            }))
            .toList();
    }

    /**
     * 根据 request.type 分发到 AIProvider 对应方法
     */
    private AiResponse dispatch(AIProvider provider, AiRequest request) {
        return switch (request.getType()) {
            case EXPLANATION -> provider.generateExplanation(
                request.getProblem(), request.getOptions());
            case TRANSFORM -> provider.transformUserInput(
                request.getContent(), request.getProblem());
            case DIAGRAM -> {
                String diagram = provider.generateDiagram(
                    request.getAlgorithmType(), request.getDiagramType(), request.getInputData());
                yield AiResponse.of(diagram, provider.getName(), 0);
            }
            case CHAT -> provider.interactiveChat(null, request.getContent());
            case DETECT_ERRORS -> provider.detectErrors(request.getContent());
            case LEVELED_EXPLANATION -> {
                int level = request.getOptions() != null ? request.getOptions().getLevel() : 3;
                yield provider.generateLeveledExplanation(request.getContent(), level);
            }
        };
    }
}
