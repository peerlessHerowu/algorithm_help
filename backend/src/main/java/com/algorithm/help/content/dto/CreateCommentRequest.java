package com.algorithm.help.content.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;
import lombok.experimental.Accessors;

/**
 * 创建评论请求体
 */
@Data
@Accessors(chain = true)
public class CreateCommentRequest {

    /** 目标类型：EXPLANATION / USER_SOLUTION */
    @NotBlank(message = "targetType 不能为空")
    private String targetType;

    /** 被评论对象 ID */
    @NotBlank(message = "targetId 不能为空")
    private String targetId;

    /** 评论内容 */
    @NotBlank(message = "content 不能为空")
    private String content;

    /** 评论类型：NORMAL / CORRECTION / SUPPLEMENT / QUESTION */
    private String type = "NORMAL";

    /** 父评论 ID（嵌套回复） */
    private String parentId;
}
