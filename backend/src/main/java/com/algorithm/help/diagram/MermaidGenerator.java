package com.algorithm.help.diagram;

import com.algorithm.help.ai.SmartRouter;
import com.algorithm.help.ai.model.AiRequest;
import com.algorithm.help.common.enums.DiagramType;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

/**
 * Mermaid 代码生成器
 * 优先使用模板生成（零成本），复杂场景调用 AI
 */
@Slf4j
@Component
public class MermaidGenerator {

    private final SmartRouter router;

    public MermaidGenerator(SmartRouter router) {
        this.router = router;
    }

    /**
     * 生成 Mermaid 代码：模板优先，AI 兜底
     */
    public String generate(String algorithmType, DiagramType diagramType, String inputData) {
        // 尝试模板生成
        String template = tryTemplateGeneration(algorithmType, diagramType, inputData);
        if (template != null) return template;

        // 回退到 AI 生成
        try {
            var request = AiRequest.forDiagram(algorithmType, diagramType.name(), inputData);
            return router.route(request).getContent();
        } catch (Exception e) {
            log.warn("AI 生成图解失败，返回默认流程图: {}", e.getMessage());
            return generateDefaultFlowchart(algorithmType);
        }
    }

    /**
     * 模板生成：对简单场景使用预定义模板
     */
    private String tryTemplateGeneration(String type, DiagramType diagram, String data) {
        return switch (diagram) {
            case FLOWCHART -> generateFlowchart(type);
            case TREE_GRAPH -> generateTreeTemplate();
            case TABLE_FILL -> generateTableTemplate(type);
            default -> null;
        };
    }

    private String generateFlowchart(String algorithmType) {
        return """
            graph TD
                A[开始] --> B{输入数据}
                B --> C[%s 算法处理]
                C --> D[输出结果]
                D --> E[结束]
            """.formatted(algorithmType);
    }

    private String generateTreeTemplate() {
        return """
            graph TD
                A((根节点)) --> B((左子树))
                A --> C((右子树))
                B --> D((叶节点))
                B --> E((叶节点))
            """;
    }

    private String generateTableTemplate(String type) {
        return """
            graph LR
                subgraph DP表格
                    A[dp[0]=0] --> B[dp[1]=?]
                    B --> C[dp[2]=?]
                    C --> D[dp[n]=答案]
                end
            """;
    }

    private String generateDefaultFlowchart(String algorithmType) {
        return "graph TD\n    A[开始] --> B[" + algorithmType + "] --> C[结束]";
    }
}
