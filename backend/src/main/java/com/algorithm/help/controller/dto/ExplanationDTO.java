package com.algorithm.help.controller.dto;

import lombok.Data;
import lombok.experimental.Accessors;

/**
 * 解析内容响应 DTO
 */
@Data
@Accessors(chain = true)
public class ExplanationDTO {
    private String id;
    private String problemId;
    private Integer level;
    private String sections;
    private Integer version;
    private String status;
    private Long createdAt;
}
