package com.algorithm.help.application.controller;

import com.algorithm.help.application.entity.CrossDomainMapping;
import com.algorithm.help.application.service.ApplicationMappingService;
import com.algorithm.help.common.ApiResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

/**
 * 跨域迁移映射表 API 控制器
 * <p>
 * 提供模式的跨域映射表查询（四列：LeetCode/工作/AI/人生）
 */
@RestController
@RequestMapping("/api/patterns")
@RequiredArgsConstructor
public class CrossDomainController {

    private final ApplicationMappingService applicationService;

    /**
     * 获取模式的跨域迁移映射表
     *
     * @param patternId 算法模式 ID
     * @return 跨域映射表（lifeScene 可为 null）
     */
    @GetMapping("/{patternId}/cross-domain-table")
    public ApiResponse<CrossDomainMapping> getCrossDomainTable(
            @PathVariable String patternId) {
        return applicationService.getCrossDomainTable(patternId)
                .map(ApiResponse::success)
                .orElse(ApiResponse.success(null));
    }
}
