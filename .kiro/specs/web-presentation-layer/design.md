# Design: Web 展示层

## Overview

本设计文档定义算法深度理解引擎 Web 展示层的技术实现方案。基于 Next.js 14+ App Router 架构，使用 TypeScript + TailwindCSS 构建响应式 UI，集成 Mermaid.js 和 react-markdown 实现内容渲染，通过 SSR/SSG/CSR 混合策略优化性能。

## Architecture

### 前端架构总览

```
┌─────────────────────────────────────────────────────────────┐
│                    Next.js App Router                         │
├──────────────────────────────────────────────────────────────┤
│  Pages (App Directory)                                       │
│  ├── / (首页)           → SSG                                │
│  ├── /problems          → SSG + CSR (搜索筛选)               │
│  ├── /problems/[id]     → ISR (增量静态再生成)                │
│  ├── /patterns          → SSG                                │
│  ├── /patterns/[id]     → ISR                                │
│  └── /graph             → CSR (纯客户端交互)                  │
├──────────────────────────────────────────────────────────────┤
│  Components Layer                                            │
│  ├── Layout: Navbar / Sidebar / Footer                       │
│  ├── Content: LevelTabs / MarkdownRenderer / MermaidRenderer │
│  ├── Code: CodeBlock / ApproachComparison                    │
│  ├── Cards: ProblemCard / PatternCard / DifficultyBadge      │
│  ├── Search: SearchFilter / SearchInput / FilterPanel        │
│  ├── Graph: KnowledgeGraph / GraphNode / GraphEdge           │
│  └── Common: ProgressBar / TOC / ThemeToggle                 │
├──────────────────────────────────────────────────────────────┤
│  Data Layer                                                  │
│  ├── API Client (fetch wrapper)                              │
│  ├── React Server Components (数据获取)                       │
│  └── Client State (localStorage + URL params)                │
├──────────────────────────────────────────────────────────────┤
│  Backend API (Spec 1 & 2)                                    │
│  ├── GET /api/problems                                       │
│  ├── GET /api/problems/:id/explanation?level=3               │
│  ├── GET /api/patterns                                       │
│  ├── GET /api/patterns/:id                                   │
│  └── GET /api/graph                                          │
└─────────────────────────────────────────────────────────────┘
```

### 目录结构

```
frontend/
├── app/                          # Next.js App Router
│   ├── layout.tsx                # 根布局（Navbar + 主题Provider）
│   ├── page.tsx                  # 首页
│   ├── problems/
│   │   ├── page.tsx              # 题目列表页
│   │   └── [id]/
│   │       └── page.tsx          # 题目详情页
│   ├── patterns/
│   │   ├── page.tsx              # 模式列表页
│   │   └── [id]/
│   │       └── page.tsx          # 模式详情页
│   └── graph/
│       └── page.tsx              # 知识图谱页
├── components/
│   ├── layout/
│   │   ├── Navbar.tsx
│   │   ├── Sidebar.tsx
│   │   ├── Footer.tsx
│   │   └── MobileNav.tsx
│   ├── content/
│   │   ├── LevelTabs.tsx
│   │   ├── MarkdownRenderer.tsx
│   │   ├── MermaidRenderer.tsx
│   │   └── TOC.tsx
│   ├── code/
│   │   ├── CodeBlock.tsx
│   │   └── ApproachComparison.tsx
│   ├── cards/
│   │   ├── ProblemCard.tsx
│   │   ├── PatternCard.tsx
│   │   └── DifficultyBadge.tsx
│   ├── search/
│   │   ├── SearchFilter.tsx
│   │   ├── SearchInput.tsx
│   │   └── FilterPanel.tsx
│   ├── graph/
│   │   └── KnowledgeGraph.tsx
│   └── common/
│       ├── ProgressBar.tsx
│       ├── ThemeToggle.tsx
│       └── EmptyState.tsx
├── lib/
│   ├── api.ts                    # API 请求封装
│   ├── types.ts                  # TypeScript 类型定义
│   └── utils.ts                  # 工具函数
├── hooks/
│   ├── useTheme.ts               # 主题管理 Hook
│   ├── useFavorites.ts           # 收藏管理 Hook
│   ├── useReadingProgress.ts     # 阅读进度 Hook
│   └── useDebounce.ts            # 防抖 Hook
├── styles/
│   └── globals.css               # TailwindCSS 入口 + 全局样式
├── tailwind.config.ts            # TailwindCSS 配置（主题色、暗色模式）
└── next.config.ts                # Next.js 配置
```


## Components and Interfaces

### 核心组件 Props 接口定义

