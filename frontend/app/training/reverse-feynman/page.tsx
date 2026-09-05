'use client';

import { Suspense, useState, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAppStore } from '@/store';
import { reverseFeynmanApi } from '@/lib/api';

// ===== 类型 =====
interface Paragraph     { id: string; content: string; }
interface CorrectionResult { passed: boolean; feedback: string; explanation?: string; }

type ParagraphState = 'idle' | 'selected' | 'correct' | 'wrong' | 'skipped';

// ===== 难度配置 =====
const DIFF_CONFIG = {
  EASY:   { label: '🟢 简单', desc: '1个明显错误', color: '#10B981', bg: 'bg-emerald-900/30', border: 'border-emerald-700/50' },
  MEDIUM: { label: '🟡 中等', desc: '1-2个隐蔽错误', color: '#F59E0B', bg: 'bg-amber-900/30',  border: 'border-amber-700/50'  },
  HARD:   { label: '🔴 困难', desc: '2-3个复杂错误', color: '#EF4444', bg: 'bg-red-900/30',    border: 'border-red-700/50'    },
};

function guestId() {
  if (typeof window === 'undefined') return 'guest';
  let id = localStorage.getItem('rf-guest-id');
  if (!id) { id = `guest-${Date.now()}`; localStorage.setItem('rf-guest-id', id); }
  return id;
}

function parseJson<T>(text: string): T | null {
  try {
    const s = text.indexOf('{'), e = text.lastIndexOf('}');
    if (s >= 0 && e > s) return JSON.parse(text.slice(s, e + 1)) as T;
    return JSON.parse(text) as T;
  } catch { return null; }
}

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

// ===== 段落卡片 =====
function ParagraphCard({
  para, state, result, isSelected, correction, onMarkCorrect, onMarkWrong,
  onSetCorrection, onSubmit, onCancel, submitting,
}: {
  para: Paragraph;
  state: ParagraphState;
  result?: CorrectionResult;
  isSelected: boolean;
  correction: string;
  onMarkCorrect: () => void;
  onMarkWrong: () => void;
  onSetCorrection: (v: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
  submitting: boolean;
}) {
  const borderClass =
    state === 'correct'  ? 'border-emerald-600/60 bg-emerald-900/10' :
    state === 'wrong'    ? 'border-gray-700/40 bg-gray-900/20' :
    state === 'skipped'  ? 'border-gray-800/40 opacity-60' :
    isSelected           ? 'border-indigo-600/70 bg-indigo-900/10' :
    'border-gray-800/60 bg-[#141820] hover:border-gray-600/60';

  return (
    <div className={`rounded-2xl border-2 transition-all ${borderClass}`}>
      {/* 段落内容 */}
      <div className="px-5 py-4">
        {/* 状态标签 */}
        {state !== 'idle' && state !== 'selected' && (
          <div className="flex items-center gap-1.5 mb-2">
            {state === 'correct' && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-900/40 border border-emerald-700/50 text-emerald-300">
                ✓ 错误已找到
              </span>
            )}
            {state === 'skipped' && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-gray-800 border border-gray-700 text-gray-500">
                ✓ 标记为正确
              </span>
            )}
          </div>
        )}
        <p className={`text-sm leading-relaxed whitespace-pre-wrap
          ${state === 'correct' ? 'text-gray-200' : state === 'skipped' ? 'text-gray-600 line-through' : 'text-gray-200'}`}>
          {para.content}
        </p>
      </div>

      {/* 操作区（未处理时显示） */}
      {state === 'idle' && (
        <div className="border-t border-gray-800/60 px-5 py-3 flex gap-2">
          <button onClick={onMarkCorrect}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-xl
              border border-emerald-700/50 bg-emerald-900/20 text-emerald-300
              hover:bg-emerald-900/40 transition-colors">
            <span>✓</span> 这段正确
          </button>
          <button onClick={onMarkWrong}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-xl
              border border-red-700/50 bg-red-900/20 text-red-300
              hover:bg-red-900/40 transition-colors">
            <span>✗</span> 发现错误
          </button>
        </div>
      )}

      {/* 纠错输入（选中后显示） */}
      {isSelected && state === 'selected' && (
        <div className="border-t border-indigo-800/40 px-5 py-4 space-y-3">
          <p className="text-xs text-indigo-400">📝 描述这段的错误在哪，正确说法是什么：</p>
          <textarea
            value={correction}
            onChange={e => onSetCorrection(e.target.value)}
            rows={3}
            autoFocus
            placeholder="例：这里说 BFS 时间复杂度是 O(n²) 是错的，正确应该是 O(V+E)，其中 V 是顶点数，E 是边数..."
            className="w-full resize-none rounded-xl border border-gray-700 bg-gray-800/60
              px-3 py-2 text-sm text-gray-200 placeholder:text-gray-600 leading-relaxed
              focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <div className="flex gap-2">
            <button onClick={onSubmit} disabled={submitting || !correction.trim()}
              className="px-4 py-1.5 text-xs rounded-xl bg-indigo-600 hover:bg-indigo-500
                text-white font-medium transition-all disabled:opacity-40">
              {submitting ? (
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full border border-white/40 border-t-white animate-spin" />
                  验证中...
                </span>
              ) : '提交纠错'}
            </button>
            <button onClick={onCancel}
              className="px-3 py-1.5 text-xs rounded-xl border border-gray-700 text-gray-400 hover:border-gray-600">
              取消
            </button>
          </div>
        </div>
      )}

      {/* 结果反馈 */}
      {result && (
        <div className={`border-t px-5 py-3 text-xs leading-relaxed
          ${result.passed
            ? 'border-emerald-800/40 text-emerald-300'
            : 'border-gray-800/40 text-gray-500'
          }`}>
          <span className="mr-1">{result.passed ? '🎉' : '💭'}</span>
          {result.feedback}
          {result.passed && result.explanation && (
            <p className="mt-1.5 text-emerald-400 leading-relaxed">{result.explanation}</p>
          )}
        </div>
      )}
    </div>
  );
}

