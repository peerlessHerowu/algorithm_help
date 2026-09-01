package com.algorithm.help.recommend.dto;

import lombok.Data;
import lombok.experimental.Accessors;

/**
 * 薄弱模式 DTO
 */
@Data
@Accessors(chain = true)
public class WeakPatternDTO {

    /** 模式 ID */
    private String patternId;

    /** 模式名称 */
    private String patternName;

    /** 正确率（0.0 ~ 1.0） */
    private Double accuracy;

    /** 建议练习题数 */
    private Integer suggestedCount;
}
