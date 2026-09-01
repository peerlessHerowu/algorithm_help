package com.algorithm.help.api.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Data;
import lombok.experimental.Accessors;

import java.io.Serializable;

/**
 * 采集触发请求 DTO
 */
@Data
@Accessors(chain = true)
public class CrawlTriggerRequest implements Serializable {

    /** 目标平台（不传则全平台） */
    private String platform;

    /** 任务类型：PROBLEM_SYNC / SOLUTION_SYNC / SINGLE_FETCH */
    @NotNull
    private String taskType;

    /** 单题采集时的平台题目ID */
    private String platformProblemId;

    /** 触发类型：CRON / MANUAL */
    @NotNull
    private String triggerType;
}
