'use client';

/**
 * Mermaid 图解渲染组件
 * 接收 Mermaid 代码字符串，渲染为 SVG 图表
 * 渲染前执行安全校验，拒绝含危险标签的代码
 * 使用模块级 Map 缓存已渲染的 SVG，相同代码不重复渲染
 */

import { useEffect, useRef, useState, useId } from 'react';
import mermaid from 'mermaid';

interface MermaidRendererProps {
  /** Mermaid 图表代码 */
  code: string;
  /** 自定义样式类名 */
  className?: string;
}

/** 危险内容正则匹配列表 */
const DANGEROUS_PATTERNS = [
  /<script[\s>]/i,
  /<iframe[\s>]/i,
  /javascript\s*:/i,
  /onerror\s*=/i,
  /onload\s*=/i,
  /<object[\s>]/i,
  /<embed[\s>]/i,
];

/**
 * 安全校验：检测 Mermaid 代码中是否含有可疑标签
 * @returns 若包含危险内容返回 true
 */
function containsDangerousContent(code: string): boolean {
  return DANGEROUS_PATTERNS.some((pattern) => pattern.test(code));
}

/**
 * 模块级 SVG 渲染缓存
 * key: Mermaid 代码字符串（trimmed）
 * value: 渲染后的 SVG HTML 字符串
 * 避免相同代码重复调用 mermaid.render()，提升性能
 */
const svgCache = new Map<string, string>();

/** 缓存最大条目数，防止内存无限增长 */
const MAX_CACHE_SIZE = 100;

/**
 * 获取缓存的 SVG，若不存在返回 undefined
 */
export function getCachedSvg(code: string): string | undefined {
  return svgCache.get(code.trim());
}

/**
 * 清空 SVG 缓存（用于主题切换等场景）
 */
export function clearSvgCache(): void {
  svgCache.clear();
}

/** 初始化 mermaid 配置（仅执行一次） */
let mermaidInitialized = false;
function ensureMermaidInit() {
  if (mermaidInitialized) return;
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: 'strict',
    theme: 'default',
  });
  mermaidInitialized = true;
}

export default function MermaidRenderer({ code, className }: MermaidRendererProps) {
  const [svgContent, setSvgContent] = useState<string>('');
  const [error, setError] = useState<string>('');
  const containerRef = useRef<HTMLDivElement>(null);
  const uniqueId = useId();
  // 用于生成 mermaid 内部唯一 id
  const mermaidId = `mermaid-${uniqueId.replace(/:/g, '')}`;

  useEffect(() => {
    // 空内容处理
    if (!code || code.trim().length === 0) {
      setSvgContent('');
      setError('');
      return;
    }

    const trimmedCode = code.trim();

    // 安全校验：拒绝含危险标签的代码
    if (containsDangerousContent(trimmedCode)) {
      setSvgContent('');
      setError('检测到不安全的内容，已拒绝渲染');
      return;
    }

    // 检查缓存：若已有缓存直接使用，跳过重复渲染
    const cached = svgCache.get(trimmedCode);
    if (cached) {
      setSvgContent(cached);
      setError('');
      return;
    }

    // 渲染 Mermaid 图表
    let cancelled = false;
    async function renderDiagram() {
      try {
        ensureMermaidInit();
        const { svg } = await mermaid.render(mermaidId, trimmedCode);
        if (!cancelled) {
          // 写入缓存，超过最大容量时清理最早的条目
          if (svgCache.size >= MAX_CACHE_SIZE) {
            const firstKey = svgCache.keys().next().value;
            if (firstKey !== undefined) {
              svgCache.delete(firstKey);
            }
          }
          svgCache.set(trimmedCode, svg);
          setSvgContent(svg);
          setError('');
        }
      } catch (err) {
        if (!cancelled) {
          setSvgContent('');
          const message = err instanceof Error ? err.message : '未知错误';
          setError(`图表渲染失败：${message}`);
        }
      }
    }

    renderDiagram();
    return () => { cancelled = true; };
  }, [code, mermaidId]);

  // 空内容：不渲染任何内容
  if (!code || code.trim().length === 0) {
    return null;
  }

  // 错误状态
  if (error) {
    return (
      <div
        className={`rounded-lg border border-red-200 bg-red-50 p-4
                    dark:border-red-800 dark:bg-red-950 ${className ?? ''}`}
      >
        <div className="flex items-center gap-2 text-sm text-red-700 dark:text-red-300">
          <svg className="h-4 w-4 shrink-0" viewBox="0 0 20 20" fill="currentColor">
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
              clipRule="evenodd"
            />
          </svg>
          <span>{error}</span>
        </div>
      </div>
    );
  }

  // 正常渲染 SVG
  return (
    <div
      ref={containerRef}
      className={`overflow-x-auto ${className ?? ''}`}
      dangerouslySetInnerHTML={{ __html: svgContent }}
    />
  );
}
