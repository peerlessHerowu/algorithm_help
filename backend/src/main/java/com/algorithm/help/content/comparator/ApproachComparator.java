package com.algorithm.help.content.comparator;

import com.algorithm.help.ai.SmartRouter;
import com.algorithm.help.ai.model.AiRequest;
import com.algorithm.help.ai.model.AiResponse;
import com.algorithm.help.content.generator.LeveledContent.Approach;
import com.algorithm.help.content.prompt.PromptTemplateEngine;
import com.algorithm.help.entity.Problem;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * 解法对比器：对多种解法进行多维对比分析
 * <p>
 * - 演进关系 Mermaid 图（AI 生成）
 * - 底层框架提炼（AI 生成）
 * - 多维对比矩阵（本地解析构建）
 */
@Slf4j
@Service
public class ApproachComparator {

    private static final String EVOLUTION_TEMPLATE = "comparator/evolution-graph.md";
    private static final String FRAMEWORK_TEMPLATE = "comparator/framework-extract.md";

    private final SmartRouter smartRouter;
    private final PromptTemplateEngine templateEngine;
    private final ObjectMapper objectMapper;

    public ApproachComparator(SmartRouter smartRouter,
                              PromptTemplateEngine templateEngine,
                              ObjectMapper objectMapper) {
        this.smartRouter = smartRouter;
        this.templateEngine = templateEngine;
        this.objectMapper = objectMapper;
    }

    /**
     * 对比多种解法，生成完整的对比结果
     *
     * @param approaches 解法列表
     * @param problem    题目信息
     * @return 对比结果（包含演进图、矩阵、框架提炼、迁移路径）
     */
    public ComparisonResult compare(List<Approach> approaches, Problem problem) {
        String approachesJson = serializeApproaches(approaches);

        // 本地构建多维对比矩阵（不需要 AI）
        List<ComparisonRow> matrix = buildMatrix(approaches);

        // AI 生成演进关系图
        String evolutionMermaid = generateEvolutionGraph(problem.getTitle(), approachesJson);

        // AI 生成底层框架提炼（含迁移路径）
        String frameworkResponse = generateFrameworkExtract(problem.getTitle(), approachesJson);

        return new ComparisonResult()
            .setEvolutionMermaid(evolutionMermaid)
            .setMatrix(matrix)
            .setCommonFramework(extractFramework(frameworkResponse))
            .setTransferPath(extractTransferPath(frameworkResponse));
    }

    /**
     * 本地构建多维对比矩阵：从 approaches 直接提取各维度信息
     */
    private List<ComparisonRow> buildMatrix(List<Approach> approaches) {
        List<ComparisonRow> rows = new ArrayList<>();
        for (Approach approach : approaches) {
            ComparisonRow row = new ComparisonRow()
                .setApproachName(approach.getName())
                .setTimeComplexity(approach.getTimeComplexity())
                .setSpaceComplexity(approach.getSpaceComplexity())
                .setPros(derivePros(approach))
                .setCons(deriveCons(approach))
                .setBestFor(deriveBestFor(approach));
            rows.add(row);
        }
        return rows;
    }

    /**
     * 根据解法特征推导优点
     */
    private String derivePros(Approach approach) {
        List<String> pros = new ArrayList<>();
        if (isOptimalTime(approach)) {
            pros.add("时间复杂度最优");
        }
        if (isLowSpace(approach)) {
            pros.add("空间开销小");
        }
        if (approach.getSteps() != null && approach.getSteps().size() <= 3) {
            pros.add("实现简洁");
        }
        return pros.isEmpty() ? "通用性好" : String.join("；", pros);
    }

    /**
     * 根据解法特征推导缺点
     */
    private String deriveCons(Approach approach) {
        List<String> cons = new ArrayList<>();
        if (isHighSpace(approach)) {
            cons.add("额外空间开销大");
        }
        if (approach.getSteps() != null && approach.getSteps().size() > 5) {
            cons.add("实现复杂度高");
        }
        return cons.isEmpty() ? "无明显短板" : String.join("；", cons);
    }

