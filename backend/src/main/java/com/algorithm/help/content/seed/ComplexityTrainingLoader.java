package com.algorithm.help.content.seed;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PostConstruct;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;

import java.io.InputStream;
import java.util.List;

/**
 * 复杂度训练题数据加载器
 * <p>
 * 从 classpath:data/static/complexity-training.json 幂等导入训练题。
 * 通过 content.complexity-training.auto-init 配置开关控制。
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class ComplexityTrainingLoader {

    private final ComplexityTrainingRepository trainingRepo;
    private final ObjectMapper objectMapper;

    @Value("${content.complexity-training.auto-init:true}")
    private boolean autoInit;

    private static final String DATA_FILE = "data/static/complexity-training.json";

    /**
     * 应用启动后幂等加载复杂度训练题数据
     */
    @PostConstruct
    public void init() {
        if (!autoInit) {
            log.info("复杂度训练题自动加载已禁用");
            return;
        }
        loadTrainingData();
    }

    /**
     * 加载训练题数据（幂等：跳过已存在的题目）
     */
    private void loadTrainingData() {
        List<JsonNode> items = readDataFile();
        if (items == null || items.isEmpty()) {
            return;
        }

        int imported = 0;
        for (JsonNode item : items) {
            String id = item.get("id").asText();
            if (trainingRepo.existsById(id)) {
                continue;
            }
            ComplexityTrainingProblem problem = convertToProblem(item);
            trainingRepo.save(problem);
            imported++;
        }
        log.info("复杂度训练题加载完成: 文件含 {} 题, 新导入 {} 题", items.size(), imported);
    }

    /**
     * 读取数据文件
     */
    private List<JsonNode> readDataFile() {
        try {
            ClassPathResource resource = new ClassPathResource(DATA_FILE);
            if (!resource.exists()) {
                log.info("复杂度训练题文件不存在: {}，跳过加载", DATA_FILE);
                return null;
            }
            InputStream is = resource.getInputStream();
            return objectMapper.readValue(is, new TypeReference<>() {});
        } catch (Exception e) {
            log.warn("读取复杂度训练题文件失败: {}", e.getMessage());
            return null;
        }
    }

    /**
     * JSON 节点转实体
     */
    private ComplexityTrainingProblem convertToProblem(JsonNode node) {
        return new ComplexityTrainingProblem()
                .setId(node.get("id").asText())
                .setMode(node.get("mode").asText())
                .setDifficulty(node.get("difficulty").asText())
                .setConstraints(toJson(node.get("constraints")))
                .setCode(node.has("code") ? node.get("code").asText() : null)
                .setOptions(toJson(node.get("options")))
                .setCorrectAnswer(node.get("correctAnswer").asText())
                .setExplanation(node.get("explanation").asText());
    }

    /**
     * JsonNode 转字符串
     */
    private String toJson(JsonNode node) {
        if (node == null) return null;
        try {
            return objectMapper.writeValueAsString(node);
        } catch (Exception e) {
            return null;
        }
    }
}
