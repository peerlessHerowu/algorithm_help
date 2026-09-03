'use client';

/**
 * RawSolutionList - 原始题解列表组件
 *
 * 收起态显示：标题、作者(@author)、发布时间、点赞数(★)、浏览数、语言标签
 * 排序切换：按点赞排序(默认) / 按时间排序
 * 语言筛选下拉：Python/Java/Go/C++ 等
 * 分页：默认每页 10 条，最大 50 条
 * "已 AI 丰富"标记：hasEnriched=true 时显示
 * 管理员专属"✨ AI 丰富"按钮
 *
 * 满足需求 7.1-7.8
 */

import { useCallback, useEffect, useState } from 'react';
import { CardSkeletonList } from './SkeletonLoader';
import MarkdownRenderer from '@/components/MarkdownRenderer';

/** 原始题解数据接口 */
export interface RawSolutionItem {
  id: string;
  problemId: string;
  title: string;
  content?: string;
  language?: string | null;
  authorName: string | null;
  upvotes: number;
  sourceUrl?: string | null;
  sourceType?: string | null;
  viewCount: number;
  createdAt: number;
  /** 是否已有对应的 enriched 记录 */
  hasEnriched: boolean;
}

/** 分页响应 */
export interface RawSolutionPageResponse {
  items: RawSolutionItem[];
  total: number;
  page: number;
  size: number;
}

/** 排序方式 */
type SortType = 'votes' | 'time';

/** 支持的编程语言列表 */
const LANGUAGE_OPTIONS = [
  { value: '', label: '全部语言' },
  { value: 'python', label: 'Python' },
  { value: 'java', label: 'Java' },
  { value: 'go', label: 'Go' },
  { value: 'cpp', label: 'C++' },
  { value: 'javascript', label: 'JavaScript' },
  { value: 'typescript', label: 'TypeScript' },
  { value: 'rust', label: 'Rust' },
  { value: 'c', label: 'C' },
];

interface RawSolutionListProps {
  /** 题目 ID */
  problemId: string;
  /** 获取原始题解列表 */
  fetchRawSolutions: (
    problemId: string,
    params: { sort: SortType; language: string; page: number; size: number }
  ) => Promise<RawSolutionPageResponse>;
  /** 管理员触发单条 AI 丰富 */
  onEnrich?: (solutionId: string) => void;
  /** 是否管理员 */
  isAdmin?: boolean;
  /** 自定义类名 */
  className?: string;
}

export default function RawSolutionList({
  problemId,
  fetchRawSolutions,
  onEnrich,
  isAdmin = false,
  className,
}: RawSolutionListProps) {
  const [sort, setSort] = useState<SortType>('votes');
  const [language, setLanguage] = useState('');
  const [page, setPage] = useState(0);
  const [size] = useState(10);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<RawSolutionPageResponse | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  /** 加载数据 */
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const result = await fetchRawSolutions(problemId, { sort, language, page, size });
      setData(result);
    } catch (err) {
      console.error('加载原始题解失败:', err);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [problemId, fetchRawSolutions, sort, language, page, size]);

  // 参数变化时重新加载
  useEffect(() => {
    loadData();
  }, [loadData]);

  /** 切换排序时重置页码 */
  const handleSortChange = useCallback((newSort: SortType) => {
    setSort(newSort);
    setPage(0);
  }, []);

  /** 切换语言筛选时重置页码 */
  const handleLanguageChange = useCallback((newLang: string) => {
    setLanguage(newLang);
    setPage(0);
  }, []);

  /** 展开/收起单条 */
  const handleToggle = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  /** 总页数 */
  const totalPages = data ? Math.ceil(data.total / data.size) : 0;

  return (
    <div className={`space-y-3 ${className || ''}`}>
      {/* 工具栏：排序切换 + 语言筛选 */}
      <div className="flex flex-wrap items-center gap-3">
        {/* 排序切换 */}
        <div className="flex items-center rounded-lg bg-gray-100 p-0.5 dark:bg-gray-800">
          <button
            type="button"
            onClick={() => handleSortChange('votes')}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors
              ${sort === 'votes'
                ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-gray-100'
                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
              }`}
          >
            按点赞排序
          </button>
          <button
            type="button"
            onClick={() => handleSortChange('time')}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors
              ${sort === 'time'
                ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-gray-100'
                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
              }`}
          >
            按时间排序
          </button>
        </div>

        {/* 语言筛选下拉 */}
        <select
          value={language}
          onChange={(e) => handleLanguageChange(e.target.value)}
          className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs
            text-gray-700 focus:border-blue-400 focus:outline-none focus:ring-1
            focus:ring-blue-400 dark:border-gray-700 dark:bg-gray-800
            dark:text-gray-300"
        >
          {LANGUAGE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        {/* 总数指示 */}
        {data && (
          <span className="text-xs text-gray-400 dark:text-gray-500">
            共 {data.total} 条
          </span>
        )}
      </div>

      {/* 加载态 */}
      {loading && <CardSkeletonList count={3} />}

      {/* 列表 */}
      {!loading && data && (
        <div className="space-y-2">
          {data.items.length === 0 && (
            <div className="py-8 text-center text-sm text-gray-400 dark:text-gray-500">
              暂无原始题解
            </div>
          )}

          {data.items.map((item) => (
            <RawSolutionCard
              key={item.id}
              item={item}
              expanded={expandedIds.has(item.id)}
              onToggle={handleToggle}
              isAdmin={isAdmin}
              onEnrich={onEnrich}
            />
          ))}
        </div>
      )}

      {/* 分页 */}
      {!loading && data && totalPages > 1 && (
        <Pagination
          page={page}
          totalPages={totalPages}
          onPageChange={setPage}
        />
      )}
    </div>
  );
}

