'use client';

/**
 * LevelTabs - 解析级别切换标签组件
 * L1=直觉, L2=入门, L3=标准, L4=深入, L5=专家
 * 响应式设计，移动端自适应
 */

import { useCallback } from 'react';

interface LevelTabsProps {
  /** 当前选中级别 1-5 */
  activeLevel: number;
  /** 切换级别回调 */
  onLevelChange: (level: number) => void;
  /** 是否正在加载（切换时禁用点击） */
  loading?: boolean;
}

/** 级别标签配置 */
const LEVELS = [
  { level: 1, label: 'L1', name: '直觉' },
  { level: 2, label: 'L2', name: '入门' },
  { level: 3, label: 'L3', name: '标准' },
  { level: 4, label: 'L4', name: '深入' },
  { level: 5, label: 'L5', name: '专家' },
] as const;

export default function LevelTabs({ activeLevel, onLevelChange, loading }: LevelTabsProps) {
  const handleClick = useCallback(
    (level: number) => {
      if (!loading && level !== activeLevel) {
        onLevelChange(level);
      }
    },
    [loading, activeLevel, onLevelChange]
  );

  return (
    <div className="flex gap-1 rounded-xl bg-gray-100 p-1 dark:bg-gray-800">
      {LEVELS.map(({ level, label, name }) => {
        const isActive = level === activeLevel;
        return (
          <button
            key={level}
            onClick={() => handleClick(level)}
            disabled={loading}
            className={`
              flex-1 rounded-lg px-3 py-2 text-center text-sm font-medium
              transition-all duration-200
              ${isActive
                ? 'bg-white text-blue-600 shadow-sm dark:bg-gray-700 dark:text-blue-400'
                : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200'
              }
              ${loading ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}
            `}
            aria-selected={isActive}
            role="tab"
          >
            <span className="block font-semibold">{label}</span>
            <span className="hidden sm:block text-xs opacity-75">{name}</span>
          </button>
        );
      })}
    </div>
  );
}
