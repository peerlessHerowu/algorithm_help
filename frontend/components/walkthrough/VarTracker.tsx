'use client';

/**
 * VarTracker — 变量状态追踪表
 *
 * 展示每步的变量值变化：
 * - 当前步骤行高亮（蓝色背景）
 * - 本步发生变化的值：紫色文字 + 淡入动画
 * - 已完成步骤：正常灰色
 * - 待执行步骤：淡化
 */

import { useEffect, useRef } from 'react';
import type { TeachingStep } from './types';

interface VarTrackerProps {
  steps: TeachingStep[];
  currentStep: number; // 0-based index
  className?: string;
}

export default function VarTracker({ steps, currentStep, className = '' }: VarTrackerProps) {
  const currentRowRef = useRef<HTMLTableRowElement>(null);

  // 当前步骤变化时，滚动到可见区域
  useEffect(() => {
    currentRowRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [currentStep]);

  if (!steps.length) return null;

  // 收集所有变量名（保持顺序稳定）
  const allVarNames = Array.from(
    new Set(steps.flatMap(s => s.variables?.map(v => v.name) ?? []))
  );

  if (!allVarNames.length) return null;

  // 最多显示 8 步（太多滚动麻烦）
  const visibleStart = Math.max(0, currentStep - 3);
  const visibleSteps = steps.slice(visibleStart, visibleStart + 8);

  return (
    <div className={`rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden ${className}`}>
      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
              <th className="px-2 py-1.5 text-left font-medium text-gray-500 dark:text-gray-400 w-12">
                步骤
              </th>
              {allVarNames.map(name => (
                <th key={name} className="px-2 py-1.5 text-left font-medium text-gray-500 dark:text-gray-400">
                  <code className="font-mono">{name}</code>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleSteps.map((step, idx) => {
              const globalIdx = visibleStart + idx;
              const isCurrentStep = globalIdx === currentStep;
              const isPastStep = globalIdx < currentStep;
              const isFutureStep = globalIdx > currentStep;

              return (
                <tr
                  key={step.step}
                  ref={isCurrentStep ? currentRowRef : undefined}
                  className={[
                    'border-b last:border-b-0 transition-colors duration-200',
                    'border-gray-100 dark:border-gray-800',
                    isCurrentStep
                      ? 'bg-blue-50 dark:bg-blue-950/30'
                      : isPastStep
                      ? 'bg-white dark:bg-gray-900'
                      : 'bg-white dark:bg-gray-900 opacity-40',
                  ].join(' ')}
                >
                  {/* 步骤编号 */}
                  <td className="px-2 py-1.5">
                    <span className={[
                      'inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold',
                      isCurrentStep
                        ? 'bg-blue-500 text-white'
                        : isPastStep
                        ? 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-400',
                    ].join(' ')}>
                      {step.step}
                    </span>
                  </td>

                  {/* 变量值 */}
                  {allVarNames.map(name => {
                    const varState = step.variables?.find(v => v.name === name);
                    const value = varState?.value ?? '—';
                    const changed = varState?.changed && isCurrentStep;

                    return (
                      <td key={name} className="px-2 py-1.5 font-mono">
                        {isFutureStep ? (
                          <span className="text-gray-300 dark:text-gray-600">—</span>
                        ) : (
                          <span
                            className={[
                              'transition-colors duration-300',
                              changed
                                ? 'text-violet-600 dark:text-violet-400 font-semibold animate-fade-in'
                                : isCurrentStep
                                ? 'text-gray-800 dark:text-gray-200'
                                : 'text-gray-500 dark:text-gray-500',
                            ].join(' ')}
                            title={varState?.note}
                          >
                            {String(value)}
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
