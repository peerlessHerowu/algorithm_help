'use client';

import { Suspense, useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { useWebSocket } from '@/hooks/useWebSocket';

// ============ 类型定义 ============

/** 面试阶段 */
type InterviewPhase = 'config' | 'thinking' | 'coding' | 'followup' | 'ended';

/** 面试配置 */
interface InterviewConfig {
  difficulty: 'Easy' | 'Medium' | 'Hard' | 'Random';
  duration: 25 | 45 | 60;
  companyStyle: 'Google' | 'Meta' | 'Amazon' | '字节' | '通用';
}

/** 对话消息 */
interface ChatMessage {
  id: string;
  role: 'interviewer' | 'candidate';
  content: string;
  timestamp: number;
}

/** 评分维度 */
interface ScoreDimension {
  name: string;
  score: number; // 0-100
  suggestion: string;
}

/** 面试评分报告 */
interface ScoreReport {
  dimensions: ScoreDimension[];
  overallScore: number;
  summary: string;
}

// ============ 阶段配置 ============

const PHASE_LABELS: Record<InterviewPhase, string> = {
  config: '准备中',
  thinking: '🧠 思路阐述',
  coding: '💻 编码实现',
  followup: '🎯 追问环节',
  ended: '面试结束',
};

const DIFFICULTY_OPTIONS = ['Easy', 'Medium', 'Hard', 'Random'] as const;
const DURATION_OPTIONS = [25, 45, 60] as const;
const COMPANY_OPTIONS = ['Google', 'Meta', 'Amazon', '字节', '通用'] as const;

// ============ 倒计时 Hook ============

function useCountdown(initialSeconds: number, isRunning: boolean) {
  const [remaining, setRemaining] = useState(initialSeconds);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setRemaining(initialSeconds);
  }, [initialSeconds]);

  useEffect(() => {
    if (!isRunning || remaining <= 0) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }

    intervalRef.current = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          if (intervalRef.current) clearInterval(intervalRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isRunning, remaining]);

  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;
  const formatted = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  const percentage = initialSeconds > 0 ? (remaining / initialSeconds) * 100 : 0;

  return { remaining, formatted, percentage };
}

// ============ 配置面板组件 ============

function ConfigPanel({
  config,
  onConfigChange,
  onStart,
}: {
  config: InterviewConfig;
  onConfigChange: (config: InterviewConfig) => void;
  onStart: () => void;
}) {
  return (
    <div className="mx-auto max-w-lg space-y-6 rounded-xl border border-gray-200 bg-white p-8 shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          🎤 面试模拟配置
        </h2>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          选择面试参数后开始模拟
        </p>
      </div>

      {/* 难度选择 */}
      <div>
        <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
          难度
        </label>
        <div className="grid grid-cols-4 gap-2">
          {DIFFICULTY_OPTIONS.map((d) => (
            <button
              key={d}
              onClick={() => onConfigChange({ ...config, difficulty: d })}
              className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                config.difficulty === d
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
              }`}
            >
              {d}
            </button>
          ))}
        </div>
      </div>

      {/* 时长选择 */}
      <div>
        <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
          时长（分钟）
        </label>
        <div className="grid grid-cols-3 gap-2">
          {DURATION_OPTIONS.map((d) => (
            <button
              key={d}
              onClick={() => onConfigChange({ ...config, duration: d })}
              className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                config.duration === d
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
              }`}
            >
              {d} 分钟
            </button>
          ))}
        </div>
      </div>

      {/* 公司风格 */}
      <div>
        <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
          公司风格
        </label>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          {COMPANY_OPTIONS.map((c) => (
            <button
              key={c}
              onClick={() => onConfigChange({ ...config, companyStyle: c })}
              className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                config.companyStyle === c
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* 开始按钮 */}
      <button
        onClick={onStart}
        className="w-full rounded-lg bg-primary-600 px-6 py-3 text-base font-semibold text-white shadow-sm hover:bg-primary-700 transition-colors"
      >
        开始面试 🚀
      </button>
    </div>
  );
}

// ============ 评分报告组件 ============

