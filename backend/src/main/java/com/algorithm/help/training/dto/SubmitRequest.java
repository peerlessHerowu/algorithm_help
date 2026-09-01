package com.algorithm.help.training.dto;

import lombok.Data;
import lombok.experimental.Accessors;

/**
 * 提交答案请求
 */
@Data
@Accessors(chain = true)
public class SubmitRequest {

    /** 用户 ID */
    private String userId;

    /** 题目 ID */
    private String problemId;

    /** 用户选择的答案（模式 ID） */
    private String answer;
}
