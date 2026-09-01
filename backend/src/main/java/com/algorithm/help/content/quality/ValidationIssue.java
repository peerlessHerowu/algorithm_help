package com.algorithm.help.content.quality;

import lombok.Data;
import lombok.experimental.Accessors;

/**
 * 质量校验问题项
 */
@Data
@Accessors(chain = true)
public class ValidationIssue {

    /** 问题类型：format, compliance, mermaid, logic */
    private String type;

    /** 严重级别：error, warning, suggestion */
    private String severity;

    /** 问题位置描述 */
    private String location;

    /** 问题描述 */
    private String message;

    /** 修改建议 */
    private String suggestion;
}
