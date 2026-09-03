'use client';

/**
 * 题目标题区组件
 * - 题目标题（中/英切换）+ 难度标签 + 分类标签
 * - "EN" 按钮切换中/英文题目描述
 * - localStorage 记住语言偏好
 * - 语言切换仅影响题目描述，不影响解析内容
 *
 * Requirements: 20.1-20.4
 */

import { memo } from 'react';
import { safeArray } from '@/lib/safeArray';
import type { Difficulty } from '@/lib/types';
import type { LangPreference } from '@/hooks/useLangPreference';

/** 难度颜色配置 */
const DIFFICULTY_STYLES: Record<Difficulty, { text: string; bg: string; label: string }> = {
  EASY: {
    text: 'text-green-700 dark:text-green-400',
    bg: 'bg-green-100 dark:bg-green-900/30',
    label: '简单',
  },
  MEDIUM: {
    text: 'text-yellow-700 dark:text-yellow-400',
    bg: 'bg-yellow-100 dark:bg-yellow-900/30',
    label: '中等',
  },
  HARD: {
    text: 'text-red-700 dark:text-red-400',
    bg: 'bg-red-100 dark:bg-red-900/30',
    label: '困难',
  },
};

export interface ProblemHeaderProps {
  /** 英文标题 */
  title: string;
  /** 中文标题（可选） */
  titleCn?: string;
  /** 难度 */
  difficulty: Difficulty;
  /** 分类标签 */
  tags: string[];
  /** 当前语言偏好 */
  lang: LangPreference;
  /** 切换语言回调 */
  onToggleLang: () => void;
  /** 是否有中文内容可切换 */
  hasChineseContent: boolean;
}

/**
 * 题目标题区
 * 显示标题 + 难度标签 + EN 切换按钮 + 分类标签
 */
function ProblemHeaderInner({
  title,
  titleCn,
  difficulty,
  tags,
  lang,
  onToggleLang,
  hasChineseContent,
}: ProblemHeaderProps) {
  const diffStyle = DIFFICULTY_STYLES[difficulty];
  const isChinese = lang === 'cn';
  const displayTitle = isChinese && titleCn ? titleCn : title;

  return (
    <div className="mb-6">
      {/* 标题行：标题 + 难度标签 + 语言切换 */}
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          {displayTitle}
        </h1>
        <span
          className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${diffStyle.bg} ${diffStyle.text}`}
        >
          {diffStyle.label}
        </span>
        {/* 中英文切换按钮：仅当有中文内容时显示 */}
        {hasChineseContent && (
          <button
            onClick={onToggleLang}
            className="ml-auto shrink-0 rounded-md border border-gray-300 px-2.5 py-1
                       text-xs font-medium text-gray-600 transition-colors
                       hover:bg-gray-100 hover:text-gray-800
                       dark:border-gray-600 dark:text-gray-400
                       dark:hover:bg-gray-800 dark:hover:text-gray-200"
            aria-label={isChinese ? '切换为英文' : '切换为中文'}
            title={isChinese ? '切换为英文' : '切换为中文'}
          >
            {isChinese ? 'EN' : '中'}
          </button>
        )}
      </div>

      {/* 分类标签 */}
      {safeArray(tags).length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {safeArray(tags).map((tag) => (
            <span
              key={tag}
              className="rounded-md bg-gray-100 px-2 py-0.5 text-xs text-gray-600
                         dark:bg-gray-800 dark:text-gray-400"
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

const ProblemHeader = memo(ProblemHeaderInner);
export default ProblemHeader;
