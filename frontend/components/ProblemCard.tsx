'use client';

/**
 * 题目卡片组件
 * 展示题目标题、难度标签（颜色编码）、分类标签和生成状态指示器
 */

import Link from 'next/link';
import { safeArray } from '@/lib/safeArray';
import type { ProblemListItem, Difficulty, GenerationStatus } from '@/lib/types';

interface ProblemCardProps {
  problem: ProblemListItem;
}

/** 难度标签颜色映射 */
const difficultyConfig: Record<Difficulty, { label: string; className: string }> = {
  EASY: { label: '简单', className: 'bg-green-100 text-green-700' },
  MEDIUM: { label: '中等', className: 'bg-yellow-100 text-yellow-700' },
  HARD: { label: '困难', className: 'bg-red-100 text-red-700' },
};

/** 根据 problem 数据推断生成状态 */
function getGenerationStatus(problem: ProblemListItem): GenerationStatus {
  if (problem.generationStatus) return problem.generationStatus;
  return problem.hasExplanation ? 'generated' : 'not_generated';
}

/** 生成状态指示器组件 */
function GenerationStatusIndicator({ status }: { status: GenerationStatus }) {
  switch (status) {
    case 'generated':
      return (
        <span className="inline-flex items-center" title="已生成">
          <svg className="h-4 w-4 text-green-500" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
        </span>
      );
    case 'generating':
      return (
        <span className="inline-flex items-center" title="生成中">
          <svg className="h-4 w-4 text-blue-500 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        </span>
      );
    case 'failed':
      return (
        <span className="inline-flex items-center" title="生成失败">
          <svg className="h-4 w-4 text-red-500" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
        </span>
      );
    case 'not_generated':
    default:
      return (
        <span className="inline-flex items-center" title="未生成">
          <span className="h-3 w-3 rounded-full bg-gray-300 dark:bg-gray-600" />
        </span>
      );
  }
}

export default function ProblemCard({ problem }: ProblemCardProps) {
  const difficulty = difficultyConfig[problem.difficulty];
  const status = getGenerationStatus(problem);
  const tags = safeArray(problem.tags);

  return (
    <Link
      href={`/problems/${problem.id}`}
      className="block rounded-xl border border-gray-200 bg-white p-5
                 transition-all hover:shadow-md hover:border-gray-300
                 dark:bg-gray-900 dark:border-gray-700 dark:hover:border-gray-500"
    >
      {/* 标题行 */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <GenerationStatusIndicator status={status} />
          <h3 className="text-base font-medium text-gray-900 dark:text-gray-100 line-clamp-2">
            {problem.title}
          </h3>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${difficulty.className}`}
        >
          {difficulty.label}
        </span>
      </div>

      {/* 标签列表 */}
      {tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {tags.map((tag) => (
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
    </Link>
  );
}
