package com.algorithm.help.config;

import com.algorithm.help.ai.AIProvider;
import com.algorithm.help.ai.impl.StaticProvider;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.List;

/**
 * AI Provider 自动注册与回退机制
 * 启动时检测各 Provider 可用性，全部不可用时记录错误日志
 */
@Slf4j
@Configuration
public class AiProviderAutoConfig {

    @Bean
    public ApplicationRunner aiProviderHealthCheck(List<AIProvider> providers) {
        return args -> {
            log.info("已注册 AI Provider 数量: {}", providers.size());
            boolean anyCloudAvailable = false;
            for (AIProvider provider : providers) {
                if (provider instanceof StaticProvider) continue;
                boolean available = provider.isAvailable();
                log.info("  {} → {}", provider.getName(), available ? "可用" : "不可用");
                if (available) anyCloudAvailable = true;
            }
            if (!anyCloudAvailable) {
                log.warn("所有云端/本地 AI Provider 不可用，系统将回退到 StaticProvider（仅提供预生成内容）");
            }
        };
    }
}