```typescript
// ==================== 类型定义 ====================

// 难度枚举
type Difficulty = 'Easy' | 'Medium' | 'Hard';

// 题目摘要（列表用）
interface ProblemSummary {
  id: string;
  title: string;
  difficulty: Difficulty;
  tags: string[];
  companyTags: string[];
  isGenerated: boolean;
  updatedAt: number;     // UTC 毫秒时间戳
  popularity: number;
}

// 题目完整数据
interface Problem extends ProblemSummary {
  description: string;
  constraints: string[];
  examples: Example[];
}

// 解析内容
interface Explanation {
  problemId: string;
  level: 1 | 2 | 3 | 4 | 5;
  sections: Section[];
  approaches: Approach[];
  diagrams: Diagram[];
  comparison?: ComparisonResult;
}

// 内容段
interface Section {
  id: string;
  title: string;
  content: string;     // Markdown 格式
  order: number;
}

// 解法
interface Approach {
  name: string;
  idea: string;
  timeComplexity: string;
  spaceComplexity: string;
  code: Record<string, string>;  // {python: "...", java: "...", ...}
}

// 图解
interface Diagram {
  type: 'mermaid' | 'svg';
  code: string;
  caption: string;
}

// 对比结果
interface ComparisonResult {
  evolutionMermaid: string;
  matrix: ComparisonRow[];
  commonFramework: string;
  transferPath: string[];
}

// 算法模式
interface Pattern {
  id: string;
  name: string;
  description: string;
  signals: string[];
  templateCode: Record<string, string>;
  relatedProblems: ProblemSummary[];
  variants: string[];
  difficultyDistribution: Record<Difficulty, number>;
}

// 知识图谱节点
interface GraphNode {
  id: string;
  title: string;
  difficulty: Difficulty;
  pattern: string;
  x?: number;
  y?: number;
}

// 知识图谱边
interface GraphEdge {
  source: string;
  target: string;
  relation: 'prerequisite' | 'variant' | 'advanced';
}
```

### 组件 Props 接口

```typescript
// ==================== 组件 Props ====================

// LevelTabs - 级别切换
interface LevelTabsProps {
  currentLevel: number;
  onLevelChange: (level: number) => void;
  availableLevels: number[];  // 已生成的级别
  className?: string;
}

// MarkdownRenderer - Markdown 渲染
interface MarkdownRendererProps {
  content: string;
  className?: string;
}

// MermaidRenderer - Mermaid 图表渲染
interface MermaidRendererProps {
  code: string;
  caption?: string;
  className?: string;
  onExport?: (format: 'svg' | 'png') => void;
}

// CodeBlock - 多语言代码块
interface CodeBlockProps {
  code: Record<string, string>;  // {python: "...", java: "..."}
  defaultLang?: string;
  className?: string;
}

// ApproachComparison - 解法对比
interface ApproachComparisonProps {
  comparison: ComparisonResult;
  className?: string;
}

// ProblemCard - 题目卡片
interface ProblemCardProps {
  problem: ProblemSummary;
  isFavorited?: boolean;
  isRead?: boolean;
  onFavoriteToggle?: (id: string) => void;
  className?: string;
}

// PatternCard - 模式卡片
interface PatternCardProps {
  pattern: Pattern;
  className?: string;
}

// DifficultyBadge - 难度标签
interface DifficultyBadgeProps {
  difficulty: Difficulty;
  size?: 'sm' | 'md';
  className?: string;
}

// SearchFilter - 搜索筛选
interface SearchFilterProps {
  onSearch: (query: string) => void;
  onFilterChange: (filters: FilterState) => void;
  onSortChange: (sort: SortOption) => void;
  initialFilters?: FilterState;
  className?: string;
}

interface FilterState {
  difficulty: Difficulty[];
  tags: string[];
  companyTags: string[];
  status: ('generated' | 'pending')[];
}

type SortOption = 'popularity' | 'difficulty' | 'updatedAt';

// ProgressBar - 进度条
interface ProgressBarProps {
  progress: number;        // 0-100
  status?: string;         // 当前步骤描述
  className?: string;
}

// KnowledgeGraph - 知识图谱
interface KnowledgeGraphProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  selectedPattern?: string;  // 按模式筛选
  onNodeClick?: (nodeId: string) => void;
  className?: string;
}

// TOC - 目录导航
interface TOCProps {
  sections: { id: string; title: string; level: number }[];
  activeId?: string;
  className?: string;
}

// ThemeToggle - 主题切换
interface ThemeToggleProps {
  className?: string;
}

// PatternQuiz - 模式识别训练
interface PatternQuizProps {
  question: QuizQuestion;
  onSubmit: (answer: string[]) => void;
  mode: 'single' | 'multi';        // 单选或多选
  timedMode?: boolean;              // 是否限时（30秒）
  className?: string;
}

interface QuizQuestion {
  id: string;
  description: string;              // 题目描述（隐藏标签）
  options: string[];                // 可选模式列表
  correctAnswer: string[];          // 正确答案（可能多个）
  explanation: string;              // 答案解释
  signals: string[];                // 识别信号列表
}

interface PatternQuizStatsProps {
  overallAccuracy: number;          // 总正确率 0-100
  patternAccuracies: { pattern: string; accuracy: number }[];
  weakPatterns: string[];           // 薄弱模式列表
  className?: string;
}

// GenerationProgress - 内容生成进度
interface GenerationProgressProps {
  taskId: string;
  steps: GenerationStep[];
  currentStep: number;              // 当前步骤索引
  status: 'generating' | 'completed' | 'failed';
  errorMessage?: string;
  onRetry?: () => void;
  onViewOtherLevels?: () => void;
  className?: string;
}

interface GenerationStep {
  label: string;                    // 步骤名（如"分析题目"）
  progress: number;                 // 0-100
}

// GenerationTrigger - 触发生成空状态
interface GenerationTriggerProps {
  problemId: string;
  level: number;
  isAuthenticated: boolean;
  onTrigger: () => void;
  className?: string;
}

// NetworkBanner - 网络断开横幅
interface NetworkBannerProps {
  isDisconnected: boolean;
  isReconnecting: boolean;
  className?: string;
}

// ErrorPage - 统一错误页面
interface ErrorPageProps {
  statusCode: number;               // 500/429/503
  title: string;
  description: string;
  retryAction?: () => void;
  fallbackAction?: { label: string; href: string };
  className?: string;
}

// WebSocketReconnectBanner - WS 重连提示
interface WebSocketReconnectBannerProps {
  isDisconnected: boolean;
  retryCountdown: number;           // 下次重连倒计时秒数
  onManualReconnect: () => void;
  className?: string;
}
```


