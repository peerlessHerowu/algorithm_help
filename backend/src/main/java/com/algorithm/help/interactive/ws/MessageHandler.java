package com.algorithm.help.interactive.ws;

import org.springframework.web.socket.WebSocketSession;

/**
 * WebSocket 消息处理器接口
 * <p>
 * 每种 WsMessageType 对应一个实现类，通过路由表自动注册
 */
public interface MessageHandler {

    /**
     * 返回当前 handler 支持的消息类型
     */
    WsMessageType supportedType();

    /**
     * 处理消息
     *
     * @param session WebSocket 会话
     * @param message 解析后的消息对象
     */
    void handle(WebSocketSession session, WsMessage message);
}
