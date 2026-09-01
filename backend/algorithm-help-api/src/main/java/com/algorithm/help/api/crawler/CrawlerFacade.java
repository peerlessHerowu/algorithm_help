package com.algorithm.help.api.crawler;

import com.algorithm.help.api.dto.CrawlTaskDTO;
import com.algorithm.help.api.dto.CrawlTriggerRequest;

/**
 * Crawler 服务 Dubbo 接口
 * 由 Core 服务调用，触发采集任务、查询进度、取消任务
 *
 * @deprecated 已迁移至 Python 爬虫服务（python-crawler-service），
 *             Core 端应使用 PythonCrawlerClient（HTTP）替代 Dubbo 调用。
 *             本接口保留用于回退，通过 crawler.use-http-client 配置开关控制。
 *             预计在 v1.0 正式发布后移除。
 */
@Deprecated(since = "0.2.0", forRemoval = true)
public interface CrawlerFacade {

    /**
     * 触发采集任务
     *
     * @param request 采集触发请求
     * @return 创建的采集任务信息
     */
    CrawlTaskDTO triggerCrawl(CrawlTriggerRequest request);

    /**
     * 查询采集任务进度
     *
     * @param taskId 任务ID
     * @return 任务进度详情
     */
    CrawlTaskDTO getTaskProgress(Long taskId);

    /**
     * 取消运行中的采集任务
     *
     * @param taskId 任务ID
     */
    void cancelTask(Long taskId);
}
