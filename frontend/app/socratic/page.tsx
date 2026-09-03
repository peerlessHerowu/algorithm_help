'use client';

import { Suspense, useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useAppStore } from '@/store';
import { problemsApi, socraticApi } from '@/lib/api';

interface Msg { id: string; role: 'guide'|'student'|'system'; content: string; ts: number; }

const HINT_LABELS = ['', '🧭 方向提示', '🔍 方法暗示', '📝 伪代码框架', '📖 完整引导'];
const HINT_COLORS = ['', 'bg-green-100 text-green-700', 'bg-yellow-100 text-yellow-700', 'bg-orange-100 text-orange-700', 'bg-red-100 text-red-700'];
const SCORE_MAP: Record<number, number> = { 1: 100, 2: 75, 3: 50, 4: 25 };

function parseJson<T>(text: string): T | null {
  try {
    const s = text.indexOf('{'), e = text.lastIndexOf('}');
    if (s >= 0 && e > s) return JSON.parse(text.slice(s, e+1)) as T;
    return JSON.parse(text) as T;
  } catch { return null; }
}

function GuideBubble({ m }: { m: Msg }) {
  if (m.role === 'system') return (
    <div className="flex justify-center">
      <div className="rounded-lg bg-gray-100 px-3 py-1.5 text-xs text-gray-500 dark:bg-gray-800 dark:text-gray-400">{m.content}</div>
    </div>
  );
  const isStudent = m.role === 'student';
  return (
    <div className={`flex gap-2 ${isStudent ? 'flex-row-reverse' : ''}`}>
      <div className={`h-7 w-7 shrink-0 flex items-center justify-center rounded-full text-xs font-bold ${
        isStudent ? 'bg-blue-600 text-white' : 'bg-green-600 text-white'
      }`}>
        {isStudent ? '我' : '引'}
      </div>
      <div className={`max-w-[78%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
        isStudent ? 'bg-blue-600 text-white' :
        'bg-white border border-l-4 border-green-400 shadow-sm text-gray-800 dark:bg-gray-800 dark:text-gray-200'
      }`}>
        <div className="whitespace-pre-wrap">{m.content}</div>
        <div className={`mt-1 text-xs ${isStudent ? 'text-blue-200 text-right' : 'text-gray-400'}`}>
          {new Date(m.ts).toLocaleTimeString('zh-CN', { hour:'2-digit', minute:'2-digit' })}
        </div>
      </div>
    </div>
  );
}

function SocraticContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const problemId = searchParams.get('problem') || '';
  const { user, isAuthenticated } = useAppStore();

  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [hintLevel, setHintLevel] = useState(1);
  const [score, setScore] = useState(100);
  const [active, setActive] = useState(true);
  const [aiTyping, setAiTyping] = useState(false);
  const [solved, setSolved] = useState(false);
  const [summaryData, setSummaryData] = useState<any>(null);
  const [problemTitle, setProblemTitle] = useState('算法题');

  const endRef = useRef<HTMLDivElement>(null);
  const { state: wsState, send, subscribe } = useWebSocket();

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs]);

  useEffect(() => {
    if (problemId) problemsApi.get(problemId).then(p => setProblemTitle(p.title)).catch(() => {});
  }, [problemId]);

  const addMsg = (role: Msg['role'], content: string) =>
    setMsgs(p => [...p, { id: `${role}-${Date.now()}`, role, content, ts: Date.now() }]);

  useEffect(() => {
    if (!isAuthenticated || !user?.id || sessionId) return;
    socraticApi.start(user.id, problemId || 'unknown').then((s: any) => {
      setSessionId(s.sessionId || s.id || '');
      addMsg('system', '苏格拉底追问模式已开启。AI 不会直接给你答案，而是通过问题引导你自己推导。');
    }).catch(() => {
      const sid = `socratic-${Date.now()}`;
      setSessionId(sid);
      addMsg('system', '苏格拉底模式已就绪。开始思考这道题吧！');
    });
  }, [isAuthenticated, user, problemId, sessionId]);

  useEffect(() => {
    const u1 = subscribe('AI_RESPONSE', (payload: any) => {
      setAiTyping(false);
      const content = typeof payload === 'string' ? payload : (payload?.content || JSON.stringify(payload));
      addMsg('guide', content);
    });
    const u2 = subscribe('SOCRATIC_SUMMARY', (payload: any) => {
      setAiTyping(false);
      setSolved(true);
      setActive(false);
      const parsed = parseJson<any>(typeof payload === 'string' ? payload : JSON.stringify(payload));
      if (parsed) setSummaryData(parsed);
    });
    const u3 = subscribe('HINT_PROVIDED', (payload: any) => {
      const content = typeof payload === 'string' ? payload : (payload?.content || JSON.stringify(payload));
      addMsg('guide', `💡 提示：${content}`);
    });
    const u4 = subscribe('SYSTEM_MESSAGE', (payload: any) => {
      addMsg('system', typeof payload === 'string' ? payload : (payload?.content || ''));
    });
    return () => { u1(); u2(); u3(); u4(); };
  }, [subscribe]);

  const handleSend = useCallback(() => {
    const text = input.trim();
    if (!text || !active || wsState !== 'connected') return;
    addMsg('student', text);
    setInput('');
    setAiTyping(true);
    send({ type: 'SOCRATIC_CHAT', sessionId, payload: text } as any);
  }, [input, active, wsState, sessionId, send]);

  const handleNextHint = useCallback(async () => {
    if (hintLevel >= 4) return;
    const newLevel = hintLevel + 1;
    setHintLevel(newLevel);
    setScore(SCORE_MAP[newLevel] || 25);
    try {
      await socraticApi.nextHint(sessionId);
      addMsg('system', `📈 提示已升级到 Level ${newLevel}/4`);
      // 也通过 WS 请求提示
      send({ type: 'SOCRATIC_CHAT', sessionId, payload: '__REQUEST_HINT__' } as any);
      setAiTyping(true);
    } catch { addMsg('system', '提示请求失败，请重试'); }
  }, [hintLevel, sessionId, send]);

  const handleSummarize = useCallback(async () => {
    try {
      const res: any = await socraticApi.summarize(sessionId, problemTitle);
      const parsed = parseJson<any>(res?.data || (typeof res === 'string' ? res : JSON.stringify(res)));
      if (parsed) setSummaryData(parsed);
      setActive(false);
      setSolved(true);
    } catch { addMsg('system', '总结生成失败'); }
  }, [sessionId, problemTitle]);

  if (!isAuthenticated) return (
    <div className="flex h-[60vh] flex-col items-center justify-center gap-4">
      <p className="text-gray-500">苏格拉底模式需要登录后使用</p>
      <button onClick={() => router.push('/auth/login')} className="rounded-lg bg-blue-600 px-6 py-2 text-sm text-white">去登录</button>
    </div>
  );

  return (
    <div className="mx-auto flex h-[calc(100vh-4rem)] max-w-5xl flex-col px-4">
      {/* 顶栏 */}
      <div className="flex items-center justify-between border-b border-gray-200 py-2.5 dark:border-gray-700">
        <div className="flex items-center gap-3">
          <h1 className="font-bold text-gray-800 dark:text-gray-100">🦉 苏格拉底追问</h1>
          <span className="text-sm text-gray-500">· {problemTitle}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${wsState === 'connected' ? 'bg-green-500' : 'bg-yellow-500 animate-pulse'}`} />
          {active && (
            <button onClick={handleSummarize}
              className="rounded-lg bg-green-600 px-3 py-1 text-xs font-medium text-white hover:bg-green-700">
              我解出了！生成总结
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-1 gap-4 overflow-hidden py-3">
        {/* 对话区 */}
        <div className="flex flex-1 flex-col overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {msgs.map(m => <GuideBubble key={m.id} m={m} />)}
            {aiTyping && (
              <div className="flex gap-2">
                <div className="h-7 w-7 flex items-center justify-center rounded-full bg-green-600 text-xs font-bold text-white shrink-0">引</div>
                <div className="rounded-2xl bg-white border border-l-4 border-green-400 px-4 py-3 shadow-sm dark:bg-gray-800">
                  <div className="flex items-center gap-1">
                    {[0,150,300].map(d => <span key={d} className="h-2 w-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay:`${d}ms` }} />)}
                  </div>
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>

          {/* 输入区 */}
          {active ? (
            <div className="border-t border-gray-200 p-3 dark:border-gray-700 space-y-2">
              <div className="flex items-end gap-2">
                <textarea value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => { if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();handleSend();} }}
                  placeholder="分享你的思路..." rows={2} disabled={wsState !== 'connected'}
                  className="flex-1 resize-none rounded-xl border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100" />
                <button onClick={handleSend} disabled={!input.trim() || wsState !== 'connected'}
                  className="rounded-xl bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed">
                  回答
                </button>
              </div>
            </div>
          ) : solved && (
            <div className="border-t border-gray-200 p-3 dark:border-gray-700 flex justify-center gap-3">
              <button onClick={() => router.push(`/problems/${problemId}`)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800">
                返回题目
              </button>
              <button onClick={() => router.push(`/review`)}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
                去复习中心
              </button>
            </div>
          )}
        </div>

        {/* 右侧：提示级别 + 得分 */}
        <div className="w-64 space-y-3">
          {/* 提示仪表 */}
          <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-3">📊 提示级别仪表</p>
            <div className="space-y-2">
              {[1,2,3,4].map(l => (
                <div key={l} className={`rounded-lg px-3 py-2 text-xs transition-all ${
                  l === hintLevel ? HINT_COLORS[l] + ' font-bold' :
                  l < hintLevel ? 'bg-gray-100 text-gray-400 dark:bg-gray-800' :
                  'bg-gray-50 text-gray-300 dark:bg-gray-800/50'
                }`}>
                  {HINT_LABELS[l]}
                  {l === hintLevel && <span className="ml-1 text-xs opacity-70">← 当前</span>}
                </div>
              ))}
            </div>
          </div>

          {/* 推导得分 */}
          <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">🏆 当前得分预估</p>
            <div className="text-3xl font-bold text-center text-blue-600 dark:text-blue-400">{score}</div>
            <p className="text-xs text-center text-gray-400 mt-1">满分 100</p>
            <div className="mt-2 w-full h-2 rounded-full bg-gray-100 dark:bg-gray-700">
              <div className="h-2 rounded-full bg-blue-500 transition-all" style={{ width:`${score}%` }} />
            </div>
          </div>

          {/* 请求提示按钮 */}
          {active && hintLevel < 4 && (
            <button onClick={handleNextHint}
              className="w-full rounded-lg border border-orange-300 bg-orange-50 px-3 py-2 text-sm text-orange-700 hover:bg-orange-100 dark:border-orange-700 dark:bg-orange-900/20 dark:text-orange-400">
              💡 需要提示（Level {hintLevel+1}）
            </button>
          )}

          {/* 总结展示 */}
          {summaryData && (
            <div className="rounded-xl border border-green-200 bg-green-50/50 p-3 dark:border-green-800 dark:bg-green-900/10">
              <p className="text-xs font-bold text-green-700 dark:text-green-400 mb-2">🎉 解题总结</p>
              <div className="space-y-2 text-xs text-gray-600 dark:text-gray-400">
                {summaryData.score && <p>🏆 得分：{summaryData.score}/100</p>}
                {summaryData.strengths && <p>✅ {summaryData.strengths}</p>}
                {summaryData.improvements && <p>💪 {summaryData.improvements}</p>}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function SocraticPage() {
  return (
    <Suspense fallback={<div className="flex h-[60vh] items-center justify-center text-gray-500">加载中...</div>}>
      <SocraticContent />
    </Suspense>
  );
}
