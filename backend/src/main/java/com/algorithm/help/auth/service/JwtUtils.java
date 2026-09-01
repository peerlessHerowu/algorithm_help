package com.algorithm.help.auth.service;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;
import java.util.UUID;

/**
 * JWT 工具类 — 负责 Token 的生成与验证
 */
@Slf4j
@Component
public class JwtUtils {

    @Value("${jwt.secret}")
    private String secret;

    @Value("${jwt.access-token-expiration}")
    private long accessTokenExpiration;

    @Value("${jwt.refresh-token-expiration}")
    private long refreshTokenExpiration;

    private SecretKey signingKey;

    /** 启动时校验密钥长度并初始化签名 Key */
    @PostConstruct
    public void init() {
        if (secret == null || secret.length() < 32) {
            throw new IllegalStateException(
                    "JWT_SECRET 长度必须 >= 32 字符（256位），当前长度: " +
                            (secret == null ? 0 : secret.length()));
        }
        this.signingKey = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
        log.info("JWT 签名密钥初始化完成");
    }

    /** 生成 Access Token（有效期 24h） */
    public String generateAccessToken(UUID userId, String role) {
        return buildToken(userId, role, accessTokenExpiration, "access");
    }

    /** 生成 Refresh Token（有效期 7d），返回值包含 tokenId */
    public RefreshTokenInfo generateRefreshToken(UUID userId, String role) {
        String tokenId = UUID.randomUUID().toString();
        String token = Jwts.builder()
                .id(tokenId)
                .subject(userId.toString())
                .claim("role", role)
                .claim("type", "refresh")
                .issuedAt(new Date())
                .expiration(new Date(System.currentTimeMillis() + refreshTokenExpiration))
                .signWith(signingKey)
                .compact();
        return new RefreshTokenInfo(token, tokenId);
    }

    /** 验证 Token 并返回 userId，失败时返回 null */
    public UUID validateAndGetUserId(String token) {
        try {
            Claims claims = Jwts.parser()
                    .verifyWith(signingKey)
                    .build()
                    .parseSignedClaims(token)
                    .getPayload();
            return UUID.fromString(claims.getSubject());
        } catch (JwtException | IllegalArgumentException e) {
            log.debug("Token 验证失败: {}", e.getMessage());
            return null;
        }
    }

    /** 从 Token 解析 Claims（不抛异常） */
    public Claims parseClaims(String token) {
        try {
            return Jwts.parser()
                    .verifyWith(signingKey)
                    .build()
                    .parseSignedClaims(token)
                    .getPayload();
        } catch (JwtException | IllegalArgumentException e) {
            return null;
        }
    }

    /** 获取 Refresh Token 过期时间（毫秒） */
    public long getRefreshTokenExpiration() {
        return refreshTokenExpiration;
    }

    private String buildToken(UUID userId, String role, long expiration, String type) {
        return Jwts.builder()
                .subject(userId.toString())
                .claim("role", role)
                .claim("type", type)
                .issuedAt(new Date())
                .expiration(new Date(System.currentTimeMillis() + expiration))
                .signWith(signingKey)
                .compact();
    }

    /** Refresh Token 信息载体 */
    public record RefreshTokenInfo(String token, String tokenId) {}
}
