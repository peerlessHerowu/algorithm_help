'use client';

/**
 * SourceBadge - 来源标记胶囊组件
 * 紫色=COMMUNITY, 蓝色=AI_ORIGINAL, 绿色=OFFICIAL
 * 附带来源热度（★ votes）展示
 */

import { useMemo } from 'react';

/** 来源类型 */
export type SourceType = 'COMMUNITY' | 'AI_ORIGINAL' | 'OFFICIAL' | 'LEGACY_V1';

interface SourceBadgeProps {
  /** 来源类型 */
  sourceType: SourceType;
  /** 来源题解的原始点赞数（AI_ORIGINAL 不展示） */
  sourceVotes?: number | null;
  /** 自定义类名 */
  className?: string;
}

/** 来源配色映射 */
const SOURCE_STYLES: Record<SourceType, { bg: string; text: string; label: string }> = {
  COMMUNITY: {
    bg: 'bg-purple-100 dark:bg-purple-900/30',
    text: 'text-purple-600 dark:text-purple-400',
    label: '社区',
  },
  AI_ORIGINAL: {
    bg: 'bg-blue-100 dark:bg-blue-900/30',
    text: 'text-blue-600 dark:text-blue-400',
    label: 'AI 原创',
  },
  OFFICIAL: {
    bg: 'bg-green-100 dark:bg-green-900/30',
    text: 'text-green-600 dark:text-green-400',
    label: '官方',
  },
  LEGACY_V1: {
    bg: 'bg-gray-100 dark:bg-gray-800',
    text: 'text-gray-600 dark:text-gray-400',
    label: '旧版',
  },
};

export default function SourceBadge({ sourceType, sourceVotes, className }: SourceBadgeProps) {
  const style = useMemo(() => SOURCE_STYLES[sourceType] || SOURCE_STYLES.COMMUNITY, [sourceType]);

  // AI_ORIGINAL 不展示来源热度
  const showVotes = sourceType !== 'AI_ORIGINAL' && sourceVotes != null && sourceVotes > 0;

  return (
    <span className={`inline-flex items-center gap-1.5 ${className || ''}`}>
      {/* 来源胶囊 */}
      <span
        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${style.bg} ${style.text}`}
      >
        {style.label}
      </span>

      {/* 来源热度 */}
      {showVotes && (
        <span className="inline-flex items-center gap-0.5 text-xs text-amber-600 dark:text-amber-400">
          <span>★</span>
          <span>{formatVotes(sourceVotes!)}</span>
        </span>
      )}
    </span>
  );
}

/** 格式化投票数：超过 1000 显示为 1.2k */
function formatVotes(votes: number): string {
  if (votes >= 10000) return `${(votes / 1000).toFixed(0)}k`;
  if (votes >= 1000) return `${(votes / 1000).toFixed(1)}k`;
  return String(votes);
}
