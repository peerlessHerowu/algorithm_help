package com.algorithm.help.event;

import com.algorithm.help.common.ApiResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.Map;

/**
 * AI 成本控制 — 管理员查看 AI 调用统计
 */
@Slf4j
@RestController
@RequestMapping("/api/v1/admin/ai")
@RequiredArgsConstructor
public class AiCostController {

    private final AiEnrichService aiEnrichService;

    /**
     * 获取 AI 调用用量统计
     * 返回今日调用次数
     */
    @GetMapping("/usage")
    public ApiResponse<Map<String, Object>> getAiUsage() {
        long todayUsage = aiEnrichService.getTodayUsage();
        String today = LocalDate.now().format(DateTimeFormatter.ISO_LOCAL_DATE);

        Map<String, Object> usage = Map.of(
                "date", today,
                "callCount", todayUsage,
                "rateLimit", "10/min"
        );
        return ApiResponse.success(usage);
    }
}
