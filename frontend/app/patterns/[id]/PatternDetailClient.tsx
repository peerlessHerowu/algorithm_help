'use client';

/**
 * 算法模式详情页客户端组件
 * 展示模式完整信息：名称、分类、信号、模板代码、变体、关联题目
 */

import { useParams } from 'next/navigation';
import useSWR from 'swr';
import Link from 'next/link';
import { fetcher } from '@/lib/fetcher';
import { safeArray } from '@/lib/safeArray';
import type { Pattern } from '@/lib/types';
import CodeBlock from '@/components/CodeBlock';
import CrossDomainTable from '@/components/patterns/CrossDomainTable';

export default function PatternDetailClient() {
  const params = useParams();
  const id = params.id as string;

  const { data: pattern, error, isLoading } = useSWR<Pattern>(
    id ? `/api/v1/patterns/${encodeURIComponent(id)}` : null,
    fetcher
  );

  // 加载状态
  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-blue-500" />
      </div>
    );
  }

  // 错误状态
  if (error || !pattern) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <p className="text-lg text-red-500">
            {error?.message || '模式加载失败'}
          </p>
          <Link href="/patterns" className="mt-4 inline-block text-sm text-blue-500 hover:underline">
            返回模式列表
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* 返回导航 */}
      <Link
        href="/patterns"
        className="inline-block mb-6 text-sm text-gray-500 hover:text-gray-700
                   dark:text-gray-400 dark:hover:text-gray-200"
      >
        ← 返回模式列表
      </Link>

      {/* 标题 + 分类 */}
      <div className="mb-6 flex items-center gap-3">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          {pattern.name}
        </h1>
        <span className="rounded-full bg-blue-100 px-3 py-0.5 text-sm font-medium text-blue-700
                         dark:bg-blue-900/30 dark:text-blue-400">
          {pattern.category}
        </span>
      </div>

      {/* 识别信号 */}
      {safeArray(pattern.signals).length > 0 && (
        <section className="mb-6">
          <h2 className="mb-3 text-lg font-semibold text-gray-800 dark:text-gray-200">
            识别信号
          </h2>
          <ul className="list-disc pl-5 space-y-1 text-gray-700 dark:text-gray-300">
            {safeArray(pattern.signals).map((signal, idx) => (
              <li key={idx}>{signal}</li>
            ))}
          </ul>
        </section>
      )}

      {/* 模板代码 */}
      {(() => {
        const tmpl = typeof pattern.template === 'string'
          ? (() => { try { return JSON.parse(pattern.template); } catch { return {}; } })()
          : pattern.template || {};
        return Object.keys(tmpl).length > 0 ? (
          <section className="mb-6">
            <h2 className="mb-3 text-lg font-semibold text-gray-800 dark:text-gray-200">
              通用模板
            </h2>
            <CodeBlock code={tmpl} />
          </section>
        ) : null;
      })()}

      {/* 变体 */}
      {safeArray(pattern.variants).length > 0 && (
        <section className="mb-6">
          <h2 className="mb-3 text-lg font-semibold text-gray-800 dark:text-gray-200">
            变体
          </h2>
          <ul className="list-disc pl-5 space-y-1 text-gray-700 dark:text-gray-300">
            {safeArray(pattern.variants).map((variant, idx) => (
              <li key={idx}>{variant}</li>
            ))}
          </ul>
        </section>
      )}

      {/* 关联题目 */}
      {safeArray(pattern.relatedProblems).length > 0 && (
        <section className="mb-6">
          <h2 className="mb-3 text-lg font-semibold text-gray-800 dark:text-gray-200">
            关联题目
          </h2>
          <div className="flex flex-wrap gap-2">
            {safeArray(pattern.relatedProblems).map((problemId) => (
              <Link
                key={problemId}
                href={`/problems/${problemId}`}
                className="rounded-md bg-gray-100 px-3 py-1 text-sm text-gray-700
                           hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300
                           dark:hover:bg-gray-700"
              >
                {problemId}
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* 跨域迁移映射表 */}
      <CrossDomainTable
        mappings={pattern.crossDomainMappings ?? []}
        patternName={pattern.name}
      />
    </div>
  );
}
