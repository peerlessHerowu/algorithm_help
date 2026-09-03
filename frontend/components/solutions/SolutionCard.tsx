'use client';

/**
 * 题解卡片组件
 * 展示单条题解信息：标题、来源标记、点赞数、评论数
 * 来源类型：用户原创 / URL 导入 / 费曼产出，各类型使用不同颜色标签
 * 精选题解有紫色高亮边框
 *
 * Requirements: 31.3, 31.4, 31.6
 */

/** 题解来源类型 */
export type SolutionSource = 'original' | 'url_import' | 'feynman';

/** 题解数据结构 */
export interface Solution {
  id: string;
  title: string;
  /** 作者昵称 */
  authorName: string;
  /** 来源类型 */
  source: SolutionSource;
  /** 是否精选 */
  featured: boolean;
  /** 点赞数 */
  likeCount: number;
  /** 评论数 */
  commentCount: number;
  /** 内容摘要（前 100 字） */
  summary: string;
  /** 创建时间（UTC 毫秒时间戳） */
  createdAt: number;
}

/** SolutionCard Props 接口 */
export interface SolutionCardProps {
  /** 题解数据 */
  solution: Solution;
  /** 点击卡片回调 */
  onClick?: (id: string) => void;
  /** 自定义样式类名 */
  className?: string;
}

/** 来源标签配置 */
const SOURCE_CONFIG: Record<SolutionSource, { label: string; color: string }> = {
  original: {
    label: '✏️ 原创',
    color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  },
  url_import: {
    label: '🔗 导入',
    color: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  },
  feynman: {
    label: '🧠 费曼产出',
    color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
  },
};

/** 格式化相对时间 */
function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return '刚刚';
  if (minutes < 60) return `${minutes} 分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小时前`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} 天前`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} 个月前`;
  return `${Math.floor(months / 12)} 年前`;
}

export default function SolutionCard({ solution, onClick, className }: SolutionCardProps) {
  const sourceConfig = SOURCE_CONFIG[solution.source] || SOURCE_CONFIG.original;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onClick?.(solution.id)}
      onKeyDown={(e) => { if (e.key === 'Enter') onClick?.(solution.id); }}
      className={`rounded-lg border p-4 transition-all cursor-pointer
        hover:bg-gray-50 dark:hover:bg-gray-800/50
        ${solution.featured
          ? 'border-purple-300 dark:border-purple-700 bg-purple-50/30 dark:bg-purple-900/10'
          : 'border-gray-200 dark:border-gray-700'
        }
        ${className || ''}`}
    >
      {/* 顶部：精选标记 + 标题 */}
      <div className="flex items-start gap-2">
        {solution.featured && (
          <span className="shrink-0 rounded bg-purple-100 px-1.5 py-0.5 text-xs font-medium text-purple-700 dark:bg-purple-900/40 dark:text-purple-300">
            ⭐ 精选
          </span>
        )}
        <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 line-clamp-1">
          {solution.title}
        </h4>
      </div>

      {/* 摘要 */}
      <p className="mt-2 text-xs text-gray-600 dark:text-gray-400 line-clamp-2">
        {solution.summary}
      </p>

      {/* 底部：来源标记 + 作者 + 互动数据 */}
      <div className="mt-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {/* 来源标签 */}
          <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${sourceConfig.color}`}>
            {sourceConfig.label}
          </span>
          {/* 作者 */}
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {solution.authorName}
          </span>
          {/* 时间 */}
          <span className="text-xs text-gray-400 dark:text-gray-500">
            {formatRelativeTime(solution.createdAt)}
          </span>
        </div>
        {/* 互动数据 */}
        <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
          <span>👍 {solution.likeCount}</span>
          <span>💬 {solution.commentCount}</span>
        </div>
      </div>
    </div>
  );
}
