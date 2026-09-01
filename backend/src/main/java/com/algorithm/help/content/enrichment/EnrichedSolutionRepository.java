package com.algorithm.help.content.enrichment;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

/**
 * Enriched Solutions 数据访问层
 */
public interface EnrichedSolutionRepository extends JpaRepository<EnrichedSolution, String> {

    /** 按题目+级别+状态查询列表，按 sortOrder 排序 */
    List<EnrichedSolution> findByProblemIdAndLevelAndStatusOrderBySortOrderAsc(
            String problemId, Integer level, EnrichedStatus status);

    /** 按题目+级别查询所有记录 */
    List<EnrichedSolution> findByProblemIdAndLevelOrderBySortOrderAsc(
            String problemId, Integer level);

    /** 查询推荐记录 */
    Optional<EnrichedSolution> findByProblemIdAndLevelAndRecommendedTrue(
            String problemId, Integer level);

    /** 按题目+级别+来源查询最新版本 */
    Optional<EnrichedSolution> findByProblemIdAndLevelAndSourceSolutionIdAndIsLatestTrue(
            String problemId, Integer level, String sourceSolutionId);

    /** 查询某题目某级别已发布记录数 */
    long countByProblemIdAndLevelAndStatus(
            String problemId, Integer level, EnrichedStatus status);

    /** 按状态查询（用于管理后台审核队列） */
    List<EnrichedSolution> findByStatusOrderByCreatedAtDesc(EnrichedStatus status);

    /** 查询某题目所有级别是否有 enriched 数据 */
    @Query("SELECT DISTINCT e.level FROM EnrichedSolution e " +
            "WHERE e.problemId = :problemId AND e.status = 'PUBLISHED'")
    List<Integer> findPublishedLevels(@Param("problemId") String problemId);
}
