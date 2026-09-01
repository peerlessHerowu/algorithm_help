package com.algorithm.help.training.dto;

import lombok.Data;
import lombok.experimental.Accessors;

/**
 * 生成测验请求
 */
@Data
@Accessors(chain = true)
public class QuizRequest {

    /** 用户 ID */
    private String userId;

    /** 题目数量（默认 10） */
    private Integer questionCount = 10;
}
