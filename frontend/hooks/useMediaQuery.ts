'use client';

import { useEffect, useState } from 'react';

/**
 * 响应式媒体查询 Hook
 *
 * 响应式断点设计：
 * - Desktop XL: ≥1280px (主内容 800px + 右侧 mini 目录)
 * - Desktop: 1024-1279px (主内容 800px，无 mini 目录)
 * - Tablet: 768-1023px (满宽，卡片内边距 16px)
 * - Mobile: <768px (满宽，标签缩略为图标，代码横滚+全屏按钮)
 *
 * Requirements: 16.6
 */

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(query);
    setMatches(mq.matches);

    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [query]);

  return matches;
}

/** 便捷断点 hooks */
export function useIsMobile(): boolean {
  return useMediaQuery('(max-width: 767px)');
}

export function useIsTablet(): boolean {
  return useMediaQuery('(min-width: 768px) and (max-width: 1023px)');
}

export function useIsDesktop(): boolean {
  return useMediaQuery('(min-width: 1024px) and (max-width: 1279px)');
}

export function useIsDesktopXL(): boolean {
  return useMediaQuery('(min-width: 1280px)');
}
