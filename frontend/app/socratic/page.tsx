'use client';

import { Suspense, useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useAppStore } from '@/store';
import { problemsApi, socraticApi } from '@/lib/api';

// ===== 类型 =====
interface Msg { id: string; role: 'guide'|'student'|'system'; content: string; ts: number; }

interface SummaryData {
  score?: number;
  strengths?: string;
  improvements?: string;
  approach?: string;
  verdict?: string;
}

// ===== 配置 =====
const HINT_CONFIG = [
  { level: 1, label: '自主推导',   emoji: '🧭', score: 100, color: '#10B981', bg: 'bg-emerald-900/30', border: 'border-emerald-700/50', text: 'text-emerald-300' },
  { level: 2, label: '方法暗示',   emoji: '🔍', score: 75,  color: '#6366F1', bg: 'bg-indigo-900/30',  border: 'border-indigo-700/50',  text: 'text-indigo-300' },
  { level: 3, label: '伪代码框架', emoji: '📝', score: 50,  color: '#F59E0B', bg: 'bg-amber-900/30',   border: 'border-amber-700/50',   text: 'text-amber-300' },
  { level: 4, label: '完整引导',   emoji: '📖', score: 25,  color: '#EF4444', bg: 'bg-red-900/30',     border: 'border-red-700/50',     text: 'text-red-300' },
];

function guestId() {
  if (typeof window === 'undefined') return 'guest';
  let id = localStorage.getItem('socratic-guest-id');
  if (!id) { id = `guest-${Date.now()}`; localStorage.setItem('socratic-guest-id', id); }
  return id;
}

function parseJson<T>(text: string): T | null {
  try {
    const s = text.indexOf('{'), e = text.lastIndexOf('}');
    if (s >= 0 && e > s) return JSON.parse(text.slice(s, e + 1)) as T;
    return JSON.parse(text) as T;
  } catch { return null; }
}

