'use client';

/**
 * 跨域迁移映射表组件
 * 展示算法思想在不同领域（LeetCode/工作/AI-ML/日常）的应用映射
 * 支持点击行展开详情面板（含代码对比）
 * 移动端横向滚动支持
 */

import { useState, useCallback } from 'react';
import type { CrossDomainMapping } from '@/lib/types';
import CodeBlock from '@/components/CodeBlock';

/** 组件 Props 定义 */
interface CrossDomainTableProps {
  /** 映射数据列表 */
  mappings: CrossDomainMapping[];
  /** 关联的算法模式名称（展示在标题中） */
  patternName?: string;
  /** 自定义样式类名 */
  className?: string;
}

/** 表头列配置 */
const TABLE_COLUMNS = [
  { key: 'leetcode', label: 'LeetCode 场景', icon: '💻' },
  { key: 'work', label: '工作中', icon: '🏢' },
  { key: 'aiMl', label: 'AI/ML', icon: '🤖' },
  { key: 'daily', label: '日常生活', icon: '🌍' },
] as const;

/**
 * 跨域迁移映射表
 * 嵌入模式详情页底部，展示同一算法思想在多个领域的应用对应关系
 */
export default function CrossDomainTable({
  mappings,
  patternName,
  className = '',
}: CrossDomainTableProps) {
  // 当前展开的行 ID
  const [expandedId, setExpandedId] = useState<string | null>(null);

  /** 切换行展开/收起 */
  const toggleRow = useCallback((id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  }, []);

  // 无数据时不渲染
  if (!mappings || mappings.length === 0) {
    return null;
  }

  return (
    <section className={`mt-8 ${className}`}>
      {/* 区域标题 */}
      <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-gray-800 dark:text-gray-200">
        <span>🔄</span>
        <span>跨域迁移映射表</span>
        {patternName && (
          <span className="text-sm font-normal text-gray-500 dark:text-gray-400">
            — {patternName}
          </span>
        )}
      </h2>

      {/* 表格容器：移动端横向滚动 */}
      <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
        <table className="min-w-[640px] w-full text-sm">
          {/* 表头 */}
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-800/50">
              {TABLE_COLUMNS.map((col) => (
                <th
                  key={col.key}
                  className="px-4 py-3 text-left font-medium text-gray-700 dark:text-gray-300"
                >
                  <span className="mr-1">{col.icon}</span>
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>

          {/* 表体 */}
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {mappings.map((mapping) => (
              <MappingRow
                key={mapping.id}
                mapping={mapping}
                isExpanded={expandedId === mapping.id}
                onToggle={toggleRow}
              />
            ))}
          </tbody>
        </table>
      </div>

      {/* 底部提示 */}
      <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">
        点击行查看详细解释和代码对比
      </p>
    </section>
  );
}


// ============ 子组件 ============

/** 单行映射数据 Props */
interface MappingRowProps {
  mapping: CrossDomainMapping;
  isExpanded: boolean;
  onToggle: (id: string) => void;
}

/** 映射表单行组件（含展开详情面板） */
function MappingRow({ mapping, isExpanded, onToggle }: MappingRowProps) {
  return (
    <>
      {/* 数据行：点击展开/收起 */}
      <tr
        onClick={() => onToggle(mapping.id)}
        className={`cursor-pointer transition-colors hover:bg-blue-50/50 dark:hover:bg-blue-900/10 ${
          isExpanded
            ? 'bg-blue-50/30 dark:bg-blue-900/20'
            : ''
        }`}
      >
        <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
          {mapping.leetcode}
        </td>
        <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
          {mapping.work}
        </td>
        <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
          {mapping.aiMl}
        </td>
        <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
          <div className="flex items-center justify-between">
            <span>{mapping.daily}</span>
            {/* 展开/收起指示箭头 */}
            <span
              className={`ml-2 inline-block text-gray-400 transition-transform duration-200 ${
                isExpanded ? 'rotate-180' : ''
              }`}
            >
              ▼
            </span>
          </div>
        </td>
      </tr>

      {/* 展开的详情面板 */}
      {isExpanded && (
        <tr>
          <td colSpan={4} className="px-4 py-4 bg-gray-50/50 dark:bg-gray-800/30">
            <DetailPanel mapping={mapping} />
          </td>
        </tr>
      )}
    </>
  );
}

/** 详情面板 Props */
interface DetailPanelProps {
  mapping: CrossDomainMapping;
}

/** 展开后的详情面板（含解释文字和代码对比） */
function DetailPanel({ mapping }: DetailPanelProps) {
  const hasCode = mapping.codeComparison && Object.keys(mapping.codeComparison).length > 0;

  return (
    <div className="space-y-3">
      {/* 详细解释 */}
      {mapping.detailExplanation && (
        <div>
          <h4 className="mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">
            💡 详细解释
          </h4>
          <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
            {mapping.detailExplanation}
          </p>
        </div>
      )}

      {/* 代码对比 */}
      {hasCode && (
        <div>
          <h4 className="mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">
            📝 代码对比
          </h4>
          <CodeBlock code={mapping.codeComparison!} />
        </div>
      )}

      {/* 无详情时的占位提示 */}
      {!mapping.detailExplanation && !hasCode && (
        <p className="text-sm text-gray-400 dark:text-gray-500 italic">
          暂无详细说明
        </p>
      )}
    </div>
  );
}
