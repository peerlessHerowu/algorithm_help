package com.algorithm.help.training.dto;

import lombok.Data;
import lombok.experimental.Accessors;

/**
 * 测验提交结果
 */
@Data
@Accessors(chain = true)
public class QuizResult {

    /** 是否回答正确 */
    private boolean correct;

    /** 正确答案（模式 ID） */
    private String correctAnswer;

    /** 正确模式名称 */
    private String correctPatternName;

    /** 解释说明 */
    private String explanation;
}
