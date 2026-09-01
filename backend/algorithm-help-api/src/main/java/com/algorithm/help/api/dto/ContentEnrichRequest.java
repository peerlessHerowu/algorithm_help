package com.algorithm.help.api.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Data;
import lombok.experimental.Accessors;

import java.io.Serializable;

/**
 * 内容增强请求 DTO
 */
@Data
@Accessors(chain = true)
public class ContentEnrichRequest implements Serializable {

    /** 内容ID（RawSource 或 Problem ID） */
    @NotNull
    private Long contentId;

    /** 内容类型：PROBLEM / SOLUTION / EDITORIAL */
    @NotNull
    private String contentType;

    /** 原始内容文本 */
    private String rawContent;

    /** 题目标题（上下文补充） */
    private String problemTitle;

    /** 题目描述（上下文补充） */
    private String problemDescription;
}
