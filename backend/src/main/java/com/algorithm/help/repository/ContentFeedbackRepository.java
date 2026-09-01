package com.algorithm.help.repository;

import com.algorithm.help.entity.ContentFeedback;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

/**
 * 内容反馈数据访问层
 */
public interface ContentFeedbackRepository extends JpaRepository<ContentFeedback, UUID> {

    List<ContentFeedback> findByExplanationId(String explanationId);

    List<ContentFeedback> findByUserId(UUID userId);

    boolean existsByUserIdAndExplanationId(UUID userId, String explanationId);
}
