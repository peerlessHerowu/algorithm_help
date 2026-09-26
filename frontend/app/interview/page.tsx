'use client';

import { Suspense, useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useAppStore } from '@/store';
import { interviewApi } from '@/lib/api';
import Link from 'next/link';

// ===== 类型 =====
type Phase = 'config' | 'thinking' | 'coding' | 'followup' | 'ended';

interface Config {
  difficulty: 'EASY' | 'MEDIUM' | 'HARD';
  duration: 25 | 45 | 60;
  company: string;
}

interface Msg { id: string; role: 'interviewer' | 'candidate' | 'system'; content: string; ts: number; }

interface ScoreDim { name: string; score: number; suggestion: string; }
interface Report {
  overallScore: number;
  summary: string;
  strengths: string[];
  improvements: string[];
  dimensions: ScoreDim[];
}

// ===== 公司配置 =====
const COMPANIES = [
  { key: 'GENERAL',  label: '通用',   emoji: '🎤', desc: '标准面试风格' },
  { key: 'GOOGLE',   label: '谷歌',   emoji: '🔍', desc: '追问细节，算法最优解' },
  { key: 'META',     label: 'Meta',   emoji: '📘', desc: '系统设计，代码整洁' },  // Meta 保留英文（品牌名）
  { key: 'AMAZON',   label: '亚马逊', emoji: '📦', desc: '领导力原则' },
  { key: 'BYTEDANCE',label: '字节',   emoji: '🎯', desc: '高强度追问，边界测试' },
  { key: 'MICROSOFT',label: '微软',   emoji: '🪟', desc: '解题过程，思路清晰' },
];

// ===== 倒计时 =====
function useCountdown(totalSec: number, running: boolean) {
  const [rem, setRem] = useState(totalSec);
  const ref = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => { setRem(totalSec); }, [totalSec]);
  useEffect(() => {
    if (!running || rem <= 0) { if (ref.current) clearInterval(ref.current); return; }
    ref.current = setInterval(() => setRem(p => p <= 1 ? (clearInterval(ref.current!), 0) : p - 1), 1000);
    return () => { if (ref.current) clearInterval(ref.current); };
  }, [running, rem]);
  const m = Math.floor(rem / 60), s = rem % 60;
  return { rem, display: `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`, pct: totalSec > 0 ? (rem / totalSec) * 100 : 0 };
}

