'use client';

import { Suspense, useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAppStore } from '@/store';
import { debugApi } from '@/lib/api';

// fetcher with options for POST
async function postRequest<T>(path: string, body: unknown): Promise<T> {
  const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8080';
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { message?: string }).message ?? `请求失败 (${res.status})`);
  }
  const json = await res.json();
  return (json?.data ?? json) as T;
}

// ===== 类型 =====
type Difficulty = 'EASY' | 'MEDIUM' | 'HARD';
interface TestCase  { input: string; expectedOutput: string; triggersBug: boolean; }
interface Challenge { buggyCode: string; testCases?: TestCase[]; language?: string; }
interface EvalResult {
  allFound: boolean; score: number; overallFeedback: string;
  foundBugs?: { line?: number; description?: string }[];
  missedBugs?: { hint?: string; description?: string }[];
}
interface DebugStats {
  total: number; found: number; accuracy: string;
  byType?: Record<string, number>;
}

// ===== 配置 =====
const DIFF_CONFIG: Record<Difficulty, { label: string; bugs: number; color: string; bg: string; border: string }> = {
  EASY:   { label: '初级', bugs: 1, color: '#10B981', bg: 'bg-emerald-900/30', border: 'border-emerald-700/50' },
  MEDIUM: { label: '中级', bugs: 2, color: '#F59E0B', bg: 'bg-amber-900/30',   border: 'border-amber-700/50'   },
  HARD:   { label: '高级', bugs: 3, color: '#EF4444', bg: 'bg-red-900/30',     border: 'border-red-700/50'     },
};

function guestId() {
  if (typeof window === 'undefined') return 'guest';
  let id = localStorage.getItem('debug-guest-id');
  if (!id) { id = `guest-${Date.now()}`; localStorage.setItem('debug-guest-id', id); }
  return id;
}

function parseJson<T>(text: string): T | null {
  try {
    const s = text.indexOf('{'), e = text.lastIndexOf('}');
    if (s >= 0 && e > s) return JSON.parse(text.slice(s, e + 1)) as T;
    return JSON.parse(text) as T;
  } catch { return null; }
}

// ===== 代码行组件 =====
function CodeLine({ line, index, selected, onToggle }: {
  line: string; index: number; selected: boolean; onToggle: (i: number) => void;
}) {
  return (
    <div
      onClick={() => onToggle(index)}
      className={`group flex items-start gap-3 cursor-pointer rounded px-2 py-0.5 transition-all
        hover:bg-gray-700/40
        ${selected ? 'bg-red-900/30 border-l-2 border-red-500' : 'border-l-2 border-transparent'}`}
    >
      <span className={`w-6 shrink-0 text-right text-xs font-mono select-none mt-0.5
        ${selected ? 'text-red-400' : 'text-gray-600 group-hover:text-gray-400'}`}>
        {index + 1}
      </span>
      <span className={`flex-1 font-mono text-sm whitespace-pre leading-relaxed
        ${selected ? 'text-red-200' : 'text-gray-300'}`}>
        {line || ' '}
      </span>
      {selected && (
        <span className="shrink-0 rounded-md bg-red-800/60 border border-red-700/50 px-1.5 py-0.5 text-[10px] text-red-300">
          🐛 Bug?
        </span>
      )}
    </div>
  );
}

