package com.algorithm.help.export.dto;

import com.algorithm.help.export.enums.ExportFormat;
import com.algorithm.help.export.enums.ExportScope;
import lombok.Data;
import lombok.experimental.Accessors;

/**
 * 导出请求 DTO
 */
@Data
@Accessors(chain = true)
public class ExportRequest {

    /** 导出格式 */
    private ExportFormat format;

    /** 导出范围 */
    private ExportScope scope;

    /** 题目 ID（scope=SINGLE_PROBLEM 时必填） */
    private String problemId;

    /** 模式 ID（scope=BY_PATTERN 时必填） */
    private String patternId;

    /** 学习路径 ID（scope=BY_LEARNING_PATH 时必填） */
    private String pathId;

    /** 导出选项 */
    private ExportOptions options;
}
