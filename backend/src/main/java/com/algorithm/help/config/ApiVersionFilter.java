package com.algorithm.help.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

/**
 * API 版本响应头拦截器：为所有响应添加 API-Version 头
 */
@Component
public class ApiVersionFilter extends OncePerRequestFilter {

    private static final String API_VERSION_HEADER = "API-Version";
    private static final String CURRENT_VERSION = "v1";

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain)
            throws ServletException, IOException {
        response.setHeader(API_VERSION_HEADER, CURRENT_VERSION);
        filterChain.doFilter(request, response);
    }
}
