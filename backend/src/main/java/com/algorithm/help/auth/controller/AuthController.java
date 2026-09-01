package com.algorithm.help.auth.controller;

import com.algorithm.help.auth.dto.AuthResponse;
import com.algorithm.help.auth.dto.LoginRequest;
import com.algorithm.help.auth.dto.RegisterRequest;
import com.algorithm.help.auth.dto.UserInfoResponse;
import com.algorithm.help.auth.entity.User;
import com.algorithm.help.auth.service.AuthService;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

/**
 * 认证控制器 — 注册、登录、刷新、登出
 */
@RestController
@RequestMapping("/api/v1/auth")
@RequiredArgsConstructor
public class AuthController {

    private static final String REFRESH_TOKEN_COOKIE = "refresh_token";
    private static final String ACCESS_TOKEN_COOKIE = "access_token";
    private static final int COOKIE_MAX_AGE_7D = 7 * 24 * 60 * 60;

    private final AuthService authService;

    /** 用户注册 */
    @PostMapping("/register")
    public ResponseEntity<UserInfoResponse> register(@Valid @RequestBody RegisterRequest request) {
        UserInfoResponse userInfo = authService.register(request);
        return ResponseEntity.ok(userInfo);
    }

    /** 用户登录 — 返回 Token 对并设置 httpOnly cookie */
    @PostMapping("/login")
    public ResponseEntity<AuthResponse> login(@Valid @RequestBody LoginRequest request,
                                              HttpServletResponse response) {
        AuthResponse authResponse = authService.login(request);
        setTokenCookies(response, authResponse);
        return ResponseEntity.ok(authResponse);
    }

    /** 刷新 Token — 旧 Token 失效，生成新 Token 对 */
    @PostMapping("/refresh")
    public ResponseEntity<AuthResponse> refresh(@RequestBody(required = false) RefreshBody body,
                                                HttpServletRequest request,
                                                HttpServletResponse response) {
        String refreshToken = extractRefreshToken(body, request);
        if (refreshToken == null) {
            return ResponseEntity.badRequest().build();
        }
        AuthResponse authResponse = authService.refresh(refreshToken);
        setTokenCookies(response, authResponse);
        return ResponseEntity.ok(authResponse);
    }

    /** 登出 — 撤销 Refresh Token 并清除 Cookie */
    @PostMapping("/logout")
    public ResponseEntity<Void> logout(@RequestBody(required = false) RefreshBody body,
                                       HttpServletRequest request,
                                       HttpServletResponse response) {
        String refreshToken = extractRefreshToken(body, request);
        if (refreshToken != null) {
            authService.logout(refreshToken);
        }
        clearTokenCookies(response);
        return ResponseEntity.ok().build();
    }

    /** 获取当前用户信息 */
    @GetMapping("/me")
    public ResponseEntity<UserInfoResponse> me(@AuthenticationPrincipal User user) {
        if (user == null) {
            return ResponseEntity.status(401).build();
        }
        return ResponseEntity.ok(authService.getCurrentUser(user));
    }

    // ==================== 私有方法 ====================

    /** 设置 httpOnly Cookie（Access + Refresh） */
    private void setTokenCookies(HttpServletResponse response, AuthResponse authResponse) {
        response.addCookie(buildHttpOnlyCookie(ACCESS_TOKEN_COOKIE,
                authResponse.getAccessToken(), COOKIE_MAX_AGE_7D));
        response.addCookie(buildHttpOnlyCookie(REFRESH_TOKEN_COOKIE,
                authResponse.getRefreshToken(), COOKIE_MAX_AGE_7D));
    }

    /** 清除认证相关 Cookie */
    private void clearTokenCookies(HttpServletResponse response) {
        response.addCookie(buildHttpOnlyCookie(ACCESS_TOKEN_COOKIE, "", 0));
        response.addCookie(buildHttpOnlyCookie(REFRESH_TOKEN_COOKIE, "", 0));
    }

    /** 构建安全的 httpOnly Cookie */
    private Cookie buildHttpOnlyCookie(String name, String value, int maxAge) {
        Cookie cookie = new Cookie(name, value);
        cookie.setHttpOnly(true);
        cookie.setSecure(true);
        cookie.setPath("/");
        cookie.setMaxAge(maxAge);
        return cookie;
    }

    /** 从 Body 或 Cookie 中提取 Refresh Token */
    private String extractRefreshToken(RefreshBody body, HttpServletRequest request) {
        // 优先 Body
        if (body != null && body.refreshToken != null) {
            return body.refreshToken;
        }
        // 回退到 Cookie
        Cookie[] cookies = request.getCookies();
        if (cookies != null) {
            for (Cookie cookie : cookies) {
                if (REFRESH_TOKEN_COOKIE.equals(cookie.getName())) {
                    return cookie.getValue();
                }
            }
        }
        return null;
    }

    /** Refresh 请求体（可选） */
    record RefreshBody(String refreshToken) {}
}
