package com.algorithm.help.training.dto;

import lombok.Data;
import lombok.experimental.Accessors;

/**
 * 模式训练统计
 */
@Data
@Accessors(chain = true)
public class PatternStatsDTO {

    /** 模式 ID */
    private String patternId;

    /** 模式名称 */
    private String patternName;

    /** 总尝试次数 */
    private int totalAttempts;

    /** 正确次数 */
    private int correctCount;

    /** 正确率（0.0 - 1.0） */
    private double accuracy;
}
