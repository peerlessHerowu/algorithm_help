'use client';

/**
 * Markdown 渲染组件
 * 支持代码语法高亮、数学公式、XSS 防护
 * 支持多语言代码块自动合并为 Tab 切换
 * 支持根据级别（L1-L5）应用差异化视觉样式
 * 性能优化：LaTeX/Mermaid 懒渲染 + 图片 native lazy loading
 */

import { useMemo } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeHighlight from 'rehype-highlight';
import rehypeKatex from 'rehype-katex';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import CodeBlock from '@/components/CodeBlock';
import LazyRender from '@/components/LazyRender';

// KaTeX 样式
import 'katex/dist/katex.min.css';
// 代码高亮样式（GitHub 风格）
import 'highlight.js/styles/github.css';

/**
 * 级别视觉样式映射
 * L1: 大字体 + 宽松间距 + 故事卡片风格（面向零基础，强调可读性）
 * L2: 较大字体 + 舒适间距（面向入门者，步骤卡片布局）
 * L3: 默认排版 + 代码突出（面向进阶学习者，平衡文字与代码）
 * L4: 默认排版 + 公式/证明突出（面向熟练者，数学推导密集）
 * L5: 小字体 + 紧凑行距 + 学术排版（面向专家，信息密度高）
 */
export const LEVEL_STYLE_CLASSES: Record<number, string> = {
  1: 'prose-lg leading-relaxed space-y-6',
  2: 'leading-relaxed space-y-4',
  3: 'leading-normal space-y-3',
  4: 'leading-snug [&_.katex]:text-blue-700 [&_.katex]:dark:text-blue-300',
  5: 'prose-sm leading-tight tracking-tight space-y-2',
};

interface MarkdownRendererProps {
  /** Markdown 文本内容 */
  content: string;
  /** 当前显示级别（1-5），用于应用差异化样式 */
  level?: 1 | 2 | 3 | 4 | 5;
  /** 自定义样式类名 */
  className?: string;
}

/**
 * 自定义 sanitize schema
 * 在默认安全规则基础上，允许 KaTeX 需要的 class 属性和 span 标签
 * 禁止 script/iframe/object/embed 等危险标签
 */
const sanitizeSchema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    // 允许代码块的 class 属性（用于语法高亮）
    code: [...(defaultSchema.attributes?.code || []), 'className'],
    span: [...(defaultSchema.attributes?.span || []), 'className', 'style'],
    // 允许 KaTeX 渲染结果的 class
    div: [...(defaultSchema.attributes?.div || []), 'className'],
  },
  // 禁止危险标签
  tagNames: (defaultSchema.tagNames || []).filter(
    (tag) => !['script', 'iframe', 'object', 'embed'].includes(tag)
  ),
};

/**
 * 自定义 ReactMarkdown 组件映射
 * - img: 添加 native lazy loading
 * - 数学公式（通过 KaTeX class 识别）通过 LazyRender 包装延迟渲染
 */
const markdownComponents: Components = {
  // 图片：添加 loading="lazy" 实现原生懒加载
  img: ({ src, alt, ...props }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt || ''} loading="lazy" {...props} />
  ),
};

export default function MarkdownRenderer({ content, level, className }: MarkdownRendererProps) {
  // 空内容优雅处理
  if (!content || content.trim().length === 0) {
    return (
      <div className={`text-gray-400 dark:text-gray-500 text-sm ${className || ''}`}>
        暂无内容
      </div>
    );
  }

  // 将 Markdown 拆分为文本段和多语言代码块组
  const segments = useMemo(() => simpleSplit(content), [content]);

  // 根据级别获取对应样式类，默认使用 L3 样式
  const levelClass = LEVEL_STYLE_CLASSES[level ?? 3] || LEVEL_STYLE_CLASSES[3];

  return (
    <div
      className={[
        'markdown-body prose prose-gray dark:prose-invert max-w-none',
        'prose-headings:text-lg prose-h1:text-xl prose-h2:text-lg',
        'transition-all duration-300 ease-in-out',
        levelClass,
        className || '',
      ].join(' ')}
    >
      {segments.map((seg, idx) =>
        seg.type === 'code' ? (
          <LazyRender key={idx} minHeight="6rem">
            <CodeBlock code={seg.languages} className="my-4" />
          </LazyRender>
        ) : seg.type === 'mermaid' ? (
          <LazyRender key={idx} minHeight="8rem">
            <MermaidBlock code={seg.code} />
          </LazyRender>
        ) : (
          <LazyRender key={idx} minHeight="2rem">
            <ReactMarkdown
              key={idx}
              remarkPlugins={[remarkMath]}
              rehypePlugins={[
                rehypeHighlight,
                rehypeKatex,
                [rehypeSanitize, sanitizeSchema],
              ]}
              components={markdownComponents}
            >
              {seg.text}
            </ReactMarkdown>
          </LazyRender>
        )
      )}
    </div>
  );
}

/** Mermaid 代码块懒渲染包装 */
function MermaidBlock({ code }: { code: string }) {
  // 动态导入 MermaidRenderer 避免 SSR 问题
  const MermaidRenderer = require('@/components/MermaidRenderer').default;
  return <MermaidRenderer code={code} className="my-4" />;
}

