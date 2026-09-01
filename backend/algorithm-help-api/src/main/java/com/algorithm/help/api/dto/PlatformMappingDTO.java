package com.algorithm.help.api.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;
import lombok.experimental.Accessors;

import java.io.Serializable;

/**
 * 跨平台映射 DTO
 */
@Data
@Accessors(chain = true)
public class PlatformMappingDTO implements Serializable {

    /** 内部统一题目ID */
    @NotNull
    private Long unifiedProblemId;

    /** 平台标识 */
    @NotBlank
    private String platform;

    /** 平台题目ID */
    @NotBlank
    private String platformProblemId;

    /** 平台链接 */
    private String platformUrl;

    /** 映射置信度（0-1） */
    private Float confidence;

    /** 是否已人工确认 */
    private Boolean confirmed;
}
