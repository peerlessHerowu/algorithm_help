'use client';

/**
 * EmptyState - 空状态引导组件（升级版）
 * 升级内容：动效入场、图标脉冲、更清晰的引导文案
 */

import { useCallback } from 'react';

interface EmptyStateProps {
  isLoggedIn: boolean;
  isCreating?: boolean;
  onGenerate: () => void;
  onLoginRequired: (intent: string) => void;
  className?: string;
}

export default function EmptyState({
  isLoggedIn,
  isCreating = false,
  onGenerate,
  onLoginRequired,
  className,
}: EmptyStateProps) {
  const handleClick = useCallback(() => {
    if (!isLoggedIn) {
      onLoginRequired('generate');
      return;
    }
    onGenerate();
  }, [isLoggedIn, onGenerate, onLoginRequired]);

  return (
    <div className={`flex flex-col items-center justify-center py-16 px-4 animate-fade-in-up ${className || ''}`}>

      {/* 图标区域 — 脉冲光晕 */}
      <div className="relative mb-6">
        {/* 外层脉冲光晕 */}
        <div className="absolute inset-0 rounded-full bg-blue-100 dark:bg-blue-900/20 animate-ping opacity-30" />
        <div className="relative flex h-16 w-16 items-center justify-center rounded-full
          bg-gradient-to-br from-blue-50 to-indigo-100
          dark:from-blue-900/30 dark:to-indigo-900/30
          border border-blue-100 dark:border-blue-800/50
          shadow-sm">
          <svg className="h-8 w-8 text-blue-500 dark:text-blue-400" fill="none" viewBox="0 0 24 24"
            stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25
                12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0
                003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259
                8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25
                6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375
                3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z"
            />
          </svg>
        </div>
      </div>

      {/* 标题 */}
      <h3 className="mb-2 text-base font-semibold text-gray-700 dark:text-gray-200">
        该级别还没有 AI 解析内容
      </h3>

      {isLoggedIn ? (
        <>
          <p className="mb-6 text-sm text-gray-500 dark:text-gray-400 text-center max-w-xs leading-relaxed">
            AI 将基于高质量社区题解，为这道题生成分级深度解析
          </p>

          <button
            type="button"
            onClick={handleClick}
            disabled={isCreating}
            className="inline-flex items-center gap-2 rounded-xl
              bg-gradient-to-r from-blue-600 to-indigo-600
              hover:from-blue-700 hover:to-indigo-700
              px-6 py-2.5 text-sm font-medium text-white shadow-sm shadow-blue-200 dark:shadow-none
              focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2
              disabled:cursor-not-allowed disabled:opacity-60
              transition-all duration-200 active:scale-95"
          >
            {isCreating ? (
              <>
                <LoadingSpinner />
                创建中...
              </>
            ) : (
              <>
                <SparkleIcon />
                AI 生成解析
              </>
            )}
          </button>

          <p className="mt-3 text-xs text-gray-400 dark:text-gray-500">
            预计 30–60 秒完成
          </p>
        </>
      ) : (
        <>
          <p className="mb-6 text-sm text-gray-500 dark:text-gray-400 text-center max-w-xs">
            登录后可使用 AI 生成深度解析
          </p>
          <button
            type="button"
            onClick={handleClick}
            className="inline-flex items-center gap-2 rounded-xl
              bg-gray-100 hover:bg-gray-200 px-5 py-2.5 text-sm font-medium text-gray-700 shadow-sm
              dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700
              focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400
              transition-all duration-200 active:scale-95"
          >
            登录后使用
          </button>
        </>
      )}
    </div>
  );
}

function SparkleIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25
          12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0
          003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z"
      />
    </svg>
  );
}

function LoadingSpinner() {
  return (
    <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}
