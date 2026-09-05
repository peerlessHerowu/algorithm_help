'use client';

import { useState, useMemo } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { fetcher } from '@/lib/fetcher';
import { safeArray } from '@/lib/safeArray';

interface Pattern {
  id: string;
  name: string;
  category: string;
  signals: string | string[];
  variants: string | string[];
  relatedProblems: string | string[];
}

// 分类颜色
const CATEGORY_BADGE: Record<string, string> = {
  '动态规划': 'bg-violet-900/40 text-violet-300 border-violet-700/50',
  '图论':     'bg-blue-900/40 text-blue-300 border-blue-700/50',
  '数据结构': 'bg-emerald-900/40 text-emerald-300 border-emerald-700/50',
  '双指针':   'bg-orange-900/40 text-orange-300 border-orange-700/50',
  '查找':     'bg-sky-900/40 text-sky-300 border-sky-700/50',
  '搜索':     'bg-rose-900/40 text-rose-300 border-rose-700/50',
  '贪心':     'bg-lime-900/40 text-lime-300 border-lime-700/50',
  '哈希':     'bg-amber-900/40 text-amber-300 border-amber-700/50',
  '分治':     'bg-indigo-900/40 text-indigo-300 border-indigo-700/50',
  '位运算':   'bg-slate-800/60 text-slate-300 border-slate-600/50',
  '链表':     'bg-cyan-900/40 text-cyan-300 border-cyan-700/50',
  '数组':     'bg-teal-900/40 text-teal-300 border-teal-700/50',
};
function getCategoryBadge(cat: string) {
  return CATEGORY_BADGE[cat] ?? 'bg-gray-800 text-gray-300 border-gray-700';
}

export default function PatternsClient() {
  const [search, setSearch]     = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('全部');

  const { data: rawPatterns, error, isLoading } = useSWR<Pattern[]>(
    '/api/v1/patterns', fetcher
  );

  const patterns = useMemo(() => rawPatterns ?? [], [rawPatterns]);

  // 所有分类
  const categories = useMemo(() => {
    const cats = new Set(patterns.map(p => p.category));
    return ['全部', ...Array.from(cats).sort()];
  }, [patterns]);

  // 过滤
  const filtered = useMemo(() => {
    let list = patterns;
    if (activeCategory !== '全部') {
      list = list.filter(p => p.category === activeCategory);
    }
    if (search.trim()) {
      const kw = search.trim().toLowerCase();
      list = list.filter(p =>
        p.name.toLowerCase().includes(kw) ||
        p.category.toLowerCase().includes(kw)
      );
    }
    return list;
  }, [patterns, activeCategory, search]);

  if (isLoading) return <ListSkeleton />;

  if (error) return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <p className="text-red-400">{error.message || '加载失败'}</p>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* 页头 */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-100">算法模式</h1>
          <p className="text-sm text-gray-500 mt-1">
            {patterns.length} 个核心算法模式，覆盖面试高频场景
          </p>
        </div>
        {/* 搜索框 */}
        <div className="relative">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索模式名称..."
            className="w-full sm:w-56 h-9 pl-9 pr-3 text-sm
              border border-gray-700 rounded-xl
              bg-gray-800/80 text-gray-200
              focus:outline-none focus:ring-2 focus:ring-indigo-500
              placeholder:text-gray-600"
          />
          <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500"
            fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          {search && (
            <button onClick={() => setSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* 分类筛选 */}
      <div className="flex gap-2 flex-wrap">
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`px-3 py-1.5 text-xs rounded-xl border transition-all font-medium
              ${activeCategory === cat
                ? 'bg-indigo-600 border-indigo-500 text-white'
                : 'bg-gray-800/60 border-gray-700 text-gray-400 hover:border-gray-600 hover:text-gray-200'
              }`}
          >
            {cat}
            {cat !== '全部' && (
              <span className="ml-1.5 text-current opacity-60">
                {patterns.filter(p => p.category === cat).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* 卡片网格 */}
      {filtered.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map(pattern => (
            <PatternCard key={pattern.id} pattern={pattern} />
          ))}
        </div>
      ) : (
        <div className="flex min-h-[30vh] items-center justify-center">
          <div className="text-center text-gray-500 space-y-2">
            <div className="text-3xl">🔍</div>
            <p>没有匹配的算法模式</p>
            <button
              onClick={() => { setSearch(''); setActiveCategory('全部'); }}
              className="text-indigo-400 text-sm hover:text-indigo-300 underline"
            >
              清除筛选
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ===== 模式卡片 =====
function PatternCard({ pattern }: { pattern: Pattern }) {
  const signals = safeArray(pattern.signals);
  const problems = safeArray(pattern.relatedProblems);
  const variants = safeArray(pattern.variants);
  const visibleSignals = signals.slice(0, 3);
  const moreSignals = signals.length - 3;

  return (
    <Link
      href={`/patterns/${pattern.id.replace('pattern:', '')}`}
      className="group block rounded-2xl border border-gray-800 bg-gray-900/60
        hover:border-indigo-700/60 hover:bg-gray-900/80
        transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-indigo-900/20
        overflow-hidden"
    >
      {/* 顶部色条 */}
      <div className="h-1 w-full bg-gradient-to-r from-indigo-600/0 via-indigo-500/60 to-indigo-600/0
        opacity-0 group-hover:opacity-100 transition-opacity" />

      <div className="p-5">
        {/* 标题行 */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <h3 className="text-base font-semibold text-gray-100 group-hover:text-white transition-colors line-clamp-1">
            {pattern.name}
          </h3>
          <span className={`shrink-0 text-xs px-2.5 py-1 rounded-lg border font-medium ${getCategoryBadge(pattern.category)}`}>
            {pattern.category}
          </span>
        </div>

        {/* 识别信号 */}
        {signals.length > 0 && (
          <div className="mb-3">
            <div className="flex flex-wrap gap-1.5">
              {visibleSignals.map((sig, i) => (
                <span key={i}
                  className="text-xs px-2 py-0.5 rounded-md bg-gray-800 text-gray-400 border border-gray-700/50">
                  {sig}
                </span>
              ))}
              {moreSignals > 0 && (
                <span className="text-xs px-2 py-0.5 rounded-md bg-gray-800 text-gray-600">
                  +{moreSignals}
                </span>
              )}
            </div>
          </div>
        )}

        {/* 底部统计 */}
        <div className="flex items-center gap-3 text-xs text-gray-600 pt-2 border-t border-gray-800">
          <span className="flex items-center gap-1">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" />
            </svg>
            {problems.length} 题
          </span>
          {variants.length > 0 && (
            <span className="flex items-center gap-1">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4" />
              </svg>
              {variants.length} 变体
            </span>
          )}
          <span className="ml-auto flex items-center gap-1 text-indigo-500 group-hover:text-indigo-400 transition-colors">
            查看详情
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </span>
        </div>
      </div>
    </Link>
  );
}

// ===== 骨架屏 =====
function ListSkeleton() {
  return (
    <div className="space-y-6">
      <div className="h-10 w-48 rounded-xl bg-gray-800 animate-pulse" />
      <div className="flex gap-2">
        {[1,2,3,4].map(i => <div key={i} className="h-8 w-20 rounded-xl bg-gray-800 animate-pulse" />)}
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({length: 9}).map((_, i) => (
          <div key={i} className="h-36 rounded-2xl bg-gray-800/60 animate-pulse" />
        ))}
      </div>
    </div>
  );
}
