'use client';

/**
 * Markdown 题解编辑器组件
 * 支持编辑 + 实时预览双栏展示
 * 用户可通过该编辑器编写和发布题解
 *
 * Requirements: 31.5, 31.7
 */

import { useState, useCallback } from 'react';
import MarkdownRenderer from '@/components/MarkdownRenderer';
import { useAppStore } from '@/store';

/** SolutionEditor Props 接口 */
export interface SolutionEditorProps {
  /** 题目 ID */
  problemId: string;
  /** 初始标题（编辑模式） */
  initialTitle?: string;
  /** 初始内容（编辑模式） */
  initialContent?: string;
  /** 提交回调 */
  onSubmit?: (data: { title: string; content: string }) => void;
  /** 取消回调 */
  onCancel?: () => void;
  /** 自定义样式类名 */
  className?: string;
}

/** 编辑器 Tab 类型 */
type EditorTab = 'edit' | 'preview';

export default function SolutionEditor({
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  problemId,
  initialTitle = '',
  initialContent = '',
  onSubmit,
  onCancel,
  className,
}: SolutionEditorProps) {
  const { isAuthenticated } = useAppStore();
  const [title, setTitle] = useState(initialTitle);
  const [content, setContent] = useState(initialContent);
  const [activeTab, setActiveTab] = useState<EditorTab>('edit');
  const [submitting, setSubmitting] = useState(false);

  /** 提交题解 */
  const handleSubmit = useCallback(async () => {
    if (!title.trim() || !content.trim()) return;
    setSubmitting(true);
    try {
      onSubmit?.({ title: title.trim(), content: content.trim() });
    } finally {
      setSubmitting(false);
    }
  }, [title, content, onSubmit]);

  // 未登录提示
  if (!isAuthenticated) {
    return (
      <div className={`rounded-lg border border-gray-200 p-6 text-center dark:border-gray-700 ${className || ''}`}>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          请先登录后再写题解
        </p>
      </div>
    );
  }

  return (
    <div className={`rounded-lg border border-gray-200 dark:border-gray-700 ${className || ''}`}>
      {/* 标题输入 */}
      <div className="border-b border-gray-200 p-4 dark:border-gray-700">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="请输入题解标题..."
          className="w-full bg-transparent text-base font-medium text-gray-900
                     placeholder-gray-400 outline-none dark:text-gray-100
                     dark:placeholder-gray-500"
          maxLength={100}
        />
      </div>

      {/* 编辑/预览 Tab 切换 */}
      <div className="flex border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={() => setActiveTab('edit')}
          className={`px-4 py-2 text-sm font-medium transition-colors
            ${activeTab === 'edit'
              ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400'
              : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
            }`}
        >
          ✏️ 编辑
        </button>
        <button
          onClick={() => setActiveTab('preview')}
          className={`px-4 py-2 text-sm font-medium transition-colors
            ${activeTab === 'preview'
              ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400'
              : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
            }`}
        >
          👁️ 预览
        </button>
      </div>

      {/* 内容区域 */}
      <div className="min-h-[300px] p-4">
        {activeTab === 'edit' ? (
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="请使用 Markdown 格式编写题解..."
            className="h-[300px] w-full resize-y bg-transparent font-mono text-sm
                       text-gray-800 placeholder-gray-400 outline-none
                       dark:text-gray-200 dark:placeholder-gray-500"
          />
        ) : (
          <div className="min-h-[300px]">
            {content.trim() ? (
              <MarkdownRenderer content={content} />
            ) : (
              <p className="text-sm text-gray-400 dark:text-gray-500">
                暂无内容可预览
              </p>
            )}
          </div>
        )}
      </div>

      {/* 底部操作栏 */}
      <div className="flex items-center justify-between border-t border-gray-200 p-4 dark:border-gray-700">
        <p className="text-xs text-gray-400 dark:text-gray-500">
          支持 Markdown 语法，包括代码块和数学公式
        </p>
        <div className="flex items-center gap-3">
          {onCancel && (
            <button
              onClick={onCancel}
              className="rounded-md px-4 py-2 text-sm text-gray-600
                         hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
            >
              取消
            </button>
          )}
          <button
            onClick={handleSubmit}
            disabled={submitting || !title.trim() || !content.trim()}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white
                       hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50
                       dark:bg-blue-500 dark:hover:bg-blue-600"
          >
            {submitting ? '发布中...' : '发布题解'}
          </button>
        </div>
      </div>
    </div>
  );
}
