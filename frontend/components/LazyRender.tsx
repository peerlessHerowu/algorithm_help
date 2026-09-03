'use client';

/**
 * 懒渲染包装组件
 * 使用 Intersection Observer 延迟渲染子内容
 * 元素未进入视口前显示占位骨架，进入后渲染真实内容
 */

import { type ReactNode } from 'react';
import { useLazyRender } from '@/hooks/useLazyRender';

interface LazyRenderProps {
  children: ReactNode;
  /** 占位区域最小高度，默认 '3rem' */
  minHeight?: string;
  /** 自定义样式 */
  className?: string;
}

export default function LazyRender({ children, minHeight = '3rem', className }: LazyRenderProps) {
  const [ref, isVisible] = useLazyRender<HTMLDivElement>();

  return (
    <div ref={ref as React.Ref<HTMLDivElement>} className={className} style={{ minHeight: isVisible ? undefined : minHeight }}>
      {isVisible ? children : (
        <div className="animate-pulse rounded bg-gray-100 dark:bg-gray-800" style={{ height: minHeight }} />
      )}
    </div>
  );
}
