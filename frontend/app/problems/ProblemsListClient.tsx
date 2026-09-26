'use client';

/**
 * 题目列表页客户端组件
 * 支持搜索、难度筛选、分页
 */

import { useState, useCallback } from 'react';
import useSWR from 'swr';
import { fetcher } from '@/lib/fetcher';
import { safeArray } from '@/lib/safeArray';
import ProblemCard from '@/components/ProblemCard';
import type { ProblemListItem, Difficulty } from '@/lib/types';

/** 分页响应 */
interface ProblemPage {
  content: ProblemListItem[];
  totalElements: number;
  totalPages: number;
}

/** 难度选项 */
const DIFFICULTIES: { value: '' | Difficulty; label: string }[] = [
  { value: '', label: '全部' },
  { value: 'EASY', label: '简单' },
  { value: 'MEDIUM', label: '中等' },
  { value: 'HARD', label: '困难' },
];

export default function ProblemsListClient() {
  const [keyword, setKeyword] = useState('');
  const [difficulty, setDifficulty] = useState<'' | Difficulty>('');
  const [page, setPage] = useState(0);
  const pageSize = 20;

  // 构建查询 URL
  const params = new URLSearchParams();
  params.set('page', String(page));
  params.set('size', String(pageSize));
  if (keyword) params.set('keyword', keyword);
  if (difficulty) params.set('difficulty', difficulty);

  const { data, error, isLoading, mutate } = useSWR<ProblemPage>(
    `/api/v1/problems?${params.toString()}`,
    fetcher
  );

  const problems = data?.content || [];
  const totalPages = data?.totalPages || 0;
  const totalElements = data?.totalElements || 0;

  const handleSearch = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    setPage(0);
  }, []);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      {/* 页面标题 */}
      <h1 className="text-2xl font-bold text-gray-100 mb-6">
        全部题目
        {totalElements > 0 && (
          <span className="ml-2 text-base font-normal text-gray-500">
            ({totalElements} 道)
          </span>
        )}
      </h1>

      {/* 搜索和筛选栏 */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        {/* 搜索框 */}
        <form onSubmit={handleSearch} className="flex-1">
          <input
            type="text"
            value={keyword}
            onChange={(e) => { setKeyword(e.target.value); setPage(0); }}
            placeholder="搜索题目标题..."
            className="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-2.5 text-sm text-gray-200
                       placeholder-gray-400 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400
                       placeholder-gray-500"
          />
        </form>

        {/* 难度筛选 */}
        <div className="flex gap-2">
          {DIFFICULTIES.map((d) => (
            <button
              key={d.value}
              onClick={() => { setDifficulty(d.value); setPage(0); }}
              className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                difficulty === d.value
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
              }`}
            >
              {d.label}
            </button>
          ))}
        </div>
      </div>

      {/* 加载状态 */}
      {isLoading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="animate-pulse rounded-xl border border-gray-800 p-5">
              <div className="h-5 w-2/3 rounded bg-gray-200 dark:bg-gray-700" />
              <div className="mt-3 h-4 w-1/2 rounded bg-gray-200 dark:bg-gray-700" />
            </div>
          ))}
        </div>
      )}

      {/* 请求失败状态：不要把网络故障误报成空结果 */}
      {!isLoading && error && (
        <div className="flex min-h-[40vh] items-center justify-center">
          <div className="text-center">
            <p className="text-4xl">⚠️</p>
            <p className="mt-4 text-gray-500 dark:text-gray-400">
              加载失败，请检查网络连接后重试
            </p>
            <button
              type="button"
              onClick={() => mutate()}
              className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-500"
            >
              重试
            </button>
          </div>
        </div>
      )}

      {/* 题目网格 */}
      {!isLoading && !error && problems.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {problems.map((problem) => (
            <ProblemCard key={problem.id} problem={problem} />
          ))}
        </div>
      )}

      {/* 空状态 */}
      {!isLoading && !error && problems.length === 0 && (
        <div className="flex min-h-[40vh] items-center justify-center">
          <div className="text-center">
            <p className="text-4xl">🔍</p>
            <p className="mt-4 text-gray-500 dark:text-gray-400">没有找到匹配的题目</p>
          </div>
        </div>
      )}

      {/* 分页 */}
      {totalPages > 1 && (
        <div className="mt-8 flex items-center justify-center gap-4">
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="rounded-lg border border-gray-700 px-4 py-2 text-sm text-gray-300 hover:bg-gray-800 disabled:opacity-40"
          >
            ← 上一页
          </button>
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {page + 1} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            className="rounded-lg border border-gray-700 px-4 py-2 text-sm text-gray-300 hover:bg-gray-800 disabled:opacity-40"
          >
            下一页 →
          </button>
        </div>
      )}
    </div>
  );
}
