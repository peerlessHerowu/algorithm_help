package com.algorithm.help.content.enrichment;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

/**
 * 纠错反馈数据访问层
 */
public interface EnrichedFeedbackRepository extends JpaRepository<EnrichedFeedback, Long> {

    /** 按解析 ID 和状态查询反馈列表 */
    List<EnrichedFeedback> findByEnrichedIdAndStatusOrderByCreatedAtDesc(
            String enrichedId, FeedbackStatus status);

    /** 按解析 ID 查询所有反馈 */
    List<EnrichedFeedback> findByEnrichedIdOrderByCreatedAtDesc(String enrichedId);

    /** 统计某条解析的反馈总数 */
    long countByEnrichedId(String enrichedId);

    /** 按状态查询反馈列表（管理后台） */
    List<EnrichedFeedback> findByStatusOrderByCreatedAtDesc(FeedbackStatus status);
}