## Data Models

### 前端数据模型（TypeScript 接口）

详见上方"Components and Interfaces"章节的完整类型定义。核心模型包括：

| 模型 | 用途 | 关键字段 |
|------|------|----------|
| ProblemSummary | 题目列表展示 | id, title, difficulty, tags, isGenerated |
| Problem | 题目完整数据 | extends ProblemSummary + description, constraints, examples |
| Explanation | 题目解析内容 | problemId, level, sections[], approaches[], diagrams[] |
| Approach | 单个解法 | name, idea, timeComplexity, code(多语言) |
| ComparisonResult | 解法对比数据 | evolutionMermaid, matrix[], commonFramework |
| Pattern | 算法模式 | id, name, signals[], templateCode, relatedProblems[] |
| GraphNode / GraphEdge | 知识图谱 | id, title, difficulty, pattern / source, target, relation |
| FilterState | 搜索筛选状态 | difficulty[], tags[], companyTags[], status[] |

### 客户端持久化数据（localStorage）

```typescript
// 存储键: 'theme'
type ThemeStorage = 'light' | 'dark';

// 存储键: 'favorites'
type FavoritesStorage = string[];  // problemId 列表

// 存储键: 'reading-progress'
interface ReadingProgressStorage {
  [problemId: string]: {
    levels: number[];       // 已浏览的级别
    lastVisit: number;      // 最后访问时间戳（UTC 毫秒）
  };
}
```

## Component Design

### 1. LevelTabs 组件

```typescript
'use client';

const LEVEL_INFO = [
  { level: 1, name: '直觉', desc: '纯类比，零代码', icon: '💡' },
  { level: 2, name: '入门', desc: '例子+图解+代码', icon: '📖' },
  { level: 3, name: '进阶', desc: '模式+框架+对比', icon: '🎯' },
  { level: 4, name: '熟练', desc: '证明+优化+面试', icon: '⚡' },
  { level: 5, name: '专家', desc: '论文+数学+前沿', icon: '🔬' },
];

const LevelTabs: React.FC<LevelTabsProps> = ({
  currentLevel,
  onLevelChange,
  availableLevels,
  className,
}) => {
  return (
    <div className={cn('flex gap-1 border-b border-gray-200 dark:border-gray-700', className)}>
      {LEVEL_INFO.map(({ level, name, desc, icon }) => (
        <button
          key={level}
          onClick={() => onLevelChange(level)}
          disabled={!availableLevels.includes(level)}
          className={cn(
            'px-4 py-2 rounded-t-lg transition-colors',
            currentLevel === level
              ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
              : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
          )}
          title={desc}
        >
          <span className="mr-1">{icon}</span>
          <span className="hidden sm:inline">L{level}</span>
          <span className="hidden md:inline ml-1">{name}</span>
        </button>
      ))}
    </div>
  );
};
```

**状态管理**：
- `currentLevel` 由父组件管理（通过 URL searchParams 持久化）
- 切换级别时触发数据获取（如果该级别内容未缓存）

### 2. MermaidRenderer 组件

