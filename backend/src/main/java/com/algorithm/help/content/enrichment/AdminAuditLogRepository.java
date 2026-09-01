package com.algorithm.help.content.enrichment;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

/**
 * 管理操作审计日志数据访问层
 */
public interface AdminAuditLogRepository extends JpaRepository<AdminAuditLog, Long> {

    /** 按操作人查询 */
    Page<AdminAuditLog> findByOperatorIdOrderByCreatedAtDesc(String operatorId, Pageable pageable);

    /** 按时间范围查询 */
    Page<AdminAuditLog> findByCreatedAtBetweenOrderByCreatedAtDesc(
            Long startTime, Long endTime, Pageable pageable);

    /** 按操作人+时间范围查询 */
    Page<AdminAuditLog> findByOperatorIdAndCreatedAtBetweenOrderByCreatedAtDesc(
            String operatorId, Long startTime, Long endTime, Pageable pageable);

    /** 90 天清理策略 */
    @Modifying
    @Transactional
    @Query("DELETE FROM AdminAuditLog a WHERE a.createdAt < :cutoff")
    int deleteByCreatedAtBefore(@Param("cutoff") Long cutoff);
}
