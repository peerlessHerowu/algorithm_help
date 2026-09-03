'use client';

/**
 * Intersection Observer 懒渲染 Hook
 * 元素进入视口后才标记为可见，用于延迟渲染 LaTeX/Mermaid/代码高亮等重计算内容
 * 一旦可见后不再切回 false（避免滚动回退后重复渲染）
 */

import { useEffect, useRef, useState } from 'react';

interface UseLazyRenderOptions {
  /** 提前触发的边距，默认 '200px'（提前 200px 开始渲染） */
  rootMargin?: string;
  /** 触发阈值，默认 0（任何像素进入即触发） */
  threshold?: number;
}

/**
 * @returns [ref, isVisible] — 将 ref 绑定到容器元素，isVisible 为 true 时渲染实际内容
 */
export function useLazyRender<T extends HTMLElement = HTMLDivElement>(
  options: UseLazyRenderOptions = {}
): [React.RefObject<T | null>, boolean] {
  const { rootMargin = '200px', threshold = 0 } = options;
  const ref = useRef<T | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || isVisible) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin, threshold }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [rootMargin, threshold, isVisible]);

  return [ref, isVisible];
}
