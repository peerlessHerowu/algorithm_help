package com.algorithm.help.content.enrichment.dto;

import com.algorithm.help.content.enrichment.FeedbackErrorType;
import com.algorithm.help.content.enrichment.FeedbackStatus;
import lombok.Data;
import lombok.experimental.Accessors;

/**
 * 纠错反馈数据传输对象
 */
@Data
@Accessors(chain = true)
public class FeedbackDTO {

    private Long id;

    /** 关联的 enriched_solutions.id */
    private String enrichedId;

    /** 反馈用户 ID */
    private String userId;

    /** 错误类型 */
    private FeedbackErrorType errorType;

    /** 错误描述 */
    private String description;

    /** 处理状态 */
    private FeedbackStatus status;

    /** 处理人 */
    private String resolvedBy;

    /** 处理时间 */
    private Long resolvedAt;

    /** 创建时间 */
    private Long createdAt;
}
