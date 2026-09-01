package com.algorithm.help.api.dto;

import lombok.Data;
import lombok.experimental.Accessors;

import java.io.Serializable;
import java.util.List;

/**
 * AI 处理结果 DTO
 */
@Data
@Accessors(chain = true)
public class AiProcessResult implements Serializable {

    /** 是否处理成功 */
    private Boolean success;

    /** 处理后的结构化内容（JSON 格式） */
    private String content;

    /** 错误信息（失败时） */
    private String errorMessage;

    /** 检测到的问题列表（错误检测用） */
    private List<DetectedIssue> issues;

    /** AI 模型标识（记录使用了哪个模型） */
    private String modelUsed;

    /** 处理耗时（毫秒） */
    private Long processingTimeMs;

    /**
     * 检测到的问题
     */
    @Data
    @Accessors(chain = true)
    public static class DetectedIssue implements Serializable {

        /** 问题类型：CODE_ERROR / COMPLEXITY_ERROR / BOUNDARY_MISS / MISMATCH */
        private String type;

        /** 严重程度：FATAL / WARNING / INFO */
        private String severity;

        /** 问题位置描述 */
        private String location;

        /** 问题描述 */
        private String description;

        /** 建议修复方式 */
        private String suggestion;
    }
}
