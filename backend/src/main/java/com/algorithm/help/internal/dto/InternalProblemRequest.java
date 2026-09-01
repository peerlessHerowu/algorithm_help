package com.algorithm.help.internal.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;
import lombok.experimental.Accessors;

/**
 * Python 爬虫写入 Problem 的请求体
 */
@Data
@Accessors(chain = true)
public class InternalProblemRequest {

    /** 题目标题 */
    @NotBlank(message = "title 不能为空")
    private String title;

    /** 难度：EASY / MEDIUM / HARD */
    @NotBlank(message = "difficulty 不能为空")
    private String difficulty;

    /** 标签 JSON 数组字符串 */
    private String tags;

    /** Markdown 格式题目描述 */
    private String description;

    /** 约束条件 JSON */
    private String constraints;

    /** 示例 JSON */
    private String examples;

    /** 公司标签 JSON */
    private String companyTags;

    /** 来源平台标识 */
    private String platform;

    /** 平台题目 ID */
    private String platformProblemId;

    /** 平台题目 URL */
    private String platformUrl;

    /** 所属项目（默认 algorithm-help） */
    private String project;
}
