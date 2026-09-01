package com.algorithm.help.internal.filter;

import com.algorithm.help.internal.config.InternalApiProperties;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.annotation.Order;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Map;

/**
 * 内部 API Token 鉴权过滤器
 * <p>
 * 仅拦截 /api/v1/internal/** 路径，校验 X-Internal-Token 请求头
 */
@Slf4j
@Component
@Order(1)
@RequiredArgsConstructor
public class InternalTokenFilter extends OncePerRequestFilter {

    private static final String INTERNAL_PATH_PREFIX = "/api/v1/internal/";
    private static final String TOKEN_HEADER = "X-Internal-Token";

    private final InternalApiProperties properties;
    private final ObjectMapper objectMapper;

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain)
            throws ServletException, IOException {
        String path = request.getRequestURI();

        // 仅拦截内部 API 路径
        if (!path.startsWith(INTERNAL_PATH_PREFIX)) {
            filterChain.doFilter(request, response);
            return;
        }

        String token = request.getHeader(TOKEN_HEADER);
        if (token == null || !token.equals(properties.getToken())) {
            log.warn("内部 API 鉴权失败: path={}, remoteAddr={}", path, request.getRemoteAddr());
            writeUnauthorized(response);
            return;
        }

        filterChain.doFilter(request, response);
    }

    private void writeUnauthorized(HttpServletResponse response) throws IOException {
        response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding("UTF-8");
        Map<String, Object> body = Map.of(
                "code", 401,
                "message", "无效的内部 API Token",
                "timestamp", System.currentTimeMillis()
        );
        objectMapper.writeValue(response.getWriter(), body);
    }
}