// ===== 配置面板 =====
function ConfigPanel({ onStart, pending, error }: { onStart: (c: Config) => void; pending: boolean; error: string }) {
  const [cfg, setCfg] = useState<Config>({ difficulty: 'MEDIUM', duration: 45, company: 'GENERAL' });

  return (
    <div className="min-h-screen bg-[#0F1117] flex items-center justify-center px-4">
      <div className="w-full max-w-lg space-y-6 rounded-2xl border border-gray-800 bg-[#141820] p-8">
        {/* 标题 */}
        <div className="text-center">
          <div className="text-4xl mb-3">🎤</div>
          <h2 className="text-2xl font-black text-gray-100">面试模拟</h2>
          <p className="mt-1.5 text-sm text-gray-500">配置面试参数，开始真实感模拟</p>
        </div>

        {/* 难度 */}
        <div>
          <p className="text-xs font-medium text-gray-400 mb-2 uppercase tracking-wider">难度</p>
          <div className="grid grid-cols-3 gap-2">
            {(['EASY','MEDIUM','HARD'] as const).map(d => (
              <button key={d} aria-pressed={cfg.difficulty === d} onClick={() => setCfg(c => ({ ...c, difficulty: d }))}
                className={`py-2 rounded-xl border text-sm font-medium transition-all
                  ${cfg.difficulty === d
                    ? d === 'EASY' ? 'border-emerald-600/60 bg-emerald-900/30 text-emerald-300'
                    : d === 'MEDIUM' ? 'border-amber-600/60 bg-amber-900/30 text-amber-300'
                    : 'border-red-600/60 bg-red-900/30 text-red-300'
                    : 'border-gray-800 text-gray-500 hover:border-gray-700'
                  }`}>
                {d === 'EASY' ? '简单' : d === 'MEDIUM' ? '中等' : '困难'}
              </button>
            ))}
          </div>
        </div>

        {/* 时长 */}
        <div>
          <p className="text-xs font-medium text-gray-400 mb-2 uppercase tracking-wider">时长</p>
          <div className="grid grid-cols-3 gap-2">
            {([25,45,60] as const).map(d => (
              <button key={d} aria-pressed={cfg.duration === d} onClick={() => setCfg(c => ({ ...c, duration: d }))}
                className={`py-2 rounded-xl border text-sm font-medium transition-all
                  ${cfg.duration === d
                    ? 'border-indigo-600/60 bg-indigo-900/30 text-indigo-300'
                    : 'border-gray-800 text-gray-500 hover:border-gray-700'
                  }`}>
                {d} 分钟
              </button>
            ))}
          </div>
        </div>

        {/* 公司风格 */}
        <div>
          <p className="text-xs font-medium text-gray-400 mb-2 uppercase tracking-wider">公司风格</p>
          <div className="grid grid-cols-2 gap-2">
            {COMPANIES.map(c => (
              <button key={c.key} aria-pressed={cfg.company === c.key} onClick={() => setCfg(p => ({ ...p, company: c.key }))}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition-all
                  ${cfg.company === c.key
                    ? 'border-indigo-600/60 bg-indigo-900/20'
                    : 'border-gray-800 hover:border-gray-700'
                  }`}>
                <span className="text-xl shrink-0">{c.emoji}</span>
                <div>
                  <p className={`text-xs font-semibold ${cfg.company === c.key ? 'text-indigo-300' : 'text-gray-300'}`}>{c.label}</p>
                  <p className="text-[10px] text-gray-600">{c.desc}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* 开始 */}
        {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
        <button onClick={() => onStart(cfg)} disabled={pending}
          className="w-full py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500
            text-white font-bold text-base transition-all shadow-lg shadow-indigo-900/30 disabled:opacity-50">
          {pending ? '正在开始...' : '开始面试'}
        </button>
      </div>
    </div>
  );
}

// ===== 评分报告 =====
function ReportPanel({ report, onRestart }: { report: Report; onRestart: () => void }) {
  const emoji = report.overallScore >= 85 ? '🏆' : report.overallScore >= 70 ? '👍' : '💪';
  const color = report.overallScore >= 85 ? '#10B981' : report.overallScore >= 70 ? '#6366F1' : '#F59E0B';

  return (
    <div className="min-h-screen bg-[#0F1117] flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-lg space-y-5 rounded-2xl border border-gray-800 bg-[#141820] p-7">
        {/* 总分 */}
        <div className="text-center space-y-2">
          <div className="text-5xl">{emoji}</div>
          <h2 className="text-xl font-black text-gray-100">面试评分报告</h2>
          <div className="text-5xl font-black tabular-nums" style={{ color }}>
            {report.overallScore}
            <span className="text-lg text-gray-500 ml-1">/100</span>
          </div>
          <p className="text-sm text-gray-400 leading-relaxed">{report.summary}</p>
        </div>

        {/* 维度得分 */}
        <div className="space-y-3">
          {report.dimensions.map(dim => {
            const c = dim.score >= 80 ? '#10B981' : dim.score >= 60 ? '#6366F1' : '#EF4444';
            return (
              <div key={dim.name}>
                <div className="flex justify-between mb-1">
                  <span className="text-xs font-medium text-gray-300">{dim.name}</span>
                  <span className="text-xs font-bold tabular-nums" style={{ color: c }}>{dim.score}</span>
                </div>
                <div className="h-2 w-full rounded-full bg-gray-800 overflow-hidden">
                  <div className="h-2 rounded-full transition-all duration-700"
                    style={{ width: `${dim.score}%`, backgroundColor: c }} />
                </div>
                {dim.score < 70 && dim.suggestion && (
                  <p className="text-[10px] text-gray-600 mt-1">💡 {dim.suggestion}</p>
                )}
              </div>
            );
          })}
        </div>

        {/* 亮点/改进 */}
        {report.strengths?.length > 0 && (
          <div>
            <p className="text-xs font-medium text-emerald-400 mb-2">✅ 表现亮点</p>
            <ul className="space-y-1">
              {report.strengths.map((s, i) => (
                <li key={i} className="text-xs text-gray-400 flex gap-1.5"><span className="text-emerald-500 shrink-0">•</span>{s}</li>
              ))}
            </ul>
          </div>
        )}
        {report.improvements?.length > 0 && (
          <div>
            <p className="text-xs font-medium text-amber-400 mb-2">💪 提升建议</p>
            <ul className="space-y-1">
              {report.improvements.map((imp, i) => (
                <li key={i} className="text-xs text-gray-400 flex gap-1.5"><span className="text-amber-500 shrink-0">•</span>{imp}</li>
              ))}
            </ul>
          </div>
        )}

        {/* 操作 */}
        <div className="flex gap-3 pt-1">
          <button onClick={onRestart}
            className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-all">
            再来一次
          </button>
          <a href="/training"
            className="flex-1 py-2.5 rounded-xl border border-gray-700 text-gray-300 text-sm text-center hover:border-gray-600 transition-all">
            训练中心
          </a>
        </div>
      </div>
    </div>
  );
}

// ===== 面试主界面 =====
function InterviewContent() {
  const searchParams = useSearchParams();
  const problemId = searchParams.get('problemId') || '';
  const { user, token } = useAppStore();

  const [phase, setPhase]       = useState<Phase>('config');
  const [cfg, setCfg]           = useState<Config | null>(null);
  const [msgs, setMsgs]         = useState<Msg[]>([]);
  const [input, setInput]       = useState('');
  const [code, setCode]         = useState('# 在这里编写代码\n');
  const [report, setReport]     = useState<Report | null>(null);
  const [sessionId, setSessionId] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  const endRef  = useRef<HTMLDivElement>(null);
  const { state: wsState, send, subscribe } = useWebSocket({ autoConnect: Boolean(token && user?.id) });

  const { display: timeDisplay, pct: timePct, rem: timeRem } = useCountdown(
    (cfg?.duration ?? 45) * 60,
    phase !== 'config' && phase !== 'ended'
  );

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs]);

  // WS 订阅
  useEffect(() => {
    const u1 = subscribe('AI_RESPONSE', (p: unknown) => {
      const content = typeof p === 'string' ? p : (p as { content?: string })?.content ?? '';
      addMsg('interviewer', content);
      setPending(false);
      setPhase(current => current === 'config' ? 'thinking' : current);
    });
    const u2 = subscribe('INTERVIEW_REPORT', (p: unknown) => {
      try {
        const raw = typeof p === 'string' ? JSON.parse(p) : p as Record<string, unknown>;
        setReport(buildReport(raw));
        setPending(false);
        setPhase('ended');
      } catch { /* 忽略 */ }
    });
    const u3 = subscribe('INTERVIEW_TIME_WARNING', (p: unknown) => {
      addMsg('system', typeof p === 'string' ? p : '⏰ 时间提醒');
    });
    const u4 = subscribe('ERROR', (p: unknown) => {
      setPending(false);
      setError(typeof p === 'string' ? p : '面试服务发生错误');
    });
    return () => { u1(); u2(); u3(); u4(); };
  }, [subscribe]);

  // 时间到自动结束
  useEffect(() => {
    if (timeRem === 0 && phase !== 'config' && phase !== 'ended') handleEnd();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeRem, phase]);

  function addMsg(role: Msg['role'], content: string) {
    setMsgs(p => [...p, { id: `${role}-${Date.now()}-${Math.random()}`, role, content, ts: Date.now() }]);
  }

  function buildReport(raw: Record<string, unknown>): Report {
    const parseList = (value: unknown): string[] => {
      if (Array.isArray(value)) return value.filter((item): item is string => typeof item === 'string');
      if (typeof value !== 'string') return [];
      try { const parsed = JSON.parse(value); return Array.isArray(parsed) ? parsed : []; }
      catch { return []; }
    };
    return {
      overallScore: Number(raw.totalScore ?? raw.overallScore),
      summary:      String(raw.summary ?? ''),
      strengths:    parseList(raw.strengths),
      improvements: parseList(raw.improvements),
      dimensions: [
        { name: '🧠 思路清晰度', score: Number(raw.correctnessScore ?? 0) * 10, suggestion: '' },
        { name: '💻 代码质量',   score: Number(raw.codeQualityScore ?? 0) * 10, suggestion: '注意边界条件处理' },
        { name: '🗣️ 沟通能力',  score: Number(raw.communicationScore ?? 0) * 10, suggestion: '' },
        { name: '⚡ 时间管理',   score: Number(raw.efficiencyScore ?? 0) * 10, suggestion: '' },
      ],
    };
  }

  const handleStart = useCallback(async (c: Config) => {
    if (!user?.id || !token) {
      setError('请先登录，再开始面试');
      return;
    }
    if (wsState !== 'connected') {
      setError('面试连接尚未就绪，请稍后重试');
      return;
    }
    setPending(true);
    setError('');
    try {
      const created = await interviewApi.start(user.id, problemId || 'unknown', c.duration, c.difficulty, c.company) as { sessionId?: string };
      if (!created.sessionId) throw new Error('服务端未返回会话 ID');
      setCfg(c);
      setSessionId(created.sessionId);
      send({ type: 'START_INTERVIEW', sessionId: created.sessionId,
        payload: JSON.stringify({ difficulty: c.difficulty, timeLimit: String(c.duration), companyStyle: c.company }) });
    } catch (cause) {
      setPending(false);
      setError(cause instanceof Error ? cause.message : '面试启动失败，请重试');
    }
  }, [user, token, wsState, problemId, send]);

  const handleSend = useCallback(() => {
    if (!input.trim() || wsState !== 'connected') return;
    addMsg('candidate', input.trim());
    send({ type: 'INTERVIEW_CHAT', sessionId, payload: input.trim() });
    setInput('');
  }, [input, sessionId, send, wsState]);

  const handleSubmitCode = useCallback(() => {
    if (wsState !== 'connected') return;
    addMsg('candidate', `[代码提交]\n\`\`\`\n${code}\n\`\`\``);
    send({ type: 'INTERVIEW_CHAT', sessionId, payload: `[代码提交]\n${code}` });
    setPhase('followup');
  }, [code, sessionId, send, wsState]);

  const handleEnd = useCallback(async () => {
    if (!user?.id || !sessionId || pending) return;
    setPending(true);
    setError('');
    try {
      const result = await interviewApi.end(sessionId, user.id, problemId) as Record<string, unknown>;
      if (!Number.isFinite(Number(result.totalScore))) throw new Error('服务端未返回有效评分');
      setReport(buildReport(result));
      setPhase('ended');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '评分生成失败，请重试');
    } finally {
      setPending(false);
    }
  }, [sessionId, user, problemId, pending]);

  // ===== 渲染 =====
  if (phase === 'config') return <>
    {!token && <div role="alert" className="bg-[#0F1117] pt-6 text-center text-sm text-gray-300">登录后开始 AI 面试。 <Link href="/auth/login" className="text-indigo-300 underline">去登录</Link></div>}
    <ConfigPanel onStart={handleStart} pending={pending} error={error} />
  </>;
  if (phase === 'ended' && report) return <ReportPanel report={report} onRestart={() => { setPhase('config'); setCfg(null); setMsgs([]); setReport(null); setSessionId(''); setCode('# 在这里编写代码\n'); }} />;

  const timeColor = timePct <= 20 ? '#EF4444' : timePct <= 40 ? '#F59E0B' : '#10B981';

  return (
    <div className="h-[calc(100vh-4rem)] bg-[#0F1117] flex flex-col">
      {/* 顶栏 */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-800 bg-[#141820] shrink-0">
        <div className="flex items-center gap-3">
          <span className={`text-xs px-2.5 py-1 rounded-xl border font-medium
            ${phase === 'thinking' ? 'border-indigo-700/50 bg-indigo-900/20 text-indigo-300'
            : phase === 'coding'   ? 'border-emerald-700/50 bg-emerald-900/20 text-emerald-300'
            : 'border-amber-700/50 bg-amber-900/20 text-amber-300'}`}>
            {phase === 'thinking' ? '🧠 思路阶段' : phase === 'coding' ? '💻 编码阶段' : '🎯 追问阶段'}
          </span>
          {cfg && (
            <span className="text-xs text-gray-500">
              {COMPANIES.find(x => x.key === cfg.company)?.label} · {cfg.difficulty === 'EASY' ? '简单' : cfg.difficulty === 'MEDIUM' ? '中等' : '困难'} · {cfg.duration}分钟
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {/* WS 状态 */}
          <span className={`h-1.5 w-1.5 rounded-full ${wsState === 'connected' ? 'bg-emerald-500' : 'bg-yellow-500 animate-pulse'}`} />
          {/* 计时器 */}
          <div className="px-3 py-1 rounded-xl border text-sm font-mono font-bold tabular-nums"
            style={{ color: timeColor, borderColor: timeColor + '50', backgroundColor: timeColor + '15' }}>
            {timeDisplay}
          </div>
          <div className="w-20 h-1.5 rounded-full bg-gray-800 overflow-hidden">
            <div className="h-1.5 rounded-full transition-all duration-1000"
              style={{ width: `${timePct}%`, backgroundColor: timeColor }} />
          </div>
          <button onClick={() => setPhase('coding')}
            className="px-2.5 py-1 text-xs rounded-xl border border-emerald-700/50 bg-emerald-900/20 text-emerald-300 hover:bg-emerald-900/40 transition-colors">
            → 开始编码
          </button>
          <button onClick={handleEnd} disabled={pending}
            className="px-2.5 py-1 text-xs rounded-xl border border-red-700/50 bg-red-900/20 text-red-300 hover:bg-red-900/40 transition-colors">
            结束
          </button>
        </div>
      </div>

      {error && <p role="alert" className="px-4 py-2 text-sm text-red-300">{error}</p>}

      {/* 双栏主体 */}
      <div className="flex flex-1 overflow-hidden gap-0">
        {/* 左：对话区 */}
        <div className="flex flex-col border-r border-gray-800 min-w-0" style={{ width: '45%' }}>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {msgs.map(m => {
              if (m.role === 'system') return (
                <div key={m.id} className="flex justify-center">
                  <span className="text-[10px] text-gray-600 bg-gray-800/60 px-3 py-1 rounded-full">
                    {m.content}
                  </span>
                </div>
              );
              const isAI = m.role === 'interviewer';
              return (
                <div key={m.id} className={`flex gap-2.5 ${isAI ? '' : 'flex-row-reverse'}`}>
                  <div className={`h-7 w-7 rounded-xl flex items-center justify-center text-xs font-bold shrink-0
                    ${isAI ? 'bg-indigo-600 text-white' : 'bg-emerald-700 text-white'}`}>
                    {isAI ? 'AI' : '我'}
                  </div>
                  <div className={`max-w-[78%] rounded-2xl px-4 py-3 text-sm leading-relaxed
                    ${isAI
                      ? 'bg-gray-800 border border-indigo-700/30 text-gray-200 rounded-tl-none'
                      : 'bg-emerald-900/30 border border-emerald-700/30 text-gray-200 rounded-tr-none'
                    }`}>
                    <p className="whitespace-pre-wrap">{m.content}</p>
                    <p className="text-[10px] text-gray-600 mt-1">
                      {new Date(m.ts).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              );
            })}
            <div ref={endRef} />
          </div>
          {/* 输入 */}
          <div className="border-t border-gray-800 p-3 shrink-0">
            <div className="flex gap-2">
              <input type="text" value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                placeholder="描述你的思路... (Enter 发送)"
                className="flex-1 rounded-xl border border-gray-700 bg-gray-800/60
                  px-3 py-2 text-sm text-gray-200 placeholder:text-gray-600
                  focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button onClick={handleSend} disabled={!input.trim()}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-all disabled:opacity-40">
                发送
              </button>
            </div>
          </div>
        </div>

        {/* 右：代码编辑器 */}
        <div className="flex flex-col min-w-0 flex-1">
          {/* 编辑器标题栏 */}
          <div className="flex items-center justify-between px-4 py-2 border-b border-gray-800 bg-gray-900/50 shrink-0">
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-400 font-mono">solution.py</span>
              <div className="flex gap-1">
                {['#FF5F56','#FFBD2E','#27C93F'].map(c => (
                  <div key={c} className="w-3 h-3 rounded-full" style={{ backgroundColor: c }} />
                ))}
              </div>
            </div>
            <button onClick={handleSubmitCode}
              className="flex items-center gap-1.5 px-3 py-1 text-xs rounded-lg
                bg-emerald-700/40 border border-emerald-600/50 text-emerald-300
                hover:bg-emerald-700/60 transition-colors font-medium">
              ✅ 提交代码
            </button>
          </div>
          {/* 编辑区 */}
          <textarea
            value={code}
            onChange={e => setCode(e.target.value)}
            spellCheck={false}
            className="flex-1 resize-none bg-[#0D1117] px-5 py-4 font-mono text-sm leading-relaxed
              text-gray-200 focus:outline-none placeholder:text-gray-700"
            placeholder="# 在这里编写代码..."
          />
          {/* 底部：快捷提示 */}
          <div className="px-4 py-2 border-t border-gray-800 bg-gray-900/30 shrink-0">
            <p className="text-[10px] text-gray-700">
              提示：先描述思路，再开始编码 · 提交代码后进入追问环节
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function InterviewPage() {
  return (
    <Suspense fallback={
      <div className="flex h-[60vh] items-center justify-center bg-[#0F1117]">
        <div className="w-8 h-8 rounded-full border-2 border-indigo-700 border-t-indigo-400 animate-spin" />
      </div>
    }>
      <InterviewContent />
    </Suspense>
  );
}
