'use client';

/**
 * 全局搜索面板组件（⌘K / Ctrl+K）
 *
 * 功能：
 * - ⌘K / Ctrl+K 快捷键呼出搜索模态框
 * - 搜索输入框自动聚焦，ESC 或点击遮罩关闭
 * - 快速跳转列表（题目列表/模式/费曼/复习中心/设置）
 * - 最近搜索历史（localStorage 存储，最多 5 条）
 * - 实时模糊搜索题目标题/模式名/标签名
 * - 结果列表带键盘 ↑↓ 选择，回车跳转第一条结果
 *
 * Requirements: 36.1-36.6
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';

// ============ 类型定义 ============

/** 搜索结果项 */
interface SearchResultItem {
  /** 唯一标识 */
  id: string;
  /** 展示标题 */
  title: string;
  /** 副标题/描述 */
  subtitle?: string;
  /** 跳转路径 */
  href: string;
  /** 图标（emoji 或类型标记） */
  icon: string;
  /** 结果类型 */
  type: 'quick' | 'history' | 'problem' | 'pattern' | 'tag';
}

/** 组件 Props */
interface GlobalSearchProps {
  /** 自定义样式类名 */
  className?: string;
}

// ============ 常量 ============

/** localStorage 中搜索历史的存储键 */
const SEARCH_HISTORY_KEY = 'global-search-history';

/** 最大搜索历史数量 */
const MAX_HISTORY = 5;

/** 快速跳转项列表 */
const QUICK_LINKS: SearchResultItem[] = [
  { id: 'q-problems', title: '题目列表', subtitle: '浏览所有算法题目', href: '/problems', icon: '📋', type: 'quick' },
  { id: 'q-patterns', title: '算法模式', subtitle: '查看算法模式分类', href: '/patterns', icon: '🧩', type: 'quick' },
  { id: 'q-feynman', title: '费曼模式', subtitle: '用自己的话讲解算法', href: '/feynman', icon: '🧠', type: 'quick' },
  { id: 'q-review', title: '复习中心', subtitle: '间隔重复复习', href: '/review', icon: '📅', type: 'quick' },
  { id: 'q-settings', title: '设置', subtitle: '偏好与账户设置', href: '/settings', icon: '⚙️', type: 'quick' },
];

// ============ 工具函数 ============