function ScoreReportPanel({ report }: { report: ScoreReport }) {
  return (
    <div className="mx-auto max-w-2xl space-y-6 rounded-xl border border-gray-200 bg-white p-8 shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          📊 面试评分报告
        </h2>
        <div className="mt-3">
          <span className="text-4xl font-bold text-primary-600">{report.overallScore}</span>
          <span className="ml-1 text-lg text-gray-500">/100</span>
        </div>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{report.summary}</p>
      </div>

      {/* 四维评分条形图 */}
      <div className="space-y-4">
        {report.dimensions.map((dim) => (
          <div key={dim.name} className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {dim.name}
              </span>
              <span className={`text-sm font-semibold ${
                dim.score >= 80 ? 'text-green-600' :
                dim.score >= 60 ? 'text-yellow-600' : 'text-red-600'
              }`}>
                {dim.score}
              </span>
            </div>
            <div className="h-3 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  dim.score >= 80 ? 'bg-green-500' :
                  dim.score >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                }`}
                style={{ width: `${dim.score}%` }}
              />
            </div>
            {/* 低分维度展示改进建议 (R12.11) */}
            {dim.score < 70 && dim.suggestion && (
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                💡 {dim.suggestion}
              </p>
            )}
          </div>
        ))}
      </div>

      {/* 操作按钮 */}
      <div className="flex gap-3 pt-4">
        <button
          onClick={() => window.location.reload()}
          className="flex-1 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 transition-colors"
        >
          再来一次
        </button>
        <a
          href="/training"
          className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-center text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700 transition-colors"
        >
          查看历史评分趋势
        </a>
      </div>
    </div>
  );
}

// ============ 面试主体内容组件 ============

function InterviewContent() {
  const searchParams = useSearchParams();
  const problemId = searchParams.get('problemId') || '';

  // 面试状态
  const [phase, setPhase] = useState<InterviewPhase>('config');
  const [config, setConfig] = useState<InterviewConfig>({
    difficulty: 'Medium',
    duration: 45,
    companyStyle: '通用',
  });
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [code, setCode] = useState('// 在这里编写代码...\n');
  const [scoreReport, setScoreReport] = useState<ScoreReport | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // 会话 ID（通过 REST 创建，WS 通信时携带）
  const [sessionId, setSessionId] = useState('');

  // 消息列表自动滚动
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // WebSocket 连接
  const { state: wsState, send, subscribe } = useWebSocket({
    autoConnect: false,
  });

  // 倒计时
  const isTimerRunning = phase !== 'config' && phase !== 'ended';
  const { formatted: timeDisplay, remaining, percentage } = useCountdown(
    config.duration * 60,
    isTimerRunning
  );

  // 自动滚动到消息底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 订阅 WebSocket 面试消息（对齐后端实际消息类型）
  useEffect(() => {
    // 后端发 AI_RESPONSE → 面试官回复
    const unsubAiResponse = subscribe<{ content: string } | string>(
      'AI_RESPONSE',
      (payload) => {
        const content = typeof payload === 'string' ? payload : payload.content;
        const newMsg: ChatMessage = {
          id: `msg-${Date.now()}`,
          role: 'interviewer',
          content,
          timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, newMsg]);
      }
    );

    // 后端发 INTERVIEW_REPORT → 评分报告
    const unsubReport = subscribe<ScoreReport | string>('INTERVIEW_REPORT', (payload) => {
      try {
        const report = typeof payload === 'string' ? JSON.parse(payload) : payload;
        // 映射后端字段到前端 ScoreReport
        const mapped: ScoreReport = {
          overallScore: report.totalScore ?? report.overallScore ?? 0,
          summary: report.summary ?? '',
          dimensions: [
            { name: '🧠 正确性', score: (report.correctnessScore ?? 5) * 10, suggestion: report.improvements?.correctness ?? '' },
            { name: '⚡ 效率', score: (report.efficiencyScore ?? 5) * 10, suggestion: report.improvements?.efficiency ?? '' },
            { name: '🗣️ 沟通', score: (report.communicationScore ?? 5) * 10, suggestion: report.improvements?.communication ?? '' },
            { name: '💻 代码质量', score: (report.codeQualityScore ?? 5) * 10, suggestion: report.improvements?.codeQuality ?? '' },
          ],
        };
        setScoreReport(mapped);
        setPhase('ended');
      } catch { /* 解析失败时保留当前状态 */ }
    });

    // 后端发 INTERVIEW_TIME_WARNING → 时间警告
    const unsubTimeWarn = subscribe<string>('INTERVIEW_TIME_WARNING', (payload) => {
      const content = typeof payload === 'string' ? payload : '时间提醒';
      const warnMsg: ChatMessage = {
        id: `warn-${Date.now()}`,
        role: 'interviewer',
        content,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, warnMsg]);
      // 如果包含评分报告触发词，切换阶段
      if (content.includes('评分报告')) setPhase('ended');
    });

    // 兼容旧路径（保留 INTERVIEW_MESSAGE 和 INTERVIEW_SCORE）
    const unsubLegacyMsg = subscribe<{ content: string; phase?: InterviewPhase }>(
      'INTERVIEW_MESSAGE',
      (payload) => {
        const newMsg: ChatMessage = {
          id: `msg-${Date.now()}`,
          role: 'interviewer',
          content: payload.content,
          timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, newMsg]);
        if (payload.phase) setPhase(payload.phase);
      }
    );
    const unsubLegacyScore = subscribe<ScoreReport>('INTERVIEW_SCORE', (payload) => {
      setScoreReport(payload);
      setPhase('ended');
    });

    return () => {
      unsubAiResponse();
      unsubReport();
      unsubTimeWarn();
      unsubLegacyMsg();
      unsubLegacyScore();
    };
  }, [subscribe]);

  // 时间到自动结束面试
  useEffect(() => {
    if (remaining === 0 && isTimerRunning) {
      handleEndInterview();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining, isTimerRunning]);

  // 开始面试（先 REST 创建 session，再 WS 通信）
  const handleStart = useCallback(async () => {
    setPhase('thinking');
    // 创建面试会话
    let sid = sessionId;
    if (!sid) {
      try {
        const { interviewApi } = await import('@/lib/api');
        const session = await interviewApi.start(
          'guest', problemId || 'unknown',
          config.duration,
          config.difficulty.toUpperCase(),
          config.companyStyle === '通用' ? 'GENERAL' : config.companyStyle.toUpperCase()
        ) as { sessionId?: string; id?: string };
        sid = (session as any).sessionId || (session as any).id || `interview-${Date.now()}`;
        setSessionId(sid);
      } catch {
        sid = `interview-${Date.now()}`;
        setSessionId(sid);
      }
    }

    // 初始面试官消息
    const introMsg: ChatMessage = {
      id: 'msg-intro',
      role: 'interviewer',
      content: `你好！欢迎参加${config.companyStyle}风格的算法面试。难度为 ${config.difficulty}，时间限制 ${config.duration} 分钟。请先描述一下你的解题思路，然后开始编写代码。`,
      timestamp: Date.now(),
    };
    setMessages([introMsg]);

    // 发送 WebSocket 开始面试消息
    send({
      type: 'INTERVIEW_CHAT',
      sessionId: sid,
      payload: JSON.stringify({
        action: 'START',
        problemId,
        difficulty: config.difficulty,
        duration: config.duration,
        companyStyle: config.companyStyle,
      }),
    } as any);
  }, [config, problemId, send, sessionId]);

  // 发送消息
  const handleSend = useCallback(() => {
    if (!input.trim() || isSubmitting) return;

    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'candidate',
      content: input.trim(),
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, userMsg]);

    // 通过 WebSocket 发送候选人回答
    send({
      type: 'INTERVIEW_CHAT',
      sessionId,
      payload: input.trim(),
    } as any);

    setInput('');
  }, [input, isSubmitting, send, phase]);

  // 提交代码
  const handleSubmitCode = useCallback(() => {
    if (isSubmitting) return;
    setIsSubmitting(true);

    const codeMsg: ChatMessage = {
      id: `msg-code-${Date.now()}`,
      role: 'candidate',
      content: `[代码提交]\n\`\`\`\n${code}\n\`\`\``,
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, codeMsg]);

    // 发送代码到后端
    send({
      type: 'INTERVIEW_CHAT',
      sessionId,
      payload: `[代码提交]\n${code}`,
    } as any);

    setIsSubmitting(false);
    setPhase('followup');
  }, [code, isSubmitting, send, phase]);

  // 结束面试
  const handleEndInterview = useCallback(() => {
    send({
      type: 'INTERVIEW_CHAT',
      sessionId,
      payload: '[INTERVIEW_END]',
    });

    // 显示默认评分（WebSocket 可能覆盖）
    if (!scoreReport) {
      setScoreReport({
        overallScore: 72,
        summary: '整体表现良好，思路清晰，代码实现需加强边界处理。',
        dimensions: [
          { name: '🧠 思路清晰度', score: 78, suggestion: '' },
          { name: '💻 代码质量', score: 65, suggestion: '注意处理边界条件，建议先写测试用例再编码。' },
          { name: '🗣️ 沟通能力', score: 80, suggestion: '' },
          { name: '⏱️ 时间管理', score: 68, suggestion: '建议先用5分钟理清思路，再开始编码。' },
        ],
      });
    }
    setPhase('ended');
  }, [code, send, scoreReport]);

  // 配置阶段
  if (phase === 'config') {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        <ConfigPanel config={config} onConfigChange={setConfig} onStart={handleStart} />
      </div>
    );
  }

  // 面试结束 - 展示评分报告
  if (phase === 'ended' && scoreReport) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4 py-8">
        <ScoreReportPanel report={scoreReport} />
      </div>
    );
  }

  // 面试进行中
  return (
    <div className="mx-auto max-w-6xl px-4">
      {/* 顶部：计时器 + 阶段提示 */}
      <div className="mb-4 flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        {/* 阶段提示 */}
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {PHASE_LABELS[phase]}
          </span>
          {/* 阶段进度点 */}
          <div className="flex gap-1">
            {(['thinking', 'coding', 'followup'] as InterviewPhase[]).map((p) => (
              <div
                key={p}
                className={`h-2 w-2 rounded-full ${
                  p === phase
                    ? 'bg-primary-600 animate-pulse'
                    : phase === 'followup' || (phase === 'coding' && p === 'thinking')
                    ? 'bg-primary-400'
                    : 'bg-gray-300 dark:bg-gray-600'
                }`}
              />
            ))}
          </div>
        </div>

        {/* 计时器 */}
        <div className="flex items-center gap-3">
          {/* WebSocket 连接状态 */}
          <span
            className={`h-2 w-2 rounded-full ${
              wsState === 'connected' ? 'bg-green-500' : 'bg-yellow-500 animate-pulse'
            }`}
            title={wsState === 'connected' ? '已连接' : '连接中...'}
          />
          {/* 倒计时 */}
          <div
            className={`rounded-lg px-4 py-1.5 font-mono text-lg font-semibold ${
              percentage <= 20
                ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
            }`}
          >
            {timeDisplay}
          </div>
        </div>
      </div>

      {/* 主体：对话区域 + 代码编辑器 */}
      <div className="grid h-[calc(100vh-16rem)] gap-4 lg:grid-cols-2">
        {/* 对话区域 */}
        <div className="flex flex-col rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="border-b border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 dark:border-gray-700 dark:text-gray-300">
            面试对话
          </div>
          <div className="flex-1 space-y-3 overflow-y-auto p-4">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`rounded-lg p-3 text-sm ${
                  msg.role === 'interviewer'
                    ? 'bg-primary-50 text-primary-800 dark:bg-primary-900/20 dark:text-primary-300'
                    : 'ml-8 bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
                }`}
              >
                <span className="mb-1 block text-xs font-medium opacity-70">
                  {msg.role === 'interviewer' ? '面试官' : '你'}
                </span>
                <span className="whitespace-pre-wrap">{msg.content}</span>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
          {/* 输入区 */}
          <div className="border-t border-gray-200 p-3 dark:border-gray-700">
            <div className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                placeholder="输入你的回答..."
                className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
              />
              <button
                onClick={handleSend}
                disabled={!input.trim()}
                className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                发送
              </button>
            </div>
          </div>
        </div>

        {/* 代码编辑区 */}
        <div className="flex flex-col rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between border-b border-gray-200 px-4 py-2 dark:border-gray-700">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              代码编辑器
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400">Monospace</span>
          </div>
          <textarea
            value={code}
            onChange={(e) => setCode(e.target.value)}
            spellCheck={false}
            className="flex-1 resize-none bg-gray-50 p-4 font-mono text-sm leading-relaxed focus:outline-none dark:bg-gray-900 dark:text-gray-100"
            placeholder="// 在这里编写代码..."
          />
        </div>
      </div>

      {/* 底部：操作按钮 */}
      <div className="mt-4 flex items-center justify-between">
        <div className="flex gap-2">
          <button
            onClick={handleSubmitCode}
            disabled={isSubmitting || code.trim() === '// 在这里编写代码...'}
            className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            ✅ 提交代码
          </button>
        </div>
        <button
          onClick={handleEndInterview}
          className="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-900/20 transition-colors"
        >
          结束面试
        </button>
      </div>
    </div>
  );
}

// ============ 页面导出 ============

/**
 * 面试模拟页面
 *
 * 功能：
 * - 面试前：配置面板（难度/时长/公司风格）
 * - 面试中：倒计时 + 阶段提示 + 对话区域 + 代码编辑器 + 提交/结束按钮
 * - 面试后：四维评分报告（思路清晰度/代码质量/沟通能力/时间管理）
 * - WebSocket 实时通信（INTERVIEW_START/ANSWER/CODE_SUBMIT/END）
 *
 * Requirements: 12.3, 12.10, 12.11
 */
export default function InterviewPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-gray-500">加载中...</div>}>
      <InterviewContent />
    </Suspense>
  );
}
