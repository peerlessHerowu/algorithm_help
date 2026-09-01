package com.algorithm.help.interactive.ws;

import com.algorithm.help.auth.service.JwtUtils;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.server.HandshakeInterceptor;

import java.util.Map;

/**
 * WebSocket 握手认证拦截器
 * <p>
 * 从 URL 参数 token 提取 JWT 验证身份，未认证则拒绝连接
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class WsAuthInterceptor implements HandshakeInterceptor {

    private final JwtUtils jwtUtils;

    @Override
    public boolean beforeHandshake(ServerHttpRequest request, ServerHttpResponse response,
                                   WebSocketHandler wsHandler, Map<String, Object> attributes) {
        String token = extractToken(request);
        if (token == null || token.isBlank()) {
            log.warn("WebSocket 连接拒绝：缺少 token 参数");
            return false;
        }
        try {
            String userId = jwtUtils.validateAndGetUserId(token).toString();
            attributes.put("userId", userId);
            return true;
        } catch (Exception e) {
            log.warn("WebSocket 认证失败: {}", e.getMessage());
            return false;
        }
    }

    @Override
    public void afterHandshake(ServerHttpRequest request, ServerHttpResponse response,
                               WebSocketHandler wsHandler, Exception exception) {
        // 无需额外操作
    }

    /**
     * 从 URL 查询参数中提取 token
     */
    private String extractToken(ServerHttpRequest request) {
        String query = request.getURI().getQuery();
        if (query == null) return null;
        for (String param : query.split("&")) {
            String[] kv = param.split("=", 2);
            if (kv.length == 2 && "token".equals(kv[0])) {
                return kv[1];
            }
        }
        return null;
    }
}
