package com.algorithm.help.interactive.session;

import com.algorithm.help.interactive.entity.SessionMessage;
import com.algorithm.help.interactive.repository.SessionMessageRepository;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.concurrent.TimeUnit;

/**
 * 会话管理核心服务
 * <p>
 * Redis 存储实时上下文（快速读写），MySQL 持久化完整消息历史。
 * Redis 作为热缓存，MySQL 作为持久层；Redis 缺失时从 MySQL 回填。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class SessionManager {

    private final InteractiveSessionRepository sessionRepo;
    private final SessionMessageRepository messageRepo;
    private final StringRedisTemplate redisTemplate;
    private final ObjectMapper objectMapper;

    // Redis Key: session:context:{sessionId}, TTL 30 分钟
    private static final String CONTEXT_KEY_PREFIX = "session:context:";
    private static final long CONTEXT_TTL_MINUTES = 30;

    // 最大对话轮数（20 轮 = 40 条消息）
    private static final int MAX_MESSAGES = 40;

    // 过期阈值（30 分钟）
    private static final long EXPIRE_THRESHOLD_MS = CONTEXT_TTL_MINUTES * 60 * 1000;

    /**
     * 创建新会话
     *
     * @return InteractiveSession 实体（status=ACTIVE）
     */
    public InteractiveSession createSession(String userId, SessionType type, String problemId) {
        InteractiveSession session = new InteractiveSession()
                .setUserId(userId)
                .setType(type)
                .setStatus(SessionStatus.ACTIVE)
                .setProblemId(problemId);
        sessionRepo.save(session);

        // 初始化 Redis 上下文为空 JSON 数组
        String key = CONTEXT_KEY_PREFIX + session.getSessionId();
        redisTemplate.opsForValue().set(key, "[]", CONTEXT_TTL_MINUTES, TimeUnit.MINUTES);

        log.info("会话创建: sessionId={}, type={}, userId={}", session.getSessionId(), type, userId);
        return session;
    }

    /**
     * 获取对话上下文
     * <p>
     * 优先从 Redis 读取；Redis 缺失则从 MySQL SessionMessage 表加载并写入 Redis。
     */
    public List<Map<String, String>> getContext(String sessionId) {
        String key = CONTEXT_KEY_PREFIX + sessionId;
        String json = redisTemplate.opsForValue().get(key);

        if (json != null) {
            return parseContext(json);
        }

        // Redis 缺失，从 MySQL 回填
        return loadContextFromDb(sessionId);
    }

    /**
     * 追加消息到上下文
     * <p>
     * 同时写入 Redis（热缓存）和 MySQL（持久层）。
     * 超过 MAX_MESSAGES 时移除最早的消息，但保留第一条 system 消息。
     */
    public void appendMessage(String sessionId, String role, String content) {
        // 持久化到 MySQL
        persistMessage(sessionId, role, content);

        // 更新 Redis 上下文
        List<Map<String, String>> context = getContext(sessionId);
        context.add(Map.of("role", role, "content", content));

        // 滑动窗口：超过上限时移除最早的消息（保留第一条 system 消息）
        trimContext(context);

        // 写回 Redis 并刷新 TTL
        saveContextToRedis(sessionId, context);

        // 更新 InteractiveSession 的 lastActiveAt
        updateLastActiveAt(sessionId);
    }

    /**
     * 结束会话
     *
     * @return 完整对话历史（从 MySQL）
     */
    public List<SessionMessage> endSession(String sessionId) {
        sessionRepo.findById(sessionId).ifPresent(session -> {
            session.setStatus(SessionStatus.COMPLETED);
            session.setCompletedAt(System.currentTimeMillis());
            sessionRepo.save(session);
        });

        // 清除 Redis 上下文
        redisTemplate.delete(CONTEXT_KEY_PREFIX + sessionId);

        // 返回完整对话历史
        return messageRepo.findBySessionIdOrderByCreatedAtAsc(sessionId);
    }

    /**
     * 完成会话（向后兼容）
     */
    public void completeSession(String sessionId) {
        endSession(sessionId);
    }

    /**
     * 断线重连
     * <p>
     * 检查 session 状态为 ACTIVE 或 PAUSED，从 Redis 或 MySQL 恢复上下文，
     * 更新状态为 ACTIVE，返回对话历史。
     *
     * @return 对话历史；session 不存在或状态不允许时返回 null
     */
    public List<Map<String, String>> reconnect(String sessionId) {
        Optional<InteractiveSession> opt = sessionRepo.findById(sessionId);
        if (opt.isEmpty()) {
            return null;
        }

        InteractiveSession session = opt.get();
        if (session.getStatus() != SessionStatus.ACTIVE && session.getStatus() != SessionStatus.PAUSED) {
            log.warn("会话状态不允许重连: sessionId={}, status={}", sessionId, session.getStatus());
            return null;
        }

        // 更新状态为 ACTIVE
        session.setStatus(SessionStatus.ACTIVE);
        session.setLastActiveAt(System.currentTimeMillis());
        sessionRepo.save(session);

        // 从 Redis 或 MySQL 恢复上下文
        List<Map<String, String>> context = getContext(sessionId);

        // 刷新 Redis TTL
        redisTemplate.expire(CONTEXT_KEY_PREFIX + sessionId, CONTEXT_TTL_MINUTES, TimeUnit.MINUTES);

        log.info("会话重连成功: sessionId={}", sessionId);
        return context;
    }

    // ======================== Task 2.3: 会话过期清理定时任务 ========================

    /**
     * 每 5 分钟清理过期会话
     * <p>
     * 查找 status=ACTIVE 且 lastActiveAt 超过 30 分钟的会话，
     * 标记为 EXPIRED 并清除对应 Redis 上下文。
     */
    @Scheduled(fixedRate = 300_000)
    public void cleanExpiredSessions() {
        long threshold = System.currentTimeMillis() - EXPIRE_THRESHOLD_MS;
        List<InteractiveSession> expired = sessionRepo
                .findByStatusAndLastActiveAtBefore(SessionStatus.ACTIVE, threshold);

        for (InteractiveSession session : expired) {
            session.setStatus(SessionStatus.EXPIRED);
            sessionRepo.save(session);
            redisTemplate.delete(CONTEXT_KEY_PREFIX + session.getSessionId());
        }

        if (!expired.isEmpty()) {
            log.info("清理过期会话: {} 个", expired.size());
        }
    }

    // ======================== 私有方法 ========================

    /**
     * 从 MySQL 加载上下文并写入 Redis
     */
    private List<Map<String, String>> loadContextFromDb(String sessionId) {
        List<SessionMessage> messages = messageRepo.findBySessionIdOrderByCreatedAtAsc(sessionId);
        List<Map<String, String>> context = new ArrayList<>(messages.size());
        for (SessionMessage msg : messages) {
            context.add(Map.of("role", msg.getRole(), "content", msg.getContent()));
        }

        // 回填到 Redis
        if (!context.isEmpty()) {
            saveContextToRedis(sessionId, context);
        }

        return context;
    }

    /**
     * 持久化消息到 MySQL
     */
    private void persistMessage(String sessionId, String role, String content) {
        SessionMessage msg = new SessionMessage()
                .setSessionId(sessionId)
                .setRole(role)
                .setContent(content);
        messageRepo.save(msg);
    }

    /**
     * 滑动窗口裁剪：超过 MAX_MESSAGES 时移除最早的消息，但保留第一条 system 消息
     */
    private void trimContext(List<Map<String, String>> context) {
        while (context.size() > MAX_MESSAGES) {
            // 如果第一条是 system 消息，从第二条开始移除
            if ("system".equals(context.get(0).get("role"))) {
                context.remove(1);
            } else {
                context.remove(0);
            }
        }
    }

    /**
     * 保存上下文到 Redis 并设置 TTL
     */
    private void saveContextToRedis(String sessionId, List<Map<String, String>> context) {
        try {
            String json = objectMapper.writeValueAsString(context);
            String key = CONTEXT_KEY_PREFIX + sessionId;
            redisTemplate.opsForValue().set(key, json, CONTEXT_TTL_MINUTES, TimeUnit.MINUTES);
        } catch (Exception e) {
            log.error("保存会话上下文到 Redis 失败: sessionId={}, error={}", sessionId, e.getMessage());
        }
    }

    /**
     * 解析 JSON 字符串为上下文列表
     */
    private List<Map<String, String>> parseContext(String json) {
        try {
            return objectMapper.readValue(json, new TypeReference<>() {});
        } catch (Exception e) {
            log.warn("解析会话上下文 JSON 失败: {}", e.getMessage());
            return new ArrayList<>();
        }
    }

    /**
     * 更新会话最后活跃时间
     */
    private void updateLastActiveAt(String sessionId) {
        sessionRepo.findById(sessionId).ifPresent(session -> {
            session.setLastActiveAt(System.currentTimeMillis());
            sessionRepo.save(session);
        });
    }
}
