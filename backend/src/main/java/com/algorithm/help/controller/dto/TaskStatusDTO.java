package com.algorithm.help.controller.dto;

import lombok.Data;
import lombok.experimental.Accessors;

/**
 * 任务状态响应 DTO
 */
@Data
@Accessors(chain = true)
public class TaskStatusDTO {
    private String taskId;
    private String status;
    private int total;
    private int completed;
    private int failed;
}
