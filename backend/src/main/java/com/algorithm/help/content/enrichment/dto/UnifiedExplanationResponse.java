package com.algorithm.help.content.enrichment.dto;

import lombok.Data;
import lombok.experimental.Accessors;

import java.util.List;

/**
 * 统一查询响应：enriched 优先，fallback legacy
 */
@Data
@Accessors(chain = true)
public class UnifiedExplanationResponse {

    /** 数据来源：enriched 或 legacy */
    private String source;

    /** enriched 摘要列表（source=enriched 时有值） */
    private List<EnrichedSummaryDTO> enrichedList;

    /** legacy 解析内容（source=legacy 时有值） */
    private LegacyExplanationDTO legacy;

    public static UnifiedExplanationResponse enriched(List<EnrichedSummaryDTO> list) {
        return new UnifiedExplanationResponse()
                .setSource("enriched")
                .setEnrichedList(list);
    }

    public static UnifiedExplanationResponse legacy(LegacyExplanationDTO dto) {
        return new UnifiedExplanationResponse()
                .setSource("legacy")
                .setLegacy(dto);
    }

    public static UnifiedExplanationResponse empty() {
        return new UnifiedExplanationResponse()
                .setSource("empty");
    }
}
