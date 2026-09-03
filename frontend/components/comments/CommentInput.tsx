'use client';

/**
 * 评论输入组件
 * 支持四种评论类型选择：普通💬、纠错🐛、补充➕、提问❓
 * 提交评论到后端 API
 */

import { useState } from 'react';
import { useAppStore } from '@/store';

/** 评论类型定义 */
export type CommentType = 'NORMAL' | 'CORRECTION' | 'SUPPLEMENT' | 'QUESTION';

/** 评论类型配置 */
const COMMENT_TYPE_OPTIONS: {
  value: CommentType;
  label: string;
  icon: string;
  description: string;
}[] = [
  { value: 'NORMAL', label: '普通', icon: '💬', description: '发表看法' },
  { value: 'CORRECTION', label: '纠错', icon: '🐛', description: '指出错误' },
  { value: 'SUPPLEMENT', label: '补充', icon: '➕', description: '补充内容' },
  { value: 'QUESTION', label: '提问', icon: '❓', description: '提出疑问' },
];

/** Props 接口 */
interface CommentInputProps {
  /** 评论目标类型（如 PROBLEM、SOLUTION 等） */
  targetType: string;
  /** 评论目标 ID */
  targetId: string;
  /** 回复的父评论 ID（可选，用于嵌套回复） */
  parentId?: string;
  /** 提交成功后的回调 */
  onSubmitSuccess?: () => void;
  /** 取消回复的回调（可选） */
  onCancel?: () => void;
  /** 占位文字 */
  placeholder?: string;
  /** 自定义样式 */
  className?: string;
}

export default function CommentInput({
  targetType,
  targetId,
  parentId,
  onSubmitSuccess,
  onCancel,
  placeholder = '写下你的评论...',
  className = '',
}: CommentInputProps) {
  const { isAuthenticated } = useAppStore();
  const [content, setContent] = useState('');
  const [commentType, setCommentType] = useState<CommentType>('NORMAL');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** 提交评论 */
  async function handleSubmit() {
    if (!content.trim()) return;
    if (!isAuthenticated) {
      setError('请先登录后再发表评论');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8080';
      const token = useAppStore.getState().token;
      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`${BASE_URL}/api/v1/comments`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          targetType,
          targetId,
          parentId: parentId || null,
          content: content.trim(),
          type: commentType,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.message || `提交失败 (${res.status})`);
      }

      // 提交成功：清空输入并通知父组件
      setContent('');
      setCommentType('NORMAL');
      onSubmitSuccess?.();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '提交失败，请重试');
    } finally {
      setSubmitting(false);
    }
  }

  // 未登录提示
  if (!isAuthenticated) {
    return (
      <div className={`rounded-lg border border-gray-200 bg-gray-50 p-4 text-center dark:border-gray-700 dark:bg-gray-800 ${className}`}>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          请先 <a href="/auth/login" className="text-blue-600 hover:underline dark:text-blue-400">登录</a> 后发表评论
        </p>
      </div>
    );
  }

  return (
    <div className={`space-y-3 ${className}`}>
      {/* 类型选择栏 */}
      <div className="flex flex-wrap gap-2">
        {COMMENT_TYPE_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => setCommentType(opt.value)}
            title={opt.description}
            className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium transition-colors
              ${commentType === opt.value
                ? 'bg-blue-100 text-blue-700 ring-1 ring-blue-300 dark:bg-blue-900/40 dark:text-blue-300 dark:ring-blue-700'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700'
              }`}
          >
            <span>{opt.icon}</span>
            <span>{opt.label}</span>
          </button>
        ))}
      </div>

      {/* 输入框 */}
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder={placeholder}
        rows={3}
        className="w-full resize-none rounded-lg border border-gray-200 bg-white p-3 text-sm
                   placeholder-gray-400 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400
                   dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:placeholder-gray-500
                   dark:focus:border-blue-600 dark:focus:ring-blue-600"
      />

      {/* 错误提示 */}
      {error && (
        <p className="text-xs text-red-500">{error}</p>
      )}

      {/* 操作按钮 */}
      <div className="flex items-center justify-end gap-2">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
          >
            取消
          </button>
        )}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting || !content.trim()}
          className="rounded-lg bg-blue-600 px-4 py-1.5 text-xs font-medium text-white
                     hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50
                     dark:bg-blue-700 dark:hover:bg-blue-600"
        >
          {submitting ? '提交中...' : '发表评论'}
        </button>
      </div>
    </div>
  );
}
