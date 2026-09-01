package com.algorithm.help.crawler.client;

/**
 * Python Crawler Service 调用异常
 * 封装与爬虫服务 HTTP 通信过程中的错误（网络超时、响应异常等）
 */
public class CrawlerServiceException extends RuntimeException {

    public CrawlerServiceException(String message) {
        super(message);
    }

    public CrawlerServiceException(String message, Throwable cause) {
        super(message, cause);
    }
}
