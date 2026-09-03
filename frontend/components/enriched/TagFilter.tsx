'use client';

/**
 * TagFilter - 标签筛选栏
 *
 * 特性：
 * - 水平滚动标签栏（位于 LevelTabs 下方）
 * - 多选切换行为（toggle）
 * - "全部"清除按钮
 * - 当前级别 ≤1 条时自动隐藏
 * - 级别切换时自动重置选中标签
 * - 暗色/亮色主题适配
 *
 * 满足需求 14.1-14.5
 */

import { useCallback, useMemo } from 'react';

/** 标签计数信息 */
export interface TagCount {
  tag: string;
  count: number;
}

interface TagFilterProps {
  /** 当前级别的所有标签（含计数） */
  tags: TagCount[];
  /** 当前选中的标签集合 */
  selectedTags: string[];
  /** 标签选中/取消回调 */
  onTagsChange: (tags: string[]) => void;
  /** 当前级别的总解析条数（≤1 时隐藏） */
  totalItems: number;
  /** 自定义类名 */
  className?: string;
}

export default function TagFilter({
  tags,
  selectedTags,
  onTagsChange,
  totalItems,
  className,
}: TagFilterProps) {
  // ≤1 条解析时隐藏标签栏（无需筛选）
  if (totalItems <= 1 || tags.length === 0) {
    return null;
  }

  /** 切换单个标签的选中状态 */
  const handleToggleTag = useCallback(
    (tag: string) => {
      const isSelected = selectedTags.includes(tag);
      if (isSelected) {
        onTagsChange(selectedTags.filter((t) => t !== tag));
      } else {
        onTagsChange([...selectedTags, tag]);
      }
    },
    [selectedTags, onTagsChange]
  );

  /** 清除所有标签筛选 */
  const handleClearAll = useCallback(() => {
    onTagsChange([]);
  }, [onTagsChange]);

  const hasSelection = selectedTags.length > 0;

  return (
    <div
      className={`flex items-center gap-2 overflow-x-auto
        scrollbar-none py-2 ${className || ''}`}
      role="toolbar"
      aria-label="标签筛选"
    >
      {/* "全部"按钮 */}
      <button
        type="button"
        onClick={handleClearAll}
        className={`flex-shrink-0 rounded-full px-3 py-1 text-xs font-medium
          transition-colors duration-150
          focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400
          ${!hasSelection
            ? 'bg-blue-500 text-white dark:bg-blue-600'
            : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700'
          }`}
      >
        全部
      </button>

      {/* 标签列表 */}
      {tags.map(({ tag, count }) => {
        const isSelected = selectedTags.includes(tag);
        return (
          <button
            key={tag}
            type="button"
            onClick={() => handleToggleTag(tag)}
            className={`flex-shrink-0 rounded-full px-3 py-1 text-xs font-medium
              transition-colors duration-150
              focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400
              ${isSelected
                ? 'bg-blue-500 text-white dark:bg-blue-600'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700'
              }`}
            aria-pressed={isSelected}
          >
            {tag}
            <span className={`ml-1 ${isSelected ? 'text-blue-200' : 'text-gray-400 dark:text-gray-500'}`}>
              {count}
            </span>
          </button>
        );
      })}
    </div>
  );
}
