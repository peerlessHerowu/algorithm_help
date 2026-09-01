package com.algorithm.help.content.enrichment.dto;

import lombok.Data;

/**
 * 拒绝请求（包含原因）
 */
@Data
public class RejectRequest {

    /** 拒绝原因 */
    private String reason;
}
