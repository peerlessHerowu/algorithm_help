package com.algorithm.help.content.enrichment.ratelimit;

import lombok.Data;
import lombok.experimental.Accessors;

/**
 * 频率超限响应数据（40002 错误码的 data 字段）
 */
@Data
@Accessors(chain = true)
public class RateLimitExceededData {

    /** 下次可用需等待的秒数 */
    private long retryAfterSeconds;

    /** 已使用次数 */
    private int usedCount;

    /** 最大允许次数 */
    private int maxCount;
}