// ============ 工具函数：拆分 Markdown 为文本和代码块组 ============

interface TextSegment { type: 'text'; text: string; }
interface CodeSegment { type: 'code'; languages: Record<string, string>; }
interface MermaidSegment { type: 'mermaid'; code: string; }
type Segment = TextSegment | CodeSegment | MermaidSegment;

/** 已知编程语言标识 */
const KNOWN_LANGS = new Set(['python', 'java', 'cpp', 'c++', 'go', 'javascript', 'typescript', 'c', 'rust', 'swift', 'kotlin']);

/**
 * 简化版拆分：扫描 Markdown 找到连续的多语言代码块和 Mermaid 图表，分别合并
 * 支持两种格式：
 * 1. 标准: ```python\ncode\n```
 * 2. 无反引号: python\ncode（紧跟在 "### Python 实现" 标题后）
 * 3. Mermaid: ```mermaid\ncode\n```（单独提取为 MermaidSegment）
 */
function simpleSplit(markdown: string): Segment[] {
  // 匹配标准代码块 ```lang\n...\n```
  const standardRegex = /```(\w+)\n([\s\S]*?)```/g;
  const blocks: { lang: string; code: string; start: number; end: number }[] = [];
  const mermaidBlocks: { code: string; start: number; end: number }[] = [];

  let m;
  while ((m = standardRegex.exec(markdown)) !== null) {
    const lang = (m[1] || 'text').toLowerCase();
    if (lang === 'mermaid') {
      mermaidBlocks.push({ code: m[2].trim(), start: m.index, end: m.index + m[0].length });
    } else {
      blocks.push({ lang, code: m[2].trim(), start: m.index, end: m.index + m[0].length });
    }
  }

  // 如果没有标准代码块，尝试识别无反引号格式
  if (blocks.length === 0 && mermaidBlocks.length === 0) {
    const looseRegex = /###\s*(Python|Java|Go|C\+\+|JavaScript|TypeScript)\s*(?:实现|Implementation|代码)?\s*\n\n(\w+)\n([\s\S]*?)(?=\n###|\n## |\n\n\n|$)/gi;
    while ((m = looseRegex.exec(markdown)) !== null) {
      let lang = m[2].toLowerCase();
      if (lang === 'c++') lang = 'cpp';
      blocks.push({ lang, code: m[3].trim(), start: m.index, end: m.index + m[0].length });
    }
  }

  // 找连续的编程语言代码块组
  const groups: { langs: Record<string, string>; firstStart: number; lastEnd: number }[] = [];
  let i = 0;
  while (i < blocks.length) {
    const b = blocks[i];
    const normalLang = b.lang === 'c++' ? 'cpp' : b.lang;
    if (!KNOWN_LANGS.has(normalLang)) { i++; continue; }

    const group: Record<string, string> = { [normalLang]: b.code };
    let lastEnd = b.end;
    const firstStart = b.start;

    let j = i + 1;
    while (j < blocks.length) {
      const nextLang = blocks[j].lang === 'c++' ? 'cpp' : blocks[j].lang;
      if (!KNOWN_LANGS.has(nextLang)) break;
      const between = markdown.slice(lastEnd, blocks[j].start).trim();
      if (between && !/^(#{1,4}\s*.{0,40})?$/.test(between)) break;
      group[nextLang] = blocks[j].code;
      lastEnd = blocks[j].end;
      j++;
    }

    if (Object.keys(group).length > 1) {
      groups.push({ langs: group, firstStart, lastEnd });
    }
    i = j > i + 1 ? j : i + 1;
  }

  // 如果没有代码块组也没有 mermaid，直接返回文本
  if (groups.length === 0 && mermaidBlocks.length === 0) {
    return [{ type: 'text', text: markdown }];
  }

  // 合并所有特殊块（代码组 + mermaid），按位置排序
  type SpecialBlock =
    | { kind: 'code'; langs: Record<string, string>; start: number; end: number }
    | { kind: 'mermaid'; code: string; start: number; end: number };

  const specials: SpecialBlock[] = [
    ...groups.map((g) => ({ kind: 'code' as const, langs: g.langs, start: g.firstStart, end: g.lastEnd })),
    ...mermaidBlocks.map((mb) => ({ kind: 'mermaid' as const, code: mb.code, start: mb.start, end: mb.end })),
  ].sort((a, b) => a.start - b.start);

  // 组装 segments
  const segments: Segment[] = [];
  let cursor = 0;

  for (const block of specials) {
    let textBefore = markdown.slice(cursor, block.start);
    textBefore = textBefore.replace(/#{1,4}\s*\w+\s*(?:实现|Implementation|代码)?\s*$/m, '').trim();
    if (textBefore) {
      segments.push({ type: 'text', text: textBefore });
    }
    if (block.kind === 'code') {
      segments.push({ type: 'code', languages: block.langs });
    } else {
      segments.push({ type: 'mermaid', code: block.code });
    }
    cursor = block.end;
  }

  const remaining = markdown.slice(cursor).trim();
  if (remaining) {
    segments.push({ type: 'text', text: remaining });
  }

  return segments;
}


