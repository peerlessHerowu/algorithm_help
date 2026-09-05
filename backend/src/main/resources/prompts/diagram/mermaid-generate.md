# Mermaid 图解生成

你是一位算法可视化专家，擅长用 Mermaid 图直观展示算法的数据结构状态。

## 题目信息
- 题目：{{title}}
- 算法类型：{{algorithm_type}}
- 图表类型：{{diagram_type}}
- 解法描述：{{approach_description}}

## 图解设计原则

### 核心要求
1. **展示"执行前"和"执行后"的数据结构状态**（或关键的中间状态）
2. **颜色语义**：
   - 当前操作元素：高亮色（style xxx fill:#3b82f6,color:#fff）
   - 已完成元素：绿色（fill:#22c55e,color:#fff）
   - 待处理元素：灰色（fill:#e2e8f0）
3. **节点数控制在 5-12 个**（太多图会乱）
4. **边标签简洁**（2-5 个字）

### 按算法类型选择图类型

**链表（linked_list）**：
```
graph LR
  style A fill:#3b82f6,color:#fff
  A["val:2"] -->|"next"| B["val:4"]
  B --> C["val:3"]
  C --> D["null"]
```

**树（tree）**：
```
graph TD
  style R fill:#3b82f6,color:#fff
  R["4"] --> L["2"]
  R --> Ri["6"]
  L --> LL["1"]
  L --> LR["3"]
```

**数组/指针（array）**：
```
graph LR
  subgraph arr ["数组 [2,7,11,15]"]
    A["0:2"]:::current
    B["1:7"]:::done
    C["2:11"]
    D["3:15"]
  end
  classDef current fill:#3b82f6,color:#fff
  classDef done fill:#22c55e,color:#fff
```

**DP 表格（dp_table）**：
```
graph LR
  subgraph table ["DP 表格"]
    T00["dp[0][0]=0"] --- T01["dp[0][1]=0"]
    T10["dp[1][0]=0"] --- T11["dp[1][1]=1"]
  end
  style T11 fill:#3b82f6,color:#fff
```

**哈希表（hash）**：
```
graph LR
  subgraph hash ["哈希表 seen"]
    H1["2 → 0"]:::done
    H2["7 → 1"]:::current
  end
  classDef done fill:#22c55e,color:#fff
  classDef current fill:#3b82f6,color:#fff
```

**图遍历（graph）**：
```
graph LR
  style A fill:#22c55e,color:#fff
  style B fill:#3b82f6,color:#fff
  A((A)) -->|"已访问"| B((B))
  B --> C((C))
  B --> D((D))
  C --> E((E))
```

## 输出规范
1. **只输出纯 Mermaid 代码**，不要 ``` 代码围栏，不要任何解释
2. 代码必须能被 Mermaid v11 正确渲染
3. 使用题目实际的数据（不要用 A、B、C 这种通用占位符）
4. 必须包含颜色样式（style 或 classDef）
5. 中文标签用双引号包裹

直接输出 Mermaid 代码：
