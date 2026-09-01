package com.algorithm.help.controller;

import com.algorithm.help.common.ApiResponse;
import com.algorithm.help.controller.dto.ImportResult;
import com.algorithm.help.controller.dto.ImportUrlRequest;
import com.algorithm.help.service.ImportService;
import org.springframework.web.bind.annotation.*;

/**
 * 内容管理 API 控制器
 */
@RestController
@RequestMapping("/api/v1/content")
public class ContentController {

    private final ImportService importService;

    public ContentController(ImportService importService) {
        this.importService = importService;
    }

    /**
     * 从 URL 导入题目
     */
    @PostMapping("/import-url")
    public ApiResponse<ImportResult> importFromUrl(@RequestBody ImportUrlRequest request) {
        ImportResult result = importService.importFromUrl(request.getUrl());
        return ApiResponse.success(result);
    }
}
