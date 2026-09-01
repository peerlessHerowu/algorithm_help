package com.algorithm.help.interactive.ws;

import lombok.Data;
import lombok.experimental.Accessors;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.WebSocketSession;

import java.util.Iterator;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * WebSocket 连接注册表
 * <p>
 * 维护 userId → WebSocketSession 映射，支持断线重连（PAUSED 状态 15 分钟窗口）
 */
@Slf4j
@Component
public class WsSessionRegistry {

    /** 重连窗口：15 分钟 */
    private static final long RECONNECT_WINDOW_MS = 15 * 60 * 1000;

    /** userId → 活跃连接 */
    private final Map<String, WebSocketSession> userSessions = new ConcurrentHashMap<>();

    /** userId → 暂停信息（断线后暂存） */
    private final Map<String, PausedInfo> pausedSessions = new ConcurrentHashMap<>();

    /**
     * 注册用户连接
     */
    public void register(String userId, WebSocketSession session) {
        userSessions.put(userId, session);
        // 如果之前有 paused 状态，清除
        pausedSessions.remove(userId);
        log.info("用户连接注册: userId={}, sessionId={}", userId, session.getId());
    }

    /**
     * 移除用户连接（立即移除，不保留 paused 状态）
     */
    public void remove(String userId) {
        WebSocketSession removed = userSessions.remove(userId);
        pausedSessions.remove(userId);
        if (removed != null) {
            log.info("用户连接移除: userId={}", userId);
        }
    }

    /**
     * 标记为 PAUSED 状态（断线但不立即清除，支持重连）
     */
    public void pause(String userId, String wsSessionId) {
        userSessions.remove(userId);
        PausedInfo info = new PausedInfo()
                .setUserId(userId)
                .setWsSessionId(wsSessionId)
                .setPausedAt(System.currentTimeMillis());
        pausedSessions.put(userId, info);
        log.info("用户连接暂停: userId={}, wsSessionId={}", userId, wsSessionId);
    }

    /**
     * 尝试恢复 PAUSED 连接（断线重连）
     *
     * @param userId             用户 ID
     * @param reconnectSessionId 客户端带回的旧 wsSessionId
     * @param newSession         新建立的 WebSocket 连接
     * @return true=恢复成功, false=无可恢复会话或已过期
     */
    public boolean tryRestore(String userId, String reconnectSessionId, WebSocketSession newSession) {
        PausedInfo info = pausedSessions.get(userId);
        if (info == null) {
            return false;
        }
        // 校验 sessionId 匹配
        if (!info.getWsSessionId().equals(reconnectSessionId)) {
            return false;
        }
        // 校验是否在 15 分钟窗口内
        long elapsed = System.currentTimeMillis() - info.getPausedAt();
        if (elapsed > RECONNECT_WINDOW_MS) {
            pausedSessions.remove(userId);
            return false;
        }
        // 恢复：注册新连接，移除暂停状态
        pausedSessions.remove(userId);
        userSessions.put(userId, newSession);
        log.info("用户重连恢复: userId={}, 旧sessionId={}, 新sessionId={}",
                userId, reconnectSessionId, newSession.getId());
        return true;
    }

    /**
     * 获取用户 WebSocket 会话
     */
    public WebSocketSession getSession(String userId) {
        return userSessions.get(userId);
    }

    /**
     * 判断用户是否在线
     */
    public boolean isOnline(String userId) {
        WebSocketSession session = userSessions.get(userId);
        return session != null && session.isOpen();
    }

    /**
     * 判断用户是否处于 PAUSED 状态（可重连）
     */
    public boolean isPaused(String userId) {
        return pausedSessions.containsKey(userId);
    }

    /**
     * 定时清理超过 15 分钟的 PAUSED 连接（每分钟执行）
     */
    @Scheduled(fixedRate = 60_000)
    public void cleanExpiredPausedSessions() {
        long now = System.currentTimeMillis();
        Iterator<Map.Entry<String, PausedInfo>> it = pausedSessions.entrySet().iterator();
        int cleaned = 0;
        while (it.hasNext()) {
            Map.Entry<String, PausedInfo> entry = it.next();
            if (now - entry.getValue().getPausedAt() > RECONNECT_WINDOW_MS) {
                it.remove();
                cleaned++;
            }
        }
        if (cleaned > 0) {
            log.info("清理过期 PAUSED 连接: {} 个", cleaned);
        }
    }

    /**
     * 暂停状态信息
     */
    @Data
    @Accessors(chain = true)
    static class PausedInfo {
        private String userId;
        private String wsSessionId;
        private Long pausedAt;
    }
}
