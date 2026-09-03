'use client';

/**
 * 首页客户端组件
 * 展示题目卡片列表，支持搜索和难度筛选
 */

import { useState, useCallback } from 'react';
import useSWR from 'swr';
import { fetcher } from '@/lib/fetcher';
import type { PageResponse, ProblemListItem, Difficulty } from '@/lib/types';
import ProblemCard from '@/components/ProblemCard';
import SearchFilter from '@/components/SearchFilter';
import { CardSkeletonList } from '@/components/enriched/SkeletonLoader';

/** 构建查询参数字符串 */
function buildQuery(params: {
  keyword: string;
  difficulty: Difficulty | '';
  page: number;
}) {
  const entries: [string, string][] = [];
  entries.push(['page', String(params.page)]);
  entries.push(['size', '12']);
  if (params.keyword) entries.push(['keyword', params.keyword]);
  if (params.difficulty) entries.push(['difficulty', params.difficulty]);
  return entries.length > 0 ? `?${new URLSearchParams(entries)}` : '';
}

export default function HomeClient() {
  const [keyword, setKeyword] = useState('');
  const [difficulty, setDifficulty] = useState<Difficulty | ''>('');
  const [page, setPage] = useState(0);

  // 搜索防抖处理
  const [debouncedKeyword, setDebouncedKeyword] = useState('');
  const [debounceTimer, setDebounceTimer] = useState<NodeJS.Timeout | null>(null);

  const handleKeywordChange = useCallback((value: string) => {
    setKeyword(value);
    if (debounceTimer) clearTimeout(debounceTimer);
    const timer = setTimeout(() => {
      setDebouncedKeyword(value);
      setPage(0); // 搜索时重置到第一页
    }, 300);
    setDebounceTimer(timer);
  }, [debounceTimer]);

  const handleDifficultyChange = useCallback((value: Difficulty | '') => {
    setDifficulty(value);
    setPage(0); // 切换筛选时重置到第一页
  }, []);

  // 使用 SWR 获取题目列表
  const queryString = buildQuery({ keyword: debouncedKeyword, difficulty, page });
  const { data, error, isLoading } = useSWR<PageResponse<ProblemListItem>>(
    `/api/v1/problems${queryString}`,
    fetcher,
    { keepPreviousData: true }
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* 页头 */}
      <header className="border-b border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            算法深度理解引擎
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            通过渐进式解析，真正理解每一道算法题
          </p>
        </div>
      </header>

      {/* 主内容区 */}
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        {/* 搜索与筛选 */}
        <SearchFilter
          keyword={keyword}
          difficulty={difficulty}
          onKeywordChange={handleKeywordChange}
          onDifficultyChange={handleDifficultyChange}
        />

        {/* 加载状态 - 骨架屏 */}
        {isLoading && !data && (
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <CardSkeletonList count={6} />
          </div>
        )}

        {/* 错误状态 */}
        {error && (
          <div className="mt-16 flex flex-col items-center justify-center gap-3 animate-fade-in-up">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-50 dark:bg-red-900/20">
              <svg className="h-7 w-7 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
            </div>
            <p className="text-sm font-medium text-red-500">加载失败，请稍后重试</p>
          </div>
        )}

        {/* 题目列表 */}
        {data && (
          <>
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {data.content.map((problem, idx) => (
                <div
                  key={problem.id}
                  className="animate-fade-in-up"
                  style={{ animationDelay: `${Math.min(idx * 30, 300)}ms`, animationFillMode: 'both' }}
                >
                  <ProblemCard problem={problem} />
                </div>
              ))}
            </div>

            {/* 空状态 */}
            {data.content.length === 0 && (
              <div className="mt-16 flex flex-col items-center justify-center gap-3 animate-fade-in-up">
                <div className="flex h-14 w-14 items-center justify-center rounded-full
                  bg-gray-100 dark:bg-gray-800">
                  <svg className="h-7 w-7 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                  没有找到匹配的题目
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-500">
                  尝试换个关键词或取消筛选条件
                </p>
              </div>
            )}

            {/* 分页控制 */}
            {data.totalPages > 1 && (
              <div className="mt-8 flex items-center justify-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={data.first}
                  className="rounded-lg border border-gray-200 px-4 py-2 text-sm
                             text-gray-700 transition-colors hover:bg-gray-100
                             disabled:cursor-not-allowed disabled:opacity-40
                             dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                >
                  上一页
                </button>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {data.number + 1} / {data.totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => p + 1)}
                  disabled={data.last}
                  className="rounded-lg border border-gray-200 px-4 py-2 text-sm
                             text-gray-700 transition-colors hover:bg-gray-100
                             disabled:cursor-not-allowed disabled:opacity-40
                             dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                >
                  下一页
                </button>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
