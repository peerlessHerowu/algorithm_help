package com.algorithm.help.crawler.client;

import com.algorithm.help.api.crawler.CrawlerFacade;
import com.algorithm.help.api.dto.CrawlTaskDTO;
import com.algorithm.help.api.dto.CrawlTriggerRequest;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.lang.Nullable;
import org.springframework.stereotype.Component;

import java.util.UUID;

/**
 * 爬虫服务调用委托器
 * 通过 crawler.use-http-client 配置开关控制新旧调用方式：
 * - true（默认）：使用 PythonCrawlerClient（HTTP）调用 Python 爬虫服务
 * - false：回退至 Dubbo CrawlerFacade 调用 Java 爬虫模块
 */
@Slf4j
@Component
public class CrawlerServiceDelegate {

    private final PythonCrawlerClient httpClient;
    @Nullable
    private final CrawlerFacade dubboFacade;
    private final boolean useHttpClient;

    public CrawlerServiceDelegate(
            PythonCrawlerClient httpClient,
            @Nullable CrawlerFacade dubboFacade,
            @Value("${crawler.use-http-client:true}") boolean useHttpClient) {
        this.httpClient = httpClient;
        this.dubboFacade = dubboFacade;
        this.useHttpClient = useHttpClient;
        log.info("爬虫服务调用方式: {}", useHttpClient ? "HTTP (Python)" : "Dubbo (Java)");
    }

    /**
     * 触发采集任务
     */
    public CrawlTaskDTO triggerCrawl(CrawlTriggerRequest request) {
        if (useHttpClient) {
            return httpClient.triggerCrawl(request, generateTraceId());
        }
        return useDubboFallback().triggerCrawl(request);
    }

    /**
     * 查询采集任务进度
     */
    public CrawlTaskDTO getTaskProgress(Long taskId) {
        if (useHttpClient) {
            return httpClient.getTaskProgress(taskId, generateTraceId());
        }
        return useDubboFallback().getTaskProgress(taskId);
    }

    /**
     * 取消采集任务
     */
    public void cancelTask(Long taskId) {
        if (useHttpClient) {
            httpClient.cancelTask(taskId, generateTraceId());
            return;
        }
        useDubboFallback().cancelTask(taskId);
    }

    /**
     * 获取当前调用方式（用于监控/调试）
     */
    public String getActiveMode() {
        return useHttpClient ? "HTTP" : "Dubbo";
    }

    private CrawlerFacade useDubboFallback() {
        if (dubboFacade == null) {
            throw new IllegalStateException(
                    "Dubbo CrawlerFacade 不可用，请检查 crawler.use-http-client 配置或 Dubbo 服务注册");
        }
        return dubboFacade;
    }

    private String generateTraceId() {
        return UUID.randomUUID().toString().replace("-", "");
    }
}
