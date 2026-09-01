package com.algorithm.help.training.dto;

import lombok.Data;
import lombok.experimental.Accessors;

import java.util.List;

/**
 * 模式识别测验
 */
@Data
@Accessors(chain = true)
public class Quiz {

    /** 测验题目列表 */
    private List<QuizQuestion> questions;
}
