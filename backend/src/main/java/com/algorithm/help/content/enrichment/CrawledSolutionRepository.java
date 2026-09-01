package com.algorithm.help.content.enrichment;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * 爬取的原始题解数据访问层
 */
public interface CrawledSolutionRepository extends JpaRepository<CrawledSolution, String> {

    /** 按题目 ID 分页查询 */
    Page<CrawledSolution> findByProblemId(String problemId, Pageable pageable);

    /** 统计某题目的爬取题解数 */
    long countByProblemId(String problemId);
}
