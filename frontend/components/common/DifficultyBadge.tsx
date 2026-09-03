'use client';

type Difficulty = 'EASY' | 'MEDIUM' | 'HARD';
type BadgeSize = 'sm' | 'md';

interface DifficultyBadgeProps {
  difficulty: Difficulty;
  size?: BadgeSize;
  className?: string;
}

/** 难度对应的颜色映射 */
const colorMap: Record<Difficulty, string> = {
  EASY: 'bg-success-100 text-success-700 dark:bg-success-900/30 dark:text-success-400',
  MEDIUM: 'bg-warning-100 text-warning-700 dark:bg-warning-900/30 dark:text-warning-400',
  HARD: 'bg-danger-100 text-danger-700 dark:bg-danger-900/30 dark:text-danger-400',
};

/** 难度中文标签 */
const labelMap: Record<Difficulty, string> = {
  EASY: '简单',
  MEDIUM: '中等',
  HARD: '困难',
};

/** 尺寸映射 */
const sizeMap: Record<BadgeSize, string> = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-2.5 py-1 text-sm',
};

/**
 * 难度标签组件
 * EASY=绿色, MEDIUM=橙色, HARD=红色
 */
export default function DifficultyBadge({
  difficulty,
  size = 'md',
  className = '',
}: DifficultyBadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full font-medium ${colorMap[difficulty]} ${sizeMap[size]} ${className}`}
    >
      {labelMap[difficulty]}
    </span>
  );
}
