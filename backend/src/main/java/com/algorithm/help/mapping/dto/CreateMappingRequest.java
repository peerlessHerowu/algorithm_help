package com.algorithm.help.mapping.dto;

import com.algorithm.help.mapping.enums.Platform;
import lombok.Data;
import lombok.experimental.Accessors;

/**
 * 手动创建映射请求 DTO
 */
@Data
@Accessors(chain = true)
public class CreateMappingRequest {

    private String unifiedProblemId;
    private Platform platform;
    private String platformId;
    private String platformUrl;
    private String platformTitle;
}