```typescript
'use client';

import dynamic from 'next/dynamic';
import { useEffect, useRef, useState, useCallback } from 'react';

// Mermaid 懒加载（不在服务端渲染）
const MermaidRenderer: React.FC<MermaidRendererProps> = ({ code, caption, className, onExport }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [svg, setSvg] = useState<string>('');
  const [scale, setScale] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // SVG 缓存：相同 code 不重复渲染
  const cacheRef = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    const renderMermaid = async () => {
      if (cacheRef.current.has(code)) {
        setSvg(cacheRef.current.get(code)!);
        return;
      }
      const mermaid = (await import('mermaid')).default;
      mermaid.initialize({
        startOnLoad: false,
        theme: document.documentElement.classList.contains('dark') ? 'dark' : 'default',
      });
      const { svg: rendered } = await mermaid.render(`mermaid-${Date.now()}`, code);
      cacheRef.current.set(code, rendered);
      setSvg(rendered);
    };
    renderMermaid();
  }, [code]);

  const handleExport = useCallback(async (format: 'svg' | 'png') => {
    // SVG 导出：直接下载
    // PNG 导出：Canvas 转换后下载
    onExport?.(format);
  }, [onExport]);

  return (
    <div className={cn('relative border rounded-lg p-4 dark:border-gray-700', className)}>
      {/* 工具栏 */}
      <div className="absolute top-2 right-2 flex gap-1">
        <button onClick={() => setScale(s => Math.min(s + 0.2, 3))} title="放大">🔍+</button>
        <button onClick={() => setScale(s => Math.max(s - 0.2, 0.5))} title="缩小">🔍-</button>
        <button onClick={() => setIsFullscreen(true)} title="全屏">⛶</button>
        <button onClick={() => handleExport('png')} title="导出PNG">📥</button>
      </div>
      {/* 图表内容 */}
      <div
        ref={containerRef}
        style={{ transform: `scale(${scale})`, transformOrigin: 'top left' }}
        dangerouslySetInnerHTML={{ __html: svg }}
      />
      {caption && <p className="text-sm text-gray-500 mt-2 text-center">{caption}</p>}
      {/* 全屏模态框 */}
      {isFullscreen && <FullscreenModal svg={svg} onClose={() => setIsFullscreen(false)} />}
    </div>
  );
};
```

**关键设计决策**：
- Mermaid 使用动态导入（`next/dynamic` 或运行时 `import()`），不影响 SSR
- SVG 结果缓存到组件内 Map，相同代码不重复渲染
- 主题变化时重新初始化 Mermaid 配色

### 3. MarkdownRenderer 组件

```typescript
import ReactMarkdown from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';
import rehypeKatex from 'rehype-katex';
import remarkMath from 'remark-math';
import remarkGfm from 'remark-gfm';

// 级别样式映射：不同级别使用不同的排版风格
const LEVEL_STYLE_CLASSES: Record<number, string> = {
  1: 'prose-xl leading-relaxed space-y-6',        // L1: 大字体+宽松间距+故事卡片风格
  2: 'prose-lg leading-relaxed',                   // L2: 较大字体+步骤卡片布局
  3: 'prose leading-normal',                       // L3: 默认大小+代码突出
  4: 'prose leading-snug',                         // L4: 默认+公式证明突出
  5: 'prose-sm leading-tight tracking-tight',      // L5: 小字体+紧凑行距+学术排版
};

interface MarkdownRendererProps {
  content: string;
  level?: 1 | 2 | 3 | 4 | 5;  // 当前显示级别，用于应用差异化样式
  className?: string;
}

const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content, level = 3, className }) => {
  const levelClass = LEVEL_STYLE_CLASSES[level] || LEVEL_STYLE_CLASSES[3];

  return (
    <ReactMarkdown
      className={cn('dark:prose-invert max-w-none', levelClass, className)}
      remarkPlugins={[remarkMath, remarkGfm]}
      rehypePlugins={[rehypeHighlight, rehypeKatex]}
      components={{
        // 自定义 code 渲染：检测 mermaid 语言标记
        code({ node, className, children, ...props }) {
          const match = /language-mermaid/.exec(className || '');
          if (match) {
            return <MermaidRenderer code={String(children).trim()} />;
          }
          // 普通代码块使用 CodeBlock 包装
          const langMatch = /language-(\w+)/.exec(className || '');
          return (
            <div className="relative group">
              <CopyButton code={String(children)} />
              <code className={className} {...props}>{children}</code>
            </div>
          );
        },
        // 自定义表格样式
        table({ children }) {
          return (
            <div className="overflow-x-auto">
              <table className="min-w-full">{children}</table>
            </div>
          );
        },
      }}
    />
  );
};
```

### 3a. AlgorithmStoryCard 组件（详情页嵌入）

```typescript
// 在题目详情页右侧 TOC 下方展示的"算法故事"精简版入口卡片
interface AlgorithmStoryCardProps {
  storyId: string;
  algorithmName: string;
  shortSummary: string;      // 100 字以内精简摘要
  inventorName?: string;
  year?: number;
  className?: string;
}

const AlgorithmStoryCard: React.FC<AlgorithmStoryCardProps> = ({
  storyId, algorithmName, shortSummary, inventorName, year, className,
}) => {
  return (
    <Link href={`/archaeology/${storyId}`}>
      <div className={cn(
        'p-4 rounded-lg border border-amber-200 bg-amber-50/50',
        'dark:border-amber-800 dark:bg-amber-900/20',
        'hover:shadow-md transition-shadow cursor-pointer',
        className
      )}>
        <div className="flex items-center gap-2 mb-2">
          <span className="text-lg">📖</span>
          <span className="text-sm font-medium text-amber-700 dark:text-amber-300">
            算法故事
          </span>
        </div>
        <p className="text-sm text-gray-700 dark:text-gray-300 line-clamp-3">
          {shortSummary}
        </p>
        {inventorName && year && (
          <p className="text-xs text-gray-500 mt-2">
            — {inventorName}, {year}
          </p>
        )}
        <span className="text-xs text-amber-600 dark:text-amber-400 mt-2 inline-block">
          阅读完整故事 →
        </span>
      </div>
    </Link>
  );
};
```

