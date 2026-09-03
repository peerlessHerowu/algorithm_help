'use client';

/**
 * LevelUpGuide — 进阶建议引导组件
 *
 * 在用户查看完当前级别所有卡片（非 L5）时，
 * 底部展示"进阶建议：查看 L{n+1} 了解更深层次内容"引导。
 *
 * 满足需求 18.2
 */

import { useCallback } from 'react';

interface LevelUpGuideProps {
  /** 当前级别 (1-5) */
  currentLevel: number;
  /** 是否所有卡片都已展开过（阅读完毕） */
  allCardsViewed: boolean;
  /** 切换级别回调 */
  onLevelChange: (level: number) => void;
  /** 自定义类名 */
  className?: string;
}

export default function LevelUpGuide({
  currentLevel,
  allCardsViewed,
  onLevelChange,
  className,
}: LevelUpGuideProps) {
  // L5 不展示进阶建议
  if (currentLevel >= 5) return null;
  // 未阅读完所有卡片时不展示
  if (!allCardsViewed) return null;

  const nextLevel = currentLevel + 1;

  const handleClick = useCallback(() => {
    onLevelChange(nextLevel);
  }, [onLevelChange, nextLevel]);

  return (
    <div
      className={`
        mt-4 rounded-xl border border-blue-200 dark:border-blue-800
        bg-blue-50/60 dark:bg-blue-950/30
        px-4 py-3 flex items-center justify-between
        ${className || ''}
      `}
    >
      <div className="flex items-center gap-2">
        <span className="text-blue-500 dark:text-blue-400 text-lg">💡</span>
        <span className="text-sm text-gray-700 dark:text-gray-300">
          进阶建议：查看 L{nextLevel} 了解更深层次内容
        </span>
      </div>

      <button
        type="button"
        onClick={handleClick}
        className="
          shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium
          text-blue-600 dark:text-blue-400
          hover:bg-blue-100 dark:hover:bg-blue-900/50
          transition-colors duration-150
          focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400
        "
      >
        去看看 →
      </button>
    </div>
  );
}
