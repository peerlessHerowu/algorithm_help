'use client';

/**
 * GenerationProgress - AI 生成进度展示组件
 *
 * 职责：
 * - 显示进度条（completedSteps / totalSteps）
 * - 当前步骤名称
 * - 预计剩余时间倒计时
 * - 取消生成按钮
 * - 失败态：错误信息 + 重试按钮
 * - 超时态（>60s）：提示"仍在生成中"
 *
 * 满足需求 11.1-11.7
 */

import { useEffect, useMemo, useState } from 'react';
import type { EnrichmentTaskStatus, TaskProgress } from '@/hooks/useEnrichmentTask';

interface GenerationProgressProps {
  /** 当前状态 */
  status: EnrichmentTaskStatus;
  /** 进度信息 */
  progress: TaskProgress | null;
  /** 预计剩余秒数 */
  estimatedRemaining: number | null;
  /** 错误信息 */
  error: string | null;
  /** 取消回调 */
  onCancel: () => void;
  /** 重试回调 */
  onRetry: () => void;
  /** 自定义类名 */
  className?: string;
}

/** 步骤名中文映射 */
const STEP_NAMES: Record<string, string> = {
  'error-check': '纠错检查',
  'source-filter': '素材筛选',
  'polish': '内容润色',
  'multi-lang': '多语言补全',
  'visualization': '可视化增强',
  'diversity-check': '差异化检查',
  'quality-score': '质量评分',
};

/** 获取步骤中文名 */
function getStepName(step: string): string {
  return STEP_NAMES[step] || step || '准备中';
}

export default function GenerationProgress({
  status,
  progress,
  estimatedRemaining,
  error,
  onCancel,
  onRetry,
  className,
}: GenerationProgressProps) {
  // 本地倒计时（每秒递减）
  const [countdown, setCountdown] = useState<number | null>(null);

  // 当 estimatedRemaining 更新时重置倒计时
  useEffect(() => {
    if (estimatedRemaining != null && estimatedRemaining > 0) {
      setCountdown(estimatedRemaining);
    }
  }, [estimatedRemaining]);

  // 每秒递减
  useEffect(() => {
    if (countdown == null || countdown <= 0) return;
    const timer = setInterval(() => {
      setCountdown((prev) => (prev != null && prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  // 进度百分比
  const progressPercent = useMemo(() => {
    if (!progress || progress.totalSteps <= 0) return 0;
    return Math.round((progress.completedSteps / progress.totalSteps) * 100);
  }, [progress]);

  // 是否超时态（>60s 仍未完成）
  const isLongRunning = countdown != null && countdown <= 0
    && (status === 'pending' || status === 'processing');

  // 失败态
  if (status === 'failed') {
    return (
      <div className={`flex flex-col items-center py-12 px-4 ${className || ''}`}>
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full
          bg-red-50 dark:bg-red-900/20"
        >
          <svg className="h-6 w-6 text-red-500" fill="none" viewBox="0 0 24 24"
            stroke="currentColor" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
            />
          </svg>
        </div>
        <p className="mb-1 text-sm font-medium text-gray-700 dark:text-gray-200">
          生成失败
        </p>
        <p className="mb-4 text-xs text-gray-500 dark:text-gray-400 text-center max-w-xs">
          {error || '未知错误'}
        </p>
        <button
          type="button"
          onClick={onRetry}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white
            hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600
            focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400
            transition-colors duration-150"
        >
          重试
        </button>
      </div>
    );
  }

  // 正常进度态
  return (
    <div className={`flex flex-col items-center py-12 px-4 ${className || ''}`}>
      {/* 状态图标 */}
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full
        bg-blue-50 dark:bg-blue-900/20"
      >
        <svg
          className="h-6 w-6 text-blue-500 dark:text-blue-400 animate-pulse"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25
              12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0
              003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z"
          />
        </svg>
      </div>

      {/* 标题 */}
      <p className="mb-4 text-sm font-medium text-gray-700 dark:text-gray-200">
        {isLongRunning ? '仍在生成中，页面将自动刷新' : 'AI 正在生成解析...'}
      </p>

      {/* 进度条 */}
      <div className="mb-3 w-full max-w-xs">
        <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
          <div
            className="h-full rounded-full bg-blue-500 dark:bg-blue-400
              transition-all duration-500 ease-out"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <div className="mt-1.5 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
          <span>{progress?.completedSteps || 0} / {progress?.totalSteps || 7} 步</span>
          <span>{progressPercent}%</span>
        </div>
      </div>

      {/* 当前步骤名 */}
      {progress?.currentStep && (
        <p className="mb-2 text-xs text-gray-500 dark:text-gray-400">
          当前步骤：{getStepName(progress.currentStep)}
        </p>
      )}

      {/* 预计剩余时间 */}
      {countdown != null && countdown > 0 && (
        <p className="mb-4 text-xs text-gray-400 dark:text-gray-500">
          预计剩余 {countdown} 秒
        </p>
      )}

      {/* 取消按钮 */}
      <button
        type="button"
        onClick={onCancel}
        className="mt-2 rounded-lg px-4 py-1.5 text-xs font-medium
          text-gray-500 hover:bg-gray-100 hover:text-gray-700
          dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200
          focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-300
          transition-colors duration-150"
      >
        取消生成
      </button>
    </div>
  );
}
