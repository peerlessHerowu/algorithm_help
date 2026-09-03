'use client';

/**
 * 题目卡片组件 - 升级版
 * 升级内容：卡片hover升起动效、难度色块优化、生成状态清晰展示
 */

import Link from 'next/link';
import { safeArray } from '@/lib/safeArray';
import type { ProblemListItem, Difficulty, GenerationStatus } from '@/lib/types';

interface ProblemCardProps {
  problem: ProblemListItem;
}

const difficultyConfig: Record<Difficulty, { label: string; bg: string; text: string; border: string }> = {
  EASY:   { label: '简单', bg: 'bg-emerald-50  dark:bg-emerald-900/20',  text: 'text-emerald-700 dark:text-emerald-400', border: 'border-emerald-200 dark:border-emerald-800' },
  MEDIUM: { label: '中等', bg: 'bg-amber-50    dark:bg-amber-900/20',    text: 'text-amber-700   dark:text-amber-400',   border: 'border-amber-200   dark:border-amber-800'   },
  HARD:   { label: '困难', bg: 'bg-rose-50     dark:bg-rose-900/20',     text: 'text-rose-700    dark:text-rose-400',    border: 'border-rose-200    dark:border-rose-800'    },
};

function getGenerationStatus(problem: ProblemListItem): GenerationStatus {
  if (problem.generationStatus) return problem.generationStatus;
  return problem.hasExplanation ? 'generated' : 'not_generated';
}

function StatusDot({ status }: { status: GenerationStatus }) {
  switch (status) {
    case 'generated':
      return <span className="h-2 w-2 rounded-full bg-emerald-500" title="已有AI解析" />;
    case 'generating':
      return <span className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" title="生成中" />;
    case 'failed':
      return <span className="h-2 w-2 rounded-full bg-red-400" title="生成失败" />;
    default:
      return <span className="h-2 w-2 rounded-full bg-gray-300 dark:bg-gray-600" title="暂无解析" />;
  }
}

export default function ProblemCard({ problem }: ProblemCardProps) {
  const diff   = difficultyConfig[problem.difficulty];
  const status = getGenerationStatus(problem);
  const tags   = safeArray(problem.tags).slice(0, 4); // 最多显示4个tag

  return (
    <Link
      href={`/problems/${problem.id}`}
      className="group block rounded-xl border border-gray-200 bg-white p-5
        transition-all duration-200 ease-out
        hover:-translate-y-1 hover:shadow-lg hover:shadow-gray-200/60 hover:border-gray-300
        dark:bg-gray-900 dark:border-gray-700
        dark:hover:border-gray-600 dark:hover:shadow-black/30"
    >
      {/* 顶行：状态点 + 标题 + 难度 */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5 min-w-0 flex-1">
          <span className="mt-1.5 shrink-0">
            <StatusDot status={status} />
          </span>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100
            line-clamp-2 leading-snug
            group-hover:text-blue-600 dark:group-hover:text-blue-400
            transition-colors duration-150">
            {problem.title}
          </h3>
        </div>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium border
          ${diff.bg} ${diff.text} ${diff.border}`}>
          {diff.label}
        </span>
      </div>

      {/* 标签列表 */}
      {tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <span
              key={tag}
              className="rounded-md bg-gray-100 px-2 py-0.5 text-[11px] text-gray-500
                dark:bg-gray-800 dark:text-gray-400
                transition-colors group-hover:bg-gray-200 dark:group-hover:bg-gray-700"
            >
              {tag}
            </span>
          ))}
          {safeArray(problem.tags).length > 4 && (
            <span className="rounded-md bg-gray-100 px-2 py-0.5 text-[11px] text-gray-400 dark:bg-gray-800">
              +{safeArray(problem.tags).length - 4}
            </span>
          )}
        </div>
      )}

      {/* 底部：有AI解析时的提示 */}
      {status === 'generated' && (
        <div className="mt-3 flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400">
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
          <span>含AI深度解析</span>
        </div>
      )}
    </Link>
  );
}
