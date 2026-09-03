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

/** 排序选项 */
type SortOption = 'featured' | 'newest' | 'hot';

/** 分页响应 */
interface SolutionPage {
  content: Solution[];
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
  { value: 'newest', label: '最新' },
  { value: 'hot', label: '最热' },
];

export default function SolutionList({ problemId, className }: SolutionListProps) {
  const { isAuthenticated } = useAppStore();
  const [sort, setSort] = useState<SortOption>('featured');
  const [showEditor, setShowEditor] = useState(false);

  // 根据排序选项构建请求 URL
  const apiUrl = `/api/v1/problems/${problemId}/solutions?page=0&size=10&sort=${sort}`;
  const { data, error, isLoading, mutate } = useSWR<SolutionPage>(apiUrl, fetcher);

  /** 处理题解提交 */
  const handleSubmit = useCallback(
    async () => {
      // TODO: 调用 POST /api/v1/problems/{problemId}/solutions 接口
      setShowEditor(false);
      mutate(); // 刷新列表
    },
    [mutate]
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

  const solutions = data?.content || [];

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
        <div className="flex flex-col items-center justify-center py-12 text-gray-400">
          <p className="text-sm">暂无题解</p>
          <p className="mt-1 text-xs">成为第一个分享题解的人吧</p>
        </div>
      )}

      {/* 题解列表 */}
      {!isLoading && solutions.length > 0 && (
        <div className="space-y-3">
          {solutions.map((sol) => (
            <SolutionCard
              key={sol.id}
              solution={sol}
              onClick={() => {
                // TODO: 跳转到题解详情页或展开内容
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
