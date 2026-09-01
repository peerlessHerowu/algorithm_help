package com.algorithm.help.controller.dto;

import lombok.Data;
import lombok.experimental.Accessors;

/**
 * 关联题目响应 DTO
 */
@Data
@Accessors(chain = true)
public class RelatedProblemDTO {
    private String id;
    private String title;
    private String difficulty;
    private String relation;
}
