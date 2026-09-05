'use client';

/**
 * AlgoCanvas — 算法可视化画布
 *
 * MVP 版本：根据 scenetype 展示不同的数据结构图，
 * 使用 SVG 渲染基本结构（数组/链表/哈希/树/DP表格），
 * 根据当前步骤的 animations 指令高亮对应元素。
 *
 * 后续版本可接入 D3.js 做更精细的动画渲染。
 */

import { useMemo } from 'react';
import type { TeachingStep, InitialScene, SceneElement } from './types';

interface AlgoCanvasProps {
  initialScene: InitialScene;
  currentStep: TeachingStep | null;
  className?: string;
}

export default function AlgoCanvas({ initialScene, currentStep, className = '' }: AlgoCanvasProps) {
  // 根据当前步骤的 animations 计算高亮的元素 ID 集合
  const highlightedIds = useMemo(() => {
    const ids = new Set<string>();
    if (!currentStep?.animations) return ids;
    for (const anim of currentStep.animations) {
      if (anim.targetId) ids.add(anim.targetId);
      // 特殊处理 hash_hit — 额外高亮
      if (anim.type === 'hash_hit' && anim.params?.key) {
        ids.add(`hash_${anim.params.key}`);
      }
    }
    return ids;
  }, [currentStep]);

  // 根据动画类型判断高亮颜色
  const getHighlightColor = (elementId: string) => {
    if (!currentStep?.animations) return null;
    const anim = currentStep.animations.find(a => a.targetId === elementId);
    if (!anim) return null;
    switch (anim.type) {
      case 'hash_hit':
      case 'array_compare':
        return 'hit'; // 绿色
      case 'stack_pop':
      case 'queue_dequeue':
        return 'remove'; // 红色
      default:
        return 'current'; // 蓝色
    }
  };

  const sceneType = initialScene?.type ?? 'generic';
  const elements  = initialScene?.elements ?? [];

  return (
    <div className={`relative flex items-center justify-center
      min-h-[200px] rounded-lg
      bg-slate-50 dark:bg-slate-900
      border border-gray-200 dark:border-gray-700
      overflow-hidden ${className}`}>

      {/* 场景渲染 */}
      <div className="w-full p-4">
        {sceneType === 'array' && (
          <ArrayScene elements={elements} highlightedIds={highlightedIds} getColor={getHighlightColor} />
        )}
        {sceneType === 'linked_list' && (
          <LinkedListScene elements={elements} highlightedIds={highlightedIds} getColor={getHighlightColor} />
        )}
        {sceneType === 'hash' && (
          <HashScene elements={elements} highlightedIds={highlightedIds} getColor={getHighlightColor} />
        )}
        {sceneType === 'dp_table' && (
          <DpTableScene elements={elements} highlightedIds={highlightedIds} getColor={getHighlightColor} />
        )}
        {sceneType === 'tree' && (
          <TreeScene elements={elements} highlightedIds={highlightedIds} getColor={getHighlightColor} />
        )}
        {!['array', 'linked_list', 'hash', 'dp_table', 'tree'].includes(sceneType) && (
          <GenericScene initialScene={initialScene} currentStep={currentStep} />
        )}
      </div>

      {/* 步骤动画指令列表（调试/辅助信息，小字显示） */}
      {currentStep && currentStep.animations.length > 0 && (
        <div className="absolute bottom-2 right-2 flex flex-wrap gap-1 max-w-[200px]">
          {currentStep.animations.slice(0, 3).map((anim, i) => (
            <span key={i}
              className="rounded px-1 py-0.5 text-[9px] font-mono
                bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500">
              {anim.type}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ── 场景渲染子组件 ──────────────────────────────────────────────────────────

type HighlightType = 'current' | 'hit' | 'remove' | null;
interface SceneProps {
  elements: SceneElement[];
  highlightedIds: Set<string>;
  getColor: (id: string) => HighlightType;
}

const COLORS: Record<NonNullable<HighlightType>, string> = {
  current: 'bg-blue-500 text-white border-blue-500',
  hit:     'bg-green-500 text-white border-green-500',
  remove:  'bg-red-400 text-white border-red-400',
};

/** 数组场景 */
function ArrayScene({ elements, highlightedIds, getColor }: SceneProps) {
  return (
    <div className="flex items-center justify-center gap-0 flex-wrap">
      {elements.map((el, i) => {
        const hl = highlightedIds.has(el.id) ? getColor(el.id) : null;
        const colorClass = hl ? COLORS[hl] : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600';
        return (
          <div key={el.id} className="flex flex-col items-center">
            <div className={`
              min-w-[36px] h-9 flex items-center justify-center
              border-r border-t border-b first:border-l first:rounded-l-md last:rounded-r-md
              font-mono text-sm font-medium transition-all duration-300
              ${colorClass}
            `}>
              {String(el.value ?? '')}
            </div>
            <span className="text-[9px] text-gray-400 mt-0.5">{el.index ?? i}</span>
          </div>
        );
      })}
    </div>
  );
}

/** 链表场景 */
function LinkedListScene({ elements, highlightedIds, getColor }: SceneProps) {
  return (
    <div className="flex items-center justify-center gap-0 flex-wrap">
      {elements.map((el, i) => {
        const hl = highlightedIds.has(el.id) ? getColor(el.id) : null;
        const isNull = el.value === 'null' || el.value === null;
        const colorClass = isNull ? 'border-dashed border-gray-300 dark:border-gray-600 text-gray-400'
          : hl ? COLORS[hl]
          : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600';
        return (
          <div key={el.id} className="flex items-center">
            {/* 节点框 */}
            <div className={`
              min-w-[44px] h-9 flex items-center justify-center
              rounded-md border font-mono text-sm font-medium
              transition-all duration-300 ${colorClass}
            `}>
              {isNull ? 'null' : String(el.value ?? '')}
            </div>
            {/* 箭头 */}
            {i < elements.length - 1 && !isNull && (
              <span className="mx-1 text-gray-400 text-xs select-none">→</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** 哈希表场景 */
function HashScene({ elements, highlightedIds, getColor }: SceneProps) {
  return (
    <div className="flex flex-col gap-1 items-center min-w-[140px]">
      <p className="text-xs font-medium text-gray-400 dark:text-gray-500 mb-1">哈希表</p>
      {elements.length === 0 ? (
        <div className="rounded-md border border-dashed border-gray-300 dark:border-gray-600
          px-4 py-2 text-xs text-gray-400">空</div>
      ) : (
        elements.map(el => {
          const hl = highlightedIds.has(el.id) ? getColor(el.id) : null;
          const colorClass = hl ? COLORS[hl]
            : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700';
          return (
            <div key={el.id} className={`
              flex items-center gap-2 rounded-md border px-3 py-1.5
              font-mono text-xs w-full transition-all duration-300 ${colorClass}
            `}>
              <span className="font-semibold">{String(el.value ?? el.label ?? el.id)}</span>
            </div>
          );
        })
      )}
    </div>
  );
}

/** DP 表格场景 */
function DpTableScene({ elements, highlightedIds, getColor }: SceneProps) {
  // 尝试推断行列数
  const maxIndex = elements.reduce((m, el) => Math.max(m, el.index ?? 0), 0);
  const cols = Math.min(Math.ceil(Math.sqrt(maxIndex + 1)) + 1, 8);

  return (
    <div className="flex flex-col gap-0.5 items-center">
      <p className="text-xs font-medium text-gray-400 mb-1">DP 表格</p>
      <div className="grid gap-0.5" style={{ gridTemplateColumns: `repeat(${cols}, minmax(32px, 1fr))` }}>
        {elements.map(el => {
          const hl = highlightedIds.has(el.id) ? getColor(el.id) : null;
          const colorClass = hl ? COLORS[hl]
            : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700';
          return (
            <div key={el.id} className={`
              flex items-center justify-center h-8 rounded border
              font-mono text-xs transition-all duration-300 ${colorClass}
            `}>
              {el.value !== undefined && el.value !== null ? String(el.value) : '0'}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** 树场景（简单 flex 布局，MVP版） */
function TreeScene({ elements, highlightedIds, getColor }: SceneProps) {
  return (
    <div className="flex items-center justify-center gap-2 flex-wrap">
      {elements.map(el => {
        const hl = highlightedIds.has(el.id) ? getColor(el.id) : null;
        const colorClass = hl ? COLORS[hl]
          : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600';
        return (
          <div key={el.id} className={`
            w-9 h-9 rounded-full flex items-center justify-center
            border-2 font-mono text-sm font-medium
            transition-all duration-300 ${colorClass}
          `}>
            {String(el.value ?? '')}
          </div>
        );
      })}
    </div>
  );
}

/** 通用/兜底场景 — 显示动画指令描述 */
function GenericScene({ initialScene, currentStep }: { initialScene: InitialScene; currentStep: TeachingStep | null }) {
  return (
    <div className="flex flex-col items-center gap-3 text-center px-4">
      <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30
        flex items-center justify-center text-2xl">
        📊
      </div>
      <div>
        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {initialScene.description || '算法执行中'}
        </p>
        {currentStep?.narration.text && (
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 max-w-[260px]">
            {currentStep.narration.text}
          </p>
        )}
      </div>
      {/* 动画指令提示 */}
      {currentStep?.animations.map((anim, i) => (
        <div key={i} className="text-[11px] font-mono text-blue-500 dark:text-blue-400
          bg-blue-50 dark:bg-blue-950/20 rounded px-2 py-0.5">
          {anim.type}({anim.targetId})
        </div>
      ))}
    </div>
  );
}
