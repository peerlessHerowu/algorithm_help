package com.algorithm.help.crawler.client;

import com.algorithm.help.api.dto.CrawlTaskDTO;
import com.algorithm.help.api.dto.CrawlTriggerRequest;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientResponseException;

import java.time.Duration;
import java.util.Map;

/**
 * Python Crawler Service HTTP 客户端
 * 替代原 Dubbo CrawlerFacade 远程调用，通过 HTTP REST 与 python-crawler-service 通信
 * &lt;p&gt;
 * 所有请求携带 X-Trace-Id 请求头用于跨服务链路追踪
 *
 * @see com.algorithm.help.api.crawler.CrawlerFacade
 */
@Slf4j
@Component
public class PythonCrawlerClient {

    private final WebClient webClient;
    private final Duration timeout;

    public PythonCrawlerClient(
            @Value("${crawler.service.url:http://python-crawler-service:8000}") String baseUrl,
            @Value("${crawler.service.timeout-ms:10000}") long timeoutMs) {
        this.webClient = WebClient.builder()
                .baseUrl(baseUrl)
                .defaultHeader(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
                .build();
        this.timeout = Duration.ofMillis(timeoutMs);
    }

    /**
     * 触发采集任务
     * 对应 Python 端 POST /api/v1/crawl/trigger
     */
    @SuppressWarnings("unchecked")
    public CrawlTaskDTO triggerCrawl(CrawlTriggerRequest request, String traceId) {
        log.info("触发采集任务: platform={}, taskType={}, traceId={}",
                request.getPlatform(), request.getTaskType(), traceId);
        try {
            Map<String, Object> response = webClient.post()
                    .uri("/api/v1/crawl/trigger")
                    .header("X-Trace-Id", traceId)
                    .bodyValue(request)
                    .retrieve()
                    .bodyToMono(Map.class)
                    .block(timeout);
            return extractData(response, "triggerCrawl");
        } catch (WebClientResponseException e) {
            log.error("触发采集任务失败: status={}, body={}",
                    e.getStatusCode(), e.getResponseBodyAsString());
            throw new CrawlerServiceException("触发采集任务失败: " + e.getMessage(), e);
        } catch (CrawlerServiceException e) {
            throw e;
        } catch (Exception e) {
            log.error("触发采集任务异常", e);
            throw new CrawlerServiceException("触发采集任务异常: " + e.getMessage(), e);
        }
    }

    /**
     * 查询采集任务进度
     * 对应 Python 端 GET /api/v1/crawl/tasks/{id}
     */
    @SuppressWarnings("unchecked")
    public CrawlTaskDTO getTaskProgress(Long taskId, String traceId) {
        log.debug("查询采集任务进度: taskId={}, traceId={}", taskId, traceId);
        try {
            Map<String, Object> response = webClient.get()
                    .uri("/api/v1/crawl/tasks/{id}", taskId)
                    .header("X-Trace-Id", traceId)
                    .retrieve()
                    .bodyToMono(Map.class)
                    .block(timeout);
            return extractData(response, "getTaskProgress");
        } catch (WebClientResponseException e) {
            log.error("查询任务进度失败: taskId={}, status={}", taskId, e.getStatusCode());
            throw new CrawlerServiceException("查询任务进度失败: " + e.getMessage(), e);
        } catch (CrawlerServiceException e) {
            throw e;
        } catch (Exception e) {
            log.error("查询任务进度异常: taskId={}", taskId, e);
            throw new CrawlerServiceException("查询任务进度异常: " + e.getMessage(), e);
        }
    }

    /**
     * 取消运行中的采集任务
     * 对应 Python 端 POST /api/v1/crawl/tasks/{id}/cancel
     */
    @SuppressWarnings("unchecked")
    public void cancelTask(Long taskId, String traceId) {
        log.info("取消采集任务: taskId={}, traceId={}", taskId, traceId);
        try {
            Map<String, Object> response = webClient.post()
                    .uri("/api/v1/crawl/tasks/{id}/cancel", taskId)
                    .header("X-Trace-Id", traceId)
                    .retrieve()
                    .bodyToMono(Map.class)
                    .block(timeout);
            validateResponse(response, "cancelTask");
        } catch (WebClientResponseException e) {
            log.error("取消任务失败: taskId={}, status={}", taskId, e.getStatusCode());
            throw new CrawlerServiceException("取消任务失败: " + e.getMessage(), e);
        } catch (CrawlerServiceException e) {
            throw e;
        } catch (Exception e) {
            log.error("取消任务异常: taskId={}", taskId, e);
            throw new CrawlerServiceException("取消任务异常: " + e.getMessage(), e);
        }
    }

    // ==================== 私有方法 ====================

    @SuppressWarnings("unchecked")
    private CrawlTaskDTO extractData(Map<String, Object> response, String method) {
        validateResponse(response, method);
        Map<String, Object> data = (Map<String, Object>) response.get("data");
        if (data == null) {
            return null;
        }
        return mapToDTO(data);
    }

    private void validateResponse(Map<String, Object> response, String method) {
        if (response == null) {
            throw new CrawlerServiceException(method + ": Python 爬虫服务响应为空");
        }
        Integer code = (Integer) response.get("code");
        if (code == null || code != 200) {
            String msg = (String) response.getOrDefault("message", "未知错误");
            throw new CrawlerServiceException(method + " 失败: " + msg);
        }
    }

    /** 将 Map 响应转为 CrawlTaskDTO，兼容 snake_case 和 camelCase */
    @SuppressWarnings("unchecked")
    private CrawlTaskDTO mapToDTO(Map<String, Object> data) {
        return new CrawlTaskDTO()
                .setId(toLong(data.get("id")))
                .setPlatform((String) data.get("platform"))
                .setTaskType(getString(data, "task_type", "taskType"))
                .setStatus((String) data.get("status"))
                .setTotal(toInt(data.get("total")))
                .setCompleted(toInt(data.get("completed")))
                .setFailed(toInt(data.get("failed")))
                .setTriggerType(getString(data, "trigger_type", "triggerType"))
                .setErrorMessage(getString(data, "error_message", "errorMessage"))
                .setCreatedAt(toLong(getField(data, "created_at", "createdAt")))
                .setCompletedAt(toLong(getField(data, "completed_at", "completedAt")));
    }

    private String getString(Map<String, Object> data, String snakeKey, String camelKey) {
        Object val = data.get(snakeKey);
        if (val == null) val = data.get(camelKey);
        return val != null ? val.toString() : null;
    }

    private Object getField(Map<String, Object> data, String snakeKey, String camelKey) {
        Object val = data.get(snakeKey);
        return val != null ? val : data.get(camelKey);
    }

    private Long toLong(Object val) {
        if (val == null) return null;
        if (val instanceof Number) return ((Number) val).longValue();
        try {
            return Long.parseLong(val.toString());
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private Integer toInt(Object val) {
        if (val == null) return 0;
        if (val instanceof Number) return ((Number) val).intValue();
        try {
            return Integer.parseInt(val.toString());
        } catch (NumberFormatException e) {
            return 0;
        }
    }
}
