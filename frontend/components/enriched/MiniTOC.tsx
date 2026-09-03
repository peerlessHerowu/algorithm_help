'use client';

/**
 * MiniTOC - 右侧浮动迷你目录
 *
 * 显示条件：
 * - ≥2 张卡片处于展开状态
 * - 屏幕宽度 ≥1280px (Desktop XL)
 *
 * 功能：
 * - 显示所有展开卡片的标题
 * - 点击标题跳转到对应卡片位置
 * - 高亮当前可视区域的卡片
 *
 * Requirements: 16.3
 */

import { useCallback, useEffect, useState } from 'react';

export interface MiniTOCItem {
  id: string;
  title: string;
}

interface MiniTOCProps {
  /** 展开的卡片列表 */
  items: MiniTOCItem[];
  /** 自定义类名 */
  className?: string;
}

export default function MiniTOC({ items, className }: MiniTOCProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [isDesktopXL, setIsDesktopXL] = useState(false);

  // 监听屏幕宽度变化
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1280px)');
    const handler = (e: MediaQueryListEvent | MediaQueryList) => {
      setIsDesktopXL(e.matches);
    };
    handler(mq);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // 监听滚动，高亮当前可视卡片
  useEffect(() => {
    if (items.length < 2 || !isDesktopXL) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const cardId = entry.target.getAttribute('data-card-id');
            if (cardId) setActiveId(cardId);
          }
        }
      },
      { rootMargin: '-100px 0px -60% 0px', threshold: 0.1 }
    );

    for (const item of items) {
      const el = document.querySelector(`[data-card-id="${item.id}"]`);
      if (el) observer.observe(el);
    }

    return () => observer.disconnect();
  }, [items, isDesktopXL]);

  /** 点击跳转到对应卡片 */
  const handleClick = useCallback((id: string) => {
    const el = document.querySelector(`[data-card-id="${id}"]`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setActiveId(id);
    }
  }, []);

  // 不满足显示条件时隐藏
  if (items.length < 2 || !isDesktopXL) return null;

  return (
    <nav
      className={`fixed right-8 top-1/3 z-30 w-48 max-h-[50vh] overflow-y-auto
        rounded-lg border border-gray-200 bg-white/90 p-3 shadow-lg backdrop-blur-sm
        dark:border-gray-700 dark:bg-gray-900/90
        ${className || ''}`}
      aria-label="解析卡片目录"
    >
      <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wider
        text-gray-400 dark:text-gray-500">
        目录
      </h4>
      <ul className="space-y-1">
        {items.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              onClick={() => handleClick(item.id)}
              className={`w-full truncate rounded px-2 py-1 text-left text-xs
                transition-colors duration-150
                ${activeId === item.id
                  ? 'bg-blue-50 text-blue-600 font-medium dark:bg-blue-900/30 dark:text-blue-400'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200'
                }`}
              title={item.title}
            >
              {item.title}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
