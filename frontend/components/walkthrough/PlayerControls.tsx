'use client';

/**
 * PlayerControls — 播放控制栏
 *
 * ◀◀ 第一步  ◀ 上一步  ▶/⏸ 播放/暂停  ▶ 下一步  ▶▶ 最后步
 * 进度条（可点击跳转）
 * 速度选择 0.5x / 1x / 1.5x / 2x
 */

import type { PlayerState } from './types';

interface PlayerControlsProps {
  state: PlayerState;
  currentStep: number;   // 0-based
  totalSteps: number;
  speed: number;
  onPlay: () => void;
  onPause: () => void;
  onNext: () => void;
  onPrev: () => void;
  onFirst: () => void;
  onLast: () => void;
  onSeek: (step: number) => void;
  onSpeedChange: (speed: number) => void;
  className?: string;
}

const SPEEDS = [0.5, 1, 1.5, 2] as const;

export default function PlayerControls({
  state,
  currentStep,
  totalSteps,
  speed,
  onPlay,
  onPause,
  onNext,
  onPrev,
  onFirst,
  onLast,
  onSeek,
  onSpeedChange,
  className = '',
}: PlayerControlsProps) {
  const isPlaying = state === 'playing';
  const isLoading = state === 'loading';
  const isIdle    = state === 'idle';
  const isComplete = state === 'complete';
  const canPrev = currentStep > 0;
  const canNext = currentStep < totalSteps - 1;
  const progress = totalSteps > 0 ? (currentStep / (totalSteps - 1)) * 100 : 0;

  const btnBase = `
    inline-flex items-center justify-center rounded-md
    transition-colors duration-150 focus:outline-none
    focus-visible:ring-2 focus-visible:ring-blue-400
    disabled:opacity-40 disabled:cursor-not-allowed
  `;

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      {/* 进度条 */}
      <div className="relative group">
        <div
          className="h-1.5 rounded-full bg-gray-200 dark:bg-gray-700 cursor-pointer overflow-hidden"
          onClick={e => {
            if (!totalSteps) return;
            const rect = e.currentTarget.getBoundingClientRect();
            const ratio = (e.clientX - rect.left) / rect.width;
            const step = Math.round(ratio * (totalSteps - 1));
            onSeek(Math.max(0, Math.min(totalSteps - 1, step)));
          }}
          role="slider"
          aria-label="播放进度"
          aria-valuemin={0}
          aria-valuemax={totalSteps - 1}
          aria-valuenow={currentStep}
        >
          <div
            className="h-full bg-blue-500 transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
        {/* 进度点 */}
        <div
          className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full
            bg-blue-500 border-2 border-white dark:border-gray-900 shadow
            transition-all duration-300 pointer-events-none"
          style={{ left: `calc(${progress}% - 6px)` }}
        />
      </div>

      {/* 控制按钮行 */}
      <div className="flex items-center justify-between gap-1">
        {/* 左侧：导航按钮 */}
        <div className="flex items-center gap-1">
          {/* 第一步 */}
          <button
            type="button"
            className={`${btnBase} w-7 h-7 text-gray-500 dark:text-gray-400
              hover:bg-gray-100 dark:hover:bg-gray-800`}
            onClick={onFirst}
            disabled={!canPrev || isLoading}
            aria-label="回到第一步"
            title="第一步"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
              <rect x="1" y="2" width="2" height="10" rx="0.5"/>
              <path d="M12 2L5 7l7 5V2z"/>
            </svg>
          </button>

          {/* 上一步 */}
          <button
            type="button"
            className={`${btnBase} w-7 h-7 text-gray-500 dark:text-gray-400
              hover:bg-gray-100 dark:hover:bg-gray-800`}
            onClick={onPrev}
            disabled={!canPrev || isLoading}
            aria-label="上一步"
            title="上一步"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
              <path d="M10 2L3 7l7 5V2z"/>
            </svg>
          </button>

          {/* 播放/暂停 — 主按钮 */}
          <button
            type="button"
            className={`${btnBase} w-9 h-9 rounded-lg
              bg-blue-500 hover:bg-blue-600 active:bg-blue-700 text-white
              disabled:bg-blue-300`}
            onClick={isPlaying ? onPause : onPlay}
            disabled={isLoading || isComplete}
            aria-label={isPlaying ? '暂停' : isComplete ? '已结束' : '播放'}
          >
            {isLoading ? (
              <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2a10 10 0 0 1 0 20"/>
              </svg>
            ) : isPlaying ? (
              /* 暂停图标 */
              <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
                <rect x="2" y="2" width="3.5" height="10" rx="0.5"/>
                <rect x="8.5" y="2" width="3.5" height="10" rx="0.5"/>
              </svg>
            ) : (
              /* 播放图标 */
              <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
                <path d="M3 2l8 5-8 5V2z"/>
              </svg>
            )}
          </button>

          {/* 下一步 */}
          <button
            type="button"
            className={`${btnBase} w-7 h-7 text-gray-500 dark:text-gray-400
              hover:bg-gray-100 dark:hover:bg-gray-800`}
            onClick={onNext}
            disabled={!canNext || isLoading}
            aria-label="下一步"
            title="下一步"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
              <path d="M4 2l7 5-7 5V2z"/>
            </svg>
          </button>

          {/* 最后步 */}
          <button
            type="button"
            className={`${btnBase} w-7 h-7 text-gray-500 dark:text-gray-400
              hover:bg-gray-100 dark:hover:bg-gray-800`}
            onClick={onLast}
            disabled={!canNext || isLoading}
            aria-label="跳到最后"
            title="最后步"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
              <rect x="11" y="2" width="2" height="10" rx="0.5"/>
              <path d="M2 2l7 5-7 5V2z"/>
            </svg>
          </button>
        </div>

        {/* 右侧：步骤计数 + 速度 */}
        <div className="flex items-center gap-2">
          {/* 步骤计数 */}
          <span className="text-xs text-gray-500 dark:text-gray-400 tabular-nums">
            {isIdle ? (
              <span className="text-gray-400">—</span>
            ) : (
              <>
                <span className="font-medium text-gray-700 dark:text-gray-300">
                  {currentStep + 1}
                </span>
                <span className="text-gray-400"> / {totalSteps}</span>
              </>
            )}
          </span>

          {/* 速度选择 */}
          <div className="flex items-center gap-0.5 rounded-md border border-gray-200
            dark:border-gray-700 overflow-hidden">
            {SPEEDS.map(s => (
              <button
                key={s}
                type="button"
                className={[
                  'px-1.5 py-0.5 text-[10px] font-medium transition-colors duration-100',
                  'focus:outline-none',
                  speed === s
                    ? 'bg-blue-500 text-white'
                    : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800',
                ].join(' ')}
                onClick={() => onSpeedChange(s)}
                aria-pressed={speed === s}
              >
                {s}x
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
