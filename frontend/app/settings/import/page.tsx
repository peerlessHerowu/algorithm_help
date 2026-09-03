'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/store';
import { importApi } from '@/lib/api';

type Step = 'fetch'|'extract'|'review'|'refine'|'done';

const STEPS: { key: Step; label: string; icon: string }[] = [
  { key:'fetch',   label:'抓取网页',  icon:'🌐' },
  { key:'extract', label:'提取正文',  icon:'📄' },
  { key:'review',  label:'AI 审查',   icon:'🔍' },
  { key:'refine',  label:'精炼格式',  icon:'✨' },
  { key:'done',    label:'完成',      icon:'✅' },
];

interface ImportResult {
  title?: string;
  rawContent?: string;
  refinedContent?: string;
  reviewResult?: string;
  success: boolean;
  error?: string;
}

export default function ImportPage() {
  const router = useRouter();
  const { isAuthenticated } = useAppStore();

  const [url, setUrl] = useState('');
  const [importing, setImporting] = useState(false);
  const [currentStep, setCurrentStep] = useState<Step | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [showRefined, setShowRefined] = useState(false);

  const handleImport = useCallback(async () => {
    if (!url.trim()) return;
    setImporting(true);
    setResult(null);
    setShowRefined(false);

    // 模拟步骤进度
    const steps: Step[] = ['fetch', 'extract', 'review', 'refine'];
    for (const step of steps) {
      setCurrentStep(step);
      await new Promise(r => setTimeout(r, 800));
    }

    try {
      const res: any = await importApi.fromUrl(url.trim());
      setResult({ ...res, success: true });
      setCurrentStep('done');
    } catch (e: any) {
      setResult({ success: false, error: e?.message || '导入失败' });
      setCurrentStep(null);
    } finally {
      setImporting(false);
    }
  }, [url]);

  if (!isAuthenticated) return (
    <div className="flex h-[60vh] flex-col items-center justify-center gap-4">
      <p className="text-gray-500">需要登录后使用</p>
      <button onClick={() => router.push('/auth/login')} className="rounded-lg bg-blue-600 px-6 py-2 text-sm text-white">去登录</button>
    </div>
  );

  const doneIdx = STEPS.findIndex(s => s.key === currentStep);

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="mb-2 text-xl font-bold text-gray-800 dark:text-gray-100">🔗 导入外部题解</h1>
      <p className="mb-6 text-sm text-gray-500 dark:text-gray-400">
        粘贴算法题解的链接，AI 自动提取正文、审查质量并精炼格式。
      </p>

      {/* URL 输入 */}
      <div className="flex gap-2 mb-6">
        <input value={url} onChange={e => setUrl(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !importing && handleImport()}
          placeholder="https://leetcode.cn/problems/... 或其他题解链接"
          disabled={importing}
          className="flex-1 rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-blue-500 focus:outline-none disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100" />
        <button onClick={handleImport} disabled={importing || !url.trim()}
          className="rounded-xl bg-blue-600 px-6 py-3 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed">
          {importing ? '解析中' : '解析'}
        </button>
      </div>

      {/* 步骤指示器 */}
      {(importing || result) && (
        <div className="mb-6 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
          <div className="flex items-center justify-between">
            {STEPS.map((step, idx) => (
              <div key={step.key} className="flex items-center">
                <div className={`flex flex-col items-center gap-1 ${idx <= doneIdx ? 'opacity-100' : 'opacity-30'}`}>
                  <div className={`flex h-8 w-8 items-center justify-center rounded-full text-sm transition-all ${
                    step.key === currentStep && importing ? 'bg-blue-600 text-white animate-pulse' :
                    idx < doneIdx || (!importing && result?.success) ? 'bg-green-500 text-white' :
                    'bg-gray-200 dark:bg-gray-700'
                  }`}>
                    {step.key === currentStep && importing ? '⟳' : (idx < doneIdx || (!importing && result?.success && idx <= 4) ? '✓' : step.icon)}
                  </div>
                  <span className="text-xs text-gray-500 dark:text-gray-400">{step.label}</span>
                </div>
                {idx < STEPS.length - 1 && (
                  <div className={`mx-2 h-0.5 w-8 transition-all ${idx < doneIdx ? 'bg-green-400' : 'bg-gray-200 dark:bg-gray-700'}`} />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 错误提示 */}
      {result && !result.success && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/10">
          <p className="text-sm text-red-700 dark:text-red-400">
            ⚠️ {result.error || '导入失败，请检查链接是否有效'}
          </p>
        </div>
      )}

      {/* 导入结果预览 */}
      {result?.success && (
        <div className="space-y-4">
          {result.title && (
            <div className="rounded-xl border border-green-200 bg-green-50/50 p-4 dark:border-green-800 dark:bg-green-900/10">
              <p className="text-xs font-medium text-green-700 dark:text-green-400 mb-1">✅ 导入成功</p>
              <h2 className="text-base font-semibold text-gray-800 dark:text-gray-200">{result.title}</h2>
            </div>
          )}

          {/* AI 审查结果 */}
          {result.reviewResult && (
            <div className="rounded-xl border border-yellow-200 bg-yellow-50/50 p-4 dark:border-yellow-800 dark:bg-yellow-900/10">
              <p className="text-xs font-medium text-yellow-700 dark:text-yellow-400 mb-2">🔍 AI 审查结果</p>
              <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{result.reviewResult}</p>
            </div>
          )}

          {/* 内容切换 */}
          <div className="flex gap-2">
            <button onClick={() => setShowRefined(false)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium ${!showRefined ? 'bg-gray-800 text-white dark:bg-gray-200 dark:text-gray-900' : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'}`}>
              原始内容
            </button>
            {result.refinedContent && (
              <button onClick={() => setShowRefined(true)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium ${showRefined ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'}`}>
                ✨ 精炼后内容
              </button>
            )}
          </div>

          <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900 max-h-80 overflow-y-auto">
            <pre className="p-4 text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
              {showRefined ? result.refinedContent : result.rawContent?.slice(0, 2000)}
              {!showRefined && result.rawContent && result.rawContent.length > 2000 && '\n...(内容已截断)'}
            </pre>
          </div>

          <button onClick={handleImport}
            className="w-full rounded-xl border border-gray-300 py-2 text-sm text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-800">
            📥 导入新链接
          </button>
        </div>
      )}

      {/* 支持的平台 */}
      <div className="mt-6 rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900">
        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">支持的平台</p>
        <div className="flex flex-wrap gap-2">
          {['LeetCode', 'LeetCode 中国', 'CSDN', '知乎', 'GitHub Gist', '牛客'].map(p => (
            <span key={p} className="rounded-full bg-white px-2 py-1 text-xs text-gray-600 border border-gray-200 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400">{p}</span>
          ))}
        </div>
      </div>
    </div>
  );
}
