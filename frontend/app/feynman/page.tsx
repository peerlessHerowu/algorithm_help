'use client';

import { Suspense, useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useAppStore } from '@/store';
import { problemsApi, feynmanApi } from '@/lib/api';

// ============ 类型 ============
interface Msg { id: string; role: 'user'|'ai'|'system'; content: string; ts: number; }
interface Summary {
  intuition: string; approach: string; pseudocode: string;
  code: string; complexity: { time: string; space: string };
  keyInsights: string[]; weakPoints: string[]; masteryLevel: number;
  analogies?: Analogy[];
}
interface Analogy { id: string; icon: string; scenario: string; description: string; punchline: string; }

const MASTERY_LABELS = ['','完全不理解','初步了解','基本掌握','深度理解','融会贯通'];
const MASTERY_COLORS = ['','#EF4444','#F59E0B','#EAB308','#10B981','#6366F1'];

// ============ 工具 ============
function parseJson<T>(text: string): T | null {
  try {
    const s = text.indexOf('{'), e = text.lastIndexOf('}');
    if (s >= 0 && e > s) return JSON.parse(text.slice(s, e + 1)) as T;
    return JSON.parse(text) as T;
  } catch { return null; }
}

function guestId() {
  if (typeof window === 'undefined') return 'guest';
  let id = localStorage.getItem('feynman-guest-id');
  if (!id) { id = `guest-${Date.now()}`; localStorage.setItem('feynman-guest-id', id); }
  return id;
}

