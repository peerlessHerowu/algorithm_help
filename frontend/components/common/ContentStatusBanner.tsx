'use client';

/**
 * 内容状态横幅组件
 * 根据解析内容的不同状态展示对应的提示信息
 * 
 * 状态说明：
 * - PUBLISHED：已发布，正常展示（不显示横幅）
 * - GENERATING：生成中（由 GenerationStatus 组件处理）
 * - PENDING_REVIEW：待审核/待修正，展示"内容审核中"警告
 * - REJECTED：审核驳回（展示提示）
 * - ARCHIVED：已归档
 */

import type { ExplanationStatus } from '@/lib/types';

interface ContentStatusBannerProps {
  /** 内容状态 */
  status: ExplanationStatus;
  className?: string;
}

/** 状态配置映射 */
const STATUS_CONFIG: Record<
  Exclude<ExplanationStatus, 'PUBLISHED'>,
  { icon: string; title: string; description: string; borderColor: string; bgColor: string; textColor: string }
> = {
  PENDING_REVIEW: {
    icon: '⚠️',
    title: '内容审核中',
    description: '该解析正在进行质量审核，部分内容暂时隐藏。当前仅展示代码和基本思路供参考。',
    borderColor: 'border-amber-300 dark:border-amber-700',
    bgColor: 'bg-amber-50 dark:bg-amber-900/20',
    textColor: 'text-amber-800 dark:text-amber-200',
  },
  GENERATING: {
    icon: '⏳',
    title: '内容生成中',
    description: 'AI 正在生成该级别的解析内容，请稍候...',
    borderColor: 'border-blue-300 dark:border-blue-700',
    bgColor: 'bg-blue-50 dark:bg-blue-900/20',
    textColor: 'text-blue-800 dark:text-blue-200',
  },
  REJECTED: {
    icon: '❌',
    title: '内容已驳回',
    description: '该解析未通过质量审核，正在等待重新生成。',
    borderColor: 'border-red-300 dark:border-red-700',
    bgColor: 'bg-red-50 dark:bg-red-900/20',
    textColor: 'text-red-800 dark:text-red-200',
  },
  ARCHIVED: {
    icon: '📦',
    title: '内容已归档',
    description: '该版本已归档，请查看最新版本的解析内容。',
    borderColor: 'border-gray-300 dark:border-gray-600',
    bgColor: 'bg-gray-50 dark:bg-gray-800/50',
    textColor: 'text-gray-700 dark:text-gray-300',
  },
};

export default function ContentStatusBanner({ status, className = '' }: ContentStatusBannerProps) {
  // PUBLISHED 状态不展示横幅
  if (status === 'PUBLISHED') {
    return null;
  }

  const config = STATUS_CONFIG[status];
  if (!config) return null;

  return (
    <div
      className={`rounded-lg border-l-4 p-4 ${config.borderColor} ${config.bgColor} ${className}`}
      role="alert"
    >
      <div className="flex items-start gap-3">
        <span className="text-xl flex-shrink-0" aria-hidden="true">
          {config.icon}
        </span>
        <div>
          <h4 className={`text-sm font-semibold ${config.textColor}`}>
            {config.title}
          </h4>
          <p className={`mt-1 text-xs ${config.textColor} opacity-80`}>
            {config.description}
          </p>
        </div>
      </div>
    </div>
  );
}
