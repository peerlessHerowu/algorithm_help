'use client';

/**
 * 题解列表组件
 * 获取指定题目的题解列表，支持精选/最新/最热排序
 * 展示题解卡片列表 + "写题解"入口按钮
 *
 * Requirements: 31.1, 31.2, 31.7
 */

import { useState, useCallback } from 'react';
import useSWR from 'swr';
import { fetcher } from '@/lib/fetcher';
import { useAppStore } from '@/store';
import SolutionCard from './SolutionCard';
import SolutionEditor from './SolutionEditor';
import type { Solution } from './SolutionCard';
import MarkdownRenderer from '@/components/MarkdownRenderer';

/** 排序选项 */
type SortOption = 'featured' | 'latest' | 'hot';

interface SolutionDTO {
  id: string;
  title: string;
  content: string | null;
  authorName: string | null;
  sourceType: string | null;
  status: string | null;
  upvotes: number | null;
  createdAt: number;
}

/** 分页响应 */
interface SolutionPage {
  content: SolutionDTO[];
  totalElements: number;
}

/** SolutionList Props 接口 */
export interface SolutionListProps {
  /** 题目 ID */
  problemId: string;
  /** 自定义样式类名 */
  className?: string;
}

/** 排序选项配置 */
const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'featured', label: '精选' },
  { value: 'latest', label: '最新' },
  { value: 'hot', label: '最热' },
];

export default function SolutionList({ problemId, className }: SolutionListProps) {
  const { isAuthenticated, user, token } = useAppStore();
  const [sort, setSort] = useState<SortOption>('featured');
  const [showEditor, setShowEditor] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // 根据排序选项构建请求 URL
  const apiUrl = `/api/v1/problems/${problemId}/solutions?page=0&size=10&sort=${sort}`;
  const { data, error, isLoading, mutate } = useSWR<SolutionPage>(apiUrl, fetcher);

  /** 处理题解提交 */
  const handleSubmit = useCallback(
    async (input: { title: string; content: string }) => {
      if (!user?.id || !token) throw new Error('请先登录后再发布题解');
      const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8080';
      const response = await fetch(`${baseUrl}/api/v1/problems/${encodeURIComponent(problemId)}/solutions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          'X-User-Id': user.id,
        },
        body: JSON.stringify({ ...input, sourceType: 'USER_INPUT' }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok || body?.code !== 200) {
        throw new Error(body?.message || `发布失败 (${response.status})`);
      }
      setShowEditor(false);
      setSort('latest');
      await mutate();
    },
    [mutate, problemId, token, user?.id]
  );

  /** 处理"写题解"按钮点击 */
  const handleWriteClick = useCallback(() => {
    if (!isAuthenticated) {
      // 未登录时弹出登录提示（由全局拦截处理）
      alert('请先登录后再写题解');
      return;
    }
    setShowEditor(true);
  }, [isAuthenticated]);

  const solutions: Solution[] = (data?.content || []).map((item) => ({
    id: item.id,
    title: item.title,
    authorName: item.authorName || '匿名用户',
    source: item.sourceType === 'URL_IMPORT' ? 'url_import' : item.sourceType === 'FEYNMAN_OUTPUT' ? 'feynman' : 'original',
    featured: item.status === 'FEATURED',
    likeCount: item.upvotes ?? 0,
    commentCount: 0,
    summary: item.content?.slice(0, 100) || '',
    createdAt: item.createdAt,
  }));

  return (
    <div className={`space-y-4 ${className || ''}`}>
      {/* 顶部操作栏：排序 + 写题解 */}
      <div className="flex items-center justify-between">
        {/* 排序标签 */}
        <div className="flex items-center gap-1">
          {SORT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setSort(opt.value)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors
                ${sort === opt.value
                  ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
                  : 'text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'
                }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* 写题解按钮 */}
        <button
          onClick={handleWriteClick}
          className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white
                     hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
        >
          ✏️ 写题解
        </button>
      </div>

      {/* 题解编辑器（展开时显示） */}
      {showEditor && (
        <SolutionEditor
          problemId={problemId}
          onSubmit={handleSubmit}
          onCancel={() => setShowEditor(false)}
        />
      )}

      {/* 加载状态 */}
      {isLoading && (
        <div className="flex items-center justify-center py-8 text-gray-500">
          加载中...
        </div>
      )}

      {/* 错误状态 */}
      {error && !isLoading && (
        <div className="flex items-center justify-center py-8 text-red-500">
          加载失败：{error.message}
        </div>
      )}

      {/* 空状态 */}
      {!isLoading && !error && solutions.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 gap-2 animate-fade-in-up">
          <svg className="h-8 w-8 text-gray-300 dark:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="text-sm font-medium text-gray-400 dark:text-gray-500">暂无题解</p>
          <p className="text-xs text-gray-300 dark:text-gray-600">成为第一个分享题解的人吧</p>
        </div>
      )}

      {/* 题解列表 */}
      {!isLoading && !error && solutions.length > 0 && (
        <div className="space-y-3">
          {solutions.map((sol) => (
            <div key={sol.id}>
              <SolutionCard solution={sol} onClick={() => setExpandedId(expandedId === sol.id ? null : sol.id)} />
              {expandedId === sol.id && (
                <div className="rounded-b-lg border border-t-0 border-gray-200 p-4 dark:border-gray-700">
                  <MarkdownRenderer content={data?.content.find((item) => item.id === sol.id)?.content || ''} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
