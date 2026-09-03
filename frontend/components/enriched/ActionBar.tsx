'use client';

/**
 * ActionBar - 展开态底部操作栏
 * 包含：👍 点赞 / 👎 踩 / 💬 评论 / 📋 复制 / 🔗 分享 / 🐛 纠错
 *
 * - 未登录点击 👍/👎 弹出登录引导
 * - 👎 计数仅管理员可见
 * - L1 级别显示"复制全文"代替"复制"
 * - 💬 跳转全局评论 Tab
 */

import { useCallback, useState } from 'react';

/** 投票状态 */
export type VoteState = 'UP' | 'DOWN' | 'NONE';

interface ActionBarProps {
  /** 点赞数 */
  upvoteCount: number;
  /** 踩数 */
  downvoteCount: number;
  /** 评论数 */
  commentCount?: number;
  /** 当前用户投票状态 */
  voteState: VoteState;
  /** 当前级别 */
  level: number;
  /** 是否为管理员（管理员可见踩计数） */
  isAdmin?: boolean;
  /** 是否已登录 */
  isLoggedIn?: boolean;
  /** enriched solution 的完整 Markdown 内容（用于复制全文） */
  fullMarkdown?: string;
  /** 分享链接 */
  shareUrl?: string;

  // 回调函数
  onUpvote?: () => void;
  onDownvote?: () => void;
  onComment?: () => void;
  onCopyCode?: () => void;
  onShare?: () => void;
  onReport?: () => void;
  onLoginRequired?: (intent: string) => void;
  /** 自定义类名 */
  className?: string;
}

export default function ActionBar({
  upvoteCount,
  downvoteCount,
  commentCount,
  voteState,
  level,
  isAdmin = false,
  isLoggedIn = false,
  fullMarkdown,
  shareUrl,
  onUpvote,
  onDownvote,
  onComment,
  onCopyCode,
  onShare,
  onReport,
  onLoginRequired,
  className,
}: ActionBarProps) {
  const [copyToast, setCopyToast] = useState(false);

  /** 点赞处理：未登录弹窗，已登录执行 */
  const handleUpvote = useCallback(() => {
    if (!isLoggedIn) {
      onLoginRequired?.('upvote');
      return;
    }
    onUpvote?.();
  }, [isLoggedIn, onUpvote, onLoginRequired]);

  /** 踩处理 */
  const handleDownvote = useCallback(() => {
    if (!isLoggedIn) {
      onLoginRequired?.('downvote');
      return;
    }
    onDownvote?.();
  }, [isLoggedIn, onDownvote, onLoginRequired]);

  /** 复制处理：L1 复制全文，其他复制代码 */
  const handleCopy = useCallback(async () => {
    if (level === 1 && fullMarkdown) {
      await navigator.clipboard.writeText(fullMarkdown);
    } else {
      onCopyCode?.();
      return;
    }
    setCopyToast(true);
    setTimeout(() => setCopyToast(false), 2000);
  }, [level, fullMarkdown, onCopyCode]);

  /** 分享：复制直达链接 */
  const handleShare = useCallback(async () => {
    const url = shareUrl || window.location.href;
    await navigator.clipboard.writeText(url);
    onShare?.();
    setCopyToast(true);
    setTimeout(() => setCopyToast(false), 2000);
  }, [shareUrl, onShare]);

  /** 复制按钮文案 */
  const copyLabel = level === 1 ? '📋 复制全文' : '📋 复制';

  return (
    <div className={`flex flex-wrap items-center gap-1 ${className || ''}`}>
      {/* 👍 点赞 */}
      <ActionButton
        active={voteState === 'UP'}
        activeClass="text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20"
        onClick={handleUpvote}
      >
        👍 {upvoteCount > 0 && <span className="ml-0.5">{upvoteCount}</span>}
      </ActionButton>

      {/* 👎 踩 */}
      <ActionButton
        active={voteState === 'DOWN'}
        activeClass="text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-900/20"
        onClick={handleDownvote}
      >
        👎 {isAdmin && downvoteCount > 0 && <span className="ml-0.5">{downvoteCount}</span>}
      </ActionButton>

      {/* 💬 评论 */}
      <ActionButton onClick={onComment}>
        💬 {commentCount != null && commentCount > 0 && <span className="ml-0.5">{commentCount}</span>}
      </ActionButton>

      {/* 📋 复制 */}
      <ActionButton onClick={handleCopy}>
        {copyLabel}
      </ActionButton>

      {/* 🔗 分享 */}
      <ActionButton onClick={handleShare}>
        🔗 分享
      </ActionButton>

      {/* 🐛 纠错 */}
      <ActionButton onClick={onReport}>
        🐛 纠错
      </ActionButton>

      {/* 复制成功提示 */}
      {copyToast && (
        <span className="ml-2 text-xs text-green-600 dark:text-green-400 animate-fade-in">
          ✓ 已复制
        </span>
      )}
    </div>
  );
}

// ============ 内部按钮组件 ============

interface ActionButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  active?: boolean;
  activeClass?: string;
}

function ActionButton({ children, onClick, active, activeClass }: ActionButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-0.5 rounded-md px-2.5 py-1.5 text-xs font-medium
        transition-all duration-150
        ${active
          ? activeClass || 'text-blue-600 bg-blue-50'
          : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
        }
        hover:scale-105 active:scale-95`}
    >
      {children}
    </button>
  );
}
