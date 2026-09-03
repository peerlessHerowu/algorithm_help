'use client';

/**
 * CollapsibleCard - 解析卡片组件（收起/展开）
 *
 * 收起态：标题、摘要(max 2行)、SourceBadge、标签、★热度、quality_score、箭头▶
 * 展开态：完整 Markdown 内容、代码 Tab、复杂度、操作栏、箭头▼
 * 加载态：骨架屏
 *
 * 交互：
 * - 展开/收起 350ms spring 高度动画
 * - 箭头 250ms 旋转动画
 * - hover: shadow-md + scale(1.005)
 * - active: scale(0.98) + opacity(0.9)
 * - 推荐卡片：金色边框 border-amber-400
 * - COMMUNITY 来源：底部版权标注
 * - DOMPurify sanitize 渲染内容
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import SourceBadge, { type SourceType } from './SourceBadge';
import ComplexityInfo from './ComplexityInfo';
import ActionBar, { type VoteState } from './ActionBar';
import { DetailSkeleton } from './SkeletonLoader';
import { sanitizeHtml } from '@/lib/sanitize';

/** 卡片数据接口 */
export interface EnrichedCardData {
  id: string;
  title: string;
  summary?: string;
  content?: string;
  tags?: string[];
  sourceType: SourceType;
  sourceVotes?: number | null;
  sourceAuthor?: string | null;
  sourceUrl?: string | null;
  timeComplexity?: string | null;
  spaceComplexity?: string | null;
  qualityScore?: number;
  recommended?: boolean;
  level: number;
  upvoteCount: number;
  downvoteCount: number;
}

interface CollapsibleCardProps {
  /** 卡片数据 */
  data: EnrichedCardData;
  /** 是否展开 */
  expanded?: boolean;
  /** 展开/收起切换回调 */
  onToggle?: (id: string) => void;
  /** 加载详情的异步函数（lazy load） */
  onLoadDetail?: (id: string) => Promise<EnrichedCardData | null>;
  /** 投票回调 */
  onUpvote?: (id: string) => void;
  onDownvote?: (id: string) => void;
  /** 💬 评论跳转 */
  onComment?: (id: string) => void;
  /** 🐛 纠错 */
  onReport?: (id: string) => void;
  /** 🔗 分享链接 */
  shareUrl?: string;
  /** 用户投票状态 */
  voteState?: VoteState;
  /** 评论数 */
  commentCount?: number;
  /** 是否管理员 */
  isAdmin?: boolean;
  /** 是否已登录 */
  isLoggedIn?: boolean;
  /** 未登录时触发 */
  onLoginRequired?: (intent: string) => void;
  /** 自定义类名 */
  className?: string;
  /** 键盘聚焦状态 */
  isFocused?: boolean;
}

/** 会话缓存：避免重复请求详情 */
const detailCache = new Map<string, EnrichedCardData>();

