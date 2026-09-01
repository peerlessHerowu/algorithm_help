package com.algorithm.help.content.enrichment.dto;

import lombok.Data;
import lombok.experimental.Accessors;

/**
 * 标签聚合结果
 */
@Data
@Accessors(chain = true)
public class TagCount {

    /** 标签名 */
    private String tag;

    /** 包含该标签的记录数 */
    private int count;
}
