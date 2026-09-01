package com.algorithm.help.content.batch;

import lombok.Data;
import lombok.experimental.Accessors;

import java.util.ArrayList;
import java.util.List;

/**
 * 批量生成进度模型
 */
@Data
@Accessors(chain = true)
public class BatchProgress {

    /** 总题目数 */
    private int total;

    /** 已完成数 */
    private int completed;

    /** 失败数 */
    private int failed;

    /** 跳过数（已存在解析的题目） */
    private int skipped;

    /** 当前正在处理的题目 ID */
    private String currentProblem;

    /** 批次状态：RUNNING / COMPLETED / FAILED */
    private String status;

    /** 失败详情列表 */
    private List<FailureDetail> failures = new ArrayList<>();

    /** 批次开始时间（UTC 毫秒） */
    private long startTime;

    /**
     * 失败详情
     */
    @Data
    @Accessors(chain = true)
    public static class FailureDetail {

        /** 题目 ID */
        private String problemId;

        /** 错误信息 */
        private String error;

        /** 重试次数 */
        private int retryCount;
    }
}
