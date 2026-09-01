package com.algorithm.help.export.controller;

import com.algorithm.help.common.ApiResponse;
import com.algorithm.help.export.dto.ExportRequest;
import com.algorithm.help.export.dto.ExportResult;
import com.algorithm.help.export.service.ExportService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 导出功能 API 控制器
 * <p>
 * 提供触发导出任务和下载导出文件的接口
 */
@Slf4j
@RestController
@RequestMapping("/api/export")
@RequiredArgsConstructor
public class ExportController {

    /** 文件大小上限：100MB */
    private static final long MAX_FILE_SIZE = 100L * 1024 * 1024;

    private final ExportService exportService;

    /** 导出任务结果缓存（MVP 同步实现） */
    private final ConcurrentHashMap<String, ExportResult> taskResults = new ConcurrentHashMap<>();

    /**
     * 触发导出任务（MVP 同步执行，返回 taskId）
     */
    @PostMapping
    public ApiResponse<Map<String, String>> triggerExport(@RequestBody ExportRequest request) {
        log.info("收到导出请求: format={}, scope={}", request.getFormat(), request.getScope());

        // 同步执行导出
        ExportResult result = exportService.export(request);

        // 校验文件大小
        if (result.getFileSizeBytes() > MAX_FILE_SIZE) {
            return ApiResponse.error(413, "导出文件超过 100MB 大小限制，请缩小导出范围");
        }

        // 生成 taskId 并缓存结果
        String taskId = UUID.randomUUID().toString();
        taskResults.put(taskId, result);

        log.info("导出完成: taskId={}, fileName={}, size={}bytes",
                taskId, result.getFileName(), result.getFileSizeBytes());
        return ApiResponse.success(Map.of("taskId", taskId));
    }

    /**
     * 下载导出文件（根据 taskId 获取文件流）
     */
    @GetMapping("/{taskId}/download")
    public ResponseEntity<byte[]> downloadExport(@PathVariable String taskId) {
        ExportResult result = taskResults.get(taskId);
        if (result == null) {
            log.warn("下载请求未找到对应任务: taskId={}", taskId);
            return ResponseEntity.notFound().build();
        }

        return buildFileResponse(result);
    }

    /**
     * 构建文件下载响应
     */
    private ResponseEntity<byte[]> buildFileResponse(ExportResult result) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.parseMediaType(result.getContentType()));
        headers.setContentDispositionFormData("attachment", result.getFileName());
        headers.setContentLength(result.getFileSizeBytes());

        return new ResponseEntity<>(result.getFileData(), headers, HttpStatus.OK);
    }
}
