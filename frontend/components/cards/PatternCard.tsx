'use client';

/**
 * 算法模式卡片组件
 * 展示模式名称、分类标签、信号列表、关联题目数量
 * 点击跳转到模式详情页
 */

import Link from 'next/link';
import { safeArray } from '@/lib/safeArray';

interface PatternCardPattern {
  id: string;
  name: string;
  category: string;
  signals: string[];
  relatedProblems: string[];
}

interface PatternCardProps {
  pattern: PatternCardPattern;
  className?: string;
}

/** 最大展示信号数 */
const MAX_SIGNALS = 3;

export default function PatternCard({ pattern, className }: PatternCardProps) {
  const signals = safeArray(pattern.signals);
  const relatedProblems = safeArray(pattern.relatedProblems);
  const visibleSignals = signals.slice(0, MAX_SIGNALS);
  const moreCount = signals.length - MAX_SIGNALS;

  return (
    <Link
      href={`/patterns/${pattern.id}`}
      className={`block rounded-xl border border-gray-200 bg-white p-5
                  transition-all hover:shadow-lg hover:-translate-y-0.5
                  dark:bg-gray-900 dark:border-gray-700 dark:hover:border-gray-500
                  ${className || ''}`}
    >
      {/* 标题 + 分类标签 */}
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-base font-medium text-gray-900 dark:text-gray-100 line-clamp-2">
          {pattern.name}
        </h3>
        <span className="shrink-0 rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-700
                         dark:bg-blue-900/30 dark:text-blue-400">
          {pattern.category}
        </span>
      </div>

      {/* 识别信号列表 */}
      {signals.length > 0 && (
        <div className="mt-3">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1.5">识别信号</p>
          <div className="flex flex-wrap gap-1.5">
            {visibleSignals.map((signal) => (
              <span
                key={signal}
                className="rounded-md bg-gray-100 px-2 py-0.5 text-xs text-gray-600
                           dark:bg-gray-800 dark:text-gray-400"
              >
                {signal}
              </span>
            ))}
            {moreCount > 0 && (
              <span className="rounded-md bg-gray-100 px-2 py-0.5 text-xs text-gray-400
                               dark:bg-gray-800 dark:text-gray-500">
                +{moreCount} 更多
              </span>
            )}
          </div>
        </div>
      )}

      {/* 关联题目数量 */}
      <div className="mt-3 text-xs text-gray-500 dark:text-gray-400">
        关联题目：{relatedProblems.length} 道
      </div>
    </Link>
  );
}
