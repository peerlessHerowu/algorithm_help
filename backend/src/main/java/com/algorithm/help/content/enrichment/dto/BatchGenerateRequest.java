package com.algorithm.help.content.enrichment.dto;

import lombok.Data;

import java.util.List;

/**
 * 批量生成请求
 */
@Data
public class BatchGenerateRequest {

    /** 题目 ID 列表（最多 50 个） */
    private List<String> problemIds;

    /** 目标级别 1-5 */
    private Integer level;
}
