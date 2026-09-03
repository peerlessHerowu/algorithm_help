'use client';

/**
 * 数学基础关联卡片组件
 * 仅在 level >= 4 时且该题模式有 MATH_FOUNDATION 关系时展示
 * 放置在解析内容最底部，点击跳转到数学关联详情
 * 数据来源：GET /api/v1/problems/{id} 返回的 mathFoundation 字段
 */

import Link from 'next/link';

/** MathFoundationCard 组件 Props */
export interface MathFoundationCardProps {
  /** 数学知识主题名称，如"递推关系" */
  mathTopicName: string;
  /** 关联的算法模式名称，如"动态规划" */
  patternName: string;
  /** 一句话说明数学与模式的关系 */
  oneSentence: string;
  /** 数学关联详情页 ID，用于跳转 */
  mathRelationId: string;
  /** 自定义样式类名 */
  className?: string;
}

/**
 * 数学基础关联卡片
 * 蓝色边框+半透明底色风格，展示数学知识与算法模式的关联
 */
export default function MathFoundationCard({
  mathTopicName,
  patternName,
  oneSentence,
  mathRelationId,
  className,
}: MathFoundationCardProps) {
  return (
    <Link href={`/patterns/${mathRelationId}#math`}>
      <div
        className={`p-4 rounded-lg border border-blue-200 bg-blue-50/50
          dark:border-blue-800 dark:bg-blue-900/20
          hover:shadow-md transition-shadow cursor-pointer mt-8
          ${className || ''}`}
      >
        {/* 标题区域 */}
        <div className="flex items-center gap-2 mb-2">
          <span className="text-lg">📐</span>
          <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
            数学基础 · {mathTopicName}
          </span>
        </div>
        {/* 一句话说明 */}
        <p className="text-sm text-gray-700 dark:text-gray-300">
          {oneSentence}
        </p>
        {/* 跳转链接文字 */}
        <span className="text-xs text-blue-600 dark:text-blue-400 mt-2 inline-block">
          深入了解 {patternName} 背后的数学 →
        </span>
      </div>
    </Link>
  );
}
