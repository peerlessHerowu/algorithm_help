package com.algorithm.help.ai;

import com.algorithm.help.ai.model.AiRequest;
import com.algorithm.help.ai.model.AiResponse;
import com.algorithm.help.ai.model.ChatMessage;
import com.algorithm.help.ai.model.GenerateOptions;
import com.algorithm.help.entity.Problem;

import java.util.List;

/**
 * AI Provider 统一接口，屏蔽底层不同 AI 实现
 */
public interface AIProvider {

    /** 生成题目完整解析 */
    AiResponse generateExplanation(Problem problem, GenerateOptions options);

    /** 用户思路转化为结构化答案 */
    AiResponse transformUserInput(String userInput, Problem problem);

    /** 生成图解 Mermaid 代码 */
    String generateDiagram(String algorithmType, String diagramType, String inputData);

    /** 交互式对话 */
    AiResponse interactiveChat(List<ChatMessage> context, String message);

    /** 错误检测 */
    AiResponse detectErrors(String content);

    /** 分级解释生成 */
    AiResponse generateLeveledExplanation(String topic, int level);

    /** 检查 Provider 是否可用 */
    boolean isAvailable();

    /** 获取 Provider 名称 */
    String getName();
}
