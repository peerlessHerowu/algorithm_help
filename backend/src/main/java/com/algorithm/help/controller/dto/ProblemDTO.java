package com.algorithm.help.controller.dto;

import com.algorithm.help.common.enums.Difficulty;
import lombok.Data;
import lombok.experimental.Accessors;

/**
 * 题目响应 DTO
 */
@Data
@Accessors(chain = true)
public class ProblemDTO {
    private String id;
    private String title;
    private Difficulty difficulty;
    private String tags;
    private String description;
    private String constraints;
    private String examples;
    private String companyTags;
    private Long createdAt;
    private Long updatedAt;
}
