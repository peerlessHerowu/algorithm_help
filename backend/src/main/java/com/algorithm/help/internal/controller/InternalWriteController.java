package com.algorithm.help.internal.controller;

import com.algorithm.help.common.ApiResponse;
import com.algorithm.help.internal.dto.InternalProblemRequest;
import com.algorithm.help.internal.dto.InternalSolutionRequest;
import com.algorithm.help.internal.service.InternalWriteService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * 内部写入 API — 供 Python 爬虫服务调用
 * <p>
 * 端点通过 InternalTokenFilter 校验 X-Internal-Token 鉴权，
 * 不通过 Gateway 暴露，仅限内网访问。
 */
@Slf4j
@RestController
@RequestMapping("/api/v1/internal")
@RequiredArgsConstructor
public class InternalWriteController {

    private final InternalWriteService writeService;

    /**
     * 写入 Problem
     * <p>
     * Python 爬虫标准化后的题目数据通过此端点写入 Problem 表。
     * 支持去重：相同标题的 Problem 会更新而非重复创建。
     */
    @PostMapping("/problems")
    public ApiResponse<Map<String, String>> saveProblem(
            @Valid @RequestBody InternalProblemRequest request) {
        String problemId = writeService.saveProblem(request);
        return ApiResponse.success(Map.of("id", problemId));
    }

    /**
     * 写入 UserSolution（sourceType=CRAWLED）
     * <p>
     * Python 爬虫标准化后的题解数据通过此端点写入 UserSolution 表。
     * 支持去重：相同 problemId + sourceUrl 不重复写入。
     */
    @PostMapping("/solutions")
    public ApiResponse<Map<String, String>> saveSolution(
            @Valid @RequestBody InternalSolutionRequest request) {
        String solutionId = writeService.saveSolution(request);
        if (solutionId == null) {
            return ApiResponse.success(Map.of("status", "skipped", "reason", "duplicate"));
        }
        return ApiResponse.success(Map.of("id", solutionId));
    }
}
