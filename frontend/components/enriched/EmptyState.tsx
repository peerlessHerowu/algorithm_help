'use client';

/**
 * EmptyState - 空状态引导组件
 *
 * 职责：
 * - 当某题某级别无 enriched/legacy 数据时展示引导 UI
 * - 已登录：显示"AI 生成解析"按钮 + 预计时间
 * - 未登录：显示"登录后可使用 AI 生成"+ 登录按钮
 *
 * 满足需求 13.1-13.4
 */

import { useCallback } from 'react';

interface EmptyStateProps {
  /** 是否已登录 */
  isLoggedIn: boolean;
  /** 是否正在创建任务（按钮 loading 态） */
  isCreating?: boolean;
  /** 点击生成按钮 */
  onGenerate: () => void;
  /** 未登录时触发登录引导 */
  onLoginRequired: (intent: string) => void;
  /** 自定义类名 */
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
    <div
      className={`flex flex-col items-center justify-center py-16 px-4 ${className || ''}`}
    >
      {/* 图标区域 */}
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full
        bg-blue-50 dark:bg-blue-900/20"
      >
        <svg
          className="h-8 w-8 text-blue-500 dark:text-blue-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25
              12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0
              003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259
              8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25
              6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375
              3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z"
          />
        </svg>
      </div>

      {/* 引导文案 */}
      <h3 className="mb-2 text-base font-medium text-gray-700 dark:text-gray-200">
        该级别还没有 AI 解析内容
      </h3>

      {isLoggedIn ? (
        <>
          {/* 已登录：生成按钮 */}
          <p className="mb-5 text-sm text-gray-500 dark:text-gray-400">
            点击下方按钮，AI 将基于高赞社区题解生成深度解析
          </p>

          <button
            type="button"
            onClick={handleClick}
            disabled={isCreating}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5
              text-sm font-medium text-white shadow-sm
              hover:bg-blue-700 focus:outline-none focus-visible:ring-2
              focus-visible:ring-blue-400 focus-visible:ring-offset-2
              disabled:cursor-not-allowed disabled:opacity-60
              dark:bg-blue-500 dark:hover:bg-blue-600
              dark:focus-visible:ring-offset-gray-900
              transition-colors duration-150"
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

          {/* 预计时间提示 */}
          <p className="mt-3 text-xs text-gray-400 dark:text-gray-500">
            预计 30-60 秒
          </p>
        </>
      ) : (
        <>
          {/* 未登录：登录引导 */}
          <p className="mb-5 text-sm text-gray-500 dark:text-gray-400">
            登录后可使用 AI 生成深度解析
          </p>

          <button
            type="button"
            onClick={handleClick}
            className="inline-flex items-center gap-2 rounded-lg bg-gray-100 px-5 py-2.5
              text-sm font-medium text-gray-700 shadow-sm
              hover:bg-gray-200 focus:outline-none focus-visible:ring-2
              focus-visible:ring-blue-400 focus-visible:ring-offset-2
              dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700
              dark:focus-visible:ring-offset-gray-900
              transition-colors duration-150"
          >
            登录后使用
          </button>
        </>
      )}
    </div>
  );
}

// ============ 内部小图标 ============

function SparkleIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25
          12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0
          003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z"
      />
    </svg>
  );
}

function LoadingSpinner() {
  return (
    <svg
      className="h-4 w-4 animate-spin"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12" cy="12" r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}
