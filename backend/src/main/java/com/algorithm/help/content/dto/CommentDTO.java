package com.algorithm.help.content.dto;

import lombok.Data;
import lombok.experimental.Accessors;

/**
 * 评论响应 DTO
 */
@Data
@Accessors(chain = true)
public class CommentDTO {

    private String id;
    private String targetType;
    private String targetId;
    private String userId;
    private String content;
    private String type;
    private Integer upvotes;
    private String parentId;
    private Long createdAt;
    private Long updatedAt;
}
