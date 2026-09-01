package com.algorithm.help.interactive.controller;

import com.algorithm.help.common.ApiResponse;
import com.algorithm.help.interactive.importer.ContentImportService;
import com.algorithm.help.interactive.importer.ImportResult;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

/**
 * 内容导入 REST API
 */
@RestController
@RequestMapping("/api/v1/import")
@RequiredArgsConstructor
public class ImportController {

    private final ContentImportService importService;

    /**
     * 导入 URL 内容
     */
    @PostMapping("/url")
    public ApiResponse<ImportResult> importUrl(@RequestBody ImportUrlRequest request) {
        ImportResult result = importService.importFromUrl(request.getUrl());
        return ApiResponse.success(result);
    }

    @Data
    public static class ImportUrlRequest {
        private String url;
    }
}
