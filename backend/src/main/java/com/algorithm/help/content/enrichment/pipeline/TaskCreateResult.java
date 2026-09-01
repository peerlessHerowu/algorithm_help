package com.algorithm.help.content.enrichment.pipeline;

import lombok.Data;
import lombok.experimental.Accessors;

/**
 * 任务创建返回结果
 */
@Data
@Accessors(chain = true)
public class TaskCreateResult {

    /** 任务 ID */
    private String taskId;

    /** 是否复用了已有任务（幂等命中） */
    private boolean reused;

    /** 预估耗时（秒） */
    private int estimatedSeconds;

    public static TaskCreateResult created(String taskId) {
        return new TaskCreateResult()
                .setTaskId(taskId)
                .setReused(false)
                .setEstimatedSeconds(45);
    }

    public static TaskCreateResult reused(String taskId) {
        return new TaskCreateResult()
                .setTaskId(taskId)
                .setReused(true)
                .setEstimatedSeconds(30);
    }
}
