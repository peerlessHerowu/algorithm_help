'use client';

/**
 * 算法故事卡片组件（题目详情页右侧嵌入）
 * 在 TOC 下方展示算法考古内容入口
 * 琥珀色边框 + 半透明底色风格，hover 有阴影效果
 * 点击跳转到 /archaeology/{storyId}
 *
 * 数据来源：GET /api/v1/problems/{id} 返回的 relatedArchaeology 字段
 * Requirements: 3.11
 */

import Link from 'next/link';

/** AlgorithmStoryCard Props 接口 */
export interface AlgorithmStoryCardProps {
  /** 算法故事 ID，用于跳转路由 */
  storyId: string;
  /** 算法名称 */
  algorithmName: string;
  /** 100 字以内的精简摘要 */
  shortSummary: string;
  /** 发明者姓名（可选） */
  inventorName?: string;
  /** 发明年份（可选） */
  year?: number;
  /** 自定义样式类名 */
  className?: string;
}

export default function AlgorithmStoryCard({
  storyId,
  algorithmName,
  shortSummary,
  inventorName,
  year,
  className,
}: AlgorithmStoryCardProps) {
  return (
    <Link href={`/archaeology/${storyId}`} className="block">
      <div
        className={`p-4 rounded-lg border border-amber-200 bg-amber-50/50
                    dark:border-amber-700 dark:bg-amber-900/20
                    hover:shadow-md transition-shadow cursor-pointer
                    ${className || ''}`}
      >
        {/* 标题区域：图标 + 算法名称 */}
        <div className="flex items-center gap-2 mb-2">
          <span className="text-lg" aria-hidden="true">📖</span>
          <span className="text-sm font-medium text-amber-700 dark:text-amber-300">
            算法故事 · {algorithmName}
          </span>
        </div>

        {/* 摘要文本，最多 3 行截断 */}
        <p className="text-sm text-gray-700 dark:text-gray-300 line-clamp-3">
          {shortSummary}
        </p>

        {/* 发明者和年份信息（可选） */}
        {(inventorName || year) && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
            — {inventorName}{inventorName && year ? ', ' : ''}{year}
          </p>
        )}

        {/* 底部跳转引导文字 */}
        <span className="text-xs text-amber-600 dark:text-amber-400 mt-2 inline-block">
          阅读完整故事 →
        </span>
      </div>
    </Link>
  );
}
