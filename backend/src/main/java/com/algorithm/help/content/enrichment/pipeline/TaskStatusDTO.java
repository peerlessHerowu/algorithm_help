package com.algorithm.help.content.enrichment.pipeline;

import lombok.Data;
import lombok.experimental.Accessors;

/**
 * 任务状态查询 DTO，从 Redis Hash 读取映射
 */
@Data
@Accessors(chain = true)
public class TaskStatusDTO {

    private String taskId;
    private TaskState status;
    private String problemId;
    private int level;
    private String currentStep;
    private int totalSteps;
    private int completedSteps;
    private String result;
    private String error;
    private int retryCount;
    private Long startedAt;
    private Long createdAt;
}