/** 从 localStorage 读取搜索历史 */
function loadSearchHistory(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(SEARCH_HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/** 保存搜索历史到 localStorage */
function saveSearchHistory(history: string[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(history.slice(0, MAX_HISTORY)));
}

/** 模糊匹配判断：query 的每个字符按顺序出现在 text 中即匹配 */
function fuzzyMatch(text: string, query: string): boolean {
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  let j = 0;
  for (let i = 0; i < lowerText.length && j < lowerQuery.length; i++) {
    if (lowerText[i] === lowerQuery[j]) j++;
  }
  return j === lowerQuery.length;
}

// ============ Mock 数据源（后续接入真实 API） ============

/** 可搜索的题目/模式数据，用于本地模糊搜索 */
const SEARCHABLE_ITEMS: SearchResultItem[] = [
  { id: 'p-1', title: '两数之和', subtitle: 'EASY · 哈希表', href: '/problems/1', icon: '📝', type: 'problem' },
  { id: 'p-2', title: '三数之和', subtitle: 'MEDIUM · 双指针', href: '/problems/15', icon: '📝', type: 'problem' },
  { id: 'p-3', title: '最长回文子串', subtitle: 'MEDIUM · 动态规划', href: '/problems/5', icon: '📝', type: 'problem' },
  { id: 'p-4', title: '合并区间', subtitle: 'MEDIUM · 排序', href: '/problems/56', icon: '📝', type: 'problem' },
  { id: 'p-5', title: '爬楼梯', subtitle: 'EASY · 动态规划', href: '/problems/70', icon: '📝', type: 'problem' },
  { id: 'p-6', title: '二叉树的层序遍历', subtitle: 'MEDIUM · BFS', href: '/problems/102', icon: '📝', type: 'problem' },
  { id: 'pat-1', title: '动态规划', subtitle: '算法模式 · 12 道关联题', href: '/patterns/dp', icon: '🧩', type: 'pattern' },
  { id: 'pat-2', title: '双指针', subtitle: '算法模式 · 8 道关联题', href: '/patterns/two-pointers', icon: '🧩', type: 'pattern' },
  { id: 'pat-3', title: '滑动窗口', subtitle: '算法模式 · 6 道关联题', href: '/patterns/sliding-window', icon: '🧩', type: 'pattern' },
  { id: 'pat-4', title: '回溯', subtitle: '算法模式 · 10 道关联题', href: '/patterns/backtracking', icon: '🧩', type: 'pattern' },
  { id: 'tag-1', title: '哈希表', subtitle: '标签', href: '/problems?tag=hash-table', icon: '🏷️', type: 'tag' },
  { id: 'tag-2', title: '图论', subtitle: '标签', href: '/problems?tag=graph', icon: '🏷️', type: 'tag' },
  { id: 'tag-3', title: '贪心算法', subtitle: '标签', href: '/problems?tag=greedy', icon: '🏷️', type: 'tag' },
];

// ============ 组件实现 ============

export default function GlobalSearch({ className = '' }: GlobalSearchProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // 面板开关状态
  const [isOpen, setIsOpen] = useState(false);
  // 搜索关键词
  const [query, setQuery] = useState('');
  // 当前选中索引（键盘导航）
  const [selectedIndex, setSelectedIndex] = useState(0);
  // 搜索历史
  const [history, setHistory] = useState<string[]>([]);

  // 初始化加载搜索历史
  useEffect(() => {
    setHistory(loadSearchHistory());
  }, []);

  // ============ 快捷键监听：⌘K / Ctrl+K 呼出面板 ============
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(true);
      }
    }
    // 监听外部触发的打开事件（如导航栏按钮点击）
    function handleOpenEvent() {
      setIsOpen(true);
    }
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('open-global-search', handleOpenEvent);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('open-global-search', handleOpenEvent);
    };
  }, []);

  // 打开面板时自动聚焦输入框
  useEffect(() => {
    if (isOpen) {
      // 延迟聚焦以确保 DOM 已渲染
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      // 关闭时重置状态
      setQuery('');
      setSelectedIndex(0);
    }
  }, [isOpen]);

  // ============ 搜索结果计算 ============
  const results: SearchResultItem[] = useMemo(() => {
    if (!query.trim()) {
      // 无搜索词时：展示搜索历史 + 快速跳转
      const historyItems: SearchResultItem[] = history.map((h, i) => ({
        id: `hist-${i}`,
        title: h,
        href: `/problems?keyword=${encodeURIComponent(h)}`,
        icon: '🕐',
        type: 'history' as const,
      }));
      return [...historyItems, ...QUICK_LINKS];
    }
    // 有搜索词时：模糊匹配可搜索项
    const matched = SEARCHABLE_ITEMS.filter(
      (item) => fuzzyMatch(item.title, query) || (item.subtitle && fuzzyMatch(item.subtitle, query))
    );
    // 同时在快速跳转中搜索
    const matchedQuick = QUICK_LINKS.filter(
      (item) => fuzzyMatch(item.title, query)
    );
    return [...matched, ...matchedQuick];
  }, [query, history]);

  // 选中索引越界修正
  useEffect(() => {
    if (selectedIndex >= results.length) {
      setSelectedIndex(Math.max(0, results.length - 1));
    }
  }, [results.length, selectedIndex]);

  // ============ 跳转处理 ============
  const handleNavigate = useCallback(
    (item: SearchResultItem) => {
      // 如果有搜索词，记录到历史
      if (query.trim() && item.type !== 'history') {
        const updated = [query.trim(), ...history.filter((h) => h !== query.trim())].slice(0, MAX_HISTORY);
        setHistory(updated);
        saveSearchHistory(updated);
      }
      // 如果点击的是历史项，用它作为搜索词跳转
      if (item.type === 'history') {
        const updated = [item.title, ...history.filter((h) => h !== item.title)].slice(0, MAX_HISTORY);
        setHistory(updated);
        saveSearchHistory(updated);
      }
      setIsOpen(false);
      router.push(item.href);
    },
    [query, history, router]
  );

  // ============ 键盘事件处理 ============
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((prev) => (prev + 1) % Math.max(results.length, 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((prev) => (prev - 1 + results.length) % Math.max(results.length, 1));
          break;
        case 'Enter':
          e.preventDefault();
          if (results.length > 0) {
            handleNavigate(results[selectedIndex] || results[0]);
          }
          break;
        case 'Escape':
          e.preventDefault();
          setIsOpen(false);
          break;
      }
    },
    [results, selectedIndex, handleNavigate]
  );

  // 滚动选中项到可见区域
  useEffect(() => {
    if (listRef.current) {
      const selected = listRef.current.querySelector('[data-selected="true"]');
      selected?.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  // 删除单条搜索历史
  const removeHistoryItem = useCallback(
    (text: string) => {
      const updated = history.filter((h) => h !== text);
      setHistory(updated);
      saveSearchHistory(updated);
    },
    [history]
  );

  // 面板未打开时不渲染
  if (!isOpen) return null;

  // ============ 渲染 ============
  return (
    <div className={`fixed inset-0 z-[100] ${className}`}>
      {/* 遮罩层 - 点击关闭 */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={() => setIsOpen(false)}
        aria-hidden="true"
      />

      {/* 搜索面板主体 */}
      <div className="relative mx-auto mt-[15vh] w-full max-w-lg px-4">
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-900">
          {/* 搜索输入区 */}
          <div className="flex items-center gap-3 border-b border-gray-200 px-4 py-3 dark:border-gray-700">
            <SearchIconSvg />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setSelectedIndex(0);
              }}
              onKeyDown={handleKeyDown}
              placeholder="搜索题目、模式、标签..."
              className="flex-1 bg-transparent text-sm text-gray-900 outline-none placeholder:text-gray-400 dark:text-gray-100 dark:placeholder:text-gray-500"
            />
            {/* 快捷键提示 */}
            <kbd className="hidden rounded border border-gray-200 px-1.5 py-0.5 text-xs text-gray-400 dark:border-gray-600 sm:inline-block">
              ESC
            </kbd>
          </div>

          {/* 结果列表区 */}
          <div ref={listRef} className="max-h-[50vh] overflow-y-auto py-2">
            {results.length === 0 && query.trim() && (
              <div className="px-4 py-8 text-center text-sm text-gray-400 dark:text-gray-500">
                没有找到匹配的结果
              </div>
            )}

            {/* 搜索历史分组标题 */}
            {!query.trim() && history.length > 0 && (
              <div className="px-4 py-1.5 text-xs font-medium text-gray-400 dark:text-gray-500">
                最近搜索
              </div>
            )}

            {/* 快速跳转分组标题（无搜索词时在历史之后显示） */}
            {!query.trim() && (
              <>
                {/* 历史项 */}
                {history.map((h, i) => {
                  const item: SearchResultItem = {
                    id: `hist-${i}`,
                    title: h,
                    href: `/problems?keyword=${encodeURIComponent(h)}`,
                    icon: '🕐',
                    type: 'history',
                  };
                  const itemIndex = i;
                  return (
                    <ResultRow
                      key={item.id}
                      item={item}
                      isSelected={selectedIndex === itemIndex}
                      onClick={() => handleNavigate(item)}
                      onRemove={() => removeHistoryItem(h)}
                      dataIndex={itemIndex}
                    />
                  );
                })}

                {/* 快速跳转分组标题 */}
                <div className="px-4 py-1.5 text-xs font-medium text-gray-400 dark:text-gray-500">
                  快速跳转
                </div>
                {QUICK_LINKS.map((item, i) => {
                  const itemIndex = history.length + i;
                  return (
                    <ResultRow
                      key={item.id}
                      item={item}
                      isSelected={selectedIndex === itemIndex}
                      onClick={() => handleNavigate(item)}
                      dataIndex={itemIndex}
                    />
                  );
                })}
              </>
            )}

            {/* 搜索结果（有搜索词时） */}
            {query.trim() &&
              results.map((item, i) => (
                <ResultRow
                  key={item.id}
                  item={item}
                  isSelected={selectedIndex === i}
                  onClick={() => handleNavigate(item)}
                  dataIndex={i}
                />
              ))}
          </div>

          {/* 底部提示栏 */}
          <div className="flex items-center justify-between border-t border-gray-200 px-4 py-2 dark:border-gray-700">
            <div className="flex items-center gap-3 text-xs text-gray-400 dark:text-gray-500">
              <span>
                <kbd className="rounded border border-gray-200 px-1 py-0.5 dark:border-gray-600">↑↓</kbd>
                {' '}导航
              </span>
              <span>
                <kbd className="rounded border border-gray-200 px-1 py-0.5 dark:border-gray-600">↵</kbd>
                {' '}跳转
              </span>
              <span>
                <kbd className="rounded border border-gray-200 px-1 py-0.5 dark:border-gray-600">ESC</kbd>
                {' '}关闭
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============ 子组件：单行搜索结果 ============

interface ResultRowProps {
  item: SearchResultItem;
  isSelected: boolean;
  onClick: () => void;
  onRemove?: () => void;
  dataIndex: number;
}

function ResultRow({ item, isSelected, onClick, onRemove, dataIndex }: ResultRowProps) {
  return (
    <div
      data-selected={isSelected}
      data-index={dataIndex}
      onClick={onClick}
      className={`flex cursor-pointer items-center gap-3 px-4 py-2.5 transition-colors ${
        isSelected
          ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
          : 'text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800'
      }`}
    >
      {/* 图标 */}
      <span className="flex-shrink-0 text-base">{item.icon}</span>

      {/* 标题和副标题 */}
      <div className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{item.title}</span>
        {item.subtitle && (
          <span className="block truncate text-xs text-gray-400 dark:text-gray-500">
            {item.subtitle}
          </span>
        )}
      </div>

      {/* 历史项的删除按钮 */}
      {onRemove && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="flex-shrink-0 rounded p-1 text-gray-400 hover:bg-gray-200 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-300"
          aria-label="删除搜索历史"
        >
          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}

      {/* 选中项右侧回车提示 */}
      {isSelected && (
        <kbd className="flex-shrink-0 rounded border border-gray-200 px-1 py-0.5 text-xs text-gray-400 dark:border-gray-600">
          ↵
        </kbd>
      )}
    </div>
  );
}

// ============ 子组件：搜索图标 SVG ============

function SearchIconSvg() {
  return (
    <svg
      className="h-5 w-5 flex-shrink-0 text-gray-400"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
      />
    </svg>
  );
}
