package com.algorithm.help.diagram;

import com.algorithm.help.ai.SmartRouter;
import com.algorithm.help.ai.model.AiRequest;
import com.algorithm.help.common.enums.DiagramType;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

/**
 * Mermaid 代码生成器
 * 根据算法类型生成结构清晰的 Mermaid 图解。
 * <p>
 * 优先使用算法类型模板（确保格式合法），AI 仅作为最终兜底。
 * 关键原则：只输出单一合法 Mermaid 图类型，禁止混合多种类型。
 */
@Slf4j
@Component
public class MermaidGenerator {

    private final SmartRouter router;

    public MermaidGenerator(SmartRouter router) {
        this.router = router;
    }

    /**
     * 生成 Mermaid 代码
     * 优先按算法类型匹配内置模板；没有匹配的则调用 AI，AI 失败降级到通用流程图。
     */
    public String generate(String algorithmType, DiagramType diagramType, String inputData) {
        // 1. 尝试按算法类型生成精准模板
        String typeTemplate = generateByAlgorithmType(algorithmType);
        if (typeTemplate != null) return typeTemplate;

        // 2. 尝试按图解类型生成通用模板
        String diagramTemplate = generateByDiagramType(diagramType);
        if (diagramTemplate != null) return diagramTemplate;

        // 3. 回退到 AI（使用改进后的 Prompt，强制单一图类型）
        try {
            var request = AiRequest.forDiagram(algorithmType, diagramType.name(), inputData);
            String aiResult = router.route(request).getContent();
            // 验证 AI 输出：确保只有一种图类型
            if (aiResult != null && isValidMermaid(aiResult)) {
                return aiResult;
            }
            log.warn("AI 图解输出格式不合法，使用兜底图解, algorithmType={}", algorithmType);
        } catch (Exception e) {
            log.warn("AI 生成图解失败，使用兜底图解: {}", e.getMessage());
        }

        // 4. 最终兜底：通用流程图
        return generateFallbackFlowchart(algorithmType);
    }

    /**
     * 按算法类型生成对应的图解模板
     * 返回 null 表示无匹配模板
     */
    private String generateByAlgorithmType(String algorithmType) {
        if (algorithmType == null) return null;
        String type = algorithmType.toLowerCase().replace("-", "_").replace(" ", "_");

        // 双指针 / 滑动窗口 / 数组
        if (type.contains("two_pointer") || type.contains("twopointer")
                || type.contains("sliding_window") || type.contains("sliding")
                || type.contains("array") || type.contains("greedy")) {
            return generateArrayPointerDiagram();
        }
        // 链表
        if (type.contains("linked_list") || type.contains("linkedlist")
                || type.contains("list")) {
            return generateLinkedListDiagram();
        }
        // 树 / 二叉树 / BST
        if (type.contains("tree") || type.contains("bst") || type.contains("binary")) {
            return generateTreeDiagram();
        }
        // 图 / BFS / DFS
        if (type.contains("graph") || type.contains("bfs") || type.contains("dfs")
                || type.contains("topological")) {
            return generateGraphDiagram();
        }
        // 动态规划
        if (type.contains("dynamic") || type.contains("dp") || type.contains("programming")) {
            return generateDpDiagram();
        }
        // 哈希
        if (type.contains("hash") || type.contains("map") || type.contains("set")) {
            return generateHashDiagram();
        }
        // 栈 / 单调栈 / 队列
        if (type.contains("stack") || type.contains("monotone") || type.contains("queue")) {
            return generateStackDiagram();
        }
        // 二分搜索
        if (type.contains("binary_search") || type.contains("binarysearch")
                || type.contains("search")) {
            return generateBinarySearchDiagram();
        }
        // 回溯 / 排列组合
        if (type.contains("backtrack") || type.contains("permut") || type.contains("combin")) {
            return generateBacktrackDiagram();
        }

        return null; // 无匹配，让调用方继续尝试其他方式
    }

