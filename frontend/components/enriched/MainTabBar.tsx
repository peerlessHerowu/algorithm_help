'use client';

/**
 * MainTabBar - 题目详情页顶部 4 Tab 导航栏
 *
 * 功能：
 * - 4 个主 Tab：📖 AI深度解析 / 📋 原始题解 / 📝 用户题解 / 💬 评论
 * - 蓝色底部指示条动画（250ms spring 滑动）
 * - URL query 参数直达（?tab=ai|raw|user|comment）
 * - Tab 切换回调
 *
 * 满足需求 15.1-15.6
 */

import { useEffect, useRef, useState, useCallback } from 'react';

/** Tab 键值类型 */
export type MainTabKey = 'ai' | 'raw' | 'user' | 'comment';

/** Tab 配置项 */
export interface MainTabConfig {
  key: MainTabKey;
  label: string;
  icon: string;
}

/** 4 个主 Tab 配置 */
export const MAIN_TABS: MainTabConfig[] = [
  { key: 'ai', label: 'AI深度解析', icon: '📖' },
  { key: 'raw', label: '原始题解', icon: '📋' },
  { key: 'user', label: '用户题解', icon: '📝' },
  { key: 'comment', label: '评论', icon: '💬' },
];

interface MainTabBarProps {
  /** 当前激活的 Tab */
  activeTab: MainTabKey;
  /** Tab 切换回调 */
  onTabChange: (tab: MainTabKey) => void;
}

export default function MainTabBar({ activeTab, onTabChange }: MainTabBarProps) {
  const tabRefs = useRef<Map<MainTabKey, HTMLButtonElement>>(new Map());
  const containerRef = useRef<HTMLDivElement>(null);
  const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0 });

  /** 更新指示条位置和宽度 */
  const updateIndicator = useCallback(() => {
    const el = tabRefs.current.get(activeTab);
    const container = containerRef.current;
    if (!el || !container) return;

    const containerRect = container.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    setIndicatorStyle({
      left: elRect.left - containerRect.left,
      width: elRect.width,
    });
  }, [activeTab]);

  // 激活 Tab 变化时更新指示条
  useEffect(() => {
    updateIndicator();
  }, [updateIndicator]);

  // 窗口 resize 时重新计算
  useEffect(() => {
    window.addEventListener('resize', updateIndicator);
    return () => window.removeEventListener('resize', updateIndicator);
  }, [updateIndicator]);

  const setTabRef = useCallback((key: MainTabKey, el: HTMLButtonElement | null) => {
    if (el) {
      tabRefs.current.set(key, el);
    } else {
      tabRefs.current.delete(key);
    }
  }, []);

  return (
    <div ref={containerRef} className="relative border-b border-gray-200 dark:border-gray-700">
      {/* Tab 按钮列表 */}
      <div className="flex">
        {MAIN_TABS.map((tab) => (
          <button
            key={tab.key}
            ref={(el) => setTabRef(tab.key, el)}
            onClick={() => onTabChange(tab.key)}
            className={`relative flex items-center gap-1.5 px-5 py-3 text-sm font-medium transition-colors
              ${activeTab === tab.key
                ? 'text-blue-600 dark:text-blue-400'
                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
              }`}
            aria-selected={activeTab === tab.key}
            role="tab"
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* 蓝色滑动指示条 - 250ms spring 动画 */}
      <div
        className="absolute bottom-0 h-0.5 bg-blue-500 dark:bg-blue-400"
        style={{
          left: indicatorStyle.left,
          width: indicatorStyle.width,
          transition: 'left 250ms cubic-bezier(0.34, 1.56, 0.64, 1), width 250ms cubic-bezier(0.34, 1.56, 0.64, 1)',
        }}
      />
    </div>
  );
}
