'use client';

/**
 * 算法模式列表页客户端组件
 * 网格展示所有算法模式，支持按名称搜索筛选
 */

import { useState, useMemo } from 'react';
import useSWR from 'swr';
import { fetcher } from '@/lib/fetcher';
import type { Pattern } from '@/lib/types';
import PatternCard from '@/components/cards/PatternCard';

export default function PatternsClient() {
  const [search, setSearch] = useState('');

  // 获取模式列表
  const { data: patterns, error, isLoading } = useSWR<Pattern[]>(
    '/api/v1/patterns',
    fetcher
  );

  // 本地搜索过滤
  const filtered = useMemo(() => {
    if (!patterns) return [];
    if (!search.trim()) return patterns;
    const keyword = search.trim().toLowerCase();
    return patterns.filter((p) =>
      p.name.toLowerCase().includes(keyword) ||
      p.category.toLowerCase().includes(keyword)
    );
  }, [patterns, search]);

  // 加载状态
  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-blue-500" />
      </div>
    );
  }

  // 错误状态
  if (error) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-red-500">{error.message || '加载失败，请稍后重试'}</p>
      </div>
    );
  }

  return (
    <div>
      {/* 页面标题 + 搜索 */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          算法模式
        </h1>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="搜索模式名称..."
          className="w-full sm:w-64 rounded-lg border border-gray-300 bg-white px-4 py-2
                     text-sm text-gray-900 placeholder-gray-400
                     focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500
                     dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100
                     dark:placeholder-gray-500 dark:focus:border-blue-400"
        />
      </div>

      {/* 模式卡片网格 */}
      {filtered.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((pattern) => (
            <PatternCard key={pattern.id} pattern={pattern} />
          ))}
        </div>
      ) : (
        <div className="flex min-h-[40vh] items-center justify-center">
          <div className="text-center text-gray-500 dark:text-gray-400">
            <p className="text-lg">暂无匹配的算法模式</p>
            {search && (
              <p className="mt-2 text-sm">
                尝试其他关键词，或{' '}
                <button
                  onClick={() => setSearch('')}
                  className="text-blue-500 hover:underline"
                >
                  清除搜索
                </button>
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
