package com.algorithm.help.content.dto;

import lombok.Data;
import lombok.experimental.Accessors;

/**
 * 题解响应 DTO
 */
@Data
@Accessors(chain = true)
public class SolutionDTO {

    private String id;
    private String problemId;
    private String title;
    private String content;
    private String language;
    private String sourceType;
    private String status;
    private String authorName;
    private Integer upvotes;
    private Integer viewCount;
    private String userId;
    private Long createdAt;
    private Long updatedAt;
}
