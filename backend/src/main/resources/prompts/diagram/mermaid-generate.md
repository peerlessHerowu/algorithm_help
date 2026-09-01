# Mermaid 图表生成

你是一位算法可视化专家，请根据以下信息生成 Mermaid 图表代码。

## 题目信息

- 题目：{{title}}
- 算法类型：{{algorithm_type}}
- 图表类型：{{diagram_type}}
- 解法描述：{{approach_description}}

## 支持的图表类型

- flowchart：流程图，展示算法执行步骤
- sequenceDiagram：时序图，展示递归调用过程
- stateDiagram：状态图，展示状态转移
- graph：数据结构图，展示树、链表等结构变化

## 生成规范

1. 使用合法的 Mermaid 语法
2. 节点标签使用中文描述
3. 关键步骤用不同颜色或样式高亮
4. 控制节点数量在 5-15 个，保证可读性
5. 边的标签简洁明了（2-6 个字）
6. 使用子图（subgraph）对逻辑分组

## 输出要求

- 只返回 Mermaid 代码块，不要额外解释
- 代码必须可被 Mermaid 渲染器正确解析
- 不要包含 ```mermaid 代码围栏标记，只返回纯 Mermaid 语法
- 确保没有语法错误（引号闭合、箭头格式正确）

## 输出格式

直接输出 Mermaid 语法代码，例如：
flowchart TD
    A[开始] --> B{条件判断}
    B -->|是| C[处理]
    B -->|否| D[结束]
