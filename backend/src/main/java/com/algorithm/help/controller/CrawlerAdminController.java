package com.algorithm.help.controller;

import com.algorithm.help.api.dto.CrawlTaskDTO;
import com.algorithm.help.api.dto.CrawlTriggerRequest;
import com.algorithm.help.common.ApiResponse;
import com.algorithm.help.crawler.client.PythonCrawlerClient;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

/**
 * 采集任务管理 API（Admin）
 * 代理到 Python 爬虫服务
 */
@Slf4j
@RestController
@RequestMapping("/api/v1/admin/crawler")
@RequiredArgsConstructor
public class CrawlerAdminController {

    private final PythonCrawlerClient crawlerClient;

    /**
     * 触发采集任务
     */
    @PostMapping("/trigger")
    public ApiResponse<CrawlTaskDTO> trigger(@Valid @RequestBody CrawlTriggerRequest request) {
        String traceId = UUID.randomUUID().toString();
        log.info("管理端触发采集: platform={}, taskType={}, traceId={}",
                request.getPlatform(), request.getTaskType(), traceId);
        CrawlTaskDTO task = crawlerClient.triggerCrawl(request, traceId);
        return ApiResponse.success(task);
    }

    /**
     * 查询采集任务详情
     */
    @GetMapping("/tasks/{id}")
    public ApiResponse<CrawlTaskDTO> getTask(@PathVariable Long id) {
        String traceId = UUID.randomUUID().toString();
        CrawlTaskDTO task = crawlerClient.getTaskProgress(id, traceId);
        return ApiResponse.success(task);
    }

    /**
     * 取消采集任务
     */
    @PostMapping("/tasks/{id}/cancel")
    public ApiResponse<Void> cancelTask(@PathVariable Long id) {
        String traceId = UUID.randomUUID().toString();
        log.info("管理端取消采集任务: taskId={}, traceId={}", id, traceId);
        crawlerClient.cancelTask(id, traceId);
        return ApiResponse.success();
    }
}
