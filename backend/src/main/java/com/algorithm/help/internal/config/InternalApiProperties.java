package com.algorithm.help.internal.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * 内部 API 配置属性
 * <p>
 * 用于 Python 爬虫服务等内部服务调用的鉴权配置
 */
@Data
@Component
@ConfigurationProperties(prefix = "app.internal-api")
public class InternalApiProperties {

    /** 内部 API 鉴权 Token */
    private String token = "change-me-in-production";
}
