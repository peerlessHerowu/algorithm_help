'use client';

/**
 * SkeletonLoader - 骨架屏加载组件
 *
 * 导出：
 * - CardSkeleton: 单张卡片骨架屏
 * - CardSkeletonList: 多张卡片骨架屏列表
 * - DetailSkeleton: 展开态详情骨架屏
 * - AIAnalysisSkeleton: AI解析区域骨架屏（更精准的内容结构）
 * - ErrorFallback: 加载失败错误提示 + 重试
 */

import { useCallback } from 'react';

// shimmer 渐变基础类
const shimmerClass = [
  'relative overflow-hidden',
  'bg-gray-200 dark:bg-gray-700',
  'after:absolute after:inset-0',
  'after:bg-gradient-to-r',
  'after:from-transparent after:via-white/20 after:to-transparent',
  'dark:after:via-white/5',
  'after:animate-shimmer',
  'after:bg-[length:200%_100%]',
].join(' ');

// ============ CardSkeleton ============

interface CardSkeletonProps { className?: string; }

export function CardSkeleton({ className }: CardSkeletonProps) {
  return (
    <div
      className={`rounded-xl border border-gray-200 dark:border-gray-700
        bg-white dark:bg-gray-900 p-4 ${className || ''}`}
      aria-hidden="true"
      role="presentation"
    >
      <div className="flex gap-1.5 mb-2">
        <div className={`h-4 w-12 rounded ${shimmerClass}`} />
        <div className={`h-4 w-16 rounded ${shimmerClass}`} />
        <div className={`h-4 w-10 rounded ${shimmerClass}`} />
      </div>
      <div className={`h-4 w-3/4 rounded ${shimmerClass} mb-2`} />
      <div className={`h-3 w-full rounded ${shimmerClass} mb-1.5`} />
      <div className={`h-3 w-5/6 rounded ${shimmerClass}`} />
    </div>
  );
}

// ============ CardSkeletonList ============

interface CardSkeletonListProps { count?: number; className?: string; }

export function CardSkeletonList({ count = 3, className }: CardSkeletonListProps) {
  return (
    <div className={`space-y-3 ${className || ''}`} aria-label="加载中" role="status">
      {Array.from({ length: count }).map((_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  );
}

// ============ DetailSkeleton ============

interface DetailSkeletonProps { className?: string; }

export function DetailSkeleton({ className }: DetailSkeletonProps) {
  return (
    <div className={`space-y-3 py-2 ${className || ''}`} aria-hidden="true" role="presentation">
      <div className={`h-3 w-full rounded ${shimmerClass}`} />
      <div className={`h-3 w-5/6 rounded ${shimmerClass}`} />
      <div className={`h-3 w-4/6 rounded ${shimmerClass}`} />
      <div className={`h-24 w-full rounded-lg bg-gray-100 dark:bg-gray-800 ${shimmerClass}`} />
      <div className="flex gap-2 pt-2">
        {[14, 14, 14, 14].map((w, i) => (
          <div key={i} className={`h-6 w-${w} rounded ${shimmerClass}`} />
        ))}
      </div>
    </div>
  );
}

// ============ AIAnalysisSkeleton - AI解析区域精准骨架屏 ============

interface AIAnalysisSkeletonProps { className?: string; }

/**
 * AI解析内容骨架屏 - 模拟真实内容结构：
 * 标题 → 段落文字 × 3 → 代码块 → 解法对比表
 */
export function AIAnalysisSkeleton({ className }: AIAnalysisSkeletonProps) {
  return (
    <div className={`space-y-6 animate-fade-in-up ${className || ''}`} aria-hidden="true" role="presentation">

      {/* Section 1: 核心思路 */}
      <div className="space-y-2">
        <div className={`h-5 w-28 rounded ${shimmerClass}`} /> {/* 标题 */}
        <div className={`h-3.5 w-full rounded ${shimmerClass}`} />
        <div className={`h-3.5 w-11/12 rounded ${shimmerClass}`} />
        <div className={`h-3.5 w-4/5 rounded ${shimmerClass}`} />
      </div>

      {/* 分隔线占位 */}
      <div className={`h-px w-full rounded ${shimmerClass}`} />

      {/* Section 2: 解法详解 */}
      <div className="space-y-2">
        <div className={`h-5 w-24 rounded ${shimmerClass}`} />
        <div className={`h-3.5 w-full rounded ${shimmerClass}`} />
        <div className={`h-3.5 w-10/12 rounded ${shimmerClass}`} />

        {/* 代码块骨架 */}
        <div className="mt-3 rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700">
          {/* 代码块顶栏 */}
          <div className="flex items-center justify-between px-4 py-2 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
            <div className={`h-4 w-16 rounded ${shimmerClass}`} />
            <div className={`h-4 w-10 rounded ${shimmerClass}`} />
          </div>
          {/* 代码行占位 */}
          <div className="p-4 space-y-2 bg-gray-900 dark:bg-gray-950">
            {[90, 70, 85, 60, 75, 80, 55].map((w, i) => (
              <div
                key={i}
                className="h-3.5 rounded bg-gray-700/60 dark:bg-gray-700/40 relative overflow-hidden
                  after:absolute after:inset-0 after:bg-gradient-to-r
                  after:from-transparent after:via-white/5 after:to-transparent
                  after:animate-shimmer after:bg-[length:200%_100%]"
                style={{ width: `${w}%` }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Section 3: 复杂度分析 */}
      <div className="space-y-2">
        <div className={`h-5 w-20 rounded ${shimmerClass}`} />
        <div className="flex gap-3">
          <div className={`h-8 flex-1 rounded-lg ${shimmerClass}`} />
          <div className={`h-8 flex-1 rounded-lg ${shimmerClass}`} />
        </div>
      </div>

      {/* 加载提示文字 */}
      <div className="flex items-center justify-center gap-2 py-2">
        <div className="h-1.5 w-1.5 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: '0ms' }} />
        <div className="h-1.5 w-1.5 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: '150ms' }} />
        <div className="h-1.5 w-1.5 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: '300ms' }} />
        <span className="text-xs text-gray-400 dark:text-gray-500 ml-1">AI 正在分析...</span>
      </div>
    </div>
  );
}

// ============ ErrorFallback ============

interface ErrorFallbackProps {
  message?: string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorFallback({
  message = '加载失败，请重试',
  onRetry,
  className,
}: ErrorFallbackProps) {
  const handleRetry = useCallback(() => { onRetry?.(); }, [onRetry]);

  return (
    <div
      className={`flex flex-col items-center justify-center py-6 text-center ${className || ''}`}
      role="alert"
    >
      <div className="mb-2 text-2xl text-gray-400 dark:text-gray-500">⚠️</div>
      <p className="mb-3 text-sm text-gray-500 dark:text-gray-400">{message}</p>
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
