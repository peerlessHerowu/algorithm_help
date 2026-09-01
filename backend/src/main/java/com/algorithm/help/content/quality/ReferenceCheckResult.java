package com.algorithm.help.content.quality;

import lombok.Data;
import lombok.experimental.Accessors;

/**
 * 单条引用校验结果
 */
@Data
@Accessors(chain = true)
public class ReferenceCheckResult {

    /** 原始引用文本 */
    private String citation;

    /** 是否匹配到已知权威来源 */
    private boolean verified;

    /** 匹配到的权威来源（未匹配时为 null） */
    private KnownReference matchedReference;

    /** 匹配置信度（0.0 ~ 1.0） */
    private double confidence;
}
