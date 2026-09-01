package com.algorithm.help.content.enrichment.pipeline;

import lombok.Data;
import lombok.experimental.Accessors;

/**
 * 单个步骤的执行结果
 */
@Data
@Accessors(chain = true)
public class EnrichmentResult {

    /** 是否执行成功 */
    private boolean success;

    /** 失败时的错误信息 */
    private String error;

    /** 判断是否失败 */
    public boolean isFailed() {
        return !success;
    }

    /** 构造成功结果 */
    public static EnrichmentResult ok() {
        return new EnrichmentResult().setSuccess(true);
    }

    /** 构造失败结果 */
    public static EnrichmentResult fail(String error) {
        return new EnrichmentResult().setSuccess(false).setError(error);
    }
}