export default function CollapsibleCard({
  data,
  expanded = false,
  onToggle,
  onLoadDetail,
  onUpvote,
  onDownvote,
  onComment,
  onReport,
  shareUrl,
  voteState = 'NONE',
  commentCount,
  isAdmin = false,
  isLoggedIn = false,
  onLoginRequired,
  className,
  isFocused = false,
}: CollapsibleCardProps) {
  const [isExpanded, setIsExpanded] = useState(expanded);
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState<EnrichedCardData | null>(
    data.content ? data : null
  );
  const contentRef = useRef<HTMLDivElement>(null);
  const [contentHeight, setContentHeight] = useState(0);

  // 同步外部 expanded 状态
  useEffect(() => {
    setIsExpanded(expanded);
  }, [expanded]);

  // 展开时测量内容高度（用于动画）
  useEffect(() => {
    if (isExpanded && contentRef.current) {
      setContentHeight(contentRef.current.scrollHeight);
    }
  }, [isExpanded, detail]);

  /** 切换展开/收起，首次展开时 lazy load 详情 */
  const handleToggle = useCallback(async () => {
    const next = !isExpanded;
    setIsExpanded(next);
    onToggle?.(data.id);

    if (next && !detail && onLoadDetail) {
      // 先检查会话缓存
      const cached = detailCache.get(data.id);
      if (cached) {
        setDetail(cached);
        return;
      }
      // lazy load
      setLoading(true);
      try {
        const result = await onLoadDetail(data.id);
        if (result) {
          detailCache.set(data.id, result);
          setDetail(result);
        }
      } finally {
        setLoading(false);
      }
    }
  }, [isExpanded, detail, data.id, onLoadDetail, onToggle]);

  /** 推荐卡片边框样式 */
  const borderClass = data.recommended
    ? 'border-2 border-amber-400 dark:border-amber-500'
    : 'border border-gray-200 dark:border-gray-700';

  /** quality_score 展示格式化 */
  const scoreDisplay = data.qualityScore != null
    ? `${(data.qualityScore * 100).toFixed(0)}分`
    : null;

  /** 键盘聚焦时的 focus ring */
  const focusRingClass = isFocused
    ? 'ring-2 ring-blue-500 ring-offset-2 dark:ring-offset-gray-900'
    : '';

  return (
    <div
      data-card-id={data.id}
      className={`group relative rounded-xl ${borderClass} ${focusRingClass} bg-white dark:bg-gray-900
        transition-all duration-200 ease-out
        hover:shadow-md hover:scale-[1.005]
        active:scale-[0.98] active:opacity-90
        ${className || ''}`}
    >
      {/* 推荐标记 */}
      {data.recommended && (
        <span className="absolute -top-2.5 left-4 rounded-full bg-amber-400 px-2 py-0.5
          text-[10px] font-bold text-white shadow-sm">
          推荐
        </span>
      )}

      {/* 收起态头部（始终可见） */}
      <button
        type="button"
        onClick={handleToggle}
        className="flex w-full items-start gap-3 p-4 text-left focus:outline-none
          focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2
          rounded-xl"
        aria-expanded={isExpanded}
      >
        {/* 箭头指示器：250ms 旋转动画 */}
        <span
          className="mt-1 flex-shrink-0 text-gray-400 dark:text-gray-500
            transition-transform duration-[250ms] ease-out"
          style={{ transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}
        >
          ▶
        </span>

        {/* 标题区 */}
        <div className="flex-1 min-w-0">
          {/* 第一行：标题 + 来源胶囊 + 热度 */}
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
              {data.title}
            </h3>
            <SourceBadge
              sourceType={data.sourceType}
              sourceVotes={data.sourceVotes}
            />
            {scoreDisplay && (
              <span className="text-[10px] text-gray-400 dark:text-gray-500">
                {scoreDisplay}
              </span>
            )}
          </div>

          {/* 第二行：摘要（最多 2 行） */}
          {data.summary && !isExpanded && (
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 line-clamp-2">
              {data.summary}
            </p>
          )}

          {/* 第三行：标签 */}
          {(() => {
            const tags = Array.isArray(data.tags) ? data.tags
              : typeof data.tags === 'string' ? (() => { try { return JSON.parse(data.tags); } catch { return []; } })()
              : [];
            return tags.length > 0 && !isExpanded ? (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {tags.slice(0, 5).map((tag: string) => (
                <span
                  key={tag}
                  className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px]
                    text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                >
                  {tag}
                </span>
              ))}
              {tags.length > 5 && (
                <span className="text-[10px] text-gray-400">+{tags.length - 5}</span>
              )}
            </div>
            ) : null;
          })()}
        </div>
      </button>

      {/* 展开态内容区：350ms spring 高度动画 */}
      <div
        className="overflow-hidden transition-all duration-[350ms] ease-[cubic-bezier(0.25,0.1,0.25,1.5)]"
        style={{
          maxHeight: isExpanded ? `${contentHeight + 200}px` : '0px',
          opacity: isExpanded ? 1 : 0,
        }}
      >
        <div ref={contentRef} className="px-4 pb-4">
          {/* 加载态骨架屏 */}
          {loading && <DetailSkeleton />}

          {/* 展开内容 */}
          {!loading && detail && (
            <div className="space-y-3">
              {/* Markdown 正文（DOMPurify sanitize） */}
              <div
                className="prose prose-sm prose-gray dark:prose-invert max-w-none"
                dangerouslySetInnerHTML={{
                  __html: sanitizeHtml(detail.content || ''),
                }}
              />

              {/* 复杂度标注区 */}
              <ComplexityInfo
                timeComplexity={detail.timeComplexity}
                spaceComplexity={detail.spaceComplexity}
                className="mt-3"
              />

              {/* 操作栏 */}
              <ActionBar
                upvoteCount={detail.upvoteCount}
                downvoteCount={detail.downvoteCount}
                commentCount={commentCount}
                voteState={voteState}
                level={data.level}
                isAdmin={isAdmin}
                isLoggedIn={isLoggedIn}
                fullMarkdown={detail.content}
                shareUrl={shareUrl}
                onUpvote={() => onUpvote?.(data.id)}
                onDownvote={() => onDownvote?.(data.id)}
                onComment={() => onComment?.(data.id)}
                onReport={() => onReport?.(data.id)}
                onLoginRequired={onLoginRequired}
                className="mt-2 border-t border-gray-100 pt-3 dark:border-gray-800"
              />

              {/* 版权标注（COMMUNITY 来源） */}
              {detail.sourceType === 'COMMUNITY' && detail.sourceAuthor && (
                <div className="mt-2 text-[11px] text-gray-400 dark:text-gray-500">
                  基于{' '}
                  {detail.sourceUrl ? (
                    <a
                      href={detail.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline hover:text-gray-600 dark:hover:text-gray-300"
                      onClick={(e) => e.stopPropagation()}
                    >
                      @{detail.sourceAuthor}
                    </a>
                  ) : (
                    <span>@{detail.sourceAuthor}</span>
                  )}{' '}
                  的题解丰富
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

