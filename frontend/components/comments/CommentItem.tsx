'use client';

/**
 * 单条评论组件
 * 支持嵌套回复（最多 2 层）、类型颜色边框、点赞操作
 * 纠错评论红色高亮、补充评论提供"展开为题解"快捷按钮
 */

import { useState } from 'react';
import { useAppStore } from '@/store';
import CommentInput, { CommentType } from './CommentInput';

/** 评论数据接口 */
export interface CommentData {
  id: string;
  userId: string;
  nickname: string;
  content: string;
  type: CommentType;
  parentId?: string | null;
  likes: number;
  createdAt: number;
  /** 嵌套回复列表 */
  replies?: CommentData[];
}

/** 评论类型对应的边框颜色 */
const TYPE_BORDER_MAP: Record<CommentType, string> = {
  NORMAL: 'border-gray-200 dark:border-gray-700',
  CORRECTION: 'border-red-300 dark:border-red-700',
  SUPPLEMENT: 'border-green-300 dark:border-green-700',
  QUESTION: 'border-purple-300 dark:border-purple-700',
};

/** 评论类型对应的背景色（纠错红色高亮） */
const TYPE_BG_MAP: Record<CommentType, string> = {
  NORMAL: 'bg-white dark:bg-gray-900',
  CORRECTION: 'bg-red-50/50 dark:bg-red-900/10',
  SUPPLEMENT: 'bg-green-50/30 dark:bg-green-900/10',
  QUESTION: 'bg-purple-50/30 dark:bg-purple-900/10',
};

/** 评论类型标签 */
const TYPE_LABEL_MAP: Record<CommentType, { icon: string; text: string; color: string }> = {
  NORMAL: { icon: '💬', text: '普通', color: 'text-gray-500 bg-gray-100 dark:bg-gray-800 dark:text-gray-400' },
  CORRECTION: { icon: '🐛', text: '纠错', color: 'text-red-600 bg-red-100 dark:bg-red-900/30 dark:text-red-400' },
  SUPPLEMENT: { icon: '➕', text: '补充', color: 'text-green-600 bg-green-100 dark:bg-green-900/30 dark:text-green-400' },
  QUESTION: { icon: '❓', text: '提问', color: 'text-purple-600 bg-purple-100 dark:bg-purple-900/30 dark:text-purple-400' },
};

interface CommentItemProps {
  /** 评论数据 */
  comment: CommentData;
  /** 评论目标类型（传递给回复输入框） */
  targetType: string;
  /** 评论目标 ID（传递给回复输入框） */
  targetId: string;
  /** 嵌套层级（控制最大嵌套深度） */
  depth?: number;
  /** 刷新列表的回调 */
  onRefresh?: () => void;
  /** 自定义样式 */
  className?: string;
}