### 3b. MathFoundationCard 组件（L4+ 级别底部嵌入）

```typescript
// 在 L4+ 级别内容底部自动展示的"数学基础"关联卡片
interface MathFoundationCardProps {
  mathTopicName: string;       // 如"递推关系"
  patternName: string;         // 如"动态规划"
  oneSentence: string;         // 一句话说明
  mathRelationId: string;      // 数学关联详情页 ID
  className?: string;
}

const MathFoundationCard: React.FC<MathFoundationCardProps> = ({
  mathTopicName, patternName, oneSentence, mathRelationId, className,
}) => {
  return (
    <Link href={`/patterns/${mathRelationId}#math`}>
      <div className={cn(
        'p-4 rounded-lg border border-blue-200 bg-blue-50/50',
        'dark:border-blue-800 dark:bg-blue-900/20',
        'hover:shadow-md transition-shadow cursor-pointer mt-8',
        className
      )}>
        <div className="flex items-center gap-2 mb-2">
          <span className="text-lg">📐</span>
          <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
            数学基础 · {mathTopicName}
          </span>
        </div>
        <p className="text-sm text-gray-700 dark:text-gray-300">
          {oneSentence}
        </p>
        <span className="text-xs text-blue-600 dark:text-blue-400 mt-2 inline-block">
          深入了解 {patternName} 背后的数学 →
        </span>
      </div>
    </Link>
  );
};
```

### 4. CodeBlock 组件

```typescript
'use client';

const CodeBlock: React.FC<CodeBlockProps> = ({ code, defaultLang = 'python', className }) => {
  const [activeLang, setActiveLang] = useState(defaultLang);
  const [copied, setCopied] = useState(false);

  const languages = Object.keys(code);
  const LANG_LABELS: Record<string, string> = {
    python: 'Python', java: 'Java', go: 'Go', cpp: 'C++',
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code[activeLang]);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={cn('rounded-lg border dark:border-gray-700 overflow-hidden', className)}>
      {/* 语言 Tab */}
      <div className="flex items-center justify-between bg-gray-100 dark:bg-gray-800 px-4 py-2">
        <div className="flex gap-2">
          {languages.map(lang => (
            <button
              key={lang}
              onClick={() => setActiveLang(lang)}
              className={cn(
                'px-3 py-1 rounded text-sm',
                activeLang === lang
                  ? 'bg-white dark:bg-gray-700 shadow-sm font-medium'
                  : 'text-gray-500 hover:text-gray-700'
              )}
            >
              {LANG_LABELS[lang] || lang}
            </button>
          ))}
        </div>
        {/* 复制按钮 */}
        <button onClick={handleCopy} className="text-sm text-gray-500 hover:text-gray-700">
          {copied ? '✓ 已复制' : '📋 复制'}
        </button>
      </div>
      {/* 代码内容 */}
      <pre className="p-4 overflow-x-auto">
        <code className={`language-${activeLang}`}>{code[activeLang]}</code>
      </pre>
    </div>
  );
};
```


### 5. SearchFilter 组件

```typescript
'use client';

import { useSearchParams, useRouter } from 'next/navigation';

const SearchFilter: React.FC<SearchFilterProps> = ({
  onSearch, onFilterChange, onSortChange, initialFilters, className,
}) => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(searchParams.get('q') || '');
  const debouncedQuery = useDebounce(query, 300);

  // URL 参数同步
  useEffect(() => {
    const params = new URLSearchParams(searchParams);
    if (debouncedQuery) params.set('q', debouncedQuery);
    else params.delete('q');
    router.push(`?${params.toString()}`, { scroll: false });
    onSearch(debouncedQuery);
  }, [debouncedQuery]);

  return (
    <div className={cn('space-y-4', className)}>
      <SearchInput value={query} onChange={setQuery} />
      <FilterPanel
        filters={initialFilters}
        onChange={(filters) => {
          syncFiltersToUrl(filters);
          onFilterChange(filters);
        }}
      />
      <SortSelector onChange={onSortChange} />
    </div>
  );
};
```

### 6. KnowledgeGraph 组件

```typescript
'use client';

// 使用 D3.js force-directed layout 或 react-force-graph
import dynamic from 'next/dynamic';

const ForceGraph2D = dynamic(() => import('react-force-graph-2d'), { ssr: false });

