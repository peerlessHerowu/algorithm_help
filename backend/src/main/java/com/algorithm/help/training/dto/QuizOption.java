package com.algorithm.help.training.dto;

import lombok.Data;
import lombok.experimental.Accessors;

/**
 * 测验选项
 */
@Data
@Accessors(chain = true)
public class QuizOption {

    /** 模式 ID */
    private String patternId;

    /** 模式显示名称 */
    private String patternName;
}