export default function CommentItem({
  comment,
  targetType,
  targetId,
  depth = 0,
  onRefresh,
  className = '',
}: CommentItemProps) {
  const { isAuthenticated } = useAppStore();
  const [showReply, setShowReply] = useState(false);
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(comment.likes || 0);

  const typeLabel = TYPE_LABEL_MAP[comment.type] || TYPE_LABEL_MAP.NORMAL;
  const borderClass = TYPE_BORDER_MAP[comment.type] || TYPE_BORDER_MAP.NORMAL;
  const bgClass = TYPE_BG_MAP[comment.type] || TYPE_BG_MAP.NORMAL;

  /** 格式化时间戳 */
  function formatTime(ts: number): string {
    const now = Date.now();
    const diff = now - ts;
    if (diff < 60_000) return '刚刚';
    if (diff < 3600_000) return `${Math.floor(diff / 60_000)} 分钟前`;
    if (diff < 86400_000) return `${Math.floor(diff / 3600_000)} 小时前`;
    return new Date(ts).toLocaleDateString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  /** 点赞操作 */
  async function handleLike() {
    if (!isAuthenticated) return;
    // 乐观更新
    setLiked(!liked);
    setLikeCount((prev) => (liked ? prev - 1 : prev + 1));

    try {
      const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8080';
      const token = useAppStore.getState().token;
      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      await fetch(`${BASE_URL}/api/v1/comments/${comment.id}/like`, {
        method: 'POST',
        headers,
      });
    } catch {
      // 失败时回滚
      setLiked(liked);
      setLikeCount(comment.likes || 0);
    }
  }

  /** 补充评论"展开为题解"快捷操作 */
  function handleExpandToSolution() {
    // 跳转到题解编辑器，携带评论内容作为初始内容
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams({
        targetId,
        fromComment: comment.id,
        content: comment.content,
      });
      window.location.href = `/problems/${targetId}?tab=solutions&action=create&${params.toString()}`;
    }
  }

  return (
    <div className={`rounded-lg border-l-4 ${borderClass} ${bgClass} p-4 ${className}`}>
      {/* 评论头部：昵称 + 类型标签 + 时间 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-800 dark:text-gray-200">
            {comment.nickname || '匿名用户'}
          </span>
          <span className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-medium ${typeLabel.color}`}>
            <span>{typeLabel.icon}</span>
            <span>{typeLabel.text}</span>
          </span>
        </div>
        <span className="text-xs text-gray-400 dark:text-gray-500">
          {formatTime(comment.createdAt)}
        </span>
      </div>

      {/* 评论正文 */}
      <p className="mt-2 text-sm leading-relaxed text-gray-700 dark:text-gray-300">
        {comment.content}
      </p>

      {/* 纠错评论自动通知提示 */}
      {comment.type === 'CORRECTION' && (
        <p className="mt-1 text-xs text-red-500 dark:text-red-400">
          📢 已自动通知作者/管理员审核此纠错
        </p>
      )}

      {/* 操作栏：点赞 + 回复 + 补充评论展开为题解 */}
      <div className="mt-3 flex items-center gap-4">
        {/* 点赞 */}
        <button
          type="button"
          onClick={handleLike}
          className={`inline-flex items-center gap-1 text-xs transition-colors
            ${liked
              ? 'text-blue-600 dark:text-blue-400'
              : 'text-gray-400 hover:text-blue-600 dark:text-gray-500 dark:hover:text-blue-400'
            }`}
        >
          <span>{liked ? '👍' : '👍🏻'}</span>
          <span>{likeCount > 0 ? likeCount : ''}</span>
        </button>

        {/* 回复按钮（最多 2 层嵌套） */}
        {depth < 2 && (
          <button
            type="button"
            onClick={() => setShowReply(!showReply)}
            className="text-xs text-gray-400 hover:text-blue-600 dark:text-gray-500 dark:hover:text-blue-400"
          >
            💭 回复
          </button>
        )}

        {/* 补充评论"展开为题解"快捷按钮 */}
        {comment.type === 'SUPPLEMENT' && (
          <button
            type="button"
            onClick={handleExpandToSolution}
            className="text-xs text-green-600 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300"
          >
            📖 展开为题解
          </button>
        )}
      </div>

      {/* 回复输入框 */}
      {showReply && (
        <div className="mt-3 pl-4 border-l-2 border-gray-200 dark:border-gray-700">
          <CommentInput
            targetType={targetType}
            targetId={targetId}
            parentId={comment.id}
            placeholder={`回复 ${comment.nickname || '匿名用户'}...`}
            onSubmitSuccess={() => {
              setShowReply(false);
              onRefresh?.();
            }}
            onCancel={() => setShowReply(false)}
          />
        </div>
      )}

      {/* 嵌套回复列表 */}
      {comment.replies && comment.replies.length > 0 && (
        <div className="mt-3 space-y-2 pl-4 border-l-2 border-gray-100 dark:border-gray-800">
          {comment.replies.map((reply) => (
            <CommentItem
              key={reply.id}
              comment={reply}
              targetType={targetType}
              targetId={targetId}
              depth={depth + 1}
              onRefresh={onRefresh}
            />
          ))}
        </div>
      )}
    </div>
  );
}