    /**
     * 按图解类型生成通用模板
     */
    private String generateByDiagramType(DiagramType diagramType) {
        return switch (diagramType) {
            case FLOWCHART   -> generateFallbackFlowchart("算法");
            case TREE_GRAPH  -> generateTreeDiagram();
            case TABLE_FILL  -> generateDpDiagram();
            case NODE_LINK   -> generateLinkedListDiagram();
            case NODE_EDGE_GRAPH -> generateGraphDiagram();
            case POINTER_ANIMATION, ARRAY_POINTER, WINDOW_SLIDE -> generateArrayPointerDiagram();
            case STACK_STATE -> generateStackDiagram();
            case DP_TABLE    -> generateDpDiagram();
            case HASH_BUCKET -> generateHashDiagram();
            default          -> null;
        };
    }

    /**
     * 校验 Mermaid 代码是否只含一种图类型（防止混合格式）
     */
    private boolean isValidMermaid(String code) {
        if (code == null || code.isBlank()) return false;
        String trimmed = code.trim();
        // 合法的起始关键字
        String[] validStarts = {
            "graph ", "flowchart ", "sequenceDiagram", "classDiagram",
            "stateDiagram", "erDiagram", "gantt", "pie ", "gitGraph",
            "mindmap", "timeline", "block-beta", "quadrantChart"
        };
        for (String start : validStarts) {
            if (trimmed.startsWith(start)) return true;
        }
        // 不合法：包含多种图类型起始词
        return false;
    }

    // ── 各算法类型的标准图解模板 ──────────────────────────────────────────

    /** 数组/双指针算法图解 */
    private String generateArrayPointerDiagram() {
        return """
                graph LR
                    subgraph 数组
                        A0["0"] --- A1["1"] --- A2["2"] --- A3["..."] --- An["n-1"]
                    end
                    style A0 fill:#3b82f6,color:#fff
                    style An fill:#3b82f6,color:#fff
                    L["左指针 L=0"] -->|指向| A0
                    R["右指针 R=n-1"] -->|指向| An
                    note["每步移动较矮的一侧指针\n直到两指针相遇"]
                    style L fill:#e0f2fe,color:#0369a1
                    style R fill:#e0f2fe,color:#0369a1
                """;
    }

    /** 链表操作图解 */
    private String generateLinkedListDiagram() {
        return """
                graph LR
                    style H fill:#3b82f6,color:#fff
                    style C fill:#f59e0b,color:#fff
                    H["头节点\nhead"] --> A["节点1\nval"] --> B["节点2\nval"] --> C["当前节点\ncurr"] --> D["..."] --> N["null"]
                    prev["prev"] -.->|"前驱指针"| B
                    C -.->|"next"| D
                    style prev fill:#e0f2fe,color:#0369a1
                """;
    }

    /** 二叉树图解 */
    private String generateTreeDiagram() {
        return """
                graph TD
                    style ROOT fill:#3b82f6,color:#fff
                    ROOT((根节点)) --> L((左子树))
                    ROOT --> R((右子树))
                    L --> LL((左叶节点))
                    L --> LR((右叶节点))
                    R --> RL((左叶节点))
                    R --> RR((右叶节点))
                    style LL fill:#22c55e,color:#fff
                    style LR fill:#22c55e,color:#fff
                """;
    }

    /** 图遍历图解（BFS/DFS） */
    private String generateGraphDiagram() {
        return """
                graph LR
                    style S fill:#3b82f6,color:#fff
                    style B fill:#22c55e,color:#fff
                    style C fill:#22c55e,color:#fff
                    S((起点 S)) --> B((节点 B))
                    S --> C((节点 C))
                    B --> D((节点 D))
                    B --> E((节点 E))
                    C --> F((节点 F))
                    Queue["BFS 队列: [S → B → C → D → E → F]"]
                    style Queue fill:#fef3c7,color:#92400e
                """;
    }

