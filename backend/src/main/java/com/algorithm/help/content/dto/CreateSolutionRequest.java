package com.algorithm.help.content.dto;

import lombok.Data;
import lombok.experimental.Accessors;

/**
 * 创建题解请求
 */
@Data
@Accessors(chain = true)
public class CreateSolutionRequest {

    /** 题解标题（可选） */
    private String title;

    /** 题解内容（必填） */
    private String content;

    /** 编程语言（可选） */
    private String language;

    /** 来源类型：USER_INPUT / URL_IMPORT / FEYNMAN_OUTPUT，默认 USER_INPUT */
    private String sourceType = "USER_INPUT";

    /** URL_IMPORT 时必填 */
    private String sourceUrl;
}
