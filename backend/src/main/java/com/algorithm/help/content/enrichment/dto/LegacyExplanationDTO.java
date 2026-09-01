package com.algorithm.help.content.enrichment.dto;

import lombok.Data;
import lombok.experimental.Accessors;

/**
 * Legacy 解析 DTO（来自 v1 explanations 表）
 */
@Data
@Accessors(chain = true)
public class LegacyExplanationDTO {

    private String id;
    private String problemId;
    private Integer level;
    private String sections;
    private Integer version;
    private Long createdAt;
}
