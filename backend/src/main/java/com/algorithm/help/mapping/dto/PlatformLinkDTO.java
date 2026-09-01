package com.algorithm.help.mapping.dto;

import com.algorithm.help.mapping.enums.Platform;
import lombok.Data;
import lombok.experimental.Accessors;

/**
 * 平台链接 DTO，展示某题在某个平台上的信息
 */
@Data
@Accessors(chain = true)
public class PlatformLinkDTO {

    /** 刷题平台 */
    private Platform platform;

    /** 平台上的编号/slug */
    private String platformId;

    /** 平台链接 */
    private String platformUrl;

    /** 平台上的标题 */
    private String platformTitle;
}
