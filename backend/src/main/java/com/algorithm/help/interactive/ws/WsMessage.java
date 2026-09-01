package com.algorithm.help.interactive.ws;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.Accessors;

/**
 * WebSocket 统一消息封装
 * <p>
 * 客户端与服务端之间的所有 WebSocket 消息均使用此结构
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Accessors(chain = true)
public class WsMessage {

    /** 消息类型，决定路由到哪个 handler */
    private WsMessageType type;

    /** 会话标识，用于关联上下文 */
    private String sessionId;

    /** 业务负载（JSON 字符串） */
    private String payload;

    /** 消息时间戳（UTC 毫秒） */
    private Long timestamp;

    /**
     * 静态工厂方法：快速构建消息
     */
    public static WsMessage of(WsMessageType type, String sessionId, String payload) {
        return new WsMessage()
                .setType(type)
                .setSessionId(sessionId)
                .setPayload(payload)
                .setTimestamp(System.currentTimeMillis());
    }
}
