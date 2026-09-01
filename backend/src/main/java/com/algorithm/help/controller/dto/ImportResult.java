package com.algorithm.help.controller.dto;

import lombok.Data;
import lombok.experimental.Accessors;

/**
 * URL 导入结果 DTO
 */
@Data
@Accessors(chain = true)
public class ImportResult {
    private String taskId;
    private String status;
    private String message;
}
