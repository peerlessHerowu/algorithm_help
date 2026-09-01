package com.algorithm.help.api.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;
import lombok.experimental.Accessors;

import java.io.Serializable;

/**
 * 图片描述请求 DTO
 */
@Data
@Accessors(chain = true)
public class ImageDescribeRequest implements Serializable {

    /** 图片 URL（MinIO 内部 URL 或外部 URL） */
    @NotBlank
    private String imageUrl;

    /** 图片上下文（所在段落文本） */
    private String context;

    /** 期望输出语言：zh / en */
    private String language;
}
