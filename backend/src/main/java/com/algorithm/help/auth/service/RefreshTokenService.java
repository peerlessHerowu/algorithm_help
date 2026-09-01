package com.algorithm.help.auth.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.util.UUID;
import java.util.concurrent.TimeUnit;

/**
 * Refresh Token 服务 — 基于 Redis 白名单管理
 * <p>
 * Key 格式: auth:refresh:{userId}:{tokenId}
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class RefreshTokenService {

    private static final String KEY_PREFIX = "auth:refresh:";

    private final StringRedisTemplate redisTemplate;
    private final JwtUtils jwtUtils;

    /** 存储 Refresh Token 到 Redis 白名单 */
    public void store(UUID userId, String tokenId) {
        String key = buildKey(userId, tokenId);
        long expirationMs = jwtUtils.getRefreshTokenExpiration();
        redisTemplate.opsForValue().set(key, "1", expirationMs, TimeUnit.MILLISECONDS);
        log.debug("存储 RefreshToken: userId={}, tokenId={}", userId, tokenId);
    }

    /** 验证 Refresh Token 是否在白名单中 */
    public boolean isValid(UUID userId, String tokenId) {
        String key = buildKey(userId, tokenId);
        return Boolean.TRUE.equals(redisTemplate.hasKey(key));
    }

    /** 撤销指定 Refresh Token */
    public void revoke(UUID userId, String tokenId) {
        String key = buildKey(userId, tokenId);
        redisTemplate.delete(key);
        log.debug("撤销 RefreshToken: userId={}, tokenId={}", userId, tokenId);
    }

    private String buildKey(UUID userId, String tokenId) {
        return KEY_PREFIX + userId + ":" + tokenId;
    }
}
