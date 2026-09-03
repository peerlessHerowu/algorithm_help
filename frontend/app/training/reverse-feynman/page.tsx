'use client';

import { Suspense, useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useAppStore } from '@/store';
import { reverseFeynmanApi } from '@/lib/api';

interface Paragraph { id: string; content: string; }
interface CorrectionResult { passed: boolean; feedback: string; explanation?: string; compliment?: string; }

function parseJson<T>(text: string): T | null {
  try {
    const s = text.indexOf('{'), e = text.lastIndexOf('}');
    if (s >= 0 && e > s) return JSON.parse(text.slice(s, e+1)) as T;
    return JSON.parse(text) as T;
  } catch { return null; }
}

function ReverseFeynmanContent() {
  const searchParams = useSearchParams();
  const { user, isAuthenticated } = useAppStore();
  const problemId = searchParams.get('problem') || '';

  const [sessionId, setSessionId] = useState('');
  const [paragraphs, setParagraphs] = useState<Paragraph[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedPara, setSelectedPara] = useState<string | null>(null);
  const [correction, setCorrection] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [results, setResults] = useState<Record<string, CorrectionResult>>({});
  const [successCount, setSuccessCount] = useState(0);
  const [totalAttempts, setTotalAttempts] = useState(0);
  const [finished, setFinished] = useState(false);
  const [difficulty, setDifficulty] = useState<'EASY'|'MEDIUM'|'HARD'>('MEDIUM');

  const { state: wsState, send, subscribe } = useWebSocket();

  useEffect(() => {
    const u1 = subscribe('AI_RESPONSE', (payload: any) => {
      setSubmitting(false);
      const content = typeof payload === 'string' ? payload : JSON.stringify(payload);
      const parsed = parseJson<CorrectionResult>(content);
      if (parsed && selectedPara) {
        setResults(p => ({ ...p, [selectedPara]: parsed }));
        setTotalAttempts(n => n + 1);
        if (parsed.passed) setSuccessCount(n => n + 1);
        setSelectedPara(null);
        setCorrection('');
      }
    });
    return () => u1();
  }, [subscribe, selectedPara]);

  const handleStart = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    setResults({});
    setSuccessCount(0);
    setTotalAttempts(0);
    setFinished(false);
    setSelectedPara(null);
    try {
      const res: any = await reverseFeynmanApi.start(user.id, problemId || 'unknown', 1, difficulty);
      setSessionId(res.session?.sessionId || res.session?.id || '');
      const content = parseJson<{ paragraphs: Paragraph[] }>(res.content || '{}');
      if (content?.paragraphs) setParagraphs(content.paragraphs);
    } catch { alert('生成失败，请重试'); }
    finally { setLoading(false); }
  }, [user, problemId, difficulty]);

  const handleSelectPara = (id: string) => {
    // 如果已经有结果（不管对错），不允许再次点击
    if (results[id]) return;
    setSelectedPara(id === selectedPara ? null : id);
    setCorrection('');
  };

  const handleMarkCorrect = (paraId: string) => {
    if (results[paraId]) return;
    setResults(p => ({ ...p, [paraId]: { passed: false, feedback: '你认为这段正确，继续找其他问题。' } }));
    setTotalAttempts(n => n + 1);
    setSelectedPara(null);
  };

  const handleSubmitCorrection = useCallback(() => {
    if (!selectedPara || !correction.trim() || !sessionId) return;
    setSubmitting(true);
    send({
      type: 'REVERSE_FEYNMAN_CHAT',
      sessionId,
      payload: JSON.stringify({ paragraphId: selectedPara, correction }),
    } as any);
  }, [selectedPara, correction, sessionId, send]);

  const handleFinish = () => setFinished(true);

  const accuracy = totalAttempts > 0 ? Math.round(successCount / totalAttempts * 100) : 0;

  if (!isAuthenticated) return (
    <div className="flex h-[60vh] flex-col items-center justify-center gap-4">
      <p className="text-gray-500">反向费曼需要登录后使用</p>
    </div>
  );

  if (!paragraphs.length && !loading) return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <div className="text-center space-y-4">
        <div className="text-5xl">🔄</div>
        <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">反向费曼法</h1>
        <p className="text-gray-500 dark:text-gray-400">
          AI 会给出一段包含隐蔽错误的算法解释，你来找出错误并纠正。
        </p>
        <div className="flex justify-center gap-2">
          {(['EASY','MEDIUM','HARD'] as const).map(d => (
            <button key={d} onClick={() => setDifficulty(d)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                difficulty === d ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400'
              }`}>
              {d === 'EASY' ? '🟢 简单' : d === 'MEDIUM' ? '🟡 中等' : '🔴 困难'}
            </button>
          ))}
        </div>
        <button onClick={handleStart} disabled={loading}
          className="mt-4 rounded-xl bg-blue-600 px-8 py-3 font-medium text-white hover:bg-blue-700 disabled:opacity-50">
          {loading ? '生成中...' : '开始训练'}
        </button>
      </div>
    </div>
  );

  if (finished) return (
    <div className="mx-auto max-w-2xl px-4 py-12 text-center space-y-4">
      <div className="text-5xl">🏆</div>
      <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">训练完成！</h2>
      <div className="grid grid-cols-3 gap-4">
        {[['总尝试', totalAttempts, 'text-blue-600'],
          ['找对错误', successCount, 'text-green-600'],
          ['纠错率', `${accuracy}%`, accuracy >= 70 ? 'text-green-600' : 'text-orange-600']
        ].map(([label, val, color]) => (
          <div key={label as string} className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
            <div className={`text-2xl font-bold ${color}`}>{val}</div>
            <div className="text-xs text-gray-500">{label}</div>
          </div>
        ))}
      </div>
      <p className="text-sm text-gray-500">🔔 已自动将本题加入复习计划</p>
      <div className="flex justify-center gap-3 mt-4">
        <button onClick={handleStart} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
          再来一次
        </button>
        <button onClick={() => window.history.back()} className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-800">
          返回
        </button>
      </div>
    </div>
  );

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      {/* 顶栏 */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="font-bold text-gray-800 dark:text-gray-100">🔄 反向费曼</h1>
          <span className={`rounded-full px-2 py-0.5 text-xs ${
            difficulty === 'EASY' ? 'bg-green-100 text-green-700' : difficulty === 'MEDIUM' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'
          }`}>{difficulty}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500">
            纠错率：<span className={`font-medium ${accuracy >= 70 ? 'text-green-600' : 'text-orange-600'}`}>{accuracy}%</span>
          </span>
          <button onClick={handleFinish}
            className="rounded-lg bg-green-600 px-3 py-1 text-xs font-medium text-white hover:bg-green-700">
            完成训练
          </button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* 左：AI 解释区（按段展示） */}
        <div className="lg:col-span-2 space-y-2">
          <p className="text-xs text-gray-500 dark:text-gray-400">AI 的解释中隐藏了 1-2 个错误，点击有问题的段落进行纠错：</p>
          {paragraphs.map((para) => {
            const result = results[para.id];
            const isSelected = selectedPara === para.id;
            return (
              <div key={para.id} className={`rounded-xl border-2 transition-all cursor-pointer ${
                result?.passed ? 'border-green-400 bg-green-50 dark:border-green-700 dark:bg-green-900/10' :
                result && !result.passed ? 'border-gray-200 dark:border-gray-700' :
                isSelected ? 'border-blue-500 bg-blue-50/50 dark:border-blue-400 dark:bg-blue-900/10' :
                'border-gray-200 hover:border-blue-300 dark:border-gray-700 dark:hover:border-blue-600'
              }`}>
                <div className="p-4">
                  <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
                    {para.content}
                  </p>
                </div>

                {/* 操作区 */}
                {!result && (
                  <div className="border-t border-gray-100 px-4 py-2 flex gap-2 dark:border-gray-800">
                    <button onClick={(e) => { e.stopPropagation(); handleMarkCorrect(para.id); }}
                      className="rounded-lg border border-green-300 px-2 py-1 text-xs text-green-600 hover:bg-green-50 dark:border-green-700 dark:text-green-400">
                      ✓ 这段正确
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); handleSelectPara(para.id); }}
                      className="rounded-lg border border-red-300 px-2 py-1 text-xs text-red-600 hover:bg-red-50 dark:border-red-700 dark:text-red-400">
                      ✗ 这段有错
                    </button>
                  </div>
                )}

                {/* 纠错输入框 */}
                {isSelected && !result && (
                  <div className="border-t border-blue-100 px-4 py-3 space-y-2 dark:border-blue-900">
                    <textarea value={correction} onChange={e => setCorrection(e.target.value)} rows={3}
                      placeholder="描述这段的错误在哪里，正确说法是什么..."
                      className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100" />
                    <div className="flex gap-2">
                      <button onClick={handleSubmitCorrection} disabled={submitting || !correction.trim()}
                        className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50">
                        {submitting ? '评估中...' : '提交纠错'}
                      </button>
                      <button onClick={() => setSelectedPara(null)}
                        className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-400">
                        取消
                      </button>
                    </div>
                  </div>
                )}

                {/* 结果反馈 */}
                {result && (
                  <div className={`border-t px-4 py-2 text-xs ${
                    result.passed ? 'border-green-100 bg-green-50 text-green-700 dark:border-green-900 dark:bg-green-900/10 dark:text-green-400' :
                    'border-gray-100 text-gray-500 dark:border-gray-800 dark:text-gray-500'
                  }`}>
                    {result.passed && <span className="mr-1">🎉</span>}
                    {result.feedback}
                    {result.passed && result.explanation && (
                      <p className="mt-1 text-green-600 dark:text-green-400">{result.explanation}</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* 右：纠错统计 */}
        <div className="space-y-3">
          <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-3">📊 纠错情况</p>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">纠错成功</span>
                <span className="font-bold text-green-600">{successCount}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">总尝试</span>
                <span className="font-bold">{totalAttempts}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">正确率</span>
                <span className={`font-bold ${accuracy >= 70 ? 'text-green-600' : 'text-orange-600'}`}>{accuracy}%</span>
              </div>
              <div className="w-full h-2 rounded-full bg-gray-100 dark:bg-gray-700 mt-1">
                <div className="h-2 rounded-full bg-green-500 transition-all"
                  style={{ width: `${accuracy}%` }} />
              </div>
            </div>
          </div>

          {/* 进度 */}
          <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">段落进度</p>
            <div className="space-y-1">
              {paragraphs.map((p, i) => {
                const r = results[p.id];
                return (
                  <div key={p.id} className="flex items-center gap-2 text-xs">
                    <span className="text-gray-400">段落{i+1}</span>
                    <div className="flex-1 h-1.5 rounded-full bg-gray-100 dark:bg-gray-700">
                      <div className={`h-1.5 rounded-full ${r ? (r.passed ? 'bg-green-500' : 'bg-gray-400') : 'bg-gray-100'}`} style={{ width: r ? '100%' : '0%' }} />
                    </div>
                    <span>{r ? (r.passed ? '✅' : '⚪') : '⬜'}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-xl border border-orange-200 bg-orange-50 p-3 text-xs text-orange-700 dark:border-orange-800 dark:bg-orange-900/10 dark:text-orange-400">
            💡 纠错成功后，该题目将自动加入你的复习计划
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ReverseFeynmanPage() {
  return (
    <Suspense fallback={<div className="flex h-[60vh] items-center justify-center text-gray-500">加载中...</div>}>
      <ReverseFeynmanContent />
    </Suspense>
  );
}
