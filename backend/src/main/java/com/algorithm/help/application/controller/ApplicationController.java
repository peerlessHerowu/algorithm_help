package com.algorithm.help.application.controller;

import com.algorithm.help.application.entity.ApplicationMapping;
import com.algorithm.help.application.enums.ApplicationDomain;
import com.algorithm.help.application.service.ApplicationMappingService;
import com.algorithm.help.common.ApiResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * 实际应用映射 API 控制器
 * <p>
 * 提供算法模式的四维应用映射、迷你案例和跨域映射表查询接口
 */
@RestController
@RequestMapping("/api/applications")
@RequiredArgsConstructor
public class ApplicationController {

    private final ApplicationMappingService applicationService;

    /**
     * 获取某模式的四维应用映射（按领域分组）
     *
     * @param patternId 算法模式 ID
     * @return 按 domain 分组的应用映射
     */
    @GetMapping("/{patternId}")
    public ApiResponse<Map<ApplicationDomain, List<ApplicationMapping>>> getApplications(
            @PathVariable String patternId) {
        Map<ApplicationDomain, List<ApplicationMapping>> result =
                applicationService.getApplications(patternId);
        return ApiResponse.success(result);
    }

    /**
     * 获取某模式的迷你案例列表
     *
     * @param patternId 算法模式 ID
     * @return 含迷你案例代码的应用映射列表
     */
    @GetMapping("/{patternId}/mini-cases")
    public ApiResponse<List<ApplicationMapping>> getMiniCases(
            @PathVariable String patternId) {
        List<ApplicationMapping> miniCases = applicationService.getMiniCases(patternId);
        return ApiResponse.success(miniCases);
    }

    /**
     * 获取某模式在指定领域的应用映射
     *
     * @param patternId 算法模式 ID
     * @param domain    应用领域（INDUSTRY/AI_ML/WORK/LIFE）
     * @return 该领域的应用映射列表
     */
    @GetMapping("/{patternId}/domain/{domain}")
    public ApiResponse<List<ApplicationMapping>> getApplicationsByDomain(
            @PathVariable String patternId,
            @PathVariable ApplicationDomain domain) {
        List<ApplicationMapping> result =
                applicationService.getApplicationsByDomain(patternId, domain);
        return ApiResponse.success(result);
    }
}
