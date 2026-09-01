package com.algorithm.help.content.dto;

import lombok.Data;
import lombok.experimental.Accessors;

/**
 * 更新题解请求
 */
@Data
@Accessors(chain = true)
public class UpdateSolutionRequest {

    /** 题解标题（可选） */
    private String title;

    /** 题解内容（可选） */
    private String content;

    /** 编程语言（可选） */
    private String language;
}
