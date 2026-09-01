package com.algorithm.help.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

/**
 * 搜索策略配置
 * 支持 mysql-fulltext 和 meilisearch 两种模式
 */
@Data
@Configuration
@ConfigurationProperties(prefix = "search")
public class SearchConfig {

    /**
     * 搜索策略：mysql-fulltext | meilisearch
     */
    private String strategy = "mysql-fulltext";

    /**
     * MeiliSearch 配置（仅 strategy=meilisearch 时使用）
     */
    private MeilisearchProperties meilisearch = new MeilisearchProperties();

    @Data
    public static class MeilisearchProperties {
        private String host = "http://localhost:7700";
        private String apiKey = "";
        private String indexName = "problems";
    }
}
