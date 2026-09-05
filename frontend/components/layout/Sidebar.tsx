'use client';

/**
 * 侧边栏导航组件
 * - 桌面端（>1024px）：完整展示题目分类导航
 * - 平板端（768-1024px）：折叠为窄版图标导航
 * - 移动端（<768px）：隐藏（使用 Navbar 的汉堡菜单代替）
 */

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

interface SidebarItem {
  label: string;
  href: string;
  icon: string;
}

const sidebarItems: SidebarItem[] = [
  { label: '全部题目', href: '/problems', icon: '📋' },
  { label: '算法模式', href: '/patterns', icon: '🧩' },
  { label: '知识图谱', href: '/graph', icon: '🕸️' },
  { label: '模式训练', href: '/training', icon: '🎯' },
  { label: '费曼学习', href: '/feynman', icon: '💡' },
  { label: '面试模拟', href: '/interview', icon: '🎤' },
  { label: '复习中心', href: '/review', icon: '🔄' },
];

const extraItems: SidebarItem[] = [
  { label: '算法考古', href: '/archaeology', icon: '🏛️' },
  { label: '论文桥梁', href: '/papers', icon: '🔬' },
  { label: '我的成就', href: '/achievements', icon: '🏆' },
];

interface SidebarProps {
  className?: string;
}

export default function Sidebar({ className = '' }: SidebarProps) {
  const pathname = usePathname();
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);

  return (
    <aside
      className={`hidden md:flex flex-col border-r border-gray-200 bg-white
                  dark:border-gray-800 dark:bg-gray-900
                  md:w-16 lg:w-56 transition-all duration-200
                  ${className}`}
    >
      {/* 导航列表 */}
      <nav className="flex-1 overflow-y-auto py-4" aria-label="主导航">
        <ul className="space-y-1 px-2" role="list">
          {sidebarItems.map((item) => {
            const isActive = pathname.startsWith(item.href);
            return (
              <li
                key={item.href}
                onMouseEnter={() => setHoveredItem(item.href)}
                onMouseLeave={() => setHoveredItem(null)}
                className="relative"
              >
                <Link
                  href={item.href}
                  aria-current={isActive ? 'page' : undefined}
                  className={`flex items-center rounded-lg px-3 py-2.5 text-sm font-medium
                             transition-colors
                             ${isActive
                               ? 'bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300'
                               : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100'
                             }`}
                >
                  <span className="text-lg shrink-0 md:mx-auto lg:mx-0" aria-hidden="true">
                    {item.icon}
                  </span>
                  <span className="ml-3 hidden lg:inline">{item.label}</span>
                </Link>
                {hoveredItem === item.href && (
                  <div className="absolute left-full top-1/2 z-50 ml-2 -translate-y-1/2
                    rounded-md bg-gray-900 px-2.5 py-1 text-xs text-white shadow-lg
                    hidden md:block lg:hidden" role="tooltip">
                    {item.label}
                  </div>
                )}
              </li>
            );
          })}
        </ul>

        {/* 分隔线 + 扩展导航 */}
        <div className="mx-3 my-3 border-t border-gray-200 dark:border-gray-800" />
        <p className="px-4 mb-1 text-[10px] uppercase tracking-widest text-gray-400 hidden lg:block">
          探索
        </p>
        <ul className="space-y-1 px-2" role="list">
          {extraItems.map((item) => {
            const isActive = pathname.startsWith(item.href);
            return (
              <li
                key={item.href}
                onMouseEnter={() => setHoveredItem(item.href)}
                onMouseLeave={() => setHoveredItem(null)}
                className="relative"
              >
                <Link
                  href={item.href}
                  aria-current={isActive ? 'page' : undefined}
                  className={`flex items-center rounded-lg px-3 py-2 text-sm font-medium
                             transition-colors
                             ${isActive
                               ? 'bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300'
                               : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-500 dark:hover:bg-gray-800 dark:hover:text-gray-200'
                             }`}
                >
                  <span className="text-base shrink-0 md:mx-auto lg:mx-0" aria-hidden="true">
                    {item.icon}
                  </span>
                  <span className="ml-3 hidden lg:inline text-xs">{item.label}</span>
                </Link>
                {hoveredItem === item.href && (
                  <div className="absolute left-full top-1/2 z-50 ml-2 -translate-y-1/2
                    rounded-md bg-gray-900 px-2.5 py-1 text-xs text-white shadow-lg
                    hidden md:block lg:hidden" role="tooltip">
                    {item.label}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}
