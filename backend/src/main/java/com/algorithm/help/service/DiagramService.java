package com.algorithm.help.service;

import com.algorithm.help.common.enums.DiagramType;
import com.algorithm.help.diagram.DiagramTypeDecider;
import com.algorithm.help.diagram.MermaidGenerator;
import com.algorithm.help.entity.Problem;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

/**
 * 图解服务编排层：组合决策器 + 生成器
 */
@Slf4j
@Service
public class DiagramService {

    private final DiagramTypeDecider decider;
    private final MermaidGenerator generator;

    public DiagramService(DiagramTypeDecider decider, MermaidGenerator generator) {
        this.decider = decider;
        this.generator = generator;
    }

    /**
     * 为指定题目自动生成图解 Mermaid 代码
     * 根据题目标签推断算法类型 → 决策图表类型 → 生成 Mermaid 代码
     */
    public String generateForProblem(Problem problem) {
        String algorithmType = inferAlgorithmType(problem);
        DiagramType diagramType = decider.decide(algorithmType);
        log.debug("题目 [{}] 推断算法类型: {}, 图表类型: {}", problem.getId(), algorithmType, diagramType);
        return generator.generate(algorithmType, diagramType, problem.getDescription());
    }

    /**
     * 从题目标签中推断主要算法类型
     */
    private String inferAlgorithmType(Problem problem) {
        String tags = problem.getTags();
        if (tags == null || tags.isBlank()) return "unknown";
        // 简单策略：取第一个标签作为算法类型
        String cleaned = tags.replaceAll("[\\[\\]\"]", "");
        String[] tagArray = cleaned.split(",");
        return tagArray.length > 0 ? tagArray[0].trim().toLowerCase() : "unknown";
    }
}
