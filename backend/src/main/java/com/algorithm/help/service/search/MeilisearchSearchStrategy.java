package com.algorithm.help.service.search;

import com.algorithm.help.entity.Problem;
import com.algorithm.help.repository.ProblemRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Component;

/**
 * MeiliSearch 搜索策略（预留实现）
 * 基于外部 MeiliSearch 搜索引擎，内置中文分词能力
 * 当 search.strategy=meilisearch 时启用
 *
 * TODO: 用户量增长后引入 MeiliSearch SDK 实现完整搜索
 * 当前为占位实现，回退到 MySQL LIKE 查询
 */
@Slf4j
@Component
public class MeilisearchSearchStrategy implements SearchStrategy {

    private final ProblemRepository problemRepo;

    public MeilisearchSearchStrategy(ProblemRepository problemRepo) {
        this.problemRepo = problemRepo;
    }

    @Override
    public Page<Problem> search(String keyword, Pageable pageable) {
        log.warn("MeiliSearch 搜索引擎尚未集成，回退到 LIKE 查询");
        // 预留：后续集成 MeiliSearch Java SDK
        // 1. 调用 MeiliSearch API 搜索获取 id 列表
        // 2. 根据 id 列表从数据库加载完整实体
        return problemRepo.searchByKeyword(keyword.trim(), pageable);
    }

    @Override
    public String getName() {
        return "meilisearch";
    }
}