/** 格式化时间戳为可读日期 */
function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return '今天';
  if (diffDays === 1) return '昨天';
  if (diffDays < 30) return `${diffDays}天前`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}个月前`;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/** 格式化数字（超过 1000 显示为 1.2k 格式） */
function formatNumber(num: number): string {
  if (num >= 10000) return `${(num / 10000).toFixed(1)}w`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}k`;
  return String(num);
}

/** 单条原始题解卡片（复用 CollapsibleCard 收起/展开交互模式） */
function RawSolutionCard({
  item,
  expanded,
  onToggle,
  isAdmin,
  onEnrich,
}: {
  item: RawSolutionItem;
  expanded: boolean;
  onToggle: (id: string) => void;
  isAdmin: boolean;
  onEnrich?: (id: string) => void;
}) {
  return (
    <div
      className="group relative rounded-xl border border-gray-200 bg-white
        transition-all duration-200 ease-out
        hover:shadow-md hover:scale-[1.005]
        active:scale-[0.98] active:opacity-90
        dark:border-gray-700 dark:bg-gray-900"
    >
      {/* 收起态头部 */}
      <button
        type="button"
        onClick={() => onToggle(item.id)}
        className="flex w-full items-start gap-3 p-4 text-left focus:outline-none
          focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2
          rounded-xl"
        aria-expanded={expanded}
      >
        {/* 箭头指示器 */}
        <span
          className="mt-1 flex-shrink-0 text-gray-400 dark:text-gray-500
            transition-transform duration-[250ms] ease-out"
          style={{ transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)' }}
        >
          ▶
        </span>

        {/* 内容区 */}
        <div className="flex-1 min-w-0">
          {/* 第一行：标题 + 已丰富标记 */}
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
              {item.title}
            </h3>
            {item.hasEnriched && (
              <span className="inline-flex items-center rounded-full bg-green-50 px-2 py-0.5
                text-[10px] font-medium text-green-700
                dark:bg-green-900/30 dark:text-green-400">
                已 AI 丰富
              </span>
            )}
          </div>

          {/* 第二行：作者、发布时间、点赞、浏览 */}
          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-gray-500 dark:text-gray-400">
            {item.authorName && (
              <span className="font-medium text-gray-600 dark:text-gray-300">
                @{item.authorName}
              </span>
            )}
            <span>·</span>
            <span>{formatDate(item.createdAt)}</span>
            <span>·</span>
            <span className="inline-flex items-center gap-0.5">
              <span className="text-amber-500">★</span>
              {formatNumber(item.upvotes)}
            </span>
            <span>·</span>
            <span className="inline-flex items-center gap-0.5">
              👁 {formatNumber(item.viewCount)}
            </span>
          </div>

          {/* 第三行：语言标签 */}
          {item.language && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              <span
                className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px]
                  font-medium text-blue-600
                  dark:bg-blue-900/30 dark:text-blue-400"
              >
                {item.language}
              </span>
            </div>
          )}
        </div>

        {/* 管理员"✨ AI 丰富"按钮 */}
        {isAdmin && !item.hasEnriched && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onEnrich?.(item.id);
            }}
            className="flex-shrink-0 rounded-lg bg-purple-50 px-2.5 py-1.5 text-xs
              font-medium text-purple-700 hover:bg-purple-100
              dark:bg-purple-900/30 dark:text-purple-400 dark:hover:bg-purple-900/50
              transition-colors"
            title="触发 AI 丰富"
          >
            ✨ AI 丰富
          </button>
        )}
      </button>

      {/* 展开态内容区 */}
      <div
        className="overflow-hidden transition-all duration-[350ms] ease-[cubic-bezier(0.25,0.1,0.25,1.5)]"
        style={{
          maxHeight: expanded ? '2000px' : '0px',
          opacity: expanded ? 1 : 0,
        }}
      >
        <div className="border-t border-gray-100 px-4 pb-4 pt-3 dark:border-gray-800">
          {item.content ? (
            <MarkdownRenderer content={item.content.replace(/\\n/g, '\n')} />
          ) : (
            <p className="text-xs text-gray-400 dark:text-gray-500">
              展开内容加载中...
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/** 分页组件 */
function Pagination({
  page,
  totalPages,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) {
  /** 生成页码范围（当前页前后各 2 页） */
  const getPageRange = (): number[] => {
    const range: number[] = [];
    const start = Math.max(0, page - 2);
    const end = Math.min(totalPages - 1, page + 2);
    for (let i = start; i <= end; i++) {
      range.push(i);
    }
    return range;
  };

  return (
    <div className="flex items-center justify-center gap-1 pt-2">
      {/* 上一页 */}
      <button
        type="button"
        onClick={() => onPageChange(page - 1)}
        disabled={page === 0}
        className="rounded-md px-2.5 py-1.5 text-xs text-gray-600
          hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40
          dark:text-gray-400 dark:hover:bg-gray-800"
      >
        ‹
      </button>

      {/* 页码 */}
      {getPageRange().map((p) => (
        <button
          key={p}
          type="button"
          onClick={() => onPageChange(p)}
          className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors
            ${p === page
              ? 'bg-blue-500 text-white'
              : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'
            }`}
        >
          {p + 1}
        </button>
      ))}

      {/* 下一页 */}
      <button
        type="button"
        onClick={() => onPageChange(page + 1)}
        disabled={page >= totalPages - 1}
        className="rounded-md px-2.5 py-1.5 text-xs text-gray-600
          hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40
          dark:text-gray-400 dark:hover:bg-gray-800"
      >
        ›
      </button>
    </div>
  );
}
