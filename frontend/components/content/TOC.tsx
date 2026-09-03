'use client';

/**
 * 目录导航组件（Table of Contents）
 * 从 markdown 内容中提取 ## 和 ### 标题
 * 桌面端 sticky 固定在右侧，移动端隐藏
 * 点击平滑滚动到对应锚点
 */

import { useMemo } from 'react';

interface TOCItem {
  id: string;
  text: string;
  level: number; // 2 或 3
}

interface TOCProps {
  /** Markdown 文本内容 */
  content: string;
  /** 自定义样式类名 */
  className?: string;
}

/** 将标题文本转为 slug（用于锚点 ID） */
function toSlug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\u4e00-\u9fff]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** 从 markdown 内容中提取 h2 和 h3 标题 */
function extractHeadings(content: string): TOCItem[] {
  const headingRegex = /^(#{2,3})\s+(.+)$/gm;
  const items: TOCItem[] = [];
  let match: RegExpExecArray | null;

  while ((match = headingRegex.exec(content)) !== null) {
    const level = match[1].length;
    const text = match[2].trim();
    items.push({ id: toSlug(text), text, level });
  }

  return items;
}

export default function TOC({ content, className }: TOCProps) {
  const headings = useMemo(() => extractHeadings(content), [content]);

  /** 点击标题平滑滚动到对应位置 */
  const handleClick = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  if (headings.length === 0) {
    return null;
  }

  return (
    <nav
      className={`hidden lg:block sticky top-8 ${className || ''}`}
      aria-label="目录导航"
    >
      <h4 className="mb-3 text-sm font-semibold text-gray-700 dark:text-gray-300">
        目录
      </h4>
      <ul className="space-y-1.5 text-sm border-l border-gray-200 dark:border-gray-700">
        {headings.map((heading) => (
          <li
            key={heading.id}
            className={heading.level === 3 ? 'pl-6' : 'pl-3'}
          >
            <button
              onClick={() => handleClick(heading.id)}
              className="text-left text-gray-600 hover:text-blue-600 dark:text-gray-400
                         dark:hover:text-blue-400 transition-colors leading-relaxed"
            >
              {heading.text}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