// ============ 消息气泡 ============
function Bubble({ m, isLatestAI = false }: { m: Msg; isLatestAI?: boolean }) {
  if (m.role === 'system') return (
    <div className="flex justify-center">
      <div className="rounded-xl bg-gray-800/80 border border-gray-700/50 px-4 py-2
        text-xs text-gray-400 animate-fade-in max-w-md text-center">
        {m.content}
      </div>
    </div>
  );
  const isUser = m.role === 'user';
  return (
    <div className={`flex gap-3 animate-fade-in-up ${isUser ? 'flex-row-reverse' : ''}`}>
      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-xs font-bold
        ${isUser ? 'bg-indigo-600 text-white' : 'bg-gradient-to-br from-purple-500 to-indigo-600 text-white'}`}>
        {isUser ? '我' : 'AI'}
      </div>
      <div className={`max-w-[76%] rounded-2xl px-4 py-3 text-sm leading-relaxed
        ${isUser
          ? 'bg-indigo-600 text-white rounded-tr-none'
          : 'bg-gray-800 border border-gray-700/60 text-gray-200 rounded-tl-none'
        }`}>
        <div className={`whitespace-pre-wrap ${!isUser && isLatestAI ? 'typing-cursor' : ''}`}>
          {m.content}
        </div>
        <div className={`mt-1.5 text-[10px] ${isUser ? 'text-indigo-200 text-right' : 'text-gray-500'}`}>
          {new Date(m.ts).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
    </div>
  );
}

// ============ 总结面板 ============
function SummaryPanel({ summary, onExport }: { summary: Summary; onExport: () => void }) {
  const [open, setOpen] = useState(new Set(['intuition','approach']));
  const toggle = (k: string) => setOpen(p => { const n = new Set(p); n.has(k) ? n.delete(k) : n.add(k); return n; });

  const sections = [
    { k:'intuition',   icon:'💡', label:'直觉理解',   val: summary.intuition },
    { k:'approach',    icon:'🧭', label:'核心思路',   val: summary.approach },
    { k:'pseudocode',  icon:'📝', label:'伪代码',     val: summary.pseudocode },
    { k:'code',        icon:'💻', label:'代码参考',   val: summary.code },
    { k:'complexity',  icon:'📊', label:'复杂度',
      val: `时间：${summary.complexity?.time ?? '-'} | 空间：${summary.complexity?.space ?? '-'}` },
  ].filter(s => s.val);

  const masteryColor = MASTERY_COLORS[summary.masteryLevel] ?? '#6B7280';
  const masteryLabel = MASTERY_LABELS[summary.masteryLevel] ?? '';

  return (
    <div className="rounded-2xl border border-emerald-700/40 bg-emerald-900/10 p-4 space-y-3">
      {/* 标题行 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-base">🎉</span>
          <h3 className="text-sm font-semibold text-emerald-300">学习总结</h3>
        </div>
        <div className="flex items-center gap-2">
          {masteryLabel && (
            <span className="text-xs px-2 py-0.5 rounded-full border"
              style={{ color: masteryColor, borderColor: masteryColor + '60', backgroundColor: masteryColor + '20' }}>
              {masteryLabel}
            </span>
          )}
          <button onClick={onExport}
            className="flex items-center gap-1 px-2.5 py-1 text-xs rounded-lg
              bg-gray-700 text-gray-300 hover:bg-gray-600 transition-colors">
            📥 MD
          </button>
        </div>
      </div>

      {/* 折叠 sections */}
      <div className="space-y-1.5">
        {sections.map(({ k, icon, label, val }) => (
          <div key={k} className="rounded-xl border border-emerald-800/40 overflow-hidden">
            <button onClick={() => toggle(k)}
              className="flex w-full items-center justify-between px-3 py-2 text-left bg-gray-800/50 hover:bg-gray-800">
              <span className="flex items-center gap-1.5 text-xs font-medium text-gray-300">
                {icon} {label}
              </span>
              <span className="text-gray-500 text-xs">{open.has(k) ? '▾' : '▸'}</span>
            </button>
            {open.has(k) && (
              <div className="px-3 py-2 bg-gray-900/40 text-xs text-gray-400 whitespace-pre-wrap leading-relaxed">
                {val}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* 关键洞察 */}
      {(summary.keyInsights?.length > 0) && (
        <div>
          <p className="text-xs font-medium text-emerald-400 mb-1.5">💡 关键洞察</p>
          <ul className="space-y-1">
            {summary.keyInsights.map((ins, i) => (
              <li key={i} className="text-xs text-gray-400 flex gap-1.5">
                <span className="text-emerald-400 shrink-0">✓</span> {ins}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 待巩固 */}
      {(summary.weakPoints?.length > 0) && (
        <div>
          <p className="text-xs font-medium text-amber-400 mb-1.5">⚠️ 待巩固</p>
          <ul className="space-y-1">
            {summary.weakPoints.map((w, i) => (
              <li key={i} className="text-xs text-gray-400 flex gap-1.5">
                <span className="text-amber-400 shrink-0">•</span> {w}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ============ 类比面板 ============
function AnalogyPanel({ analogies, selected, onSelect }: {
  analogies: Analogy[]; selected: string | null; onSelect: (id: string) => void;
}) {
  return (
    <div className="space-y-2">
      <p className="text-xs text-gray-500">选择最能帮助你理解的类比：</p>
      {analogies.map(a => (
        <button key={a.id} onClick={() => onSelect(a.id)}
          className={`w-full rounded-xl border p-3 text-left transition-all
            ${selected === a.id
              ? 'border-indigo-500 bg-indigo-900/20'
              : 'border-gray-700 bg-gray-800/40 hover:border-indigo-700'
            }`}>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">{a.icon}</span>
            <span className="text-xs font-medium text-gray-200">{a.scenario}</span>
          </div>
          <p className="text-xs text-gray-500">{a.description}</p>
          {selected === a.id && a.punchline && (
            <p className="mt-1.5 text-xs text-indigo-300 italic">"{a.punchline}"</p>
          )}
        </button>
      ))}
    </div>
  );
}

// ============ 主组件 ============
function FeynmanContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const problemId = searchParams.get('problemId') || searchParams.get('problem') || '';
  const { user } = useAppStore();

  const [msgs, setMsgs]         = useState<Msg[]>([]);
  const [input, setInput]       = useState('');
  const [sessionId, setSessionId] = useState('');
  const [active, setActive]     = useState(true);
  const [aiTyping, setAiTyping] = useState(false);
  const [summary, setSummary]   = useState<Summary | null>(null);
  const [analogies, setAnalogies] = useState<Analogy[]>([]);
  const [selectedAnalogy, setSelectedAnalogy] = useState<string | null>(null);
  const [round, setRound]       = useState(0);
  const [problemTitle, setProblemTitle] = useState('算法题');
  const [rightTab, setRightTab] = useState<'status'|'analogies'|'history'>('status');
  const [loadingAnalogies, setLoadingAnalogies] = useState(false);

  const endRef  = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const { state: wsState, send, subscribe } = useWebSocket();

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs]);

  // 加载题目信息
  useEffect(() => {
    if (!problemId) return;
    problemsApi.get(problemId).then((p: any) => setProblemTitle(p.title || problemId)).catch(() => {});
  }, [problemId]);

  // 初始化会话（游客也可以用）
  useEffect(() => {
    if (sessionId) return;
    const uid = user?.id ?? guestId();
    feynmanApi.start(uid, problemId || 'unknown').then((s: any) => {
      setSessionId(s.sessionId || s.id || `feynman-${Date.now()}`);
      addMsg('system', '费曼模式已就绪，请用自己的话解释解题思路，AI 会追问帮你深化理解。');
    }).catch(() => {
      setSessionId(`feynman-local-${Date.now()}`);
      addMsg('system', '费曼模式已就绪（离线模式）。');
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, problemId]);

  // WebSocket 订阅
  useEffect(() => {
    const unsub1 = subscribe('AI_RESPONSE', (payload: unknown) => {
      setAiTyping(false);
      const content = typeof payload === 'string' ? payload : (payload as { content?: string })?.content ?? '';
      addMsg('ai', content);
    });
    const unsub2 = subscribe('FEYNMAN_SUMMARY', (payload: unknown) => {
      setAiTyping(false); setActive(false);
      const raw = typeof payload === 'string' ? payload : JSON.stringify(payload);
      const parsed = parseJson<Summary>(raw);
      if (parsed) { setSummary(parsed); if (parsed.analogies?.length) setAnalogies(parsed.analogies); }
    });
    const unsub3 = subscribe('SYSTEM_MESSAGE', (payload: unknown) => {
      addMsg('system', typeof payload === 'string' ? payload : (payload as { content?: string })?.content ?? '');
    });
    return () => { unsub1(); unsub2(); unsub3(); };
  }, [subscribe]);

  const addMsg = (role: Msg['role'], content: string) => {
    setMsgs(p => [...p, { id: `${role}-${Date.now()}-${Math.random()}`, role, content, ts: Date.now() }]);
  };

  const handleSend = useCallback(() => {
    const text = input.trim();
    if (!text || !active) return;
    addMsg('user', text);
    setInput('');
    setRound(r => r + 1);
    if (wsState === 'connected') {
      setAiTyping(true);
      send({ type: 'FEYNMAN_CHAT', sessionId, payload: text } as unknown as Parameters<typeof send>[0]);
    } else {
      // WS 未连接时提示
      addMsg('system', '⚠️ AI 连接未就绪，请确保已登录或稍后重试。');
    }
    if (textRef.current) textRef.current.style.height = 'auto';
  }, [input, active, wsState, sessionId, send]);

  const handleEnd = useCallback(async () => {
    if (!sessionId) return;
    setAiTyping(true);
    addMsg('system', '正在生成结构化总结...');
    try {
      const res = await feynmanApi.end(sessionId, problemTitle) as Record<string, unknown>;
      const parsed = parseJson<Summary>(String(res?.summary ?? JSON.stringify(res)));
      if (parsed) { setSummary(parsed); if (parsed.analogies?.length) setAnalogies(parsed.analogies); }
    } catch { addMsg('system', '总结生成失败，请重试。'); }
    setAiTyping(false); setActive(false);
  }, [sessionId, problemTitle]);

  const handleReset = useCallback(async () => {
    if (!sessionId) return;
    await feynmanApi.reset(sessionId).catch(() => {});
    setMsgs([]); setSummary(null); setAnalogies([]); setRound(0); setActive(true);
    addMsg('system', '会话已重置，重新开始吧！');
  }, [sessionId]);

  const handleLoadAnalogies = useCallback(async () => {
    if (!sessionId || !summary) return;
    setLoadingAnalogies(true);
    try {
      const res = await feynmanApi.analogies(sessionId, summary.approach, problemTitle) as string;
      const parsed = parseJson<{ analogies: Analogy[] }>(res);
      if (parsed?.analogies) { setAnalogies(parsed.analogies); setRightTab('analogies'); }
    } catch { /* 忽略 */ } finally { setLoadingAnalogies(false); }
  }, [sessionId, summary, problemTitle]);

  const handleExportMd = useCallback(async () => {
    // 优先从后端获取格式化 MD
    if (sessionId && !sessionId.startsWith('feynman-local')) {
      try {
        const res = await fetch(`/api/v1/feynman/${sessionId}/export`);
        const json = await res.json();
        const mdText = json?.data ?? '';
        if (mdText) {
          const blob = new Blob([mdText], { type: 'text/markdown' });
          const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
          a.download = `费曼-${problemTitle}-${new Date().toLocaleDateString('zh-CN')}.md`;
          a.click(); return;
        }
      } catch { /* 降级到本地生成 */ }
    }
    // 降级：从 summary 生成
    if (!summary) return;
    const lines = [
      `# 费曼学习总结 · ${problemTitle}`,
      `> 对话轮次：${round} 轮  |  生成时间：${new Date().toLocaleString('zh-CN')}`,
      '',
      `## 💡 直觉理解\n${summary.intuition}`,
      `## 🧭 核心思路\n${summary.approach}`,
      `## 📝 伪代码\n\`\`\`\n${summary.pseudocode}\n\`\`\``,
      `## 📊 复杂度\n时间：${summary.complexity?.time}  空间：${summary.complexity?.space}`,
      summary.keyInsights?.length ? `## 💡 关键洞察\n${summary.keyInsights.map(i => `- ${i}`).join('\n')}` : '',
      summary.weakPoints?.length  ? `## ⚠️ 待巩固\n${summary.weakPoints.map(w => `- ${w}`).join('\n')}` : '',
    ].filter(Boolean);
    const blob = new Blob([lines.join('\n\n')], { type: 'text/markdown' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = `费曼-${problemTitle}-${new Date().toLocaleDateString('zh-CN')}.md`;
    a.click();
  }, [sessionId, summary, problemTitle, round]);

  // 轮次颜色
  const roundPct = Math.min(round / 20 * 100, 100);
  const roundColor = round < 14 ? '#6366F1' : round < 18 ? '#F59E0B' : '#EF4444';

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col bg-[#0F1117]">
      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 overflow-hidden">
        {/* 顶栏 */}
        <div className="flex items-center justify-between border-b border-gray-800 py-3 shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-xl">🧠</span>
            <div>
              <h1 className="text-sm font-semibold text-gray-100">费曼学习</h1>
              {problemTitle !== '算法题' && (
                <p className="text-xs text-gray-500 truncate max-w-[200px]">{problemTitle}</p>
              )}
            </div>
            {active && (
              <div className="flex items-center gap-2 ml-2">
                <div className="w-24 h-1.5 rounded-full bg-gray-800 overflow-hidden">
                  <div className="h-1.5 rounded-full transition-all duration-500"
                    style={{ width: `${roundPct}%`, backgroundColor: roundColor }} />
                </div>
                <span className="text-xs font-mono tabular-nums" style={{ color: roundColor }}>
                  {round}/20
                </span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            {/* WS 状态 */}
            <div className="flex items-center gap-1.5">
              <span className={`h-1.5 w-1.5 rounded-full ${wsState === 'connected' ? 'bg-emerald-500' : 'bg-yellow-500 animate-pulse'}`} />
              <span className="text-[10px] text-gray-600 hidden sm:inline">
                {wsState === 'connected' ? '已连接' : '未连接'}
              </span>
            </div>
            {active && (
              <>
                <button onClick={handleReset}
                  className="px-2.5 py-1 text-xs rounded-lg border border-gray-700 text-gray-400 hover:border-gray-600 hover:text-gray-300 transition-colors">
                  🔄 重置
                </button>
                <button onClick={handleEnd}
                  className="px-3 py-1 text-xs rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white font-medium transition-colors">
                  ✅ 结束并总结
                </button>
              </>
            )}
          </div>
        </div>

        {/* 主体：双栏布局 */}
        <div className="flex flex-1 gap-4 overflow-hidden py-3 min-h-0">
          {/* 左栏：对话区 */}
          <div className="flex flex-1 flex-col overflow-hidden rounded-2xl border border-gray-800 bg-[#141820] min-w-0">
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {msgs.length === 0 && (
                <div className="flex flex-col items-center justify-center h-40 gap-3 text-center">
                  <div className="text-4xl">🧠</div>
                  <p className="text-sm text-gray-400">会话初始化中...</p>
                </div>
              )}
              {msgs.map((m, idx) => (
                <Bubble key={m.id} m={m}
                  isLatestAI={m.role === 'ai' && idx === msgs.length - 1} />
              ))}
              {aiTyping && (
                <div className="flex gap-3 animate-fade-in">
                  <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-xs font-bold text-white shrink-0">AI</div>
                  <div className="rounded-2xl rounded-tl-none bg-gray-800 border border-gray-700/60 px-4 py-3">
                    <div className="flex gap-1.5 items-center">
                      {[0, 150, 300].map(d => (
                        <span key={d} className="h-2 w-2 rounded-full bg-purple-400 animate-bounce"
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
                      e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
                    }}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                    placeholder="用你的话解释... (Enter 发送，Shift+Enter 换行)"
                    rows={1}
                    className="flex-1 resize-none rounded-xl border border-gray-700 bg-gray-800/60
                      px-3 py-2.5 text-sm text-gray-200 placeholder:text-gray-600
                      focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                  <button
                    onClick={handleSend}
                    disabled={!input.trim()}
                    className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500
                      text-white text-sm font-medium transition-all
                      disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                  >
                    发送
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
                <button onClick={handleReset}
                  className="px-4 py-2 text-sm rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition-colors">
                  再来一次
                </button>
              </div>
            )}
          </div>

          {/* 右栏：辅助面板 */}
          <div className="w-72 shrink-0 flex flex-col gap-3 overflow-y-auto">
            {/* Tab */}
            <div className="flex rounded-xl border border-gray-800 bg-gray-900/60 p-1 shrink-0">
              {([['status','📋 状态'], ['analogies','💡 类比'], ['history','📜 历史']] as const).map(([k, l]) => (
                <button key={k} onClick={() => setRightTab(k)}
                  className={`flex-1 rounded-lg py-1.5 text-xs font-medium transition-colors
                    ${rightTab === k ? 'bg-indigo-600 text-white' : 'text-gray-500 hover:text-gray-300'}`}>
                  {l}
                </button>
              ))}
            </div>

            {/* 状态面板 */}
            {rightTab === 'status' && (
              <div className="space-y-3">
                {/* 进度 */}
                <div className="rounded-2xl border border-gray-800 bg-[#141820] p-4">
                  <p className="text-xs font-medium text-gray-500 mb-3">📊 对话进度</p>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-xs text-gray-400">当前轮次</span>
                      <span className="text-xs font-mono tabular-nums font-bold" style={{ color: roundColor }}>
                        {round} / 20
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-gray-800 overflow-hidden">
                      <div className="h-2 rounded-full transition-all duration-500"
                        style={{ width: `${roundPct}%`, backgroundColor: roundColor }} />
                    </div>
                    <p className="text-[10px] text-gray-600">
                      {round < 18 ? `还剩 ${20 - round} 轮可追问` : round < 20 ? '⚠️ 即将达到上限，建议总结' : '已达最大轮次'}
                    </p>
                  </div>
                </div>

                {/* 总结面板 */}
                {summary && <SummaryPanel summary={summary} onExport={handleExportMd} />}

                {/* 生成类比 */}
                {summary && analogies.length === 0 && (
                  <button onClick={handleLoadAnalogies} disabled={loadingAnalogies}
                    className="w-full py-2 text-xs rounded-xl bg-purple-900/40 border border-purple-700/50
                      text-purple-300 hover:bg-purple-900/60 transition-colors disabled:opacity-50">
                    {loadingAnalogies ? '生成中...' : '✨ 生成多角度类比'}
                  </button>
                )}

                {/* 使用提示（无会话时） */}
                {!summary && msgs.length <= 1 && (
                  <div className="rounded-2xl border border-dashed border-gray-700 p-4 text-center space-y-1.5">
                    <div className="text-2xl">💬</div>
                    <p className="text-xs text-gray-400">用你自己的话解释算法思路</p>
                    <p className="text-[10px] text-gray-600">AI 会像教练一样追问，帮你深化理解</p>
                  </div>
                )}
              </div>
            )}

            {/* 类比面板 */}
            {rightTab === 'analogies' && (
              <div className="rounded-2xl border border-gray-800 bg-[#141820] p-4">
                {analogies.length > 0 ? (
                  <AnalogyPanel analogies={analogies} selected={selectedAnalogy} onSelect={setSelectedAnalogy} />
                ) : (
                  <div className="text-center py-10 space-y-2">
                    <div className="text-3xl">🌟</div>
                    <p className="text-sm text-gray-400">完成学习后生成类比</p>
                    <p className="text-xs text-gray-600">多角度理解算法精髓</p>
                  </div>
                )}
              </div>
            )}

            {/* 历史面板 */}
            {rightTab === 'history' && (
              <div className="rounded-2xl border border-gray-800 bg-[#141820] p-4 space-y-2">
                <p className="text-xs font-medium text-gray-400">📜 本次对话 · {msgs.filter(m => m.role !== 'system').length} 条</p>
                <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                  {msgs.filter(m => m.role !== 'system').map(m => (
                    <div key={m.id}
                      className={`rounded-xl px-3 py-2 text-xs leading-relaxed
                        ${m.role === 'user'
                          ? 'bg-indigo-900/30 border border-indigo-700/40 text-indigo-200'
                          : 'bg-gray-800/60 border border-gray-700/40 text-gray-300'
                        }`}>
                      <span className="font-medium opacity-70 mr-1">
                        {m.role === 'user' ? '你：' : 'AI：'}
                      </span>
                      {m.content.slice(0, 80)}{m.content.length > 80 ? '...' : ''}
                    </div>
                  ))}
                  {msgs.filter(m => m.role !== 'system').length === 0 && (
                    <p className="text-xs text-gray-600 text-center py-4">对话后在这里显示</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function FeynmanPage() {
  return (
    <Suspense fallback={
      <div className="flex h-[60vh] items-center justify-center bg-[#0F1117]">
        <div className="w-8 h-8 rounded-full border-2 border-indigo-700 border-t-indigo-400 animate-spin" />
      </div>
    }>
      <FeynmanContent />
    </Suspense>
  );
}
