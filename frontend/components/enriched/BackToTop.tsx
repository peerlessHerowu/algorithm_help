'use client';

/**
 * BackToTop - 回到顶部浮动按钮
 *
 * 显示条件：页面滚动超过 600px
 * 交互：点击平滑滚动回到顶部
 * 位置：固定在右下角
 *
 * Requirements: 16.4
 */

import { useCallback, useEffect, useState } from 'react';

interface BackToTopProps {
  /** 显示阈值（px），默认 600 */
  threshold?: number;
  /** 自定义类名 */
  className?: string;
}

export default function BackToTop({
  threshold = 600,
  className,
}: BackToTopProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let ticking = false;
    const handleScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        setVisible(window.scrollY > threshold);
        ticking = false;
      });
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [threshold]);

  const scrollToTop = useCallback(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  if (!visible) return null;

  return (
    <button
      type="button"
      onClick={scrollToTop}
      className={`fixed bottom-6 right-6 z-40 flex h-10 w-10 items-center justify-center
        rounded-full border border-gray-200 bg-white shadow-lg
        transition-all duration-200 ease-out
        hover:scale-110 hover:shadow-xl
        active:scale-95
        dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700
        animate-fade-in
        ${className || ''}`}
      aria-label="回到顶部"
      title="回到顶部"
    >
      <svg
        className="h-4 w-4 text-gray-600 dark:text-gray-300"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
      </svg>
    </button>
  );
}
