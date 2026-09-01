package com.algorithm.help.mapping.dto;

import com.algorithm.help.mapping.enums.MappingStatus;
import com.algorithm.help.mapping.enums.Platform;
import lombok.Data;
import lombok.experimental.Accessors;

/**
 * 平台映射响应 DTO
 */
@Data
@Accessors(chain = true)
public class MappingDTO {

    private String id;
    private String unifiedProblemId;
    private Platform platform;
    private String platformId;
    private String platformUrl;
    private String platformTitle;
    private MappingStatus status;
    private Long createdAt;
    private Long updatedAt;
}
