package com.algorithm.help.api.ai;

import com.algorithm.help.api.dto.AiProcessResult;
import com.algorithm.help.api.dto.AggregateRequest;
import com.algorithm.help.api.dto.ContentEnrichRequest;
import com.algorithm.help.api.dto.ErrorDetectRequest;
import com.algorithm.help.api.dto.ImageDescribeRequest;
import com.algorithm.help.api.dto.StructurizeRequest;

/**
 * AI 加工服务 Dubbo 接口
 * 由 Crawler/Core 服务调用，触发 AI 内容加工
 */
public interface AiProcessFacade {

    /**
     * 内容增强（多源聚合、结构化格式化）
     *
     * @param request 内容增强请求
     * @return AI 处理结果
     */
    AiProcessResult enrichContent(ContentEnrichRequest request);

    /**
     * 逻辑错误检测（代码错误、复杂度分析错误、边界遗漏）
     *
     * @param request 错误检测请求
     * @return AI 处理结果
     */
    AiProcessResult detectErrors(ErrorDetectRequest request);

    /**
     * 图片内容识别（生成文本描述）
     *
     * @param request 图片描述请求
     * @return AI 处理结果
     */
    AiProcessResult describeImage(ImageDescribeRequest request);

    /**
     * 多源题解聚合精炼
     *
     * @param request 聚合请求
     * @return AI 处理结果
     */
    AiProcessResult aggregateSolutions(AggregateRequest request);

    /**
     * 用户输入结构化处理
     *
     * @param request 结构化请求
     * @return AI 处理结果
     */
    AiProcessResult structurizeUserInput(StructurizeRequest request);
}
