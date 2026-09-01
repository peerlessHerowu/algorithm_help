package com.algorithm.help.controller.dto;

import lombok.Data;
import lombok.experimental.Accessors;

/**
 * 算法模式响应 DTO
 */
@Data
@Accessors(chain = true)
public class PatternDTO {
    private String id;
    private String name;
    private String category;
    private String template;
    private String signals;
    private String variants;
    private String relatedProblems;
}