const KnowledgeGraph: React.FC<KnowledgeGraphProps> = ({
  nodes, edges, selectedPattern, onNodeClick, className,
}) => {
  const filteredData = useMemo(() => {
    if (!selectedPattern) return { nodes, links: edges };
    const filteredNodes = nodes.filter(n => n.pattern === selectedPattern);
    const nodeIds = new Set(filteredNodes.map(n => n.id));
    const filteredEdges = edges.filter(e => nodeIds.has(e.source) && nodeIds.has(e.target));
    return { nodes: filteredNodes, links: filteredEdges };
  }, [nodes, edges, selectedPattern]);

  return (
    <div className={cn('w-full h-[600px] border rounded-lg', className)}>
      <ForceGraph2D
        graphData={filteredData}
        nodeLabel="title"
        nodeColor={(node) => DIFFICULTY_COLORS[node.difficulty]}
        onNodeClick={(node) => onNodeClick?.(node.id)}
        linkDirectionalArrowLength={6}
        linkColor={() => 'rgba(156, 163, 175, 0.5)'}
      />
    </div>
  );
};
```

## Data Flow

### 数据获取策略

| 页面 | 渲染策略 | 数据获取方式 | 缓存策略 |
|------|----------|-------------|----------|
| 首页 `/` | SSG | 构建时获取静态数据 | 重新部署时更新 |
| 题目列表 `/problems` | SSG + CSR | 初始列表 SSG，搜索筛选 CSR | URL params 驱动 |
| 题目详情 `/problems/[id]` | ISR (revalidate=3600) | Server Component fetch | 1小时增量再生成 |
| 模式列表 `/patterns` | SSG | 构建时获取 | 重新部署时更新 |
| 模式详情 `/patterns/[id]` | ISR (revalidate=3600) | Server Component fetch | 1小时增量再生成 |
| 知识图谱 `/graph` | CSR | 客户端 fetch | React Query 缓存 |

### 题目详情页数据流

```
用户访问 /problems/1
  ↓
Next.js Server Component
  ↓ fetch('/api/problems/1')
获取 Problem 基本信息
  ↓ fetch('/api/problems/1/explanation?level=3')  // 默认 L3
获取 L3 解析内容
  ↓
渲染页面骨架 + L3 内容
  ↓ (客户端水合)
用户切换 Tab 到 L2
  ↓ Client Component fetch
fetch('/api/problems/1/explanation?level=2')
  ↓
更新内容区域（带 loading skeleton）
```

### 搜索筛选数据流

```
用户输入搜索词 "两数"
  ↓ (300ms 防抖)
SearchFilter → 更新 URL params: ?q=两数
  ↓
useEffect 触发 → fetch('/api/problems?q=两数&difficulty=Medium&page=1')
  ↓
更新题目列表 + 结果计数
  ↓
用户点击难度筛选 "Hard"
  ↓
URL 更新: ?q=两数&difficulty=Medium,Hard&page=1
  ↓
重新 fetch → 更新列表
```

## Styling System

### TailwindCSS 配置

```typescript
// tailwind.config.ts
import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  darkMode: 'class',  // 使用 class 策略控制暗色模式
  theme: {
    extend: {
      colors: {
        // 品牌色
        brand: {
          50: '#eff6ff',
          500: '#3b82f6',
          700: '#1d4ed8',
        },
        // 难度颜色
        difficulty: {
          easy: '#22c55e',
          medium: '#f59e0b',
          hard: '#ef4444',
        },
      },
      typography: {
        DEFAULT: {
          css: {
            maxWidth: 'none',
            code: { backgroundColor: '#f3f4f6', padding: '2px 4px', borderRadius: '4px' },
          },
        },
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),  // prose 类
  ],
};

export default config;
```

### 主题切换实现

```typescript
// hooks/useTheme.ts
'use client';

export function useTheme() {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window === 'undefined') return 'light';
    return (localStorage.getItem('theme') as 'light' | 'dark') || 'light';
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggle = () => setTheme(prev => prev === 'light' ? 'dark' : 'light');

  return { theme, toggle };
}
```

## Performance Optimization

### 1. 代码分割策略

| 组件/模块 | 加载方式 | 原因 |
|-----------|----------|------|
| MermaidRenderer | `next/dynamic` (ssr: false) | Mermaid.js 体积大（~500KB），且需 DOM |
| KnowledgeGraph | `next/dynamic` (ssr: false) | D3/force-graph 纯客户端交互 |
| rehype-highlight | 静态导入 | Markdown 渲染核心依赖 |
| rehype-katex | 静态导入 | 数学公式渲染必需 |
| CodeBlock | 静态导入 | 高频使用，无需懒加载 |

### 2. 缓存策略

```typescript
// Mermaid SVG 缓存（组件级）
const mermaidCache = new Map<string, string>();

// API 数据缓存（Next.js fetch）
// 题目详情页：ISR with revalidate
export async function generateStaticParams() {
  const problems = await fetch(`${API_BASE}/problems`).then(r => r.json());
  return problems.map((p: Problem) => ({ id: p.id }));
}

