package com.algorithm.help.api.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;
import lombok.experimental.Accessors;

import java.io.Serializable;
import java.util.List;

/**
 * 题目保存 DTO（Crawler → Core）
 */
@Data
@Accessors(chain = true)
public class ProblemSaveDTO implements Serializable {

    /** 题目标题 */
    @NotBlank
    private String title;

    /** 题目描述（Markdown 格式） */
    @NotBlank
    private String description;

    /** 难度：EASY / MEDIUM / HARD */
    @NotNull
    private String difficulty;

    /** 标签列表 */
    private List<String> tags;

    /** 约束条件 */
    private String constraints;

    /** 示例输入输出（JSON 结构） */
    private String examples;

    /** 来源平台 */
    @NotBlank
    private String platform;

    /** 平台题目ID */
    @NotBlank
    private String platformId;

    /** 平台链接 */
    private String platformUrl;

    /** 采集时间（UTC 毫秒） */
    private Long fetchedAt;
}
