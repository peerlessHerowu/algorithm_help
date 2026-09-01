package com.algorithm.help.content.enrichment.dto;

import com.algorithm.help.content.enrichment.FeedbackErrorType;
import lombok.Data;
import lombok.experimental.Accessors;

/**
 * 纠错反馈提交请求体
 */
@Data
@Accessors(chain = true)
public class FeedbackRequest {

    /** 错误类型 */
    private FeedbackErrorType errorType;

    /** 错误描述（10-500 字符） */
    private String description;
}