export const revalidate = 3600; // 1小时增量再生成
```

### 3. 资源优化

- **图片**：使用 `next/image` 组件，自动 WebP 转换 + 懒加载
- **字体**：使用 `next/font` 本地字体，避免 CLS
- **Bundle**：每页 JS < 200KB（gzipped），通过 `@next/bundle-analyzer` 监控
- **预加载**：题目列表 hover 时预加载详情页数据

## Error Handling

| 错误场景 | 处理方式 | 用户体验 |
|----------|----------|----------|
| API 请求失败 | 展示 ErrorBoundary 错误提示 + 重试按钮 | 友好错误页面 |
| Mermaid 渲染失败 | 显示原始 Mermaid 代码 + 错误提示 | 降级展示 |
| 级别内容未生成 | Tab 置灰 + 提示"内容生成中" | 明确状态 |
| 图谱数据加载失败 | 展示 Loading Skeleton → 错误提示 | 渐进加载 |
| 搜索无结果 | 展示空状态 + 推荐题目 | 引导用户 |
| 复制失败（浏览器限制） | Toast 提示"请手动复制" | 降级方案 |


## Testing Strategy

### 单元测试（Jest + React Testing Library）
- **DifficultyBadge**：不同难度值渲染正确颜色 class
- **LevelTabs**：点击触发 onLevelChange、禁用级别不可点击
- **CodeBlock**：语言 Tab 切换、复制按钮功能、默认语言选择
- **SearchFilter**：防抖生效（300ms 内不触发）、URL 参数同步
- **MarkdownRenderer**：正确渲染标题/代码块/KaTeX 公式/表格
- **useTheme Hook**：localStorage 读写、dark class 切换
- **useFavorites Hook**：添加/移除收藏、持久化

### 集成测试
- **题目列表页**：搜索→筛选→分页→URL 同步→浏览器前进后退
- **题目详情页**：级别切换→内容渲染→Mermaid 图表→代码复制
- **主题切换**：切换后所有组件（含 Mermaid、代码高亮）配色正确

### Mock 策略
- API 请求使用 MSW (Mock Service Worker) 拦截
- Mermaid 渲染在测试环境使用 mock（返回固定 SVG 字符串）
- localStorage 使用 jest-localstorage-mock

### 性能测试
- 使用 Lighthouse CI 自动化检测：LCP < 1s、FID < 100ms、CLS < 0.1
- 使用 `@next/bundle-analyzer` 监控每页 Bundle 大小 < 200KB

## Correctness Properties

### Property 1: 路由完整性
所有定义的路由（/, /problems, /problems/[id], /patterns, /patterns/[id], /graph）均可正确解析并渲染对应页面，无 404 错误。

**Validates: Requirements 1.1**

### Property 2: 级别切换数据一致性
当用户切换 LevelTabs 时，展示的内容严格对应所选级别的 Explanation 数据，不会出现级别与内容不匹配的情况。

**Validates: Requirements 3.1, 3.2**

### Property 3: 筛选 URL 同步
搜索筛选状态与 URL 查询参数双向同步：修改筛选→URL 更新；直接访问含参数 URL→筛选状态正确恢复。

**Validates: Requirements 2.5**

### Property 4: 主题持久性
用户选择的主题偏好在页面刷新后保持不变，且所有组件（包括 Mermaid 图表和代码高亮）正确适配当前主题。

**Validates: Requirements 5.3, 5.4, 5.5, 5.6**

### Property 5: 响应式布局断点正确性
在三个断点（<768px, 768-1024px, >1024px）下，侧边栏、代码块、卡片网格布局均按规范适配，无内容溢出或不可访问区域。

**Validates: Requirements 5.1, 5.2**

### Property 6: 组件 Props 类型安全
所有组件严格遵循 TypeScript Props 接口定义，缺少必需 Props 时编译报错，可选 Props 有合理默认值。

**Validates: Requirements 8.2, 8.4**

## 补充页面路由（2026-06-21 UI Review 后新增）

以下路由在 tasks.md 中已有实现计划，此处补充到 design 文档正式记录：

| 路由 | 渲染策略 | 描述 |
|------|----------|------|
| `/training` | CSR | 模式识别训练页（PatternQuiz 组件） |
| `/training/complexity` | CSR | 复杂度直觉训练页（看范围猜算法 + 看代码估复杂度） |
| `/feynman` | CSR | 费曼学习模式（WebSocket 实时对话） |
| `/interview` | CSR | 面试模拟（WebSocket + 计时器） |
| `/review` | CSR | 复习中心（翻卡片 + 自评） |
| `/auth/login` | SSG | 登录页 |
| `/auth/register` | SSG | 注册页 |
| `/settings` | CSR | 用户设置页 |
| `/admin/review` | CSR | 管理员审核页（仅 ADMIN） |
| `/daily-plan` | CSR | 今日学习计划（含历史日期查看 + 完成率统计） |
| `/learning-path` | SSG + CSR | 学习路径列表页（DP入门/图论基础等路径卡片） |
| `/learning-path/[id]` | CSR | 学习路径详情（进度条+里程碑节点+当前位置高亮） |
| `/archaeology` | SSG | 算法考古列表（经典算法发明故事时间线） |
| `/archaeology/[id]` | ISR | 算法故事详情（叙事体+时间线图+关联模式入口） |
| `/paper-bridge` | SSG | 论文桥梁列表（按领域分组：CV/NLP/推荐/机器人等） |
| `/paper-bridge/[id]` | ISR | 论文桥梁详情（桥梁步骤+分级解读L3/L4/L5+动手实验链接） |
| `/problems/[id]/history` | CSR | 解析版本历史页（版本列表+回滚操作，管理员可见） |
| `/admin/problems` | CSR | 题目 CRUD 管理（手动创建/编辑/删除/批量导入） |
| `/admin/crawler` | CSR | 数据采集管理（平台状态+触发采集+任务列表） |
| `/admin/mapping` | CSR | 跨平台映射管理（确认/驳回/手动创建映射） |
| `/admin/monitor` | CSR | 系统健康监控（AI成功率/缓存/队列/服务状态） |
| `/admin/users` | CSR | 用户管理（列表/角色修改/封禁） |

### 补充组件接口（2026-06-21 新增）

```typescript
// GlobalSearch - 全局搜索面板
interface GlobalSearchProps {
  isOpen: boolean;
  onClose: () => void;
  className?: string;
}

