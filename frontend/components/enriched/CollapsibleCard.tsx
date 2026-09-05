'use client';

/**
 * CollapsibleCard - 解析卡片组件（收起/展开）
 *
 * 收起态：标题、摘要(max 2行)、SourceBadge、标签、★热度、quality_score、箭头▶
 * 展开态：Tab（📖 解析 / ▶ 走流程 / 📊 图解 / 💻 代码）、复杂度、操作栏
 * 加载态：骨架屏
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import SourceBadge, { type SourceType } from './SourceBadge';
import ComplexityInfo from './ComplexityInfo';
import ActionBar, { type VoteState } from './ActionBar';
import { DetailSkeleton } from './SkeletonLoader';
import CodeBlock from '@/components/CodeBlock';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import dynamic from 'next/dynamic';

// 走流程播放器懒加载（避免 SSR 问题）
const WalkThroughPlayer = dynamic(
  () => import('@/components/walkthrough/WalkThroughPlayer'),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-32 text-gray-400 text-sm">
        加载走流程组件...
      </div>
    ),
  }
);

type ContentTab = 'analysis' | 'walkthrough' | 'code';
const TAB_CONFIG: { id: ContentTab; label: string; icon: string }[] = [
  { id: 'analysis',    label: '解析',  icon: '📖' },
  { id: 'walkthrough', label: '走流程', icon: '▶' },
  { id: 'code',        label: '代码',  icon: '💻' },
];

/** 卡片数据接口 */
export interface EnrichedCardData {
  id: string;
  problemId?: string;   // 题目 ID（用于走流程、图解 API）
  title: string;
  summary?: string;
  content?: string;
  codeImplementations?: string | null;
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
  const [activeTab, setActiveTab] = useState<ContentTab>('analysis');
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
              {/* ── Tab 导航 ── */}
              <div className="flex gap-1 border-b border-gray-100 dark:border-gray-800 -mx-1 px-1">
                {TAB_CONFIG.map(tab => {
                  // 代码 tab 仅在有 codeImplementations 时显示
                  if (tab.id === 'code' && !detail.codeImplementations) return null;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveTab(tab.id)}
                      className={[
                        'flex items-center gap-1 px-3 py-2 text-xs font-medium rounded-t-md',
                        'transition-colors duration-150 focus:outline-none',
                        'focus-visible:ring-2 focus-visible:ring-blue-400',
                        activeTab === tab.id
                          ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-500 -mb-px bg-white dark:bg-gray-900'
                          : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200',
                      ].join(' ')}
                      aria-selected={activeTab === tab.id}
                      role="tab"
                    >
                      <span>{tab.icon}</span>
                      <span>{tab.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* ── Tab 内容区 ── */}

              {/* 📖 解析 Tab */}
              {activeTab === 'analysis' && (
                <div className="animate-fade-in">
                  {detail.content && (
                    <div className="prose prose-sm prose-gray dark:prose-invert max-w-none
                      prose-headings:font-semibold prose-headings:text-gray-900 dark:prose-headings:text-gray-100
                      prose-code:before:content-none prose-code:after:content-none
                      prose-code:rounded prose-code:bg-gray-100 dark:prose-code:bg-gray-800
                      prose-code:px-1 prose-code:py-0.5 prose-code:text-sm prose-code:font-mono
                      prose-pre:bg-gray-900 prose-pre:rounded-lg prose-pre:p-4
                      prose-blockquote:border-blue-400 prose-blockquote:text-gray-600 dark:prose-blockquote:text-gray-400">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {detail.content}
                      </ReactMarkdown>
                    </div>
                  )}
                  {!detail.content && detail.codeImplementations && (
                    <CodeImplBlock raw={detail.codeImplementations} />
                  )}
                  <ComplexityInfo
                    timeComplexity={detail.timeComplexity}
                    spaceComplexity={detail.spaceComplexity}
                    className="mt-3"
                  />
                </div>
              )}

              {/* ▶ 走流程 Tab */}
              {activeTab === 'walkthrough' && (
                <div className="animate-fade-in">
                  <WalkThroughPlayer
                    problemId={data.problemId ?? data.id}
                    level={data.level}
                  />
                </div>
              )}

              {/* 💻 代码 Tab */}
              {activeTab === 'code' && detail.codeImplementations && (
                <div className="animate-fade-in">
                  <CodeImplBlock raw={detail.codeImplementations} />
                </div>
              )}

              {/* 操作栏（所有 Tab 都显示） */}
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


/**
 * CodeImplBlock - 渲染 codeImplementations JSON 字段
 * 格式：{"python": "...", "java": "...", "cpp": "...", "go": "..."}
 */
function CodeImplBlock({ raw }: { raw: string }) {
  let parsed: Record<string, string> = {};
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  // 过滤掉空值和明显的错误信息（kiro-cli 有时输出 tool 警告）
  const langs = Object.entries(parsed)
    .filter(([, code]) => code && code.length > 10 && !code.includes('Not all mcp servers'))
    .reduce<Record<string, string>>((acc, [lang, code]) => {
      // 去掉代码块首行的语言标记（如 "python\n" 开头）
      const cleaned = code.replace(/^\s*\w+\n/, '').trim();
      acc[lang] = cleaned;
      return acc;
    }, {});

  if (Object.keys(langs).length === 0) return null;

  return (
    <div className="space-y-2 animate-fade-in-up">
      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">代码实现</p>
      <CodeBlock code={langs} className="my-2" />
    </div>
  );
}
