package com.algorithm.help.service.search;

import com.algorithm.help.config.SearchConfig;
import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * 搜索策略工厂
 * 根据 search.strategy 配置项自动选择搜索实现
 */
@Slf4j
@Component
public class SearchStrategyFactory {

    private final SearchConfig searchConfig;
    private final Map<String, SearchStrategy> strategyMap;

    public SearchStrategyFactory(SearchConfig searchConfig,
                                 List<SearchStrategy> strategies) {
        this.searchConfig = searchConfig;
        this.strategyMap = strategies.stream()
                .collect(Collectors.toMap(SearchStrategy::getName, Function.identity()));
    }

    @PostConstruct
    void init() {
        String strategy = searchConfig.getStrategy();
        log.info("搜索策略配置: {}", strategy);
        if (!strategyMap.containsKey(strategy)) {
            log.warn("未知搜索策略: {}，将回退到 mysql-fulltext", strategy);
        }
    }

    /**
     * 获取当前配置对应的搜索策略
     */
    public SearchStrategy getStrategy() {
        String name = searchConfig.getStrategy();
        SearchStrategy strategy = strategyMap.get(name);
        if (strategy == null) {
            log.warn("搜索策略 {} 不存在，回退到 mysql-fulltext", name);
            return strategyMap.get("mysql-fulltext");
        }
        return strategy;
    }
}