// NotificationBell - 通知铃铛
interface NotificationBellProps {
  unreadCount: number;
  onClick: () => void;
  className?: string;
}

// NotificationPanel - 通知面板
interface NotificationPanelProps {
  notifications: Notification[];
  onMarkAllRead: () => void;
  onNotificationClick: (id: string) => void;
  className?: string;
}

interface Notification {
  id: string;
  type: 'generation_complete' | 'review_reminder' | 'comment_reply' | 'system_announcement';
  title: string;
  description: string;
  isRead: boolean;
  createdAt: number;  // UTC 毫秒
  actionUrl?: string;
}

// SolutionCard - 用户题解卡片
interface SolutionCardProps {
  solution: UserSolution;
  onLike: (id: string) => void;
  className?: string;
}

interface UserSolution {
  id: string;
  author: { name: string; avatar?: string };
  title: string;
  summary: string;
  source: 'original' | 'url_import' | 'feynman_output';
  isFeatured: boolean;
  likes: number;
  commentCount: number;
  tags: string[];
  createdAt: number;
  sourceUrl?: string;
}

// CommentInput - 评论输入
interface CommentInputProps {
  problemId: string;
  parentId?: string;  // 回复时传入父评论 ID
  onSubmit: (comment: NewComment) => void;
  className?: string;
}

interface NewComment {
  content: string;
  type: 'normal' | 'bug_report' | 'supplement' | 'question';
}

// CrossDomainTable - 跨域映射表
interface CrossDomainTableProps {
  patternId: string;
  mappings: CrossDomainMapping[];
  className?: string;
}

interface CrossDomainMapping {
  id: string;
  leetcodeScene: string;
  workScene: string;
  aiMlScene: string;
  dailyLifeScene: string;
  expandedDetail?: string;
  codeExample?: string;
}
```

### 已登录用户首页 Dashboard 布局

已登录用户访问 `/` 时，首页从 Hero 模式切换为 Dashboard 模式：

```
┌──────────────────────────────────────────────────────┐
│  Navbar (搜索 + 通知铃铛 + 头像)                      │
├──────────────────────────────────────────────────────┤
│  ┌────────────┐ ┌────────────┐ ┌────────────┐       │
│  │ 📅 今日计划 │ │ 🔄 待复习5  │ │ 🔥 连续7天  │       │
│  └────────────┘ └────────────┘ └────────────┘       │
├──────────────────────────────────────────────────────┤
│  ┌─── 继续学习 ──────────────────────────────────┐  │
│  │ 上次学到：#42 接雨水 · L3 · 阅读到"解法对比"   │  │
│  │ [继续阅读]                                     │  │
│  └────────────────────────────────────────────────┘  │
├──────────────────────────────────────────────────────┤
│  推荐题目（基于薄弱模式）                             │
│  [ProblemCard] [ProblemCard] [ProblemCard]            │
└──────────────────────────────────────────────────────┘
```

## Scope

### 包含
- 6 个页面的完整实现（首页、题目列表、题目详情、模式列表、模式详情、知识图谱）
- 所有核心交互组件（LevelTabs、MermaidRenderer、MarkdownRenderer、CodeBlock、SearchFilter 等）
- 响应式布局（移动端/平板/桌面端）
- 暗色主题支持
- 搜索筛选功能（客户端）
- 性能优化（SSR/SSG/ISR/动态导入）
- localStorage 客户端状态（收藏、阅读进度、主题偏好）

### 不包含
- 用户认证/注册系统（后续 Spec）
- 后端 API 开发（Spec 1 & 2 已覆盖）
- 实际内容数据（Spec 2 生成）
- 面试模拟、间隔重复等高级交互功能
- SEO 优化细节（meta tags、structured data）
- E2E 测试（后续单独处理）
- 国际化/多语言支持

