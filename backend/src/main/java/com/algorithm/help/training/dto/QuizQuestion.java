package com.algorithm.help.training.dto;

import lombok.Data;
import lombok.experimental.Accessors;

import java.util.List;

/**
 * 测验题目
 */
@Data
@Accessors(chain = true)
public class QuizQuestion {

    /** 题目 ID */
    private String problemId;

    /** 题目描述（已隐藏标签） */
    private String problemDescription;

    /** 四个选项 */
    private List<QuizOption> options;

    /** 正确答案（模式 ID） */
    private String correctAnswer;
}
