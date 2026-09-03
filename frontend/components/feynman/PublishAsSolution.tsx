'use client';

/**
 * 费曼会话转题解发布弹窗组件
 *
 * 功能：
 * - 自动从费曼对话总结中提取精华生成题解草稿
 * - 支持编辑标题、内容、标签
 * - 发布后自动标记"🧠 费曼产出"来源
 * - 发布成功后展示 Toast 提示并跳转到题解详情
 *
 * Requirements: 34.1-34.5
 */

import { useState, useCallback, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import MarkdownRenderer from '@/components/MarkdownRenderer';

// ============ 类型定义 ============

/** 费曼结构化总结 */
export interface FeynmanSummary {
  intuition: string;
  approach: string;
  pseudocode: string;
  code: string;
  complexity: string;
}

/** PublishAsSolution Props 接口 */
export interface PublishAsSolutionProps {
  /** 是否显示弹窗 */
  open: boolean;
  /** 关闭弹窗回调 */
  onClose: () => void;
  /** 关联的题目 ID */
  problemId: string;
  /** 题目标题（用于生成默认题解标题） */
  problemTitle?: string;
  /** 费曼会话的结构化总结数据 */
  summary: FeynmanSummary;
  /** 自定义样式类名 */
  className?: string;
}

/** 编辑器 Tab 类型 */
type EditorTab = 'edit' | 'preview';

// ============ 辅助函数 ============

/**
 * 从费曼总结中自动提取对话精华，生成 Markdown 格式的题解草稿
 * 按"直觉→思路→伪代码→代码→复杂度"结构组织内容
 */
function generateDraftFromSummary(summary: FeynmanSummary, problemTitle?: string): string {
  const sections: string[] = [];

  if (summary.intuition) {
    sections.push(`## 💡 直觉理解\n\n${summary.intuition}`);
  }
  if (summary.approach) {
    sections.push(`## 🧭 解题思路\n\n${summary.approach}`);
  }
  if (summary.pseudocode) {
    sections.push(`## 📝 伪代码\n\n\`\`\`\n${summary.pseudocode}\n\`\`\``);
  }
  if (summary.code) {
    sections.push(`## 💻 代码实现\n\n\`\`\`\n${summary.code}\n\`\`\``);
  }
  if (summary.complexity) {
    sections.push(`## 📊 复杂度分析\n\n${summary.complexity}`);
  }

  if (sections.length === 0) {
    return problemTitle
      ? `# ${problemTitle} 题解\n\n请在此编写你的题解...`
      : '请在此编写你的题解...';
  }

  return sections.join('\n\n');
}

/** 生成默认题解标题 */
function generateDefaultTitle(problemTitle?: string): string {
  if (problemTitle) {
    return `[费曼学习] ${problemTitle} - 我的理解`;
  }
  return '[费曼学习] 我的理解';
}

// ============ 主组件 ============

export default function PublishAsSolution({
  open,
  onClose,
  problemId,
  problemTitle,
  summary,
  className,
}: PublishAsSolutionProps) {
  const router = useRouter();

  // 编辑状态
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [activeTab, setActiveTab] = useState<EditorTab>('edit');
  const [submitting, setSubmitting] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  // 从总结自动生成草稿（弹窗打开时初始化）
  const defaultTitle = useMemo(
    () => generateDefaultTitle(problemTitle),
    [problemTitle]
  );
  const defaultContent = useMemo(
    () => generateDraftFromSummary(summary, problemTitle),
    [summary, problemTitle]
  );

  // 弹窗打开时重置内容为草稿
  useEffect(() => {
    if (open) {
      setTitle(defaultTitle);
      setContent(defaultContent);
      setActiveTab('edit');
      setSubmitting(false);
    }
  }, [open, defaultTitle, defaultContent]);

  /** 提交发布题解 */
  const handlePublish = useCallback(async () => {
    if (!title.trim() || !content.trim()) return;
    setSubmitting(true);

    try {
      // TODO: 调用后端 API 发布题解
      // POST /api/v1/solutions
      // body: { problemId, title, content, source: 'feynman' }
      // 模拟发布成功
      await new Promise((resolve) => setTimeout(resolve, 800));

      // 显示成功提示
      setToastMessage('题解发布成功 🎉');
      setTimeout(() => {
        setToastMessage('');
        onClose();
        // 跳转到题目详情页的题解 Tab
        router.push(`/problems/${problemId}?tab=solutions`);
      }, 1500);
    } catch {
      setToastMessage('发布失败，请稍后重试');
      setTimeout(() => setToastMessage(''), 3000);
    } finally {
      setSubmitting(false);
    }
  }, [title, content, problemId, onClose, router]);

  // 不显示时直接返回 null
  if (!open) return null;

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center ${className || ''}`}>
      {/* 遮罩层 */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* 弹窗主体 */}
      <div className="relative mx-4 flex max-h-[85vh] w-full max-w-3xl flex-col rounded-xl bg-white shadow-2xl dark:bg-gray-900">
        {/* 弹窗头部 */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <span className="text-lg">📤</span>
            <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">
              发布为题解
            </h2>
            <span className="rounded bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700 dark:bg-orange-900/30 dark:text-orange-300">
              🧠 费曼产出
            </span>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
            aria-label="关闭"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 标题输入 */}
        <div className="border-b border-gray-200 px-6 py-3 dark:border-gray-700">
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
        <div className="flex border-b border-gray-200 px-6 dark:border-gray-700">
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

        {/* 内容编辑/预览区域 */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {activeTab === 'edit' ? (
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="请使用 Markdown 格式编写题解..."
              className="h-[350px] w-full resize-y bg-transparent font-mono text-sm
                         text-gray-800 placeholder-gray-400 outline-none
                         dark:text-gray-200 dark:placeholder-gray-500"
            />
          ) : (
            <div className="min-h-[350px]">
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
        <div className="flex items-center justify-between border-t border-gray-200 px-6 py-4 dark:border-gray-700">
          <p className="text-xs text-gray-400 dark:text-gray-500">
            发布后将自动标记为「🧠 费曼产出」来源
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-sm text-gray-600
                         hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
            >
              取消
            </button>
            <button
              onClick={handlePublish}
              disabled={submitting || !title.trim() || !content.trim()}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white
                         hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50
                         transition-colors"
            >
              {submitting ? '发布中...' : '📤 发布题解'}
            </button>
          </div>
        </div>
      </div>

      {/* Toast 提示 */}
      {toastMessage && (
        <div className="fixed bottom-6 left-1/2 z-[60] -translate-x-1/2 rounded-lg bg-gray-900 px-4 py-2 text-sm text-white shadow-lg dark:bg-gray-100 dark:text-gray-900">
          {toastMessage}
        </div>
      )}
    </div>
  );
}
