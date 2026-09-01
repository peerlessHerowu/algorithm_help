package com.algorithm.help.api.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;
import lombok.experimental.Accessors;

import java.io.Serializable;

/**
 * 错误检测请求 DTO
 */
@Data
@Accessors(chain = true)
public class ErrorDetectRequest implements Serializable {

    /** 待检测的内容文本 */
    @NotBlank
    private String content;

    /** 内容类型：SOLUTION / EDITORIAL */
    private String contentType;

    /** 关联题目标题（上下文） */
    private String problemTitle;

    /** 关联题目描述（上下文） */
    private String problemDescription;

    /** 代码语言 */
    private String codeLanguage;
}
