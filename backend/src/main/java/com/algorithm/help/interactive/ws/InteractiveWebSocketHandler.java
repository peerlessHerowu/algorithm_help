package com.algorithm.help.interactive.ws;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.io.IOException;
import java.net.URI;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * WebSocket 统一消息处理器
 * <p>
 * 接收 JSON 消息，解析为 WsMessage 后根据 type 路由到对应 handler
 */
@Slf4j
@Component
public class InteractiveWebSocketHandler extends TextWebSocketHandler {

    private final ObjectMapper objectMapper;
    private final Map<WsMessageType, MessageHandler> handlerMap;
    private final WsSessionRegistry sessionRegistry;
    private final WsRateLimiter rateLimiter;
    private final Map<String, WebSocketSession> sessions = new ConcurrentHashMap<>();

    public InteractiveWebSocketHandler(ObjectMapper objectMapper,
                                       List<MessageHandler> handlers,
                                       WsSessionRegistry sessionRegistry,
                                       WsRateLimiter rateLimiter) {
        this.objectMapper = objectMapper;
        this.sessionRegistry = sessionRegistry;
        this.rateLimiter = rateLimiter;
        this.handlerMap = handlers.stream()
                .collect(Collectors.toMap(MessageHandler::supportedType, Function.identity()));
        log.info("已注册 WebSocket 消息处理器: {}", handlerMap.keySet());
    }

    @Override
    public void afterConnectionEstablished(WebSocketSession session) {
        sessions.put(session.getId(), session);
        String userId = getUserId(session);
        if (userId != null) {
            sessionRegistry.register(userId, session);
        }
        // 断线重连：检查 URL 参数 reconnectSessionId
        String reconnectSessionId = extractQueryParam(session, "reconnectSessionId");
        if (reconnectSessionId != null && userId != null) {
            boolean restored = sessionRegistry.tryRestore(userId, reconnectSessionId, session);
            if (restored) {
                log.info("WebSocket 断线重连成功: userId={}, reconnectSessionId={}", userId, reconnectSessionId);
            }
        }
        log.info("WebSocket 连接建立: sessionId={}, userId={}", session.getId(), userId);
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) {
        // 速率限制检查
        String userId = getUserId(session);
        if (userId != null && !rateLimiter.allowMessage(userId)) {
            sendError(session, "消息发送过于频繁，请稍后再试");
            return;
        }
        try {
            WsMessage wsMessage = objectMapper.readValue(message.getPayload(), WsMessage.class);
            routeMessage(session, wsMessage);
        } catch (Exception e) {
            log.warn("消息解析失败: {}", e.getMessage());
            sendError(session, "消息格式错误: " + e.getMessage());
        }
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        sessions.remove(session.getId());
        String userId = getUserId(session);
        if (userId != null) {
            // 不立即移除，标记为 PAUSED 状态支持断线重连
            sessionRegistry.pause(userId, session.getId());
        }
        log.info("WebSocket 连接关闭: sessionId={}, userId={}, status={}",
                session.getId(), userId, status);
    }

    @Override
    public void handleTransportError(WebSocketSession session, Throwable exception) {
        log.error("WebSocket 传输错误: sessionId={}, error={}",
                session.getId(), exception.getMessage());
        sessions.remove(session.getId());
        String userId = getUserId(session);
        if (userId != null) {
            sessionRegistry.remove(userId);
        }
    }

    /**
     * 根据消息类型路由到对应 handler
     */
    private void routeMessage(WebSocketSession session, WsMessage wsMessage) {
        if (wsMessage.getType() == null) {
            sendError(session, "消息缺少 type 字段");
            return;
        }
        // 心跳处理：直接回复 PONG
        if (wsMessage.getType() == WsMessageType.PING) {
            sendMessage(session, WsMessage.of(WsMessageType.PONG, wsMessage.getSessionId(), "pong"));
            return;
        }
        MessageHandler handler = handlerMap.get(wsMessage.getType());
        if (handler == null) {
            sendError(session, "未找到消息类型处理器: " + wsMessage.getType());
            return;
        }
        handler.handle(session, wsMessage);
    }

    /**
     * 向客户端发送错误消息
     */
    private void sendError(WebSocketSession session, String errorMsg) {
        sendMessage(session, WsMessage.of(WsMessageType.ERROR, null, errorMsg));
    }

    /**
     * 向指定 WebSocket 会话发送消息
     */
    private void sendMessage(WebSocketSession session, WsMessage message) {
        try {
            String json = objectMapper.writeValueAsString(message);
            session.sendMessage(new TextMessage(json));
        } catch (IOException e) {
            log.error("发送消息失败: sessionId={}, error={}", session.getId(), e.getMessage());
        }
    }

    /**
     * 向指定会话 ID 发送消息（供其他组件调用）
     */
    public void sendToSession(String wsSessionId, WsMessage message) {
        WebSocketSession session = sessions.get(wsSessionId);
        if (session != null && session.isOpen()) {
            sendMessage(session, message);
        }
    }

    /**
     * 从 WebSocket 会话属性中获取 userId
     */
    private String getUserId(WebSocketSession session) {
        Object userId = session.getAttributes().get("userId");
        return userId != null ? userId.toString() : null;
    }

    /**
     * 从 WebSocket 连接 URL 中提取指定查询参数
     */
    private String extractQueryParam(WebSocketSession session, String paramName) {
        URI uri = session.getUri();
        if (uri == null) return null;
        String query = uri.getQuery();
        if (query == null) return null;
        for (String param : query.split("&")) {
            String[] kv = param.split("=", 2);
            if (kv.length == 2 && paramName.equals(kv[0])) {
                return kv[1];
            }
        }
        return null;
    }
}