// ===== 统计侧栏 =====
function StatsPanel({ stats }: { stats: DebugStats | null }) {
  if (!stats) return (
    <div className="rounded-2xl border border-dashed border-gray-700 p-4 text-center space-y-2">
      <div className="text-2xl">📊</div>
      <p className="text-xs text-gray-500">完成训练后显示统计</p>
    </div>
  );

  const byTypeEntries = Object.entries(stats.byType ?? {});
  const maxCount = byTypeEntries.length > 0 ? Math.max(...byTypeEntries.map(([, v]) => v)) : 1;

  return (
    <div className="rounded-2xl border border-gray-800 bg-[#141820] p-4 space-y-4">
      <p className="text-xs font-medium text-gray-400">📈 我的 Debug 统计</p>

      {/* 概览 */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: '总练习', value: stats.total, color: 'text-indigo-400' },
          { label: '已找到', value: stats.found, color: 'text-emerald-400' },
          { label: '正确率', value: stats.accuracy, color: 'text-amber-400' },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-xl bg-gray-800/60 border border-gray-700 p-2 text-center">
            <div className={`text-base font-bold tabular-nums ${color}`}>{value}</div>
            <div className="text-[10px] text-gray-600 mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      {/* 按类型柱状图 */}
      {byTypeEntries.length > 0 && (
        <div>
          <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">Bug 类型分布</p>
          <div className="space-y-2">
            {byTypeEntries.sort(([,a],[,b]) => b - a).map(([type, count]) => (
              <div key={type} className="flex items-center gap-2">
                <span className="text-[10px] text-gray-500 w-20 truncate shrink-0" title={type}>{type}</span>
                <div className="flex-1 h-2 rounded-full bg-gray-800 overflow-hidden">
                  <div className="h-2 rounded-full bg-indigo-500 transition-all duration-700"
                    style={{ width: `${(count / maxCount) * 100}%` }} />
                </div>
                <span className="text-[10px] text-gray-500 w-4 text-right shrink-0">{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ===== 主组件 =====
function DebugContent() {
  const searchParams = useSearchParams();
  const { user } = useAppStore();
  const problemId = searchParams.get('problem') || searchParams.get('problemId') || '';

  const [difficulty, setDifficulty] = useState<Difficulty>('EASY');
  const [sessionId, setSessionId]   = useState('');
  const [challenge, setChallenge]   = useState<Challenge | null>(null);
  const [loading, setLoading]       = useState(false);
  const [userFix, setUserFix]       = useState('');
  const [selectedLines, setSelectedLines] = useState<Set<number>>(new Set());
  const [evalResult, setEvalResult] = useState<EvalResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [stats, setStats]           = useState<DebugStats | null>(null);
  const [hintText, setHintText]     = useState('');
  const [hintLevel, setHintLevel]   = useState(0);

  const uid = user?.id ?? guestId();

  // 加载统计
  useEffect(() => {
    debugApi.stats(uid).then((s: unknown) => setStats(s as DebugStats)).catch(() => {});
  }, [uid]);

  // 生成题目
  const handleGenerate = useCallback(async () => {
    setLoading(true);
    setChallenge(null);
    setEvalResult(null);
    setSelectedLines(new Set());
    setUserFix('');
    setHintText('');
    setHintLevel(0);
    try {
      const res = await debugApi.challenge(uid, problemId || 'unknown', difficulty) as {
        session?: { sessionId?: string; id?: string };
        challenge?: string;
      };
      setSessionId(res.session?.sessionId ?? res.session?.id ?? `debug-${Date.now()}`);
      const ch = parseJson<Challenge>(res.challenge ?? '{}');
      if (ch) setChallenge(ch);
    } catch { alert('生成失败，请重试'); }
    finally { setLoading(false); }
  }, [uid, problemId, difficulty]);

  // 行点击标注
  const handleToggleLine = (i: number) => {
    setSelectedLines(prev => {
      const n = new Set(prev);
      n.has(i) ? n.delete(i) : n.add(i);
      return n;
    });
  };

  // 提交验证（REST，不依赖 WS）
  const handleSubmit = useCallback(async () => {
    if (!sessionId || !userFix.trim()) return;
    setSubmitting(true);
    setEvalResult(null);
    try {
      const res = await postRequest<Record<string, unknown>>(
        `/api/v1/debug/${sessionId}/verify`,
        { userFix }
      );
      setEvalResult(res as unknown as EvalResult);
      // 刷新统计
      debugApi.stats(uid).then((s: unknown) => setStats(s as DebugStats)).catch(() => {});
    } catch (err) {
      const msg = err instanceof Error ? err.message : '提交失败';
      setEvalResult({ allFound: false, score: 0, overallFeedback: msg });
    } finally {
      setSubmitting(false);
    }
  }, [sessionId, userFix, uid]);

  // 获取提示（WS 降级到系统提示）
  const handleHint = useCallback(async () => {
    const newLevel = hintLevel + 1;
    setHintLevel(newLevel);
    const msgs = [
      '仔细检查循环边界条件（< vs <=）',
      '看看数组索引是否会越界',
      '检查返回值和条件判断的逻辑',
      '对比正确算法和当前实现的差异',
    ];
    setHintText(msgs[Math.min(newLevel - 1, msgs.length - 1)] ?? '');
  }, [hintLevel]);

  const codeLines = challenge?.buggyCode?.split('\n') ?? [];
  const diffConf = DIFF_CONFIG[difficulty];

  return (
    <div className="min-h-screen bg-[#0F1117]">
      <div className="mx-auto max-w-6xl px-4 py-6">
        {/* 顶栏 */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🐛</span>
            <div>
              <h1 className="text-lg font-bold text-gray-100">Debug 训练</h1>
              <p className="text-xs text-gray-500">找出代码中的 Bug 并描述修复方案</p>
            </div>
          </div>
          {/* 难度 + 生成 */}
          <div className="flex items-center gap-2">
            {(Object.keys(DIFF_CONFIG) as Difficulty[]).map(d => (
              <button key={d} onClick={() => setDifficulty(d)}
                className={`px-3 py-1.5 text-xs rounded-xl border font-medium transition-all
                  ${difficulty === d
                    ? `${DIFF_CONFIG[d].bg} ${DIFF_CONFIG[d].border} text-white`
                    : 'border-gray-700 text-gray-500 hover:border-gray-600'
                  }`}>
                {DIFF_CONFIG[d].label} · {DIFF_CONFIG[d].bugs} Bug
              </button>
            ))}
            <button onClick={handleGenerate} disabled={loading}
              className="px-4 py-1.5 text-xs rounded-xl bg-indigo-600 hover:bg-indigo-500
                text-white font-medium transition-all disabled:opacity-50">
              {loading ? (
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full border border-white/40 border-t-white animate-spin" />
                  生成中...
                </span>
              ) : '🎲 生成题目'}
            </button>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          {/* 左/中：代码区 */}
          <div className="lg:col-span-2 space-y-3">
            {/* 代码块 */}
            {challenge ? (
              <>
                <div className="rounded-2xl border border-gray-800 bg-[#0D1117] overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-800 bg-gray-900/50">
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-gray-400 font-mono">
                        {challenge.language ?? 'python'} · 含 Bug 代码
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full border font-medium
                        ${diffConf.bg} ${diffConf.border}`}
                        style={{ color: diffConf.color }}>
                        {diffConf.label} · {diffConf.bugs} 个 Bug
                      </span>
                    </div>
                    <span className="text-[10px] text-gray-600">← 点击行号标注 Bug 位置</span>
                  </div>
                  <div className="overflow-x-auto py-3">
                    {codeLines.map((line, i) => (
                      <CodeLine key={i} line={line} index={i}
                        selected={selectedLines.has(i)} onToggle={handleToggleLine} />
                    ))}
                  </div>
                </div>

                {/* 测试用例 */}
                {(challenge.testCases?.length ?? 0) > 0 && (
                  <div className="rounded-2xl border border-gray-800 bg-[#141820] p-4">
                    <p className="text-xs font-medium text-gray-400 mb-3">🧪 测试用例</p>
                    <div className="space-y-2">
                      {challenge.testCases!.map((tc, i) => (
                        <div key={i}
                          className={`rounded-xl px-3 py-2 text-xs font-mono
                            ${tc.triggersBug
                              ? 'bg-red-900/20 border border-red-700/40 text-red-300'
                              : 'bg-gray-800/60 border border-gray-700/40 text-gray-400'
                            }`}>
                          <span className="text-gray-500">输入：</span>{tc.input}
                          <span className="mx-2 text-gray-600">→</span>
                          <span className="text-gray-500">期望：</span>{tc.expectedOutput}
                          {tc.triggersBug && <span className="ml-2 text-red-400">⚠ 触发 Bug</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="flex h-64 flex-col items-center justify-center gap-3
                rounded-2xl border-2 border-dashed border-gray-800 text-gray-600">
                <span className="text-5xl">🔍</span>
                <p className="text-sm">点击「生成题目」开始 Debug 训练</p>
                <p className="text-xs opacity-60">AI 会在正确代码中故意植入 Bug</p>
              </div>
            )}

            {/* 提示文字 */}
            {hintText && (
              <div className="rounded-2xl border border-amber-800/40 bg-amber-900/10 px-4 py-3">
                <p className="text-xs text-amber-300">
                  💡 提示 Level {hintLevel}：{hintText}
                </p>
              </div>
            )}
          </div>

          {/* 右：操作 + 统计 */}
          <div className="space-y-3">
            {/* 操作面板 */}
            <div className="rounded-2xl border border-gray-800 bg-[#141820] p-4 space-y-4">
              <p className="text-xs font-medium text-gray-400">🔧 找 Bug 并提交</p>

              {/* Step 1 */}
              <div className={`rounded-xl px-3 py-2 text-xs border transition-all
                ${selectedLines.size > 0
                  ? 'bg-indigo-900/20 border-indigo-700/40 text-indigo-300'
                  : 'bg-gray-800/40 border-gray-700/40 text-gray-500'
                }`}>
                <span className="font-medium">Step 1</span>：点击行号标注 Bug 位置
                {selectedLines.size > 0 && (
                  <span className="ml-2 text-indigo-400">✓ 已标注 {selectedLines.size} 行</span>
                )}
              </div>

              {/* Step 2: 修复描述 */}
              <div>
                <p className="text-xs text-gray-500 mb-1.5">
                  <span className="font-medium">Step 2</span>：描述 Bug 原因和修复方案
                </p>
                <textarea
                  value={userFix}
                  onChange={e => setUserFix(e.target.value)}
                  rows={5}
                  placeholder={`描述你发现的 Bug 和修复方案...\n例：第7行条件应该是 < n 而不是 <= n，会导致数组越界`}
                  className="w-full resize-none rounded-xl border border-gray-700 bg-gray-800/60
                    px-3 py-2 text-xs text-gray-200 placeholder:text-gray-600
                    focus:outline-none focus:ring-2 focus:ring-indigo-500 leading-relaxed"
                />
              </div>

              {/* 按钮 */}
              <div className="space-y-2">
                <button
                  onClick={handleSubmit}
                  disabled={submitting || !userFix.trim() || !challenge}
                  className="w-full py-2.5 text-sm rounded-xl bg-indigo-600 hover:bg-indigo-500
                    text-white font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {submitting ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-3.5 h-3.5 rounded-full border border-white/40 border-t-white animate-spin" />
                      AI 验证中...
                    </span>
                  ) : '✅ 提交修复方案'}
                </button>
                <button
                  onClick={handleHint}
                  disabled={!challenge || hintLevel >= 4}
                  className="w-full py-2 text-xs rounded-xl border border-amber-700/50
                    bg-amber-900/20 text-amber-300 hover:bg-amber-900/30
                    transition-all disabled:opacity-30">
                  💡 获取提示（Level {hintLevel + 1}/4）
                </button>
              </div>
            </div>

            {/* 评估结果 */}
            {evalResult && (
              <div className={`rounded-2xl border p-4 space-y-3 transition-all
                ${evalResult.allFound
                  ? 'border-emerald-700/50 bg-emerald-900/15'
                  : 'border-amber-700/40 bg-amber-900/10'
                }`}>
                <div className="flex items-center gap-2">
                  <span className="text-xl">{evalResult.allFound ? '🎉' : '🔧'}</span>
                  <div>
                    <p className={`text-sm font-semibold ${evalResult.allFound ? 'text-emerald-300' : 'text-amber-300'}`}>
                      {evalResult.allFound ? '全部找到！' : `得分 ${evalResult.score}/100`}
                    </p>
                    {evalResult.score > 0 && !evalResult.allFound && (
                      <div className="mt-1 h-1.5 w-full rounded-full bg-gray-800 overflow-hidden">
                        <div className="h-1.5 rounded-full bg-amber-500"
                          style={{ width: `${evalResult.score}%` }} />
                      </div>
                    )}
                  </div>
                </div>

                {evalResult.overallFeedback && (
                  <p className="text-xs text-gray-400 leading-relaxed whitespace-pre-wrap">
                    {evalResult.overallFeedback}
                  </p>
                )}

                {(evalResult.missedBugs?.length ?? 0) > 0 && (
                  <div>
                    <p className="text-xs font-medium text-amber-400 mb-1.5">遗漏的 Bug：</p>
                    <div className="space-y-1">
                      {evalResult.missedBugs!.map((b, i) => (
                        <div key={i} className="text-xs text-gray-500 flex gap-1.5">
                          <span className="text-amber-500 shrink-0">•</span>
                          {b.hint ?? b.description ?? '未知 Bug'}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {evalResult.allFound && (
                  <button onClick={handleGenerate}
                    className="w-full py-1.5 text-xs rounded-xl bg-emerald-700/40 border border-emerald-700/50
                      text-emerald-300 hover:bg-emerald-700/60 transition-colors">
                    🎲 再来一题
                  </button>
                )}
              </div>
            )}

            {/* 统计侧栏 */}
            <StatsPanel stats={stats} />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DebugPage() {
  return (
    <Suspense fallback={
      <div className="flex h-[60vh] items-center justify-center bg-[#0F1117]">
        <div className="w-8 h-8 rounded-full border-2 border-indigo-700 border-t-indigo-400 animate-spin" />
      </div>
    }>
      <DebugContent />
    </Suspense>
  );
}
