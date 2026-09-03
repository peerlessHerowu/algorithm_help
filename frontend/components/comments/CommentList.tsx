'use client';

/**
 * 评论列表组件
 * 集成 CommentInput 和 CommentItem，支持分类颜色边框
 * 支持按点赞数/时间排序
 */

import { useState } from 'react';
import useSWR from 'swr';
import { fetcher } from '@/lib/fetcher';
import CommentInput from './CommentInput';
import CommentItem, { CommentData } from './CommentItem';

/** 排序方式 */
type SortBy = 'likes' | 'createdAt';

/** 后端评论分页响应 */
interface CommentPage {
  content: CommentData[];
  totalElements: number;
  totalPages: number;
}

interface CommentListProps {
  /** 评论目标类型（PROBLEM、SOLUTION 等） */
  targetType: string;
  /** 评论目标 ID */
  targetId: string;
  /** 自定义样式 */
  className?: string;
}

export default function CommentList({
  targetType,
  targetId,
  className = '',
}: CommentListProps) {
  const [sortBy, setSortBy] = useState<SortBy>('createdAt');
  const [page, setPage] = useState(0);

  /** SWR 获取评论列表 */
  const { data, error, isLoading, mutate } = useSWR<CommentPage>(
    `/api/v1/comments?targetType=${targetType}&targetId=${targetId}&page=${page}&size=20&sort=${sortBy}`,
    fetcher
  );

  const comments = data?.content || [];
  const totalPages = data?.totalPages || 0;

  /** 分离顶层评论和回复，构建嵌套结构 */
  function buildNestedComments(flat: CommentData[]): CommentData[] {
    const map = new Map<string, CommentData>();
    const roots: CommentData[] = [];

    // 初始化：为每条评论设置空的回复列表
    flat.forEach((c) => {
      map.set(c.id, { ...c, replies: [] });
    });

    // 构建树形结构
    flat.forEach((c) => {
      const node = map.get(c.id)!;
      if (c.parentId && map.has(c.parentId)) {
        map.get(c.parentId)!.replies!.push(node);
      } else {
        roots.push(node);
      }
    });

    return roots;
  }

  const nestedComments = buildNestedComments(comments);

  return (
    <div className={`space-y-6 ${className}`}>
      {/* 评论输入区 */}
      <CommentInput
        targetType={targetType}
        targetId={targetId}
        onSubmitSuccess={() => mutate()}
      />

      {/* 排序栏 */}
      <div className="flex items-center justify-between border-b border-gray-100 pb-2 dark:border-gray-800">
        <span className="text-sm text-gray-500 dark:text-gray-400">
          {data ? `${data.totalElements} 条评论` : ''}
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => { setSortBy('createdAt'); setPage(0); }}
            className={`text-xs px-2 py-1 rounded transition-colors
              ${sortBy === 'createdAt'
                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                : 'text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'
              }`}
          >
            最新
          </button>
          <button
            type="button"
            onClick={() => { setSortBy('likes'); setPage(0); }}
            className={`text-xs px-2 py-1 rounded transition-colors
              ${sortBy === 'likes'
                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                : 'text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'
              }`}
          >
            最热
          </button>
        </div>
      </div>

      {/* 加载状态 */}
      {isLoading && (
        <div className="flex items-center justify-center py-8 text-gray-500 dark:text-gray-400">
          <span className="animate-pulse">加载评论中...</span>
        </div>
      )}

      {/* 错误状态 */}
      {error && !isLoading && (
        <div className="flex items-center justify-center py-8 text-red-500">
          加载失败：{error.message}
          <button
            type="button"
            onClick={() => mutate()}
            className="ml-2 text-blue-600 hover:underline dark:text-blue-400"
          >
            重试
          </button>
        </div>
      )}

      {/* 空状态 */}
      {!isLoading && !error && nestedComments.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 gap-2 animate-fade-in-up">
          <svg className="h-8 w-8 text-gray-300 dark:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          <p className="text-sm text-gray-400 dark:text-gray-500">暂无评论，来发表第一条吧</p>
        </div>
      )}

      {/* 评论列表 */}
      {!isLoading && nestedComments.length > 0 && (
        <div className="space-y-3">
          {nestedComments.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              targetType={targetType}
              targetId={targetId}
              onRefresh={() => mutate()}
            />
          ))}
        </div>
      )}

      {/* 分页 */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-4">
          <button
            type="button"
            disabled={page === 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            className="rounded px-3 py-1 text-xs text-gray-600 hover:bg-gray-100 disabled:opacity-40 dark:text-gray-400 dark:hover:bg-gray-800"
          >
            ← 上一页
          </button>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {page + 1} / {totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages - 1}
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            className="rounded px-3 py-1 text-xs text-gray-600 hover:bg-gray-100 disabled:opacity-40 dark:text-gray-400 dark:hover:bg-gray-800"
          >
            下一页 →
          </button>
        </div>
      )}
    </div>
  );
}
