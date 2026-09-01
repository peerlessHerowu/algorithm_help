package com.algorithm.help.internal.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;
import lombok.experimental.Accessors;

/**
 * Python 爬虫写入 UserSolution 的请求体
 */
@Data
@Accessors(chain = true)
public class InternalSolutionRequest {

    /** 关联的 Problem ID */
    @NotBlank(message = "problemId 不能为空")
    private String problemId;

    /** 题解标题 */
    private String title;

    /** 题解内容（Markdown） */
    @NotBlank(message = "content 不能为空")
    private String content;

    /** 编程语言 */
    private String language;

    /** 来源平台 */
    private String platform;

    /** 平台原始作者 */
    private String authorName;

    /** 平台点赞数 */
    private Integer upvotes;

    /** 平台题解 URL */
    private String sourceUrl;

    /** 所属项目（默认 algorithm-help） */
    private String project;
}
