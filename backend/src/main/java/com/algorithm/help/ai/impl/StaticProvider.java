package com.algorithm.help.ai.impl;

import com.algorithm.help.ai.AIProvider;
import com.algorithm.help.ai.model.AiResponse;
import com.algorithm.help.ai.model.ChatMessage;
import com.algorithm.help.ai.model.GenerateOptions;
import com.algorithm.help.entity.Problem;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

/**
 * 静态文件 Provider，从预生成 JSON 文件读取解析内容
 */
@Slf4j
@Component
public class StaticProvider implements AIProvider {

    private static final String DATA_DIR = "data/static/";

    @Override
    public AiResponse generateExplanation(Problem problem, GenerateOptions options) {
        long start = System.currentTimeMillis();
        String filename = problem.getId() + "-L" + options.getLevel() + ".json";
        String content = readStaticFile(filename);
        long duration = System.currentTimeMillis() - start;
        return AiResponse.of(content, getName(), duration);
    }

    @Override
    public AiResponse transformUserInput(String userInput, Problem problem) {
        return notAvailableResponse();
    }

    @Override
    public String generateDiagram(String algorithmType, String diagramType, String inputData) {
        return "";
    }

    @Override
    public AiResponse interactiveChat(List<ChatMessage> context, String message) {
        return notAvailableResponse();
    }

    @Override
    public AiResponse detectErrors(String content) {
        return notAvailableResponse();
    }

    @Override
    public AiResponse generateLeveledExplanation(String topic, int level) {
        String filename = topic + "-L" + level + ".json";
        long start = System.currentTimeMillis();
        String content = readStaticFile(filename);
        long duration = System.currentTimeMillis() - start;
        return AiResponse.of(content, getName(), duration);
    }

    @Override
    public boolean isAvailable() {
        return true;
    }

    @Override
    public String getName() {
        return "static";
    }

    /** 读取静态文件，不存在则返回提示信息 */
    private String readStaticFile(String filename) {
        Path path = Path.of(DATA_DIR, filename);
        try {
            if (Files.exists(path)) {
                return Files.readString(path);
            }
        } catch (IOException e) {
            log.warn("读取静态文件失败: {}", filename, e);
        }
        return "暂无预生成内容";
    }

    private AiResponse notAvailableResponse() {
        return AiResponse.of("暂无预生成内容", getName(), 0);
    }
}
