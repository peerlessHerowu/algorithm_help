'use client';

/**
 * LevelTabs - Apple 风格分段控制器
 *
 * 特性：
 * - 5 个级别 Tab：L1 直觉 / L2 入门 / L3 标准 / L4 深入 / L5 专家
 * - 选中态：蓝色背景滑块 + spring 滑动动画 (250ms)
 * - 每个 Tab 显示解析条数气泡（0 条时隐藏）
 * - 新用户引导气泡："建议从 L3 标准开始"（3 秒消失）
 * - 智能默认级别：L3 有内容则默认 L3，否则选有内容的最低级别
 * - 暗色/亮色主题适配
 *
 * 满足需求 21.1-21.4
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

/** 级别配置 */
export interface LevelConfig {
  level: number;
  label: string;
  subtitle: string;
}

/** 各级别配置 */
export const LEVEL_CONFIGS: LevelConfig[] = [
  { level: 1, label: 'L1', subtitle: '直觉' },
  { level: 2, label: 'L2', subtitle: '入门' },
  { level: 3, label: 'L3', subtitle: '标准' },
  { level: 4, label: 'L4', subtitle: '深入' },
  { level: 5, label: 'L5', subtitle: '专家' },
];

interface LevelTabsProps {
  /** 当前选中级别 (1-5) */
  activeLevel: number;
  /** 级别切换回调 */
  onLevelChange: (level: number) => void;
  /** 各级别的解析条数 */
  counts: Record<number, number>;
  /** 是否为新用户（无阅读历史） */
  isNewUser?: boolean;
  /** 自定义类名 */
  className?: string;
}

export default function LevelTabs({
  activeLevel,
  onLevelChange,
  counts,
  isNewUser = false,
  className,
}: LevelTabsProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [sliderStyle, setSliderStyle] = useState({ left: 0, width: 0 });
  const [showGuide, setShowGuide] = useState(false);

  // 计算滑块位置
  const updateSlider = useCallback(() => {
    const idx = activeLevel - 1;
    const tab = tabRefs.current[idx];
    const container = containerRef.current;
    if (tab && container) {
      const containerRect = container.getBoundingClientRect();
      const tabRect = tab.getBoundingClientRect();
      setSliderStyle({
        left: tabRect.left - containerRect.left,
        width: tabRect.width,
      });
    }
  }, [activeLevel]);

  // 初始化和更新滑块位置
  useEffect(() => {
    updateSlider();
  }, [updateSlider]);

  // 窗口 resize 时重新计算
  useEffect(() => {
    window.addEventListener('resize', updateSlider);
    return () => window.removeEventListener('resize', updateSlider);
  }, [updateSlider]);

  // 新用户引导气泡：3 秒后消失
  useEffect(() => {
    if (isNewUser) {
      setShowGuide(true);
      const timer = setTimeout(() => setShowGuide(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [isNewUser]);

  /** 处理级别切换 */
  const handleLevelChange = useCallback(
    (level: number) => {
      onLevelChange(level);
    },
    [onLevelChange]
  );

  return (
    <div className={`relative ${className || ''}`}>
      {/* 分段控制器容器 */}
      <div
        ref={containerRef}
        className="relative flex rounded-xl bg-gray-100 p-1 dark:bg-gray-800"
        role="tablist"
        aria-label="解析深度级别"
      >
        {/* 蓝色滑块背景 */}
        <div
          className="absolute top-1 h-[calc(100%-8px)] rounded-lg
            bg-blue-500 dark:bg-blue-600 shadow-sm
            transition-all duration-[250ms] ease-[cubic-bezier(0.25,0.1,0.25,1.5)]"
          style={{ left: `${sliderStyle.left}px`, width: `${sliderStyle.width}px` }}
          aria-hidden="true"
        />

        {/* Tab 按钮 */}
        {LEVEL_CONFIGS.map((config, idx) => {
          const isActive = activeLevel === config.level;
          const count = counts[config.level] || 0;

          return (
            <button
              key={config.level}
              ref={(el) => { tabRefs.current[idx] = el; }}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-label={`${config.label} ${config.subtitle}，${count} 条解析`}
              onClick={() => handleLevelChange(config.level)}
              className={`relative z-10 flex flex-1 flex-col items-center
                rounded-lg px-2 py-1.5 text-center
                transition-colors duration-200
                focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400
                ${isActive
                  ? 'text-white'
                  : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200'
                }`}
            >
              {/* 标签 + 副标题 */}
              <span className="text-xs font-semibold">{config.label}</span>
              <span className={`text-[10px] ${isActive ? 'text-blue-100' : 'text-gray-400 dark:text-gray-500'}`}>
                {config.subtitle}
              </span>

              {/* 解析条数气泡 */}
              {count > 0 && (
                <span
                  className={`absolute -top-1 -right-0.5 flex h-4 min-w-4 items-center
                    justify-center rounded-full px-1 text-[10px] font-bold
                    ${isActive
                      ? 'bg-white text-blue-600'
                      : 'bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300'
                    }`}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* 新用户引导气泡 */}
      {showGuide && (
        <div
          className="absolute left-1/2 top-full mt-2 -translate-x-1/2
            whitespace-nowrap rounded-lg bg-gray-900 px-3 py-1.5
            text-xs text-white shadow-lg dark:bg-gray-700
            animate-in fade-in slide-in-from-top-1 duration-200"
          role="tooltip"
        >
          <span className="absolute -top-1 left-1/2 -translate-x-1/2
            border-4 border-transparent border-b-gray-900 dark:border-b-gray-700" />
          不确定看哪个？建议从 L3 标准开始
        </div>
      )}
    </div>
  );
}

/** 计算智能默认级别：L3 有内容则选 L3，否则选有内容的最低级别 */
export function getSmartDefaultLevel(counts: Record<number, number>): number {
  if ((counts[3] || 0) > 0) return 3;
  for (let i = 1; i <= 5; i++) {
    if ((counts[i] || 0) > 0) return i;
  }
  return 3; // 全部无内容时默认 L3
}
