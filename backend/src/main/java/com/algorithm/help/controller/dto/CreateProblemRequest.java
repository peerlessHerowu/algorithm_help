package com.algorithm.help.controller.dto;

import com.algorithm.help.common.enums.Difficulty;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;
import lombok.experimental.Accessors;

/**
 * 创建题目请求 DTO
 */
@Data
@Accessors(chain = true)
public class CreateProblemRequest {

    @NotBlank(message = "标题不能为空")
    private String title;

    @NotNull(message = "难度不能为空")
    private Difficulty difficulty;

    @NotBlank(message = "描述不能为空")
    private String description;

    private String tags;

    private String constraints;

    private String examples;

    private String companyTags;
}
