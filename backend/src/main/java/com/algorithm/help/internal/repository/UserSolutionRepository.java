package com.algorithm.help.internal.repository;

import com.algorithm.help.internal.entity.UserSolution;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

/**
 * UserSolution 数据访问层
 */
public interface UserSolutionRepository extends JpaRepository<UserSolution, String> {

    List<UserSolution> findByProblemIdAndSourceType(String problemId, String sourceType);

    boolean existsByProblemIdAndSourceUrlAndSourceType(String problemId, String sourceUrl, String sourceType);

    /** 按题目查询未删除的题解（分页） */
    Page<UserSolution> findByProblemIdAndDeletedFalse(String problemId, Pageable pageable);

    /** 统计题目下未删除的题解数 */
    long countByProblemIdAndDeletedFalse(String problemId);

    /** 按用户查询未删除的题解（分页） */
    Page<UserSolution> findByUserIdAndDeletedFalse(String userId, Pageable pageable);

    /** 按题目+状态查询未删除的题解（分页，用于 featured 筛选） */
    Page<UserSolution> findByProblemIdAndStatusAndDeletedFalse(String problemId, String status, Pageable pageable);

    /** 按状态查询未删除的题解（分页，用于审核队列） */
    Page<UserSolution> findByStatusAndDeletedFalse(String status, Pageable pageable);

    /** 按平台和来源 URL 模糊匹配查询未删除的题解（用于合规下架） */
    List<UserSolution> findByPlatformAndSourceUrlContainingAndDeletedFalse(String platform, String platformId);

    /** 按关键词搜索题解（标题或内容，用于全文搜索） */
    @org.springframework.data.jpa.repository.Query(
            "SELECT s FROM UserSolution s WHERE s.deleted = false AND s.status = 'PUBLISHED' " +
            "AND (s.title LIKE %:keyword% OR s.content LIKE %:keyword%)")
    Page<UserSolution> searchByKeyword(@org.springframework.data.repository.query.Param("keyword") String keyword, Pageable pageable);
}
