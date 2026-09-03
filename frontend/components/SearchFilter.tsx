'use client';

/**
 * 搜索和筛选组件
 * 包含搜索输入框和难度筛选下拉框
 */

import type { Difficulty } from '@/lib/types';

interface SearchFilterProps {
  keyword: string;
  difficulty: Difficulty | '';
  onKeywordChange: (value: string) => void;
  onDifficultyChange: (value: Difficulty | '') => void;
}

const difficultyOptions: { value: Difficulty | ''; label: string }[] = [
  { value: '', label: '全部难度' },
  { value: 'EASY', label: '简单' },
  { value: 'MEDIUM', label: '中等' },
  { value: 'HARD', label: '困难' },
];

export default function SearchFilter({
  keyword,
  difficulty,
  onKeywordChange,
  onDifficultyChange,
}: SearchFilterProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      {/* 搜索输入框 */}
      <div className="relative flex-1">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
        <input
          type="text"
          value={keyword}
          onChange={(e) => onKeywordChange(e.target.value)}
          placeholder="搜索题目..."
          className="w-full rounded-lg border border-gray-200 bg-white py-2.5 pl-10 pr-4
                     text-sm text-gray-900 placeholder:text-gray-400
                     focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500
                     dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100
                     dark:placeholder:text-gray-500 dark:focus:border-blue-400"
        />
      </div>

      {/* 难度筛选下拉框 */}
      <select
        value={difficulty}
        onChange={(e) => onDifficultyChange(e.target.value as Difficulty | '')}
        className="rounded-lg border border-gray-200 bg-white px-4 py-2.5
                   text-sm text-gray-900
                   focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500
                   dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
      >
        {difficultyOptions.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
