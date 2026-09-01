# Design: 算法深度理解引擎 MVP（历史参考文档，已废弃）

> ⚠️ **本文件已废弃**。最初 MVP 规划为 TypeScript CLI 工具，后决定直接实施全栈 Web 方案。最终实现以 `algorithm-engine-infrastructure`、`content-generation-engine`、`web-presentation-layer`、`interactive-features`、`knowledge-graph-advanced` 五个正式 Spec 为准。本文件仅作为历史参考保留。

## Overview

构建一个 CLI 工具 + 内容生成系统，能够为经典算法题生成高质量的深度解析内容（Markdown + Mermaid 图解），存储为本地文件，可直接阅读或用静态站展示。

## Architecture

### 分层架构

```
CLI 入口 (commander.js)
    ↓
生成编排层 (Generator)
    ↓
┌──────────────┬──────────────┬──────────────┐
│ AIProvider   │ DiagramEngine│ TemplateEngine│
│ (接口抽象)   │ (Mermaid生成)│ (输出模板)   │
└──────────────┴──────────────┴──────────────┘
    ↓
文件存储层 (data/ 目录，JSON + Markdown)
```

### 核心模块

1. **CLI 入口**：`npx adue generate <problem-id>` 生成单题解析
2. **AIProvider 接口**：抽象层，MVP 实现 StaticProvider（读预生成文件）+ 预留 Kiro/OpenAI 接口
3. **内容生成器**：组合 prompt 模板，调用 AI 生成结构化解析
4. **图解引擎**：根据算法类型自动选择 Mermaid 图类型并生成
5. **文件存储**：按统一目录结构存储生成结果

### 技术选型

- 语言：TypeScript (Node.js)
- CLI 框架：commander.js
- 包管理：pnpm
- 图解：Mermaid 语法（文本生成，前端渲染）
- 存储：文件系统（JSON 元数据 + Markdown 内容）
- 构建：tsup

## Data Models

### Problem（题目元信息）

```typescript
interface Problem {
  id: string                    // 统一ID如 "001-two-sum"
  leetcodeId: number            // LeetCode 编号
  title: string                 // 中文题名
  titleEn: string               // 英文题名
  difficulty: 'easy' | 'medium' | 'hard'
  tags: string[]                // 如 ["哈希表", "数组"]
  patterns: string[]            // 如 ["hash-lookup"]
  description: string           // 题目描述
  examples: { input: string; output: string; explanation?: string }[]
  constraints: string[]
}
```

### Explanation（解析内容）

```typescript
interface Explanation {
  problemId: string
  level: 2 | 3                  // MVP 只生成 L2 和 L3
  intuition: string             // 直觉/一句话总结
  approaches: Approach[]        // 多种解法
  diagrams: string[]            // Mermaid 代码
  patterns: string[]            // 关联模式
  relatedProblems: string[]     // 关联题目ID
  applications: string[]        // 实际应用简述
  commonMistakes: string[]      // 常见错误
  references: string[]          // 权威引用
}

interface Approach {
  name: string
  idea: string
  steps: string[]               // 逐步流程
  code: { lang: string; code: string }[]
  timeComplexity: string
  spaceComplexity: string
  prosAndCons: string
}
```

### AIProvider 接口

```typescript
interface AIProvider {
  generateExplanation(problem: Problem, level: number): Promise<Explanation>
  generateDiagram(algorithm: string, type: string): Promise<string>
}
```

## File Structure

```
algorithm_help/
├── src/
│   ├── cli.ts                  # CLI 入口
│   ├── generator.ts            # 生成编排
│   ├── providers/
│   │   ├── types.ts            # AIProvider 接口
│   │   └── static-provider.ts  # 静态文件读取
│   ├── diagrams/
│   │   └── mermaid.ts          # Mermaid 生成逻辑
│   ├── templates/
│   │   └── explanation.ts      # Markdown 输出模板
│   └── types.ts                # 数据模型
├── data/
│   └── problems/               # 生成的内容
│       └── 001-two-sum/
│           ├── meta.json
│           ├── explanation-L2.md
│           └── explanation-L3.md
├── prompts/
│   ├── generate-explanation.md # AI prompt 模板
│   └── generate-diagram.md
├── package.json
├── tsconfig.json
└── README.md
```

## Scope (MVP)

### 包含
- 项目脚手架（TypeScript + pnpm + tsup）
- 数据模型定义
- AIProvider 接口 + StaticProvider 实现
- Mermaid 图解生成逻辑（按算法类型选图）
- Markdown 输出模板
- CLI 命令：`generate` 生成单题、`list` 列出已有题目
- 5 道示范题目的完整解析内容（手动精写，验证格式）
- prompt 模板（供后续接入 AI 批量生成）

### 不包含
- Web 前端
- 用户系统/数据库
- 实时 AI 交互（费曼模式等）
- 间隔重复系统
- 面试模拟
- 50 题全量内容（先做 5 题验证质量）
