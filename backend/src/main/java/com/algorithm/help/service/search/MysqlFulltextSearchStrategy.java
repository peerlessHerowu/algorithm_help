package com.algorithm.help.service.search;

import com.algorithm.help.entity.Problem;
import com.algorithm.help.repository.ProblemRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Component;

/**
 * MySQL FULLTEXT + ngram 全文搜索实现
 * 支持中英文混合搜索，基于 MySQL 8.0 内置 ngram 解析器
 */
@Slf4j
@Component
public class MysqlFulltextSearchStrategy implements SearchStrategy {

    private final ProblemRepository problemRepo;

    public MysqlFulltextSearchStrategy(ProblemRepository problemRepo) {
        this.problemRepo = problemRepo;
    }

    @Override
    public Page<Problem> search(String keyword, Pageable pageable) {
        String trimmed = keyword.trim();
        if (trimmed.length() < 2) {
            // ngram token_size=2，单字符无法命中全文索引，回退到 LIKE 查询
            log.debug("关键词过短({}字符)，回退到 LIKE 搜索", trimmed.length());
            return problemRepo.searchByKeyword(trimmed, pageable);
        }
        return problemRepo.fulltextSearch(trimmed, pageable);
    }

    @Override
    public String getName() {
        return "mysql-fulltext";
    }
}
