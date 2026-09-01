package com.algorithm.help.content.enrichment.dto;

import lombok.Data;
import lombok.experimental.Accessors;

/**
 * 原始题解 DTO（来自 user_solutions 表）
 */
@Data
@Accessors(chain = true)
public class RawSolutionDTO {

    private String id;
    private String problemId;
    private String title;
    private String content;
    private String language;
    private String authorName;
    private Integer upvotes;
    private String sourceUrl;
    private String sourceType;
    private Integer viewCount;
    private Long createdAt;

    /** 是否已有对应的 enriched 记录 */
    private Boolean hasEnriched;
}
