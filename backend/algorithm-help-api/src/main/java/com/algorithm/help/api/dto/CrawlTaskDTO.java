package com.algorithm.help.api.dto;

import lombok.Data;
import lombok.experimental.Accessors;

import java.io.Serializable;

/**
 * 采集任务 DTO
 */
@Data
@Accessors(chain = true)
public class CrawlTaskDTO implements Serializable {

    private Long id;

    /** 平台标识 */
    private String platform;

    /** 任务类型：PROBLEM_SYNC / SOLUTION_SYNC / SINGLE_FETCH */
    private String taskType;

    /** 任务状态：PENDING / RUNNING / COMPLETED / FAILED */
    private String status;

    /** 进度：总数 */
    private Integer total;

    /** 进度：已完成数 */
    private Integer completed;

    /** 进度：失败数 */
    private Integer failed;

    /** 当前处理项 */
    private String currentItem;

    /** 触发类型：CRON / MANUAL */
    private String triggerType;

    /** 错误信息 */
    private String errorMessage;

    /** 创建时间（UTC 毫秒） */
    private Long createdAt;

    /** 完成时间（UTC 毫秒） */
    private Long completedAt;
}
