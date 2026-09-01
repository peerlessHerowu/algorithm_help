package com.algorithm.help.content.enrichment;

import com.algorithm.help.content.enrichment.dto.FeedbackDTO;
import com.algorithm.help.content.enrichment.dto.FeedbackRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * 纠错反馈服务
 * <p>
 * 支持提交反馈、查询反馈列表、处理反馈（标记解决/忽略），
 * 以及自动复核触发（反馈数 >= 3 时将 PUBLISHED 内容置为 PENDING_REVIEW）。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class FeedbackService {

    /** 触发自动复核的最小反馈数阈值 */
    private static final int AUTO_REVIEW_THRESHOLD = 3;

    private final EnrichedFeedbackRepository feedbackRepo;
    private final EnrichedSolutionRepository enrichedRepo;
    private final UnifiedExplanationService unifiedService;

    /**
     * 提交纠错反馈
     *
     * @param enrichedId 解析记录 ID
     * @param userId     反馈用户 ID
     * @param req        反馈内容
     */
    @Transactional
    public void submitFeedback(String enrichedId, String userId, FeedbackRequest req) {
        // 校验 enriched 记录存在
        EnrichedSolution solution = findSolution(enrichedId);

        // 校验描述长度
        validateDescription(req.getDescription());

        // 保存反馈记录
        EnrichedFeedback feedback = new EnrichedFeedback()
                .setEnrichedId(enrichedId)
                .setUserId(userId)
                .setErrorType(req.getErrorType())
                .setDescription(req.getDescription());
        feedbackRepo.save(feedback);

        // 更新 feedback_count 字段
        updateFeedbackCount(solution);

        // 检查是否触发自动复核
        checkAutoReview(solution);
    }

    /**
     * 查询某条解析的反馈列表（管理员用）
     */
    public List<FeedbackDTO> getFeedbacks(String enrichedId) {
        List<EnrichedFeedback> feedbacks = feedbackRepo.findByEnrichedIdOrderByCreatedAtDesc(enrichedId);
        return feedbacks.stream()
                .map(this::toDTO)
                .toList();
    }

    /**
     * 处理反馈（标记已解决或已忽略）
     *
     * @param feedbackId 反馈 ID
     * @param resolution 处理方式：RESOLVED 或 DISMISSED
     * @param operatorId 操作人 ID
     */
    @Transactional
    public void resolveFeedback(Long feedbackId, String resolution, String operatorId) {
        EnrichedFeedback feedback = feedbackRepo.findById(feedbackId)
                .orElseThrow(() -> new IllegalArgumentException("反馈记录不存在: " + feedbackId));

        FeedbackStatus newStatus = FeedbackStatus.valueOf(resolution);
        feedback.setStatus(newStatus);
        feedback.setResolvedBy(operatorId);
        feedback.setResolvedAt(System.currentTimeMillis());
        feedbackRepo.save(feedback);

        log.info("反馈已处理, feedbackId={}, resolution={}, operator={}", feedbackId, resolution, operatorId);
    }

    // ===== 私有方法 =====

    private EnrichedSolution findSolution(String enrichedId) {
        return enrichedRepo.findById(enrichedId)
                .orElseThrow(() -> new IllegalArgumentException("enriched 记录不存在: " + enrichedId));
    }

    /** 校验描述长度（10-500 字符） */
    private void validateDescription(String description) {
        if (description == null || description.length() < 10 || description.length() > 500) {
            throw new IllegalArgumentException("错误描述长度必须在 10-500 字符之间");
        }
    }

    /** 更新 enriched_solutions.feedback_count */
    private void updateFeedbackCount(EnrichedSolution solution) {
        long count = feedbackRepo.countByEnrichedId(solution.getId());
        solution.setFeedbackCount((int) count);
        enrichedRepo.save(solution);
    }

    /**
     * 检查是否触发自动复核
     * <p>
     * 当反馈数 >= 3 且状态为 PUBLISHED 时，自动将状态改为 PENDING_REVIEW
     */
    private void checkAutoReview(EnrichedSolution solution) {
        if (solution.getFeedbackCount() >= AUTO_REVIEW_THRESHOLD
                && solution.getStatus() == EnrichedStatus.PUBLISHED) {
            solution.setStatus(EnrichedStatus.PENDING_REVIEW);
            enrichedRepo.save(solution);
            // 失效缓存
            unifiedService.invalidateCache(solution.getProblemId(), solution.getLevel());
            log.info("自动触发复核, enrichedId={}, feedbackCount={}",
                    solution.getId(), solution.getFeedbackCount());
        }
    }

    /** 转换为 DTO */
    private FeedbackDTO toDTO(EnrichedFeedback entity) {
        return new FeedbackDTO()
                .setId(entity.getId())
                .setEnrichedId(entity.getEnrichedId())
                .setUserId(entity.getUserId())
                .setErrorType(entity.getErrorType())
                .setDescription(entity.getDescription())
                .setStatus(entity.getStatus())
                .setResolvedBy(entity.getResolvedBy())
                .setResolvedAt(entity.getResolvedAt())
                .setCreatedAt(entity.getCreatedAt());
    }
}
