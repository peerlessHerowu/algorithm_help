package com.algorithm.help.common.security;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.net.InetAddress;
import java.net.URI;
import java.net.UnknownHostException;
import java.util.Set;

/**
 * URL 安全校验组件 — SSRF 防护
 * <p>
 * 功能：
 * 1. 校验 URL 协议（仅允许 HTTP/HTTPS）
 * 2. 解析目标 IP，拦截 IPv4 内网地址段
 * 3. 拦截 IPv6 内网地址（::1、fc00::/7、fe80::/10）
 */
@Slf4j
@Component
public class UrlValidator {

    private static final Set<String> ALLOWED_SCHEMES = Set.of("http", "https");

    /**
     * 校验 URL 是否安全（非内网、协议合法）
     *
     * @param url 待校验的 URL 字符串
     * @return true 表示安全，false 表示被拦截
     */
    public boolean isSafeUrl(String url) {
        if (url == null || url.isBlank()) {
            return false;
        }
        try {
            URI uri = URI.create(url);
            return validateScheme(uri) && validateHost(uri);
        } catch (IllegalArgumentException e) {
            log.warn("URL 格式无效: {}", url);
            return false;
        }
    }

    /**
     * 校验 URL 并返回解析后的安全 IP 地址（用于防止 DNS Rebinding）
     *
     * @param url 待校验的 URL 字符串
     * @return 解析后的安全 InetAddress，校验失败返回 null
     */
    public InetAddress resolveAndValidate(String url) {
        if (url == null || url.isBlank()) {
            return null;
        }
        try {
            URI uri = URI.create(url);
            if (!validateScheme(uri)) {
                return null;
            }
            String host = uri.getHost();
            if (host == null || host.isBlank()) {
                return null;
            }
            InetAddress address = InetAddress.getByName(host);
            if (isPrivateAddress(address)) {
                log.warn("SSRF 防护：拦截内网地址 {} -> {}", url, address.getHostAddress());
                return null;
            }
            return address;
        } catch (IllegalArgumentException | UnknownHostException e) {
            log.warn("URL 解析失败: {}", url);
            return null;
        }
    }

    /** 校验协议：仅允许 HTTP/HTTPS */
    private boolean validateScheme(URI uri) {
        String scheme = uri.getScheme();
        if (scheme == null || !ALLOWED_SCHEMES.contains(scheme.toLowerCase())) {
            log.warn("SSRF 防护：拦截非法协议 {}", scheme);
            return false;
        }
        return true;
    }

    /** 校验目标主机是否为内网地址 */
    private boolean validateHost(URI uri) {
        String host = uri.getHost();
        if (host == null || host.isBlank()) {
            return false;
        }
        try {
            InetAddress address = InetAddress.getByName(host);
            if (isPrivateAddress(address)) {
                log.warn("SSRF 防护：拦截内网地址 {} -> {}", host, address.getHostAddress());
                return false;
            }
            return true;
        } catch (UnknownHostException e) {
            log.warn("DNS 解析失败: {}", host);
            return false;
        }
    }

    /**
     * 判断 IP 地址是否为内网/保留地址
     * <p>
     * IPv4 内网段：10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, 127.0.0.0/8
     * IPv6 内网：::1 (loopback), fc00::/7 (ULA), fe80::/10 (link-local)
     */
    private boolean isPrivateAddress(InetAddress address) {
        // 使用 JDK 内置方法覆盖大部分场景
        if (address.isLoopbackAddress()
                || address.isSiteLocalAddress()
                || address.isLinkLocalAddress()
                || address.isAnyLocalAddress()) {
            return true;
        }

        byte[] bytes = address.getAddress();

        // IPv4 额外检查
        if (bytes.length == 4) {
            return isPrivateIpv4(bytes);
        }

        // IPv6 额外检查
        if (bytes.length == 16) {
            return isPrivateIpv6(bytes);
        }

        return false;
    }

    /**
     * 检查 IPv4 内网地址段
     * 10.0.0.0/8 | 172.16.0.0/12 | 192.168.0.0/16 | 127.0.0.0/8
     */
    private boolean isPrivateIpv4(byte[] bytes) {
        int first = bytes[0] & 0xFF;
        int second = bytes[1] & 0xFF;

        // 10.0.0.0/8
        if (first == 10) {
            return true;
        }
        // 127.0.0.0/8
        if (first == 127) {
            return true;
        }
        // 172.16.0.0/12 (172.16.x.x - 172.31.x.x)
        if (first == 172 && (second >= 16 && second <= 31)) {
            return true;
        }
        // 192.168.0.0/16
        if (first == 192 && second == 168) {
            return true;
        }
        // 169.254.0.0/16 (Link-local)
        if (first == 169 && second == 254) {
            return true;
        }
        return false;
    }

    /**
     * 检查 IPv6 内网地址
     * ::1 (loopback) | fc00::/7 (ULA) | fe80::/10 (link-local)
     */
    private boolean isPrivateIpv6(byte[] bytes) {
        int first = bytes[0] & 0xFF;

        // fc00::/7 — Unique Local Address (ULA)
        if ((first & 0xFE) == 0xFC) {
            return true;
        }
        // fe80::/10 — Link-local
        if (first == 0xFE && (bytes[1] & 0xC0) == 0x80) {
            return true;
        }
        return false;
    }
}
