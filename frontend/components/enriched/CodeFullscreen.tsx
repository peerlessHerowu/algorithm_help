'use client';

/**
 * CodeFullscreen - 移动端代码全屏查看组件
 *
 * 功能：
 * - 全屏覆盖层展示代码
 * - 语法高亮（亮色/暗色主题）
 * - 支持横向滚动
 * - 顶部工具栏：语言标签 + 复制按钮 + 关闭按钮
 *
 * Requirements: 16.7
 */

import { useCallback, useEffect, useRef } from 'react';

interface CodeFullscreenProps {
  /** 代码内容 */
  code: string;
  /** 编程语言 */
  language: string;
  /** 是否显示 */
  isOpen: boolean;
  /** 关闭回调 */
  onClose: () => void;
  /** 自定义类名 */
  className?: string;
}

export default function CodeFullscreen({
  code,
  language,
  isOpen,
  onClose,
  className,
}: CodeFullscreenProps) {
  const codeRef = useRef<HTMLPreElement>(null);

  // Esc 键关闭
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  // 打开时锁定 body 滚动
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  /** 复制代码到剪贴板 */
  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(code);
      // 简单的视觉反馈：按钮文字变化
      const btn = document.getElementById('code-fullscreen-copy-btn');
      if (btn) {
        btn.textContent = '已复制 ✓';
        setTimeout(() => { btn.textContent = '复制'; }, 1500);
      }
    } catch {
      // fallback: 不处理
    }
  }, [code]);

  if (!isOpen) return null;

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col bg-white dark:bg-gray-950
        animate-fade-in ${className || ''}`}
      role="dialog"
      aria-modal="true"
      aria-label={`${language} 代码全屏查看`}
    >
      {/* 顶部工具栏 */}
      <div className="flex items-center justify-between border-b border-gray-200
        px-4 py-3 dark:border-gray-800">
        <div className="flex items-center gap-2">
          <span className="rounded bg-gray-100 px-2 py-0.5 text-xs font-medium
            text-gray-700 dark:bg-gray-800 dark:text-gray-300">
            {language}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            id="code-fullscreen-copy-btn"
            type="button"
            onClick={handleCopy}
            className="rounded-md px-3 py-1.5 text-xs font-medium
              text-gray-600 hover:bg-gray-100
              dark:text-gray-400 dark:hover:bg-gray-800
              transition-colors"
          >
            复制
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100
              dark:text-gray-400 dark:hover:bg-gray-800
              transition-colors"
            aria-label="关闭全屏"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24"
              stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* 代码区域 */}
      <div className="flex-1 overflow-auto p-4">
        <pre
          ref={codeRef}
          className="text-sm leading-relaxed font-mono whitespace-pre
            text-gray-800 dark:text-gray-200"
        >
          <code className={`language-${language}`}>{code}</code>
        </pre>
      </div>
    </div>
  );
}