// ===== 消息气泡 =====
function GuideBubble({ m }: { m: Msg }) {
  if (m.role === 'system') return (
    <div className="flex justify-center">
      <div className="rounded-xl bg-gray-800/70 border border-gray-700/40 px-4 py-2
        text-xs text-gray-400 animate-fade-in max-w-md text-center">
        {m.content}
      </div>
    </div>
  );
  const isStudent = m.role === 'student';
  return (
    <div className={`flex gap-3 animate-fade-in-up ${isStudent ? 'flex-row-reverse' : ''}`}>
      <div className={`h-8 w-8 shrink-0 rounded-xl flex items-center justify-center text-xs font-bold
        ${isStudent ? 'bg-indigo-600 text-white' : 'bg-emerald-600 text-white'}`}>
        {isStudent ? '我' : '引'}
      </div>
      <div className={`max-w-[76%] rounded-2xl px-4 py-3 text-sm leading-relaxed
        ${isStudent
          ? 'bg-indigo-600 text-white rounded-tr-none'
          : 'bg-gray-800 border-l-2 border-emerald-500 text-gray-200 rounded-tl-none'
        }`}>
        <div className="whitespace-pre-wrap">{m.content}</div>
        <div className={`mt-1.5 text-[10px] ${isStudent ? 'text-indigo-200 text-right' : 'text-gray-500'}`}>
          {new Date(m.ts).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
    </div>
  );
}

// ===== 提示级别仪表盘 =====
function HintGauge({ hintLevel, score }: { hintLevel: number; score: number }) {
  const conf = HINT_CONFIG.find(c => c.level === hintLevel) ?? HINT_CONFIG[0];
  const scorePct = score;

  return (
    <div className="rounded-2xl border border-gray-800 bg-[#141820] p-4 space-y-4">
      {/* 标题 */}
      <p className="text-xs font-medium text-gray-400">📊 提示级别仪表</p>

      {/* 提示步骤 */}
      <div className="space-y-2">
        {HINT_CONFIG.map(c => {
          const isActive = c.level === hintLevel;
          const isPast = c.level < hintLevel;
          return (
            <div key={c.level}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 border transition-all
                ${isActive ? `${c.bg} ${c.border}` : isPast ? 'bg-gray-800/30 border-gray-700/30 opacity-40' : 'border-transparent opacity-20'}`}>
              <span className="text-base shrink-0">{c.emoji}</span>
              <div className="flex-1 min-w-0">
                <p className={`text-xs font-medium ${isActive ? c.text : 'text-gray-500'}`}>
                  Level {c.level} · {c.label}
                </p>
                {isActive && (
                  <p className="text-[10px] text-gray-500 mt-0.5">预计得分 {c.score} 分</p>
                )}
              </div>
              {isActive && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full border"
                  style={{ color: c.color, borderColor: c.color + '60', backgroundColor: c.color + '20' }}>
                  当前
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* 分隔 */}
      <div className="border-t border-gray-800" />

      {/* 自主度进度条 */}
      <div>
        <div className="flex justify-between mb-1.5">
          <span className="text-xs text-gray-400">自主推导度</span>
          <span className="text-xs font-bold tabular-nums" style={{ color: conf.color }}>{scorePct}%</span>
        </div>
        <div className="h-2.5 w-full rounded-full bg-gray-800 overflow-hidden">
          <div className="h-2.5 rounded-full transition-all duration-700"
            style={{ width: `${scorePct}%`, backgroundColor: conf.color }} />
        </div>
      </div>
    </div>
  );
}

// ===== 得分对比图 =====
function ScoreCompare({ hintLevel, score, solved }: { hintLevel: number; score: number; solved: boolean }) {
  if (!solved) return null;
  return (
    <div className="rounded-2xl border border-gray-800 bg-[#141820] p-4 space-y-3">
      <p className="text-xs font-medium text-gray-400">📈 独立性对比</p>
      <div className="grid grid-cols-2 gap-2">
        {[
          { label: '自主完成', value: `${score}%`, color: score >= 75 ? '#10B981' : score >= 50 ? '#F59E0B' : '#EF4444' },
          { label: '引导帮助', value: `${100 - score}%`, color: '#6366F1' },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-xl bg-gray-800/60 border border-gray-700/50 p-3 text-center">
            <div className="text-xl font-bold tabular-nums" style={{ color }}>{value}</div>
            <div className="text-[10px] text-gray-500 mt-0.5">{label}</div>
          </div>
        ))}
      </div>
      {/* Level 柱状图 */}
      <div className="space-y-1.5">
        {HINT_CONFIG.map(c => (
          <div key={c.level} className={`flex items-center gap-2 text-[10px] ${c.level === hintLevel ? '' : 'opacity-30'}`}>
            <span className="w-3 shrink-0">{c.emoji}</span>
            <div className="flex-1 h-1.5 rounded-full bg-gray-800 overflow-hidden">
              <div className="h-1.5 rounded-full"
                style={{ width: c.level === hintLevel ? `${c.score}%` : '0%', backgroundColor: c.color }} />
            </div>
            <span className="w-8 text-right shrink-0" style={{ color: c.level === hintLevel ? c.color : '#6B7280' }}>
              {c.level === hintLevel ? `${c.score}` : '-'}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ===== 主组件 =====
function SocraticContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const problemId = searchParams.get('problem') || searchParams.get('problemId') || '';
  const { user } = useAppStore();

  const [msgs, setMsgs]       = useState<Msg[]>([]);
  const [input, setInput]     = useState('');
  const [sessionId, setSessionId] = useState('');
  const [hintLevel, setHintLevel] = useState(1);
  const [score, setScore]     = useState(100);
  const [active, setActive]   = useState(true);
  const [aiTyping, setAiTyping] = useState(false);
  const [solved, setSolved]   = useState(false);
  const [summaryData, setSummaryData] = useState<SummaryData | null>(null);
  const [problemTitle, setProblemTitle] = useState('算法题');

  const endRef  = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const { state: wsState, send, subscribe } = useWebSocket();

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs]);

  useEffect(() => {
    if (problemId) problemsApi.get(problemId).then((p: { title?: string }) => setProblemTitle(p.title ?? problemId)).catch(() => {});
  }, [problemId]);

  const addMsg = (role: Msg['role'], content: string) =>
    setMsgs(p => [...p, { id: `${role}-${Date.now()}-${Math.random()}`, role, content, ts: Date.now() }]);

  // 初始化会话（游客可用）
  useEffect(() => {
    if (sessionId) return;
    const uid = user?.id ?? guestId();
    socraticApi.start(uid, problemId || 'unknown').then((s: { sessionId?: string; id?: string }) => {
      setSessionId(s.sessionId ?? s.id ?? `socratic-${Date.now()}`);
      addMsg('system', '🦉 苏格拉底追问模式已开启。AI 不会直接给你答案，而是通过问题引导你自己推导。');
    }).catch(() => {
      setSessionId(`socratic-local-${Date.now()}`);
      addMsg('system', '苏格拉底模式已就绪，开始思考这道题吧！');
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, problemId]);

  // WS 订阅
  useEffect(() => {
    const u1 = subscribe('AI_RESPONSE', (payload: unknown) => {
      setAiTyping(false);
      const content = typeof payload === 'string' ? payload : (payload as { content?: string })?.content ?? '';
      addMsg('guide', content);
    });
    const u2 = subscribe('SOCRATIC_SUMMARY', (payload: unknown) => {
      setAiTyping(false); setSolved(true); setActive(false);
      const raw = typeof payload === 'string' ? payload : JSON.stringify(payload);
      const parsed = parseJson<SummaryData>(raw);
      if (parsed) setSummaryData(parsed);
    });
    const u3 = subscribe('SYSTEM_MESSAGE', (payload: unknown) => {
      addMsg('system', typeof payload === 'string' ? payload : (payload as { content?: string })?.content ?? '');
    });
    return () => { u1(); u2(); u3(); };
  }, [subscribe]);

  const handleSend = useCallback(() => {
    const text = input.trim();
    if (!text || !active) return;
    addMsg('student', text);
    setInput('');
    if (wsState === 'connected') {
      setAiTyping(true);
      send({ type: 'SOCRATIC_CHAT', sessionId, payload: text } as Parameters<typeof send>[0]);
    } else {
      addMsg('system', '⚠️ AI 连接未就绪，请确保已登录或稍后重试。');
    }
    if (textRef.current) textRef.current.style.height = 'auto';
  }, [input, active, wsState, sessionId, send]);

  const handleNextHint = useCallback(async () => {
    if (hintLevel >= 4) return;
    const newLevel = hintLevel + 1;
    try {
      await socraticApi.nextHint(sessionId);
      setHintLevel(newLevel);
      setScore(HINT_CONFIG.find(c => c.level === newLevel)?.score ?? 25);
      addMsg('system', `📈 提示升级到 Level ${newLevel}/4 — ${HINT_CONFIG[newLevel - 1]?.label}`);
    } catch { addMsg('system', '提示请求失败，请重试'); }
  }, [hintLevel, sessionId]);

  const handleSolvedSummarize = useCallback(async () => {
    addMsg('system', '正在生成解题总结...');
    try {
      const res = await socraticApi.summarize(sessionId, problemTitle) as string | { data?: string };
      const raw = typeof res === 'string' ? res : res?.data ?? JSON.stringify(res);
      const parsed = parseJson<SummaryData>(raw);
      if (parsed) setSummaryData(parsed);
    } catch { addMsg('system', '总结生成失败，请重试'); }
    setActive(false); setSolved(true);
  }, [sessionId, problemTitle]);

  const currentConf = HINT_CONFIG.find(c => c.level === hintLevel) ?? HINT_CONFIG[0];

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col bg-[#0F1117]">
      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 overflow-hidden">
        {/* 顶栏 */}
        <div className="flex items-center justify-between border-b border-gray-800 py-3 shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-xl">🦉</span>
            <div>
              <h1 className="text-sm font-semibold text-gray-100">苏格拉底追问</h1>
              {problemTitle !== '算法题' && (
                <p className="text-xs text-gray-500 truncate max-w-[200px]">{problemTitle}</p>
              )}
            </div>
            {/* 当前提示级别标签 */}
            <span className={`text-xs px-2.5 py-1 rounded-xl border font-medium ${currentConf.bg} ${currentConf.border} ${currentConf.text}`}>
              {currentConf.emoji} Level {hintLevel} · {currentConf.label}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className={`h-1.5 w-1.5 rounded-full ${wsState === 'connected' ? 'bg-emerald-500' : 'bg-yellow-500 animate-pulse'}`} />
            {active && (
              <button onClick={handleSolvedSummarize}
                className="px-3 py-1.5 text-xs rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white font-medium transition-colors">
                ✅ 我解出了！生成总结
              </button>
            )}
          </div>
        </div>

        {/* 主体 */}
        <div className="flex flex-1 gap-4 overflow-hidden py-3 min-h-0">
          {/* 左：对话区 */}
          <div className="flex flex-1 flex-col overflow-hidden rounded-2xl border border-gray-800 bg-[#141820] min-w-0">
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {msgs.length === 0 && (
                <div className="flex flex-col items-center justify-center h-40 gap-3 text-center">
                  <div className="text-4xl">🦉</div>
                  <p className="text-sm text-gray-400">初始化中...</p>
                </div>
              )}
              {msgs.map(m => <GuideBubble key={m.id} m={m} />)}
              {aiTyping && (
                <div className="flex gap-3 animate-fade-in">
                  <div className="h-8 w-8 rounded-xl bg-emerald-600 flex items-center justify-center text-xs font-bold text-white shrink-0">引</div>
                  <div className="rounded-2xl rounded-tl-none bg-gray-800 border-l-2 border-emerald-500 px-4 py-3">
                    <div className="flex gap-1.5 items-center">
                      {[0, 150, 300].map(d => (
                        <span key={d} className="h-2 w-2 rounded-full bg-emerald-400 animate-bounce"
                          style={{ animationDelay: `${d}ms` }} />
                      ))}
                    </div>
                  </div>
                </div>
              )}
              <div ref={endRef} />
            </div>

            {/* 输入区 */}
            {active ? (
              <div className="border-t border-gray-800 p-3 shrink-0">
                <div className="flex items-end gap-2">
                  <textarea
                    ref={textRef}
                    value={input}
                    onChange={e => {
                      setInput(e.target.value);
                      e.target.style.height = 'auto';
                      e.target.style.height = `${Math.min(e.target.scrollHeight, 100)}px`;
                    }}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                    placeholder="分享你的思路... (Enter 回答，Shift+Enter 换行)"
                    rows={2}
                    className="flex-1 resize-none rounded-xl border border-gray-700 bg-gray-800/60
                      px-3 py-2.5 text-sm text-gray-200 placeholder:text-gray-600
                      focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-transparent"
                  />
                  <button
                    onClick={handleSend}
                    disabled={!input.trim()}
                    className="px-4 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-600
                      text-white text-sm font-medium transition-all
                      disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                  >
                    回答
                  </button>
                </div>
              </div>
            ) : (
              <div className="border-t border-gray-800 p-3 flex justify-center gap-3 shrink-0">
                {problemId && (
                  <button onClick={() => router.push(`/problems/${problemId}`)}
                    className="px-4 py-2 text-sm rounded-xl border border-gray-700 text-gray-300 hover:border-gray-600 transition-colors">
                    返回题目
                  </button>
                )}
                <button onClick={() => router.push('/review')}
                  className="px-4 py-2 text-sm rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition-colors">
                  去复习中心
                </button>
              </div>
            )}
          </div>

          {/* 右：仪表 + 得分 */}
          <div className="w-64 shrink-0 flex flex-col gap-3 overflow-y-auto">
            {/* 提示仪表盘 */}
            <HintGauge hintLevel={hintLevel} score={score} />

            {/* 请求提示按钮 */}
            {active && hintLevel < 4 && (
              <button onClick={handleNextHint}
                className={`w-full py-2.5 text-xs rounded-xl border font-medium transition-all
                  ${HINT_CONFIG[hintLevel].bg} ${HINT_CONFIG[hintLevel].border} ${HINT_CONFIG[hintLevel].text}
                  hover:opacity-90`}>
                💡 需要提示 → Level {hintLevel + 1}（{HINT_CONFIG[hintLevel].label}）
              </button>
            )}
            {active && hintLevel >= 4 && (
              <div className="text-center text-xs text-gray-600 py-2">已达最高提示级别</div>
            )}

            {/* 得分对比（解出后显示） */}
            <ScoreCompare hintLevel={hintLevel} score={score} solved={solved} />

            {/* 解题总结 */}
            {summaryData && (
              <div className="rounded-2xl border border-emerald-800/40 bg-emerald-900/10 p-4 space-y-2">
                <p className="text-xs font-semibold text-emerald-300">🎉 解题总结</p>
                <div className="space-y-2 text-xs text-gray-400">
                  {summaryData.score !== undefined && (
                    <div className="flex items-center gap-2">
                      <span className="text-gray-500">最终得分</span>
                      <span className="font-bold tabular-nums" style={{ color: currentConf.color }}>
                        {summaryData.score ?? score}/100
                      </span>
                    </div>
                  )}
                  {summaryData.verdict && (
                    <p className="text-emerald-300 text-xs">{summaryData.verdict}</p>
                  )}
                  {summaryData.strengths && (
                    <div>
                      <p className="text-emerald-400 mb-1">✅ 亮点</p>
                      <p className="text-gray-500 leading-relaxed">{summaryData.strengths}</p>
                    </div>
                  )}
                  {summaryData.improvements && (
                    <div>
                      <p className="text-amber-400 mb-1">💪 待改进</p>
                      <p className="text-gray-500 leading-relaxed">{summaryData.improvements}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 使用引导（初始状态） */}
            {msgs.length <= 1 && !solved && (
              <div className="rounded-2xl border border-dashed border-gray-700 p-4 space-y-2 text-center">
                <div className="text-2xl">🦉</div>
                <p className="text-xs text-gray-400">AI 不会直接给答案</p>
                <p className="text-[10px] text-gray-600">通过追问引导你自己推导解法</p>
                <p className="text-[10px] text-gray-600">越早推导出，得分越高</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SocraticPage() {
  return (
    <Suspense fallback={
      <div className="flex h-[60vh] items-center justify-center bg-[#0F1117]">
        <div className="w-8 h-8 rounded-full border-2 border-emerald-700 border-t-emerald-400 animate-spin" />
      </div>
    }>
      <SocraticContent />
    </Suspense>
  );
}