// ===== 主组件 =====
function ReverseFeynmanContent() {
  const searchParams = useSearchParams();
  const { user } = useAppStore();
  const problemId = searchParams.get('problem') || searchParams.get('problemId') || '';

  const [difficulty, setDifficulty] = useState<'EASY' | 'MEDIUM' | 'HARD'>('MEDIUM');
  const [sessionId, setSessionId]   = useState('');
  const [paragraphs, setParagraphs] = useState<Paragraph[]>([]);
  const [loading, setLoading]       = useState(false);
  const [states, setStates]         = useState<Record<string, ParagraphState>>({});
  const [results, setResults]       = useState<Record<string, CorrectionResult>>({});
  const [selectedPara, setSelectedPara] = useState<string | null>(null);
  const [correction, setCorrection] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [finished, setFinished]     = useState(false);

  const uid = user?.id ?? guestId();

  const successCount  = Object.values(results).filter(r => r.passed).length;
  const totalAttempts = Object.keys(states).filter(k => states[k] !== 'idle').length;
  const accuracy      = totalAttempts > 0 ? Math.round(successCount / totalAttempts * 100) : 0;
  const diffConf      = DIFF_CONFIG[difficulty];

  // 开始训练
  const handleStart = useCallback(async () => {
    setLoading(true);
    setStates({}); setResults({}); setSelectedPara(null);
    setCorrection(''); setFinished(false);
    try {
      const res = await reverseFeynmanApi.start(uid, problemId || 'unknown', 1, difficulty) as {
        session?: { sessionId?: string; id?: string };
        content?: string;
      };
      setSessionId(res.session?.sessionId ?? res.session?.id ?? `rf-${Date.now()}`);
      const parsed = parseJson<{ paragraphs: Paragraph[] }>(res.content ?? '{}');
      if (parsed?.paragraphs) {
        setParagraphs(parsed.paragraphs);
        const initialStates: Record<string, ParagraphState> = {};
        parsed.paragraphs.forEach(p => { initialStates[p.id] = 'idle'; });
        setStates(initialStates);
      }
    } catch { alert('生成失败，请重试'); }
    finally { setLoading(false); }
  }, [uid, problemId, difficulty]);

  // 标记正确（跳过）
  const handleMarkCorrect = (paraId: string) => {
    setStates(p => ({ ...p, [paraId]: 'skipped' }));
    if (selectedPara === paraId) setSelectedPara(null);
  };

  // 选中段落（发现错误）
  const handleMarkWrong = (paraId: string) => {
    setSelectedPara(paraId);
    setStates(p => ({ ...p, [paraId]: 'selected' }));
    setCorrection('');
  };

  // 提交纠错（REST）
  const handleSubmit = useCallback(async () => {
    if (!selectedPara || !correction.trim() || !sessionId) return;
    setSubmitting(true);
    try {
      const res = await postRequest<CorrectionResult>(
        `/api/v1/reverse-feynman/${sessionId}/validate`,
        { paragraphId: selectedPara, correction }
      );
      setResults(p => ({ ...p, [selectedPara]: res }));
      setStates(p => ({ ...p, [selectedPara]: res.passed ? 'correct' : 'wrong' }));
      setSelectedPara(null);
      setCorrection('');
    } catch (err) {
      const msg = err instanceof Error ? err.message : '提交失败';
      if (selectedPara) {
        setResults(p => ({ ...p, [selectedPara]: { passed: false, feedback: msg } }));
        setStates(p => ({ ...p, [selectedPara]: 'wrong' }));
      }
      setSelectedPara(null);
    } finally {
      setSubmitting(false);
    }
  }, [selectedPara, correction, sessionId]);

  // ===== 开始页面 =====
  if (!paragraphs.length && !loading) {
    return (
      <div className="min-h-screen bg-[#0F1117] flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="text-6xl">🔄</div>
          <div>
            <h1 className="text-2xl font-bold text-gray-100 mb-2">反向费曼法</h1>
            <p className="text-sm text-gray-400 leading-relaxed">
              AI 会给出一段包含隐蔽错误的算法解释，<br />你来找出错误并纠正。通过纠错加深理解。
            </p>
          </div>

          {/* 难度选择 */}
          <div className="space-y-2">
            {(Object.entries(DIFF_CONFIG) as [keyof typeof DIFF_CONFIG, typeof DIFF_CONFIG[keyof typeof DIFF_CONFIG]][]).map(([d, conf]) => (
              <button key={d} onClick={() => setDifficulty(d)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl border transition-all
                  ${difficulty === d ? `${conf.bg} ${conf.border}` : 'border-gray-800 bg-gray-900/40 hover:border-gray-700'}`}>
                <span className="text-base">{conf.label.split(' ')[0]}</span>
                <div className="text-left flex-1">
                  <p className={`text-sm font-medium ${difficulty === d ? '' : 'text-gray-300'}`}>
                    {d} · {conf.desc}
                  </p>
                </div>
                {difficulty === d && (
                  <span className="text-xs px-2 py-0.5 rounded-full border"
                    style={{ color: conf.color, borderColor: conf.color + '60', backgroundColor: conf.color + '20' }}>
                    已选
                  </span>
                )}
              </button>
            ))}
          </div>

          <button onClick={handleStart} disabled={loading}
            className="w-full py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500
              text-white font-semibold text-sm transition-all disabled:opacity-50">
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                AI 正在生成含错误的解释...
              </span>
            ) : '🚀 开始训练'}
          </button>
        </div>
      </div>
    );
  }

  // ===== 完成页面 =====
  if (finished) {
    return (
      <div className="min-h-screen bg-[#0F1117] flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="text-6xl">{accuracy >= 70 ? '🏆' : accuracy >= 40 ? '👍' : '💪'}</div>
          <h2 className="text-xl font-bold text-gray-100">训练完成！</h2>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: '总尝试', value: totalAttempts, color: 'text-indigo-400' },
              { label: '纠错成功', value: successCount, color: 'text-emerald-400' },
              { label: '正确率', value: `${accuracy}%`, color: accuracy >= 70 ? 'text-emerald-400' : 'text-amber-400' },
            ].map(({ label, value, color }) => (
              <div key={label} className="rounded-xl bg-gray-800/60 border border-gray-700 p-3">
                <div className={`text-xl font-bold tabular-nums ${color}`}>{value}</div>
                <div className="text-[10px] text-gray-500 mt-0.5">{label}</div>
              </div>
            ))}
          </div>
          <p className="text-xs text-emerald-400">🔔 纠错成功的题目已自动加入复习计划</p>
          <div className="flex gap-3 justify-center">
            <button onClick={handleStart}
              className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium">
              再来一次
            </button>
            <button onClick={() => window.history.back()}
              className="px-5 py-2.5 rounded-xl border border-gray-700 text-gray-300 text-sm hover:border-gray-600">
              返回
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ===== 训练主界面 =====
  const allDone = paragraphs.length > 0 && paragraphs.every(p => states[p.id] !== 'idle' && states[p.id] !== 'selected');

  return (
    <div className="min-h-screen bg-[#0F1117]">
      <div className="mx-auto max-w-4xl px-4 py-6">
        {/* 顶栏 */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <span className="text-xl">🔄</span>
            <div>
              <h1 className="text-sm font-semibold text-gray-100">反向费曼法</h1>
              <p className="text-xs text-gray-500">找出 AI 故意植入的错误</p>
            </div>
            <span className="text-xs px-2.5 py-1 rounded-xl border"
              style={{ color: diffConf.color, borderColor: diffConf.color + '60', backgroundColor: diffConf.color + '15' }}>
              {difficulty} · {diffConf.desc}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {totalAttempts > 0 && (
              <span className="text-xs text-gray-400">
                正确率 <span className="font-bold tabular-nums"
                  style={{ color: accuracy >= 70 ? '#10B981' : '#F59E0B' }}>{accuracy}%</span>
              </span>
            )}
            {allDone && (
              <button onClick={() => setFinished(true)}
                className="px-3 py-1.5 text-xs rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white font-medium transition-colors">
                ✅ 完成训练
              </button>
            )}
            <button onClick={handleStart}
              className="px-3 py-1.5 text-xs rounded-xl border border-gray-700 text-gray-400 hover:border-gray-600 transition-colors">
              🔄 重新生成
            </button>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          {/* 左：段落列表 */}
          <div className="lg:col-span-2 space-y-3">
            <div className="flex items-center gap-2 mb-1">
              <p className="text-xs text-gray-500">
                AI 的解释中隐藏了错误，点击段落操作：
              </p>
              <span className="text-xs text-indigo-400">「发现错误」→ 填写纠正 → AI 验证</span>
            </div>
            {paragraphs.map((para, idx) => (
              <div key={para.id} className="relative">
                {/* 段落编号 */}
                <div className="absolute -left-6 top-4 text-xs text-gray-700 font-mono select-none">
                  {idx + 1}
                </div>
                <ParagraphCard
                  para={para}
                  state={states[para.id] ?? 'idle'}
                  result={results[para.id]}
                  isSelected={selectedPara === para.id}
                  correction={selectedPara === para.id ? correction : ''}
                  onMarkCorrect={() => handleMarkCorrect(para.id)}
                  onMarkWrong={() => handleMarkWrong(para.id)}
                  onSetCorrection={setCorrection}
                  onSubmit={handleSubmit}
                  onCancel={() => { setSelectedPara(null); setStates(p => ({ ...p, [para.id]: 'idle' })); }}
                  submitting={submitting && selectedPara === para.id}
                />
              </div>
            ))}
          </div>

          {/* 右：进度 + 统计 */}
          <div className="space-y-3">
            {/* 纠错统计 */}
            <div className="rounded-2xl border border-gray-800 bg-[#141820] p-4 space-y-3">
              <p className="text-xs font-medium text-gray-400">📊 纠错情况</p>
              <div className="space-y-2">
                {[
                  { label: '纠错成功', value: successCount, color: 'text-emerald-400' },
                  { label: '总尝试', value: totalAttempts, color: 'text-gray-300' },
                ].map(({ label, value, color }) => (
                  <div key={label} className="flex justify-between text-sm">
                    <span className="text-gray-500">{label}</span>
                    <span className={`font-bold tabular-nums ${color}`}>{value}</span>
                  </div>
                ))}
                {totalAttempts > 0 && (
                  <>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">正确率</span>
                      <span className="font-bold tabular-nums"
                        style={{ color: accuracy >= 70 ? '#10B981' : '#F59E0B' }}>
                        {accuracy}%
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-gray-800 overflow-hidden">
                      <div className="h-2 rounded-full transition-all duration-700"
                        style={{ width: `${accuracy}%`, backgroundColor: accuracy >= 70 ? '#10B981' : '#F59E0B' }} />
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* 段落进度 */}
            <div className="rounded-2xl border border-gray-800 bg-[#141820] p-4">
              <p className="text-xs font-medium text-gray-400 mb-3">段落进度</p>
              <div className="space-y-2">
                {paragraphs.map((p, i) => {
                  const s = states[p.id] ?? 'idle';
                  return (
                    <div key={p.id} className="flex items-center gap-2 text-[10px]">
                      <span className="text-gray-600 shrink-0 w-8">段落{i + 1}</span>
                      <div className="flex-1 h-1.5 rounded-full bg-gray-800 overflow-hidden">
                        <div className="h-1.5 rounded-full transition-all duration-500"
                          style={{
                            width: s === 'idle' ? '0%' : '100%',
                            backgroundColor: s === 'correct' ? '#10B981' : s === 'skipped' ? '#6B7280' : s === 'selected' ? '#6366F1' : '#374151'
                          }} />
                      </div>
                      <span className="shrink-0">
                        {s === 'correct' ? '✅' : s === 'skipped' ? '⚪' : s === 'selected' ? '✏️' : '⬜'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 提示说明 */}
            <div className="rounded-2xl border border-indigo-900/50 bg-indigo-900/10 p-4 space-y-2">
              <p className="text-xs font-medium text-indigo-300">💡 玩法说明</p>
              <ul className="space-y-1 text-[10px] text-gray-500">
                <li>• 每段点「发现错误」→ 填写纠错</li>
                <li>• 点「这段正确」跳过该段</li>
                <li>• 纠错成功自动加入复习计划</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ReverseFeynmanPage() {
  return (
    <Suspense fallback={
      <div className="flex h-[60vh] items-center justify-center bg-[#0F1117]">
        <div className="w-8 h-8 rounded-full border-2 border-indigo-700 border-t-indigo-400 animate-spin" />
      </div>
    }>
      <ReverseFeynmanContent />
    </Suspense>
  );
}
