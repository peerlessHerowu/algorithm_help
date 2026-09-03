'use client';

/**
 * 解法多维对比矩阵组件
 * 展示多种解法的对比表格（名称/时间复杂度/空间复杂度/适用场景）
 * 可选渲染解法演进图（Mermaid）
 */

import type { Approach } from '@/lib/types';
import MermaidRendererDynamic from '@/components/MermaidRendererDynamic';

interface ApproachComparisonProps {
  /** 解法列表 */
  approaches: Approach[];
  /** 解法演进 Mermaid 图代码 */
  evolutionMermaid?: string;
  /** 自定义样式类名 */
  className?: string;
}

export default function ApproachComparison({
  approaches,
  evolutionMermaid,
  className,
}: ApproachComparisonProps) {
  if (!approaches || approaches.length === 0) {
    return null;
  }

  return (
    <div className={className || ''}>
      {/* 对比矩阵表格 - 移动端横向滚动 */}
      <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-800">
              <th className="whitespace-nowrap px-4 py-3 text-left font-medium text-gray-700 dark:text-gray-300">
                解法名称
              </th>
              <th className="whitespace-nowrap px-4 py-3 text-left font-medium text-gray-700 dark:text-gray-300">
                时间复杂度
              </th>
              <th className="whitespace-nowrap px-4 py-3 text-left font-medium text-gray-700 dark:text-gray-300">
                空间复杂度
              </th>
              <th className="whitespace-nowrap px-4 py-3 text-left font-medium text-gray-700 dark:text-gray-300">
                适用场景
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {approaches.map((approach, idx) => (
              <tr
                key={idx}
                className="bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800/50"
              >
                <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">
                  {approach.name}
                </td>
                <td className="px-4 py-3 text-gray-600 dark:text-gray-400 font-mono text-xs">
                  {approach.timeComplexity}
                </td>
                <td className="px-4 py-3 text-gray-600 dark:text-gray-400 font-mono text-xs">
                  {approach.spaceComplexity}
                </td>
                <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                  {approach.whenToUse}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 解法演进图 */}
      {evolutionMermaid && (
        <div className="mt-6">
          <h4 className="mb-3 text-sm font-medium text-gray-700 dark:text-gray-300">
            解法演进
          </h4>
          <MermaidRendererDynamic code={evolutionMermaid} className="rounded-lg border border-gray-200 dark:border-gray-700 p-4" />
        </div>
      )}
    </div>
  );
}