    /**
     * 根据解法特征推导最佳适用场景
     */
    private String deriveBestFor(Approach approach) {
        String time = approach.getTimeComplexity();
        if (time == null) {
            return "一般场景";
        }
        if (time.contains("n log n") || time.contains("nlogn")) {
            return "中等规模数据，需要较优时间表现";
        }
        if (time.contains("n^2") || time.contains("n²")) {
            return "小规模数据或对空间要求严格";
        }
        if (time.contains("log n") || time.contains("logn")) {
            return "大规模有序数据的高效查找";
        }
        if (time.contains("2^n") || time.contains("2ⁿ")) {
            return "小规模穷举，确保正确性";
        }
        return "通用场景";
    }

    /**
     * 调用 AI 生成演进关系 Mermaid 图，失败时降级为空值
     */
    private String generateEvolutionGraph(String title, String approachesJson) {
        try {
            String prompt = templateEngine.render(EVOLUTION_TEMPLATE, Map.of(
                "title", title,
                "approaches_json", approachesJson
            ));
            AiRequest request = new AiRequest()
                .setType(AiRequest.RequestType.CHAT)
                .setContent(prompt);
            AiResponse response = smartRouter.route(request);
            return response.getContent();
        } catch (Exception e) {
            log.warn("生成演进关系图失败，降级为空: {}", e.getMessage());
            return null;
        }
    }

    /**
     * 调用 AI 生成底层框架提炼，失败时降级为空值
     */
    private String generateFrameworkExtract(String title, String approachesJson) {
        try {
            String prompt = templateEngine.render(FRAMEWORK_TEMPLATE, Map.of(
                "title", title,
                "approaches_json", approachesJson
            ));
            AiRequest request = new AiRequest()
                .setType(AiRequest.RequestType.CHAT)
                .setContent(prompt);
            AiResponse response = smartRouter.route(request);
            return response.getContent();
        } catch (Exception e) {
            log.warn("生成底层框架提炼失败，降级为空: {}", e.getMessage());
            return null;
        }
    }

    /**
     * 从 AI 响应中提取共同框架部分
     */
    private String extractFramework(String response) {
        if (response == null) {
            return null;
        }
        // AI 响应格式约定：以 "---" 分隔 framework 和 transferPath
        int separator = response.indexOf("---");
        if (separator > 0) {
            return response.substring(0, separator).trim();
        }
        return response.trim();
    }

    /**
     * 从 AI 响应中提取迁移路径部分
     */
    private String extractTransferPath(String response) {
        if (response == null) {
            return null;
        }
        int separator = response.indexOf("---");
        if (separator > 0 && separator + 3 < response.length()) {
            return response.substring(separator + 3).trim();
        }
        return null;
    }

    /**
     * 将 approaches 列表序列化为 JSON 字符串
     */
    private String serializeApproaches(List<Approach> approaches) {
        try {
            return objectMapper.writeValueAsString(approaches);
        } catch (Exception e) {
            log.warn("序列化 approaches 失败: {}", e.getMessage());
            return "[]";
        }
    }

    /**
     * 判断是否为最优时间复杂度（O(n) 或 O(log n)）
     */
    private boolean isOptimalTime(Approach approach) {
        String time = approach.getTimeComplexity();
        if (time == null) return false;
        return time.contains("O(n)") || time.contains("O(log n)")
            || time.contains("O(1)");
    }

    /**
     * 判断是否为低空间复杂度（O(1)）
     */
    private boolean isLowSpace(Approach approach) {
        String space = approach.getSpaceComplexity();
        if (space == null) return false;
        return space.contains("O(1)");
    }

    /**
     * 判断是否为高空间复杂度（O(n) 及以上）
     */
    private boolean isHighSpace(Approach approach) {
        String space = approach.getSpaceComplexity();
        if (space == null) return false;
        return space.contains("O(n") && !space.contains("O(1)");
    }
}
