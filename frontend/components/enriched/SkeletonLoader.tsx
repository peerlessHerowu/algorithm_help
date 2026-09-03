'use client';

/**
 * SkeletonLoader - 骨架屏加载组件
 *
 * 导出：
 * - CardSkeleton: 单张卡片骨架屏（列表加载时）
 * - CardSkeletonList: 2-3 张卡片骨架屏（级别切换/列表加载）
 * - DetailSkeleton: 展开态详情骨架屏（lazy load 加载详情时）
 * - ErrorFallback: 加载失败时的错误提示 + 重试按钮
 *
 * 特性：
 * - shimmer 动画（渐变从左到右流动）
 * - 暗色/亮色主题适配（dark: 前缀）
 * - 语义化结构占位
 *
 * 满足需求 25.1-25.4
 */

import { useCallback } from 'react';

// ============ shimmer 渐变基础样式 ============

/** shimmer 渐变背景样式（亮色/暗色自适应） */
const shimmerClass = [
  'relative overflow-hidden',
  'bg-gray-200 dark:bg-gray-700',
  'after:absolute after:inset-0',
  'after:bg-gradient-to-r',
  'after:from-transparent after:via-white/10 after:to-transparent',
  'dark:after:via-white/5',
  'after:animate-shimmer',
  'after:bg-[length:200%_100%]',
].join(' ');

// ============ CardSkeleton：单张卡片骨架屏 ============

interface CardSkeletonProps {
  className?: string;
}

/**
 * 单张卡片骨架屏
 * 结构：1 行标签占位 + 1 行标题占位 + 2 行摘要占位
 * 用于列表加载时占位展示
 */
export function CardSkeleton({ className }: CardSkeletonProps) {
  return (
    <div
      className={`rounded-xl border border-gray-200 dark:border-gray-700
        bg-white dark:bg-gray-900 p-4 ${className || ''}`}
      aria-hidden="true"
      role="presentation"
    >
      {/* 标签行占位 */}
      <div className="flex gap-1.5 mb-2">
        <div className={`h-4 w-12 rounded ${shimmerClass}`} />
        <div className={`h-4 w-16 rounded ${shimmerClass}`} />
        <div className={`h-4 w-10 rounded ${shimmerClass}`} />
      </div>

      {/* 标题占位 */}
      <div className={`h-4 w-3/4 rounded ${shimmerClass} mb-2`} />

      {/* 摘要占位（2 行） */}
      <div className={`h-3 w-full rounded ${shimmerClass} mb-1.5`} />
      <div className={`h-3 w-5/6 rounded ${shimmerClass}`} />
    </div>
  );
}

// ============ CardSkeletonList：多张卡片骨架屏 ============

interface CardSkeletonListProps {
  /** 显示的卡片数量，默认 3 */
  count?: number;
  className?: string;
}

/**
 * 卡片骨架屏列表（2-3 张）
 * 用于级别切换或初始列表加载时展示
 */
export function CardSkeletonList({ count = 3, className }: CardSkeletonListProps) {
  return (
    <div className={`space-y-3 ${className || ''}`} aria-label="加载中" role="status">
      {Array.from({ length: count }).map((_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  );
}

// ============ DetailSkeleton：展开态详情骨架屏 ============

interface DetailSkeletonProps {
  className?: string;
}

/**
 * 展开态详情骨架屏
 * 结构：3 行文字占位 + 代码块占位（深色背景矩形）+ 操作栏占位
 * 用于卡片展开时 lazy load 详情加载期间
 */
export function DetailSkeleton({ className }: DetailSkeletonProps) {
  return (
    <div
      className={`space-y-3 py-2 ${className || ''}`}
      aria-hidden="true"
      role="presentation"
    >
      {/* 3 行文字占位 */}
      <div className={`h-3 w-full rounded ${shimmerClass}`} />
      <div className={`h-3 w-5/6 rounded ${shimmerClass}`} />
      <div className={`h-3 w-4/6 rounded ${shimmerClass}`} />

      {/* 代码块占位（深色背景矩形） */}
      <div
        className={`h-24 w-full rounded-lg bg-gray-100 dark:bg-gray-800
          ${shimmerClass}`}
      />

      {/* 操作栏占位 */}
      <div className="flex gap-2 pt-2">
        <div className={`h-6 w-14 rounded ${shimmerClass}`} />
        <div className={`h-6 w-14 rounded ${shimmerClass}`} />
        <div className={`h-6 w-14 rounded ${shimmerClass}`} />
        <div className={`h-6 w-14 rounded ${shimmerClass}`} />
      </div>
    </div>
  );
}

// ============ ErrorFallback：加载失败错误提示 ============

interface ErrorFallbackProps {
  /** 错误信息 */
  message?: string;
  /** 重试回调 */
  onRetry?: () => void;
  className?: string;
}

/**
 * 加载失败时的错误提示 + 重试按钮
 * 替换骨架屏，引导用户重新加载
 */
export function ErrorFallback({
  message = '加载失败，请重试',
  onRetry,
  className,
}: ErrorFallbackProps) {
  const handleRetry = useCallback(() => {
    onRetry?.();
  }, [onRetry]);

  return (
    <div
      className={`flex flex-col items-center justify-center py-6 text-center
        ${className || ''}`}
      role="alert"
    >
      {/* 错误图标 */}
      <div className="mb-2 text-2xl text-gray-400 dark:text-gray-500">
        ⚠️
      </div>

      {/* 错误信息 */}
      <p className="mb-3 text-sm text-gray-500 dark:text-gray-400">
        {message}
      </p>

      {/* 重试按钮 */}
      {onRetry && (
        <button
          type="button"
          onClick={handleRetry}
          className="rounded-lg bg-primary-500 px-4 py-1.5 text-sm font-medium
            text-white transition-colors hover:bg-primary-600
            focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500
            focus-visible:ring-offset-2 dark:bg-primary-600 dark:hover:bg-primary-700"
        >
          重试
        </button>
      )}
    </div>
  );
}
