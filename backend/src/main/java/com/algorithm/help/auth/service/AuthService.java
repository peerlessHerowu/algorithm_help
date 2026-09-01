package com.algorithm.help.auth.service;

import com.algorithm.help.auth.dto.AuthResponse;
import com.algorithm.help.auth.dto.LoginRequest;
import com.algorithm.help.auth.dto.RegisterRequest;
import com.algorithm.help.auth.dto.UserInfoResponse;
import com.algorithm.help.auth.entity.User;
import com.algorithm.help.auth.repository.UserRepository;
import io.jsonwebtoken.Claims;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.UUID;

/**
 * 认证服务 — 注册、登录、刷新、登出业务逻辑
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtils jwtUtils;
    private final RefreshTokenService tokenService;

    /** 用户注册 */
    public UserInfoResponse register(RegisterRequest request) {
        if (userRepository.existsByEmail(request.getEmail())) {
            throw new IllegalArgumentException("邮箱已被注册");
        }
        User user = buildNewUser(request);
        user = userRepository.save(user);
        log.info("用户注册成功: email={}", user.getEmail());
        return toUserInfo(user);
    }

    /** 用户登录 — 验证凭据并生成 Token 对 */
    public AuthResponse login(LoginRequest request) {
        User user = userRepository.findByEmail(request.getEmail())
                .orElseThrow(() -> new IllegalArgumentException("邮箱或密码错误"));
        if (!passwordEncoder.matches(request.getPassword(), user.getPasswordHash())) {
            throw new IllegalArgumentException("邮箱或密码错误");
        }
        // 更新最后登录时间
        user.setLastLoginAt(System.currentTimeMillis());
        userRepository.save(user);
        return generateTokenPair(user);
    }

    /** 刷新 Token — 验证旧 Refresh Token 并生成新 Token 对 */
    public AuthResponse refresh(String refreshToken) {
        Claims claims = jwtUtils.parseClaims(refreshToken);
        if (claims == null || !"refresh".equals(claims.get("type", String.class))) {
            throw new IllegalArgumentException("无效的 Refresh Token");
        }
        UUID userId = UUID.fromString(claims.getSubject());
        String tokenId = claims.getId();
        // 校验 Redis 白名单
        if (!tokenService.isValid(userId, tokenId)) {
            throw new IllegalArgumentException("Refresh Token 已失效");
        }
        // 撤销旧 Token，生成新 Token 对
        tokenService.revoke(userId, tokenId);
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("用户不存在"));
        return generateTokenPair(user);
    }

    /** 登出 — 撤销 Refresh Token */
    public void logout(String refreshToken) {
        Claims claims = jwtUtils.parseClaims(refreshToken);
        if (claims == null) {
            return;
        }
        UUID userId = UUID.fromString(claims.getSubject());
        String tokenId = claims.getId();
        tokenService.revoke(userId, tokenId);
        log.info("用户登出: userId={}", userId);
    }

    /** 获取当前用户信息 */
    public UserInfoResponse getCurrentUser(User user) {
        return toUserInfo(user);
    }

    /** 生成 Access + Refresh Token 对 */
    private AuthResponse generateTokenPair(User user) {
        String role = user.getRole().name();
        String accessToken = jwtUtils.generateAccessToken(user.getId(), role);
        JwtUtils.RefreshTokenInfo refreshInfo = jwtUtils.generateRefreshToken(user.getId(), role);
        // 存储 Refresh Token 到 Redis 白名单
        tokenService.store(user.getId(), refreshInfo.tokenId());
        return AuthResponse.builder()
                .accessToken(accessToken)
                .refreshToken(refreshInfo.token())
                .expiresIn(System.currentTimeMillis() + 24 * 60 * 60 * 1000L)
                .build();
    }

    private User buildNewUser(RegisterRequest request) {
        return User.builder()
                .email(request.getEmail())
                .nickname(request.getNickname())
                .passwordHash(passwordEncoder.encode(request.getPassword()))
                .build();
    }

    private UserInfoResponse toUserInfo(User user) {
        return UserInfoResponse.builder()
                .id(user.getId())
                .email(user.getEmail())
                .nickname(user.getNickname())
                .role(user.getRole())
                .tier(user.getTier())
                .build();
    }
}
