package com.algorithm.help.content.enrichment.util;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * source_url 域名白名单校验器
 * <p>
 * 校验 enriched_solutions 的 source_url 域名是否在白名单内。
 * 允许空 URL（AI_ORIGINAL 类型无来源）。
 * 白名单配置外置到 application.yml。
 *
 * Requirements: 31.3
 */
@Slf4j
@Component
public class UrlWhitelistValidator {

    private final Set<String> allowedDomains;

    public UrlWhitelistValidator(
            @Value("${content.enrichment.url-whitelist:leetcode.com,leetcode-cn.com,github.com,lintcode.com,nowcoder.com,codeforces.com}")
            List<String> whitelist) {
        this.allowedDomains = whitelist.stream()
                .map(String::trim)
                .map(String::toLowerCase)
                .collect(Collectors.toSet());
        log.info("URL 白名单已加载, domains={}", allowedDomains);
    }

    /**
     * 校验 URL 域名是否在白名单中
     *
     * @param url source_url 字段值
     * @return true=合法，false=域名不在白名单
     */
    public boolean isValid(String url) {
        // 空 URL 允许（AI_ORIGINAL 等无来源类型）
        if (url == null || url.isBlank()) {
            return true;
        }

        try {
            String host = new URI(url).getHost();
            if (host == null) {
                return false;
            }
            String lowerHost = host.toLowerCase();
            return allowedDomains.stream().anyMatch(lowerHost::endsWith);
        } catch (Exception e) {
            log.warn("URL 解析失败, url={}: {}", url, e.getMessage());
            return false;
        }
    }

    /**
     * 获取当前白名单（只读）
     */
    public Set<String> getAllowedDomains() {
        return Set.copyOf(allowedDomains);
    }
}
