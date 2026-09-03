'use client';

import { Suspense, useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useAppStore } from '@/store';
import { debugApi } from '@/lib/api';

type Difficulty = 'EASY'|'MEDIUM'|'HARD';
interface TestCase { input: string; expectedOutput: string; triggersBug: boolean; }
interface Challenge { buggyCode: string; testCases: TestCase[]; }
interface EvalResult { allFound: boolean; score: number; overallFeedback: string; foundBugs: any[]; missedBugs: any[]; }

const DIFF_CONFIG: Record<Difficulty, { label:string; bugs:number; color:string }> = {
  EASY:   { label:'初级', bugs:1, color:'text-green-600 bg-green-100 dark:bg-green-900/30' },
  MEDIUM: { label:'中级', bugs:2, color:'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/30' },
  HARD:   { label:'高级', bugs:3, color:'text-red-600 bg-red-100 dark:bg-red-900/30' },
};

function parseJson<T>(text: string): T | null {
  try {
    const s = text.indexOf('{'), e = text.lastIndexOf('}');
    if (s >= 0 && e > s) return JSON.parse(text.slice(s, e+1)) as T;
    return JSON.parse(text) as T;
  } catch { return null; }
}

function DebugContent() {
  const searchParams = useSearchParams();
  const { user, isAuthenticated } = useAppStore();
  const problemId = searchParams.get('problem') || '';

  const [difficulty, setDifficulty] = useState<Difficulty>('EASY');
  const [sessionId, setSessionId] = useState('');
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [loading, setLoading] = useState(false);
  const [userFix, setUserFix] = useState('');
  const [selectedLines, setSelectedLines] = useState<Set<number>>(new Set());
  const [evalResult, setEvalResult] = useState<EvalResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [hintLevel, setHintLevel] = useState(0);
  const [stats, setStats] = useState<any>(null);

  const { state: wsState, send, subscribe } = useWebSocket();

  // 加载统计数据
  useEffect(() => {
    if (!user?.id) return;
    debugApi.stats(user.id).then((s: any) => setStats(s)).catch(() => {});
  }, [user]);

  // 订阅 WS 评估结果
  useEffect(() => {
    const u1 = subscribe('AI_RESPONSE', (payload: any) => {
      setSubmitting(false);
      const content = typeof payload === 'string' ? payload : (payload?.content || JSON.stringify(payload));
      const parsed = parseJson<EvalResult>(content);
      if (parsed) setEvalResult(parsed);
    });
    const u2 = subscribe('HINT_PROVIDED', (payload: any) => {
      const content = typeof payload === 'string' ? payload : (payload?.content || JSON.stringify(payload));
      alert(`💡 提示：${content}`);
    });
    return () => { u1(); u2(); };
  }, [subscribe]);

  const handleGenerateChallenge = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    setChallenge(null);
    setEvalResult(null);
    setSelectedLines(new Set());
    setUserFix('');
    setHintLevel(0);
    try {
      const res: any = await debugApi.challenge(user.id, problemId || 'unknown', difficulty);
      setSessionId(res.session?.sessionId || res.session?.id || '');
      const ch = parseJson<Challenge>(res.challenge || '{}');
      if (ch) setChallenge(ch);
    } catch { alert('生成失败，请重试'); }
    finally { setLoading(false); }
  }, [user, problemId, difficulty]);

  const handleToggleLine = (lineIdx: number) => {
    setSelectedLines(prev => {
      const n = new Set(prev);
      n.has(lineIdx) ? n.delete(lineIdx) : n.add(lineIdx);
      return n;
    });
  };

  const handleSubmit = useCallback(() => {
    if (!sessionId || !userFix.trim()) return;
    setSubmitting(true);
    setEvalResult(null);
    const buggyCode = challenge?.buggyCode || '';
    send({
      type: 'DEBUG_SUBMIT',
      sessionId,
      payload: JSON.stringify({
        userFix,
        requestHint: false,
        hintLevel,
        buggyCode,
      }),
    } as any);
  }, [sessionId, userFix, challenge, hintLevel, send]);

  const handleRequestHint = useCallback(() => {
    if (!sessionId) return;
    const newLevel = hintLevel + 1;
    setHintLevel(newLevel);
    send({
      type: 'DEBUG_SUBMIT',
      sessionId,
      payload: JSON.stringify({
        requestHint: true,
        hintLevel: newLevel,
        buggyCode: challenge?.buggyCode || '',
        userFix: '',
      }),
    } as any);
  }, [sessionId, hintLevel, challenge, send]);

  const codeLines = challenge?.buggyCode?.split('\n') || [];

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-800 dark:text-gray-100">🐛 Debug 训练</h1>
        {/* 难度选择 */}
        <div className="flex gap-2">
          {(Object.keys(DIFF_CONFIG) as Difficulty[]).map(d => (
            <button key={d} onClick={() => setDifficulty(d)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                difficulty === d ? DIFF_CONFIG[d].color : 'bg-gray-100 text-gray-500 dark:bg-gray-800'
              }`}>
              {DIFF_CONFIG[d].label}（{DIFF_CONFIG[d].bugs}个Bug）
            </button>
          ))}
          <button onClick={handleGenerateChallenge} disabled={loading}
            className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50">
            {loading ? '生成中...' : '🎲 新题目'}
          </button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* 代码展示区 */}
        <div className="lg:col-span-2 space-y-3">
          {challenge ? (
            <>
              <div className="rounded-xl border border-gray-200 bg-gray-900 dark:border-gray-700">
                <div className="flex items-center justify-between border-b border-gray-700 px-4 py-2">
                  <span className="text-xs text-gray-400 font-mono">有 Bug 的代码</span>
                  <span className="text-xs text-gray-500">点击行号标注 Bug</span>
                </div>
                <div className="overflow-x-auto p-4">
                  {codeLines.map((line, i) => (
                    <div key={i}
                      onClick={() => handleToggleLine(i)}
                      className={`flex gap-3 cursor-pointer rounded px-1 py-0.5 transition-colors hover:bg-gray-800 ${
                        selectedLines.has(i) ? 'bg-red-900/40 border-l-2 border-red-500' : ''
                      }`}>
                      <span className={`w-6 shrink-0 text-right text-xs font-mono select-none ${
                        selectedLines.has(i) ? 'text-red-400' : 'text-gray-600'
                      }`}>{i+1}</span>
                      <span className={`font-mono text-sm whitespace-pre ${
                        selectedLines.has(i) ? 'text-red-300' : 'text-gray-300'
                      }`}>{line || ' '}</span>
                      {selectedLines.has(i) && (
                        <span className="ml-auto shrink-0 rounded bg-red-800 px-1 text-xs text-red-300">🐛 Bug?</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* 测试用例 */}
              {challenge.testCases?.length > 0 && (
                <div className="rounded-xl border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-900">
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">🧪 测试用例</p>
                  <div className="space-y-1.5">
                    {challenge.testCases.map((tc, i) => (
                      <div key={i} className={`rounded-lg px-3 py-2 text-xs font-mono ${
                        tc.triggersBug ? 'bg-red-50 border border-red-200 dark:bg-red-900/20 dark:border-red-800' : 'bg-gray-50 dark:bg-gray-800'
                      }`}>
                        <span className="text-gray-600 dark:text-gray-400">输入：</span>{tc.input}
                        <span className="mx-2 text-gray-400">→</span>
                        <span className="text-gray-600 dark:text-gray-400">期望：</span>{tc.expectedOutput}
                        {tc.triggersBug && <span className="ml-2 text-red-500">⚠️</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="flex h-64 flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-gray-300 text-gray-400 dark:border-gray-700">
              <span className="text-4xl">🔍</span>
              <p className="text-sm">点击「新题目」生成一道有 Bug 的代码</p>
            </div>
          )}
        </div>

        {/* 右侧：操作面板 + 统计 */}
        <div className="space-y-3">
          {/* 操作步骤 */}
          <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-3">操作步骤</p>
            <div className="space-y-3">
              <div className={`rounded-lg p-2 text-xs ${selectedLines.size > 0 ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/20' : 'bg-gray-50 text-gray-400 dark:bg-gray-800'}`}>
                <span className="font-medium">Step 1：</span>点击行号标注 Bug 所在行
                {selectedLines.size > 0 && <span className="ml-1 text-blue-500">✓ 已标注 {selectedLines.size} 行</span>}
              </div>
              <div className="rounded-lg p-2 text-xs bg-gray-50 dark:bg-gray-800">
                <span className="font-medium text-gray-600 dark:text-gray-400">Step 2：</span>
                <span className="text-gray-500 dark:text-gray-400">描述你的修复方案</span>
              </div>
              <textarea value={userFix} onChange={e => setUserFix(e.target.value)} rows={4}
                placeholder="描述错误原因和修复方案...&#10;例：第7行条件应该是 < n 而不是 <= n"
                className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-xs focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100" />
              <button onClick={handleSubmit} disabled={submitting || !userFix.trim() || !challenge}
                className="w-full rounded-lg bg-blue-600 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed">
                {submitting ? '评估中...' : '✅ 提交修复'}
              </button>
              <button onClick={handleRequestHint} disabled={!challenge}
                className="w-full rounded-lg border border-orange-300 py-1.5 text-xs text-orange-600 hover:bg-orange-50 disabled:opacity-50 dark:border-orange-700 dark:text-orange-400 dark:hover:bg-orange-900/20">
                💡 获取提示（Level {hintLevel+1}）
              </button>
            </div>
          </div>

          {/* 评估结果 */}
          {evalResult && (
            <div className={`rounded-xl border p-4 ${
              evalResult.allFound ? 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/10' : 'border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-900/10'
            }`}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">{evalResult.allFound ? '🎉' : '🔧'}</span>
                <span className="font-medium text-sm text-gray-800 dark:text-gray-200">
                  {evalResult.allFound ? '全部找到！' : `得分 ${evalResult.score}/100`}
                </span>
              </div>
              <p className="text-xs text-gray-600 dark:text-gray-400 whitespace-pre-wrap">{evalResult.overallFeedback}</p>
              {evalResult.missedBugs?.length > 0 && (
                <div className="mt-2">
                  <p className="text-xs font-medium text-orange-600 dark:text-orange-400 mb-1">遗漏的 Bug：</p>
                  {evalResult.missedBugs.map((b, i) => (
                    <div key={i} className="text-xs text-gray-600 dark:text-gray-400">• {b.hint}</div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 统计侧栏 */}
          {stats && (
            <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">📈 我的 Debug 统计</p>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-500">总练习</span>
                  <span className="font-medium">{stats.total}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">找到正确</span>
                  <span className="font-medium text-green-600">{stats.found}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">正确率</span>
                  <span className="font-medium text-blue-600">{stats.accuracy}</span>
                </div>
              </div>
              {stats.byType && Object.entries(stats.byType).length > 0 && (
                <div className="mt-2">
                  <p className="text-xs text-gray-400 mb-1">按类型分布</p>
                  {Object.entries(stats.byType).map(([type, count]) => (
                    <div key={type} className="flex justify-between text-xs">
                      <span className="text-gray-500">{type}</span>
                      <span>{count as number} 次</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function DebugPage() {
  return (
    <Suspense fallback={<div className="flex h-[60vh] items-center justify-center text-gray-500">加载中...</div>}>
      <DebugContent />
    </Suspense>
  );
}
