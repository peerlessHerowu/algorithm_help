package com.algorithm.help.service;

import com.algorithm.help.common.enums.DiagramType;
import com.algorithm.help.diagram.DiagramTypeDecider;
import com.algorithm.help.diagram.MermaidGenerator;
import com.algorithm.help.entity.Diagram;
import com.algorithm.help.entity.Problem;
import com.algorithm.help.repository.DiagramRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.UUID;

/**
 * 图解服务编排层：组合决策器 + 生成器，并持久化图解结果
 */
@Slf4j
@Service
public class DiagramService {

    private final DiagramTypeDecider decider;
    private final MermaidGenerator generator;
    private final DiagramRepository diagramRepo;

    public DiagramService(DiagramTypeDecider decider, MermaidGenerator generator,
                          DiagramRepository diagramRepo) {
        this.decider = decider;
        this.generator = generator;
        this.diagramRepo = diagramRepo;
    }

    /**
     * 为指定题目自动生成图解 Mermaid 代码，并存入 diagrams 表
     *
     * @param problem    题目信息
     * @param level      解析级别
     * @param enrichedId 关联解析 ID（可空）
     * @return 生成的 Mermaid 代码（失败时返回 null）
     */
    public String generateForProblem(Problem problem, int level, String enrichedId) {
        String algorithmType = inferAlgorithmType(problem);
        DiagramType diagramType = decider.decide(algorithmType);
        log.debug("题目 [{}] 推断算法类型: {}, 图表类型: {}", problem.getId(), algorithmType, diagramType);

        String mermaidCode = generator.generate(algorithmType, diagramType, problem.getDescription());
        if (mermaidCode == null || mermaidCode.isBlank()) {
            return null;
        }

        // 存入 diagrams 表
        saveDiagram(problem.getId(), enrichedId, level, algorithmType, diagramType, mermaidCode);
        return mermaidCode;
    }

    /**
     * 兼容旧接口（无 level、enrichedId）
     */
    public String generateForProblem(Problem problem) {
        return generateForProblem(problem, 0, null);
    }

    /**
     * 查询题目图解列表（已存在不重新生成）
     */
    public List<Diagram> getDiagrams(String problemId, int level) {
        return diagramRepo.findByProblemIdAndLevel(problemId, level);
    }

    private void saveDiagram(String problemId, String enrichedId, int level,
                              String algorithmType, DiagramType diagramType, String mermaidCode) {
        try {
            Diagram diagram = new Diagram()
                    .setId(UUID.randomUUID().toString())
                    .setProblemId(problemId)
                    .setEnrichedId(enrichedId)
                    .setLevel(level)
                    .setAlgorithmType(algorithmType)
                    .setDiagramType(diagramType)
                    .setMermaidCode(mermaidCode)
                    .setRenderEngine("mermaid")
                    .setStatus("ready");
            diagramRepo.save(diagram);
            log.debug("图解已存入 diagrams 表, problemId={}, level=L{}", problemId, level);
        } catch (Exception e) {
            log.warn("图解持久化失败, problemId={}: {}", problemId, e.getMessage());
        }
    }

    /**
     * 从题目标签中推断主要算法类型
     */
    private String inferAlgorithmType(Problem problem) {
        String tags = problem.getTags();
        if (tags == null || tags.isBlank()) return "unknown";
        String cleaned = tags.replaceAll("[\\[\\]\"]", "");
        String[] tagArray = cleaned.split(",");
        return tagArray.length > 0 ? tagArray[0].trim().toLowerCase() : "unknown";
    }
}
