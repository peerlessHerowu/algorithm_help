'use client';

/**
 * NarrationPanel — 步骤解说面板
 *
 * 展示当前步骤的解说文字，关键词加粗高亮，
 * 关键决策步骤有金色脉冲边框 + "关键！"badge
 */

import type { NarrationData } from './types';

interface NarrationPanelProps {
  narration: NarrationData | null;
  stepTitle?: string;
  className?: string;
}

export default function NarrationPanel({ narration, stepTitle, className = '' }: NarrationPanelProps) {
  if (!narration) {
    return (
      <div className={`rounded-lg bg-gray-50 dark:bg-gray-800/50 p-3 ${className}`}>
        <p className="text-xs text-gray-400 dark:text-gray-500">等待播放...</p>
      </div>
    );
  }

  // 高亮关键词
  const highlightText = (text: string, keywords: string[] = []) => {
    if (!keywords.length) return <span>{text}</span>;

    const pattern = keywords.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
    const regex = new RegExp(`(${pattern})`, 'g');
    const parts = text.split(regex);

    return (
      <>
        {parts.map((part, i) =>
          keywords.includes(part) ? (
            <span key={i} className="font-semibold text-blue-600 dark:text-blue-400">
              {part}
            </span>
          ) : (
            <span key={i}>{part}</span>
          )
        )}
      </>
    );
  };

  return (
    <div
      className={[
        'rounded-lg p-3 transition-all duration-300',
        narration.isKeyDecision
          ? 'bg-amber-50 dark:bg-amber-950/20 border border-amber-300 dark:border-amber-700'
          : 'bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700',
        className,
      ].join(' ')}
      style={
        narration.isKeyDecision
          ? { animation: 'decision-pulse 1.5s ease infinite' }
          : undefined
      }
    >
      <div className="flex items-start gap-2">
        {/* 关键决策 badge */}
        {narration.isKeyDecision && (
          <span className="flex-shrink-0 mt-0.5 rounded-full bg-amber-400 px-1.5 py-0.5
            text-[10px] font-bold text-white leading-none">
            关键
          </span>
        )}

        <div className="flex-1 min-w-0">
          {/* 步骤标题 */}
          {stepTitle && (
            <p className="text-[11px] font-medium text-gray-400 dark:text-gray-500 mb-0.5">
              {stepTitle}
            </p>
          )}

          {/* 解说文字 */}
          <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
            {highlightText(narration.text, narration.keywords)}
          </p>

          {/* 关键决策额外说明 */}
          {narration.isKeyDecision && narration.keyDecisionNote && (
            <p className="mt-1 text-xs text-amber-700 dark:text-amber-400 font-medium">
              💡 {narration.keyDecisionNote}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
