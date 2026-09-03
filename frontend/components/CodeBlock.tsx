'use client';

/**
 * 多语言代码块组件
 * 支持多语言 Tab 切换，带复制功能和语法高亮
 * 用于展示同一题目的不同语言实现
 */

import { useState, useCallback } from 'react';
import { useAppStore } from '@/store';
import hljs from 'highlight.js/lib/core';
// 按需注册语言（减少打包体积）
import python from 'highlight.js/lib/languages/python';
import java from 'highlight.js/lib/languages/java';
import cpp from 'highlight.js/lib/languages/cpp';
import go from 'highlight.js/lib/languages/go';
import typescript from 'highlight.js/lib/languages/typescript';
import javascript from 'highlight.js/lib/languages/javascript';
import CodeFullscreen from '@/components/enriched/CodeFullscreen';

import 'highlight.js/styles/github.css';

// 注册语言
hljs.registerLanguage('python', python);
hljs.registerLanguage('java', java);
hljs.registerLanguage('cpp', cpp);
hljs.registerLanguage('go', go);
hljs.registerLanguage('typescript', typescript);
hljs.registerLanguage('javascript', javascript);

interface CodeBlockProps {
  /** 语言到代码的映射，如 { python: "...", java: "...", cpp: "..." } */
  code: Record<string, string>;
  /** 默认展示的语言 Tab，未指定时从 store 偏好读取 */
  defaultLang?: string;
  /** 自定义样式类名 */
  className?: string;
}

/** 语言显示名称映射 */
const languageLabels: Record<string, string> = {
  python: 'Python',
  java: 'Java',
  cpp: 'C++',
  go: 'Go',
  typescript: 'TypeScript',
  javascript: 'JavaScript',
};

export default function CodeBlock({ code, defaultLang, className }: CodeBlockProps) {
  const languages = Object.keys(code);
  const preferredLanguage = useAppStore((s) => s.preferredLanguage);

  // 确定初始选中的语言：优先 prop > store 偏好 > 第一个可用语言
  const resolveInitialLang = (): string => {
    if (defaultLang && languages.includes(defaultLang)) return defaultLang;
    if (preferredLanguage && languages.includes(preferredLanguage)) return preferredLanguage;
    return languages[0] || '';
  };

  const [activeTab, setActiveTab] = useState(resolveInitialLang);
  const [copied, setCopied] = useState(false);
  const [showFullscreen, setShowFullscreen] = useState(false);

  /** 复制代码到剪贴板 */
  const handleCopy = useCallback(async () => {
    const text = code[activeTab];
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // 降级方案：使用旧版 API
      const textarea = document.createElement('textarea');
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [code, activeTab]);

  /** 获取高亮后的 HTML */
  const getHighlightedCode = (lang: string, source: string): string => {
    try {
      // 尝试使用注册的语言进行高亮
      if (hljs.getLanguage(lang)) {
        return hljs.highlight(source, { language: lang }).value;
      }
      // 未注册的语言使用自动检测
      return hljs.highlightAuto(source).value;
    } catch {
      // 高亮失败时返回纯文本（转义 HTML）
      return source
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
    }
  };

  // 无代码时的空状态
  if (languages.length === 0) {
    return (
      <div className={`text-gray-400 dark:text-gray-500 text-sm ${className || ''}`}>
        暂无代码
      </div>
    );
  }

  const activeCode = code[activeTab] || '';
  const highlightedHtml = getHighlightedCode(activeTab, activeCode);

  return (
    <div className={`rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden ${className || ''}`}>
      {/* Tab 栏 + 复制按钮 */}
      <div className="flex items-center justify-between bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-1">
        {/* 语言 Tab */}
        <div className="flex gap-0.5 overflow-x-auto">
          {languages.map((lang) => (
            <button
              key={lang}
              onClick={() => setActiveTab(lang)}
              className={`px-3 py-2 text-xs font-medium rounded-t transition-colors whitespace-nowrap
                ${activeTab === lang
                  ? 'text-blue-600 dark:text-blue-400 bg-white dark:bg-gray-900 border-b-2 border-blue-500'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
            >
              {languageLabels[lang] || lang}
            </button>
          ))}
        </div>

        {/* 复制按钮 */}
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-gray-500 dark:text-gray-400
                     hover:text-gray-700 dark:hover:text-gray-200 transition-colors rounded"
          title="复制代码"
        >
          {copied ? (
            <>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span>已复制</span>
            </>
          ) : (
            <>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              <span>复制</span>
            </>
          )}
        </button>
      </div>

      {/* 代码内容区 */}
      <div className="overflow-x-auto bg-white dark:bg-gray-900 relative">
        <pre className="p-4 text-sm leading-relaxed">
          <code
            className={`hljs language-${activeTab}`}
            dangerouslySetInnerHTML={{ __html: highlightedHtml }}
          />
        </pre>
        {/* 移动端全屏查看按钮 */}
        <button
          type="button"
          onClick={() => setShowFullscreen(true)}
          className="absolute bottom-2 right-2 flex items-center gap-1 rounded-md
            bg-gray-100/80 px-2 py-1 text-[11px] text-gray-600 backdrop-blur-sm
            hover:bg-gray-200/80
            dark:bg-gray-800/80 dark:text-gray-400 dark:hover:bg-gray-700/80
            md:hidden"
          aria-label="全屏查看代码"
        >
          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
          </svg>
          全屏
        </button>
      </div>

      {/* 移动端代码全屏查看 */}
      <CodeFullscreen
        code={activeCode}
        language={activeTab}
        isOpen={showFullscreen}
        onClose={() => setShowFullscreen(false)}
      />
    </div>
  );
}
