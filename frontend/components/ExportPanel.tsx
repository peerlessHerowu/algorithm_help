'use client';

import { useState, useCallback, useMemo } from 'react';

// ===== 类型定义 =====

/** 导出格式 */
type ExportFormat = 'PDF' | 'MARKDOWN' | 'NOTION' | 'ANKI';

/** 导出范围 */
type ExportScope = 'SINGLE_PROBLEM' | 'BY_PATTERN' | 'BY_LEARNING_PATH' | 'ALL';

/** 导出请求体 */
interface ExportRequestBody {
  format: ExportFormat;
  scope: ExportScope;
  problemId?: string;
  patternId?: string;
  pathId?: string;
  options: ExportOptions;
}

/** 导出高级选项 */
interface ExportOptions {
  languages: string[];
  includeCode: boolean;
  includeDiagrams: boolean;
}

/** 导出触发响应 */
interface ExportResponse {
  taskId: string;
}

/** 组件 Props */
interface ExportPanelProps {
  /** 当前题目 ID（嵌入题目详情页时传入） */
  problemId?: string;
  /** 当前模式 ID（嵌入模式详情页时传入） */
  patternId?: string;
  /** 当前学习路径 ID */
  pathId?: string;
  /** 额外样式 */
  className?: string;
}

// ===== 常量 =====

const API_BASE = '/api/export';

/** 格式选项 */
const FORMAT_OPTIONS: { value: ExportFormat; label: string; icon: string }[] = [
  { value: 'PDF', label: 'PDF', icon: '📄' },
  { value: 'MARKDOWN', label: 'Markdown', icon: '📝' },
  { value: 'NOTION', label: 'Notion', icon: '📓' },
  { value: 'ANKI', label: 'Anki', icon: '🃏' },
];

/** 范围选项 */
const SCOPE_OPTIONS: { value: ExportScope; label: string; description: string }[] = [
  { value: 'SINGLE_PROBLEM', label: '单题导出', description: '仅导出当前题目' },
  { value: 'BY_PATTERN', label: '按模式导出', description: '导出该模式所有题目' },
  { value: 'BY_LEARNING_PATH', label: '按路径导出', description: '导出整条学习路径' },
  { value: 'ALL', label: '全量导出', description: '导出所有学习内容' },
];

/** 支持的语言选项 */
const LANGUAGE_OPTIONS = [
  { value: 'java', label: 'Java' },
  { value: 'python', label: 'Python' },
];

// ===== 主组件 =====