    /** 动态规划表格图解 */
    private String generateDpDiagram() {
        return """
                graph LR
                    subgraph DP状态转移
                        dp0["dp[0]=0\n初始值"] --> dp1["dp[1]=?"]
                        dp1 --> dp2["dp[2]=?"]
                        dp2 --> dp3["dp[i]=?"]
                        dp3 --> dpn["dp[n]=答案"]
                    end
                    style dp0 fill:#e2e8f0,color:#475569
                    style dpn fill:#3b82f6,color:#fff
                    style dp3 fill:#f59e0b,color:#fff
                    rule["转移方程: dp[i] = f(dp[i-1], dp[i-2], ...)"]
                    style rule fill:#fef3c7,color:#92400e
                """;
    }

    /** 哈希表图解 */
    private String generateHashDiagram() {
        return """
                graph LR
                    subgraph 哈希表 seen
                        K1["key1 → val1"]
                        K2["key2 → val2"]
                        K3["key3 → val3"]
                    end
                    style K1 fill:#22c55e,color:#fff
                    style K2 fill:#22c55e,color:#fff
                    style K3 fill:#3b82f6,color:#fff
                    lookup["查询: target - nums[i]\n若存在则找到答案！"]
                    style lookup fill:#fef3c7,color:#92400e
                """;
    }

    /** 栈/单调栈图解 */
    private String generateStackDiagram() {
        return """
                graph TD
                    subgraph 栈 Stack
                        TOP["栈顶 top"] --> E3["元素3（最新入栈）"]
                        E3 --> E2["元素2"]
                        E2 --> E1["元素1（最早入栈）"]
                        E1 --> BOT["栈底 bottom"]
                    end
                    style TOP fill:#3b82f6,color:#fff
                    style E3 fill:#f59e0b,color:#fff
                    ops["操作: push(入栈) / pop(出栈) / peek(查看栈顶)"]
                    style ops fill:#fef3c7,color:#92400e
                """;
    }

    /** 二分搜索图解 */
    private String generateBinarySearchDiagram() {
        return """
                graph LR
                    subgraph 有序数组
                        L["left=0"] --- M["mid=(l+r)/2"] --- R["right=n-1"]
                    end
                    style M fill:#3b82f6,color:#fff
                    style L fill:#e0f2fe,color:#0369a1
                    style R fill:#e0f2fe,color:#0369a1
                    cond{{"nums[mid] vs target"}}
                    cond -->|"相等"| FOUND["找到！返回 mid"]
                    cond -->|"太小"| MOVEL["left = mid + 1\n向右收缩"]
                    cond -->|"太大"| MOVER["right = mid - 1\n向左收缩"]
                    style FOUND fill:#22c55e,color:#fff
                """;
    }

    /** 回溯决策树图解 */
    private String generateBacktrackDiagram() {
        return """
                graph TD
                    ROOT["[]"] --> A["[1]"]
                    ROOT --> B["[2]"]
                    ROOT --> C["[3]"]
                    A --> A1["[1,2]"] --> A12["[1,2,3] ✓"]
                    A --> A2["[1,3]"]
                    B --> B1["[2,1]"]
                    B --> B2["[2,3]"]
                    style ROOT fill:#3b82f6,color:#fff
                    style A12 fill:#22c55e,color:#fff
                    prune["剪枝: 不满足条件时回溯"]
                    style prune fill:#fef3c7,color:#92400e
                """;
    }

    /** 通用兜底流程图 */
    private String generateFallbackFlowchart(String algorithmType) {
        return """
                graph TD
                    A["开始"] --> B["初始化数据结构"]
                    B --> C{{"满足条件？"}}
                    C -->|"是"| D["%s 核心操作"]
                    D --> E["更新状态"]
                    E --> C
                    C -->|"否"| F["返回结果"]
                    style A fill:#3b82f6,color:#fff
                    style F fill:#22c55e,color:#fff
                    style D fill:#f59e0b,color:#fff
                """.formatted(algorithmType != null ? algorithmType : "算法");
    }
}

