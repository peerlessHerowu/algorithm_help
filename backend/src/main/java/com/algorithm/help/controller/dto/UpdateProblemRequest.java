package com.algorithm.help.controller.dto;

import com.algorithm.help.common.enums.Difficulty;
import lombok.Data;
import lombok.experimental.Accessors;

/**
 * 更新题目请求 DTO（所有字段可选，只更新非 null 字段）
 */
@Data
@Accessors(chain = true)
public class UpdateProblemRequest {

    private String title;

    private Difficulty difficulty;

    private String description;

    private String tags;

    private String constraints;

    private String examples;

    private String companyTags;
}
