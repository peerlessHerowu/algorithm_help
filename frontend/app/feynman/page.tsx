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
  analogies?: { id:string; icon:string; scenario:string; description:string; punchline:string }[];
}
interface Analogy { id:string; icon:string; scenario:string; description:string; punchline:string; }

const QUALITY_COLORS = ['bg-green-500','bg-blue-500','bg-yellow-500','bg-orange-500','bg-red-500'];
// eslint-disable-next-line @typescript-eslint/no-unused-vars

// ============ 工具 ============
function parseJson<T>(text: string): T | null {
  try {
    const s = text.indexOf('{'), e = text.lastIndexOf('}');
    if (s >= 0 && e > s) return JSON.parse(text.slice(s, e+1)) as T;
    return JSON.parse(text) as T;
  } catch { return null; }
}

// ============ 子组件：消息气泡（AI消息支持打字机动效） ============
function Bubble({ m, isLatestAI = false }: { m: Msg; isLatestAI?: boolean }) {
  if (m.role === 'system') return (
    <div className="flex justify-center">
      <div className="rounded-lg bg-gray-100 px-3 py-1.5 text-xs text-gray-500 dark:bg-gray-800 dark:text-gray-400 animate-fade-in">
        {m.content}
      </div>
    </div>
  );
  const isUser = m.role === 'user';
  return (
    <div className={`flex gap-2 animate-fade-in-up ${isUser ? 'flex-row-reverse' : ''}`}>
      <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
        isUser ? 'bg-blue-600 text-white' : 'bg-gradient-to-br from-purple-500 to-indigo-600 text-white'
      }`}>
        {isUser ? '我' : 'AI'}
      </div>
      <div className={`max-w-[78%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
        isUser
          ? 'bg-blue-600 text-white'
          : 'bg-white shadow-sm border border-gray-100 text-gray-800 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-200'
      }`}>
        <div className={`whitespace-pre-wrap ${!isUser && isLatestAI ? 'typing-cursor' : ''}`}>
          {m.content}
        </div>
        <div className={`mt-1 text-xs ${isUser ? 'text-blue-200 text-right' : 'text-gray-400'}`}>
          {new Date(m.ts).toLocaleTimeString('zh-CN', { hour:'2-digit', minute:'2-digit' })}
        </div>
      </div>
    </div>
  );
}

// ============ 子组件：总结面板 ============
function SummaryPanel({ summary, onExport }: { summary: Summary; onExport: () => void }) {
  const [open, setOpen] = useState<Set<string>>(new Set(['intuition','approach']));
  const toggle = (k: string) => setOpen(p => { const n = new Set(p); n.has(k)?n.delete(k):n.add(k); return n; });
  const sections = [
    { k:'intuition', icon:'💡', label:'直觉理解', val: summary.intuition },
    { k:'approach', icon:'🧭', label:'核心思路', val: summary.approach },
    { k:'pseudocode', icon:'📝', label:'伪代码', val: summary.pseudocode },
    { k:'code', icon:'💻', label:'代码参考', val: summary.code },
    { k:'complexity', icon:'📊', label:'复杂度', val: `时间：${summary.complexity?.time} | 空间：${summary.complexity?.space}` },
  ];
  const masteryColors = ['','bg-red-100 text-red-700','bg-orange-100 text-orange-700','bg-yellow-100 text-yellow-700','bg-green-100 text-green-700','bg-blue-100 text-blue-700'];
  const masteryLabels = ['','完全不理解','初步了解','基本掌握','深度理解','融会贯通'];
  return (
    <div className="rounded-xl border border-green-200 bg-green-50/50 p-4 space-y-3 dark:border-green-800 dark:bg-green-900/10">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-green-800 dark:text-green-300">🎉 学习总结</h3>
        <div className="flex gap-2">
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${masteryColors[summary.masteryLevel] || ''}`}>
            {masteryLabels[summary.masteryLevel] || ''}
          </span>
          <button onClick={onExport} className="rounded-lg bg-gray-700 px-2 py-1 text-xs text-white hover:bg-gray-600">
            📥 导出 MD
          </button>
        </div>
      </div>
      <div className="space-y-1.5">
        {sections.map(({ k, icon, label, val }) => val && (
          <div key={k} className="rounded-lg border border-green-100 bg-white dark:border-green-800 dark:bg-gray-800">
            <button onClick={() => toggle(k)} className="flex w-full items-center justify-between px-3 py-2 text-left">
              <span className="flex items-center gap-1.5 text-xs font-medium text-gray-700 dark:text-gray-300">
                {icon} {label}
              </span>
              <span className="text-gray-400 text-xs">{open.has(k) ? '▾' : '▸'}</span>
            </button>
            {open.has(k) && (
              <div className="border-t border-green-50 px-3 py-2 text-xs text-gray-600 whitespace-pre-wrap dark:border-green-900 dark:text-gray-400">
                {val}
              </div>
            )}
          </div>
        ))}
      </div>
      {summary.keyInsights?.length > 0 && (
        <div>
          <p className="text-xs font-medium text-green-700 dark:text-green-400 mb-1">💡 关键洞察</p>
          <ul className="space-y-0.5">
            {summary.keyInsights.map((ins, i) => (
              <li key={i} className="text-xs text-gray-600 dark:text-gray-400 flex gap-1.5">
                <span className="text-green-500 shrink-0">✓</span> {ins}
              </li>
            ))}
          </ul>
        </div>
      )}
      {summary.weakPoints?.length > 0 && (
        <div>
          <p className="text-xs font-medium text-orange-600 dark:text-orange-400 mb-1">⚠️ 待巩固</p>
          <ul className="space-y-0.5">
            {summary.weakPoints.map((w, i) => (
              <li key={i} className="text-xs text-gray-600 dark:text-gray-400 flex gap-1.5">
                <span className="text-orange-400 shrink-0">•</span> {w}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ============ 子组件：类比面板 ============
function AnalogyPanel({ analogies, selected, onSelect }: {
  analogies: Analogy[]; selected: string | null; onSelect: (id: string) => void;
}) {
  return (
    <div className="space-y-2">
      <p className="text-xs text-gray-500 dark:text-gray-400">选择最能帮助你理解的类比：</p>
      {analogies.map(a => (
        <button key={a.id} onClick={() => onSelect(a.id)}
          className={`w-full rounded-lg border p-3 text-left transition-colors ${
            selected === a.id
              ? 'border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-900/20'
              : 'border-gray-200 bg-white hover:border-blue-300 dark:border-gray-700 dark:bg-gray-800'
          }`}>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">{a.icon}</span>
            <span className="text-xs font-medium text-gray-800 dark:text-gray-200">{a.scenario}</span>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">{a.description}</p>
          {selected === a.id && a.punchline && (
            <p className="mt-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 italic">"{a.punchline}"</p>
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
  const { user, isAuthenticated } = useAppStore();

  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [active, setActive] = useState(true);
  const [aiTyping, setAiTyping] = useState(false);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [analogies, setAnalogies] = useState<Analogy[]>([]);
  const [selectedAnalogy, setSelectedAnalogy] = useState<string | null>(null);
  const [round, setRound] = useState(0);
  const [problemTitle, setProblemTitle] = useState('算法题');
  const [rightTab, setRightTab] = useState<'status'|'analogies'|'history'>('status');
  const [loadingAnalogies, setLoadingAnalogies] = useState(false);

  const endRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const { state: wsState, send, subscribe } = useWebSocket();

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs]);

  // 加载题目信息
  useEffect(() => {
    if (!problemId) return;
    problemsApi.get(problemId).then(p => setProblemTitle(p.title)).catch(() => {});
  }, [problemId]);

  // 初始化会话
  useEffect(() => {
    if (!isAuthenticated || !user?.id || sessionId) return;
    feynmanApi.start(user.id, problemId || 'unknown').then((s: any) => {
      setSessionId(s.sessionId || s.id || '');
      addMsg('system', '费曼模式已就绪，请用自己的话解释解题思路，AI 会追问帮你深化理解。');
    }).catch(() => {
      // 降级：用本地 sessionId
      const sid = `feynman-${Date.now()}`;
      setSessionId(sid);
      addMsg('system', '费曼模式已就绪，请用自己的话解释解题思路。');
    });
  }, [isAuthenticated, user, problemId, sessionId]);

  // WebSocket 订阅
  useEffect(() => {
    const unsub1 = subscribe('AI_RESPONSE', (payload: any) => {
      setAiTyping(false);
      const content = typeof payload === 'string' ? payload : (payload?.content || payload);
      addMsg('ai', content);
    });
    const unsub2 = subscribe('FEYNMAN_SUMMARY', (payload: any) => {
      setAiTyping(false);
      setActive(false);
      const parsed = parseJson<Summary>(typeof payload === 'string' ? payload : JSON.stringify(payload));
      if (parsed) {
        setSummary(parsed);
        if (parsed.analogies?.length) setAnalogies(parsed.analogies);
      }
    });
    const unsub3 = subscribe('SYSTEM_MESSAGE', (payload: any) => {
      addMsg('system', typeof payload === 'string' ? payload : payload?.content || '');
    });
    return () => { unsub1(); unsub2(); unsub3(); };
  }, [subscribe]);

  const addMsg = (role: Msg['role'], content: string) => {
    setMsgs(p => [...p, { id: `${role}-${Date.now()}`, role, content, ts: Date.now() }]);
  };

  const handleSend = useCallback(() => {
    const text = input.trim();
    if (!text || !active || wsState !== 'connected') return;
    addMsg('user', text);
    setInput('');
    setRound(r => r + 1);
    setAiTyping(true);
    send({ type: 'FEYNMAN_CHAT', sessionId, payload: text } as any);
    if (textRef.current) textRef.current.style.height = 'auto';
  }, [input, active, wsState, sessionId, send]);

  const handleEnd = useCallback(async () => {
    if (!sessionId) return;
    setAiTyping(true);
    addMsg('system', '正在生成结构化总结...');
    try {
      const res: any = await feynmanApi.end(sessionId, problemTitle);
      const parsed = parseJson<Summary>(res?.summary || JSON.stringify(res));
      if (parsed) {
        setSummary(parsed);
        if (parsed.analogies?.length) setAnalogies(parsed.analogies);
      }
    } catch { addMsg('system', '总结生成失败，请重试'); }
    setAiTyping(false);
    setActive(false);
  }, [sessionId, problemTitle]);

  const handleReset = useCallback(async () => {
    if (!sessionId) return;
    await feynmanApi.reset(sessionId).catch(() => {});
    setMsgs([]);
    setSummary(null);
    setAnalogies([]);
    setRound(0);
    setActive(true);
    addMsg('system', '会话已重置，重新开始吧！');
  }, [sessionId]);

  const handleLoadAnalogies = useCallback(async () => {
    if (!sessionId || !summary) return;
    setLoadingAnalogies(true);
    try {
      const res: any = await feynmanApi.analogies(sessionId, summary.approach, problemTitle);
      const parsed = parseJson<{ analogies: Analogy[] }>(res);
      if (parsed?.analogies) { setAnalogies(parsed.analogies); setRightTab('analogies'); }
    } catch { } finally { setLoadingAnalogies(false); }
  }, [sessionId, summary, problemTitle]);

  const handleExportMd = useCallback(() => {
    if (!summary) return;
    const lines = [
      `# 费曼学习总结 · ${problemTitle}`,
      `> 生成时间：${new Date().toLocaleString('zh-CN')}`,
      '',
      `## 💡 直觉理解\n${summary.intuition}`,
      `## 🧭 核心思路\n${summary.approach}`,
      `## 📝 伪代码\n\`\`\`\n${summary.pseudocode}\n\`\`\``,
      `## 📊 复杂度\n时间：${summary.complexity?.time}  空间：${summary.complexity?.space}`,
    ];
    if (summary.keyInsights?.length) {
      lines.push(`## 💡 关键洞察\n${summary.keyInsights.map(i => `- ${i}`).join('\n')}`);
    }
    const blob = new Blob([lines.join('\n\n')], { type: 'text/markdown' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `费曼-${problemTitle}-${new Date().toLocaleDateString('zh-CN')}.md`;
    a.click();
  }, [summary, problemTitle]);

  if (!isAuthenticated) return (
    <div className="flex h-[60vh] flex-col items-center justify-center gap-4">
      <div className="text-5xl">🔒</div>
      <p className="text-gray-500">费曼模式需要登录后使用</p>
      <button onClick={() => router.push('/auth/login')}
        className="rounded-lg bg-blue-600 px-6 py-2 text-sm font-medium text-white hover:bg-blue-700">
        去登录
      </button>
    </div>
  );

  return (
    <div className="mx-auto flex h-[calc(100vh-4rem)] max-w-6xl flex-col px-4">
      {/* 顶栏 */}
      <div className="flex items-center justify-between border-b border-gray-200 py-2.5 dark:border-gray-700">
        <div className="flex items-center gap-3">
          <h1 className="font-bold text-gray-800 dark:text-gray-100">🧠 费曼学习</h1>
          <span className="text-sm text-gray-500 dark:text-gray-400">· {problemTitle}</span>
          {active && <span className="text-xs text-gray-400">第 {round}/20 轮</span>}
          {/* 进度条 */}
          {active && (
            <div className="w-20 h-1.5 rounded-full bg-gray-200 dark:bg-gray-700">
              <div className="h-1.5 rounded-full bg-blue-500 transition-all"
                style={{ width: `${Math.min(round / 20 * 100, 100)}%` }} />
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${
            wsState === 'connected'
              ? 'bg-green-500 status-dot-online'
              : 'bg-yellow-500 animate-pulse'
          }`} />
          {active && (
            <>
              <button onClick={handleReset}
                className="rounded-lg border border-gray-300 px-2.5 py-1 text-xs text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-800">
                🔄 重置
              </button>
              <button onClick={handleEnd}
                className="rounded-lg bg-green-600 px-3 py-1 text-xs font-medium text-white hover:bg-green-700">
                ✅ 结束并总结
              </button>
            </>
          )}
        </div>
      </div>

      {/* 主体：双栏布局 */}
      <div className="flex flex-1 gap-4 overflow-hidden py-3">
        {/* 左栏：对话区 */}
        <div className="flex flex-1 flex-col overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {msgs.map((m, idx) => (
              <Bubble
                key={m.id}
                m={m}
                isLatestAI={m.role === 'ai' && idx === msgs.length - 1}
              />
            ))}
            {aiTyping && (
              <div className="flex gap-2 animate-fade-in">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 text-xs font-bold text-white shrink-0">AI</div>
                <div className="rounded-2xl bg-white border border-gray-100 px-4 py-3 shadow-sm dark:bg-gray-800 dark:border-gray-700">
                  <div className="flex items-center gap-1.5">
                    {[0,150,300].map(d => (
                      <span key={d} className="h-2 w-2 rounded-full bg-purple-400 animate-bounce"
                        style={{ animationDelay: `${d}ms`, animationDuration: '0.8s' }} />
                    ))}
                  </div>
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>

          {/* 输入区 */}
          {active ? (
            <div className="border-t border-gray-200 p-3 dark:border-gray-700">
              <div className="flex items-end gap-2">
                <textarea ref={textRef} value={input}
                  onChange={e => { setInput(e.target.value); e.target.style.height='auto'; e.target.style.height=`${Math.min(e.target.scrollHeight,120)}px`; }}
                  onKeyDown={e => { if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();handleSend();} }}
                  placeholder="继续用你的话解释... (Enter发送，Shift+Enter换行)" rows={1} disabled={wsState !== 'connected'}
                  className="flex-1 resize-none rounded-xl border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100" />
                <button onClick={handleSend} disabled={!input.trim() || wsState !== 'connected'}
                  className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed">
                  发送
                </button>
              </div>
            </div>
          ) : (
            <div className="border-t border-gray-200 p-3 dark:border-gray-700 flex justify-center gap-3">
              <button onClick={() => router.push(`/problems/${problemId}`)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800">
                返回题目
              </button>
              <button onClick={handleReset}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
                再来一次
              </button>
            </div>
          )}
        </div>

        {/* 右栏：辅助面板 */}
        <div className="w-72 flex flex-col gap-3 overflow-y-auto">
          {/* Tab 切换 */}
          <div className="flex rounded-lg border border-gray-200 bg-white p-1 dark:border-gray-700 dark:bg-gray-900">
            {[['status','📋 状态'], ['analogies','💡 类比'], ['history','📜 历史']].map(([k,l]) => (
              <button key={k} onClick={() => setRightTab(k as any)}
                className={`flex-1 rounded-md py-1 text-xs transition-colors ${
                  rightTab === k ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
                }`}>
                {l}
              </button>
            ))}
          </div>

          {/* 状态面板 */}
          {rightTab === 'status' && (
            <div className="space-y-3">
              {/* 轮次统计 */}
              <div className="rounded-xl border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-900">
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">📊 对话进度</p>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">当前轮次</span>
                    <span className="font-medium text-blue-600">{round} / 20</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-gray-100 dark:bg-gray-700">
                    <div className="h-2 rounded-full bg-blue-500 transition-all"
                      style={{ width: `${Math.min(round/20*100,100)}%` }} />
                  </div>
                  <p className="text-xs text-gray-400">
                    {round < 18 ? `还剩 ${20-round} 轮` : round < 20 ? '即将达到上限，建议总结' : '已达最大轮次'}
                  </p>
                </div>
              </div>

              {/* 连接状态 */}
              <div className="rounded-xl border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-900">
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">🔗 连接状态</p>
                <div className={`flex items-center gap-2 text-sm ${
                  wsState==='connected' ? 'text-green-600' : 'text-yellow-600'
                }`}>
                  <span className={`h-2 w-2 rounded-full ${wsState==='connected' ? 'bg-green-500' : 'bg-yellow-500 animate-pulse'}`} />
                  {wsState === 'connected' ? '已连接' : wsState === 'reconnecting' ? '重连中...' : '未连接'}
                </div>
              </div>

              {/* 总结快捷入口 */}
              {summary && (
                <SummaryPanel summary={summary} onExport={handleExportMd} />
              )}

              {/* 生成类比按钮 */}
              {summary && !analogies.length && (
                <button onClick={handleLoadAnalogies} disabled={loadingAnalogies}
                  className="w-full rounded-lg bg-purple-600 px-3 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50">
                  {loadingAnalogies ? '生成中...' : '✨ 生成多角度类比'}
                </button>
              )}
            </div>
          )}

          {/* 类比面板 */}
          {rightTab === 'analogies' && (
            <div className="rounded-xl border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-900">
              {analogies.length > 0 ? (
                <AnalogyPanel analogies={analogies} selected={selectedAnalogy} onSelect={setSelectedAnalogy} />
              ) : (
                <div className="text-center text-sm text-gray-400 py-8">
                  <p>完成费曼学习后</p>
                  <p>可生成多角度类比</p>
                </div>
              )}
            </div>
          )}

          {/* 历史面板 */}
          {rightTab === 'history' && (
            <div className="rounded-xl border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-900">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">📜 本次对话</p>
              <div className="space-y-1.5 max-h-96 overflow-y-auto">
                {msgs.filter(m => m.role !== 'system').map(m => (
                  <div key={m.id} className={`rounded-lg px-2 py-1.5 text-xs ${
                    m.role === 'user' ? 'bg-blue-50 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300' : 'bg-gray-50 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
                  }`}>
                    <span className="font-medium">{m.role === 'user' ? '你' : 'AI'}：</span>
                    {m.content.slice(0, 60)}{m.content.length > 60 ? '...' : ''}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function FeynmanPage() {
  return (
    <Suspense fallback={<div className="flex h-[60vh] items-center justify-center text-gray-500">加载中...</div>}>
      <FeynmanContent />
    </Suspense>
  );
}
