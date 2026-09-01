package com.algorithm.help.auth.config;

import org.springframework.context.annotation.Configuration;

/**
 * WebSocket 安全配置 — 空壳类
 * <p>
 * 预留 HandshakeInterceptor 扩展点（为 Spec 4 实时交互准备）
 * 后续将在此配置 WebSocket 握手认证、STOMP 消息安全等
 */
@Configuration
public class WebSocketSecurityConfig {

    // TODO: 实现 HandshakeInterceptor 用于 WebSocket 连接认证
    // TODO: 配置 STOMP 消息端点安全策略
}