export default function ExportPanel({
  problemId,
  patternId,
  pathId,
  className = '',
}: ExportPanelProps) {
  // --- 表单状态 ---
  const [format, setFormat] = useState<ExportFormat>('PDF');
  const [scope, setScope] = useState<ExportScope>(() => inferDefaultScope(problemId, patternId, pathId));
  const [languages, setLanguages] = useState<string[]>(['java', 'python']);
  const [includeCode, setIncludeCode] = useState(true);
  const [includeDiagrams, setIncludeDiagrams] = useState(true);

  // --- 导出流程状态 ---
  const [exporting, setExporting] = useState(false);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [downloadReady, setDownloadReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** 根据可用 Props 过滤范围选项 */
  const availableScopes = useMemo(() => {
    return SCOPE_OPTIONS.filter((opt) => {
      if (opt.value === 'SINGLE_PROBLEM') return !!problemId;
      if (opt.value === 'BY_PATTERN') return !!patternId;
      if (opt.value === 'BY_LEARNING_PATH') return !!pathId;
      return true; // ALL 始终可用
    });
  }, [problemId, patternId, pathId]);

  /** 切换语言选中状态 */
  const toggleLanguage = useCallback((lang: string) => {
    setLanguages((prev) => {
      if (prev.includes(lang)) {
        // 至少保留一种语言
        if (prev.length <= 1) return prev;
        return prev.filter((l) => l !== lang);
      }
      return [...prev, lang];
    });
  }, []);

  /** 触发导出 */
  const handleExport = useCallback(async () => {
    setExporting(true);
    setError(null);
    setTaskId(null);
    setDownloadReady(false);

    try {
      const body: ExportRequestBody = {
        format,
        scope,
        ...(problemId && { problemId }),
        ...(patternId && { patternId }),
        ...(pathId && { pathId }),
        options: { languages, includeCode, includeDiagrams },
      };

      const res = await fetch(API_BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.message ?? `导出失败 (${res.status})`);
      }

      const data: ExportResponse = await res.json();
      setTaskId(data.taskId);
      // 导出完成后标记可下载
      setDownloadReady(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : '导出请求失败');
    } finally {
      setExporting(false);
    }
  }, [format, scope, problemId, patternId, pathId, languages, includeCode, includeDiagrams]);

  /** 下载文件 */
  const handleDownload = useCallback(() => {
    if (!taskId) return;
    window.open(`${API_BASE}/${taskId}/download`, '_blank');
  }, [taskId]);

  /** 重置表单 */
  const handleReset = useCallback(() => {
    setTaskId(null);
    setDownloadReady(false);
    setError(null);
  }, []);

  // ===== 渲染 =====
  return (
    <div className={`rounded-xl border border-gray-100 bg-white shadow-sm ${className}`}>
      <div className="p-5 border-b border-gray-50">
        <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
          <span className="text-lg">📦</span>
          导出内容
        </h3>
      </div>

      <div className="p-5 space-y-5">
        {/* 格式选择 */}
        <fieldset>
          <legend className="text-xs font-medium text-gray-500 mb-2">导出格式</legend>
          <div className="grid grid-cols-2 gap-2">
            {FORMAT_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setFormat(opt.value)}
                className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors ${
                  format === opt.value
                    ? 'border-indigo-300 bg-indigo-50 text-indigo-700'
                    : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                }`}
              >
                <span>{opt.icon}</span>
                <span className="font-medium">{opt.label}</span>
              </button>
            ))}
          </div>
        </fieldset>

        {/* 范围选择 */}
        <fieldset>
          <legend className="text-xs font-medium text-gray-500 mb-2">导出范围</legend>
          <div className="space-y-1.5">
            {availableScopes.map((opt) => (
              <label
                key={opt.value}
                className={`flex items-center gap-3 rounded-lg border px-3 py-2 cursor-pointer transition-colors ${
                  scope === opt.value
                    ? 'border-indigo-300 bg-indigo-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <input
                  type="radio"
                  name="export-scope"
                  value={opt.value}
                  checked={scope === opt.value}
                  onChange={() => setScope(opt.value)}
                  className="h-3.5 w-3.5 text-indigo-600 border-gray-300 focus:ring-indigo-500"
                />
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-gray-700">{opt.label}</span>
                  <span className="text-xs text-gray-400">{opt.description}</span>
                </div>
              </label>
            ))}
          </div>
        </fieldset>

        {/* 高级选项 */}
        <fieldset>
          <legend className="text-xs font-medium text-gray-500 mb-2">高级选项</legend>
          <div className="space-y-3">
            {/* 语言选择 */}
            <div>
              <span className="text-xs text-gray-500 mb-1 block">代码语言</span>
              <div className="flex gap-2">
                {LANGUAGE_OPTIONS.map((lang) => (
                  <button
                    key={lang.value}
                    type="button"
                    onClick={() => toggleLanguage(lang.value)}
                    className={`rounded-md border px-3 py-1 text-xs font-medium transition-colors ${
                      languages.includes(lang.value)
                        ? 'border-indigo-300 bg-indigo-50 text-indigo-700'
                        : 'border-gray-200 text-gray-500 hover:border-gray-300'
                    }`}
                  >
                    {lang.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 包含代码开关 */}
            <ToggleOption
              label="包含代码"
              checked={includeCode}
              onChange={setIncludeCode}
            />

            {/* 包含图解开关 */}
            <ToggleOption
              label="包含图解"
              checked={includeDiagrams}
              onChange={setIncludeDiagrams}
            />
          </div>
        </fieldset>

        {/* 错误提示 */}
        {error && (
          <div className="rounded-lg bg-red-50 border border-red-100 px-3 py-2">
            <p className="text-xs text-red-600">⚠️ {error}</p>
          </div>
        )}

        {/* 操作按钮区域 */}
        <div className="pt-2">
          {!downloadReady ? (
            <button
              type="button"
              onClick={handleExport}
              disabled={exporting}
              className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:bg-indigo-300 disabled:cursor-not-allowed"
            >
              {exporting ? (
                <span className="flex items-center justify-center gap-2">
                  <LoadingSpinner />
                  导出中...
                </span>
              ) : (
                '导出'
              )}
            </button>
          ) : (
            <div className="space-y-2">
              <button
                type="button"
                onClick={handleDownload}
                className="w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-emerald-700"
              >
                ⬇️ 下载文件
              </button>
              <button
                type="button"
                onClick={handleReset}
                className="w-full rounded-lg border border-gray-200 px-4 py-2 text-xs text-gray-500 transition-colors hover:bg-gray-50"
              >
                重新导出
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


// ===== 辅助组件 =====

/** Toggle 开关 */
function ToggleOption({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between cursor-pointer">
      <span className="text-xs text-gray-600">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors ${
          checked ? 'bg-indigo-600' : 'bg-gray-200'
        }`}
      >
        <span
          className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm ring-0 transition-transform ${
            checked ? 'translate-x-4' : 'translate-x-0'
          }`}
        />
      </button>
    </label>
  );
}

/** 加载动画 */
function LoadingSpinner() {
  return (
    <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}

// ===== 辅助函数 =====

/** 根据传入的 Props 推断默认导出范围 */
function inferDefaultScope(
  problemId?: string,
  patternId?: string,
  pathId?: string,
): ExportScope {
  if (problemId) return 'SINGLE_PROBLEM';
  if (patternId) return 'BY_PATTERN';
  if (pathId) return 'BY_LEARNING_PATH';
  return 'ALL';
}
