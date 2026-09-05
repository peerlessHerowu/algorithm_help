'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useAppStore } from '@/store';
import Link from 'next/link';

// ===== 类型 =====

interface QuizOption { patternId: string; patternName: string; }

interface QuizQuestion {
  problemId: string;
  problemDescription: string;
  options: QuizOption[];
  correctAnswer: string;
}

interface Quiz { questions: QuizQuestion[]; }

interface QuizResult {
  correct: boolean;
  correctAnswer: string;
  correctPatternName: string;
  explanation: string;
}

interface PatternStat {
  patternId: string;
  patternName: string;
  totalAttempts: number;
  correctCount: number;
  accuracy: number;
}

// ===== 常量 =====

const QUESTION_COUNT = 10;
const TIME_LIMIT_SEC = 30; // 每题限时秒数
const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8080';

const OPTION_LABELS = ['A', 'B', 'C', 'D'];

// 训练模式卡片配置
const TRAINING_MODES = [
  {
    id: 'pattern',
    icon: '🧩',
    title: '模式识别',
    desc: '题目描述（隐藏标签），判断该用哪种算法模式。',
    accent: 'indigo',
    action: null as null, // 在主页启动
  },
  {
    id: 'debug',
    icon: '🐛',
    title: 'Debug 训练',
    desc: 'AI 生成有 Bug 的代码，找出错误并修复。',
    accent: 'blue',
    action: '/training/debug',
  },
  {
    id: 'reverse-feynman',
    icon: '🔄',
    title: '反向费曼',
    desc: 'AI 故意讲错，你来纠正，加深对正确解法的记忆。',
    accent: 'purple',
    action: '/training/reverse-feynman',
  },
  {
    id: 'socratic',
    icon: '🦉',
    title: '苏格拉底追问',
    desc: 'AI 通过渐进式问题引导你自己推导解法。',
    accent: 'emerald',
    action: '/socratic',
  },
];

// ===== 主页面 =====

export default function TrainingPage() {
  const { token, user } = useAppStore();

  const [quiz, setQuiz]       = useState<Quiz | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [submitted, setSubmitted]   = useState(false);
  const [result, setResult]         = useState<QuizResult | null>(null);
  const [completed, setCompleted]   = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const [answers, setAnswers]       = useState<{ correct: boolean; patternName: string }[]>([]);
  const [stats, setStats]           = useState<PatternStat[]>([]);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [timeLeft, setTimeLeft]     = useState(TIME_LIMIT_SEC);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // API 请求
  const apiRequest = useCallback(async (path: string, options: RequestInit = {}) => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body?.message || `请求失败 (${res.status})`);
    }
    const json = await res.json();
    return json?.data ?? json;
  }, [token]);

  // 计时器
  useEffect(() => {
    if (!quiz || submitted || completed) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }
    setTimeLeft(TIME_LIMIT_SEC);
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          // 超时自动提交空答案
          handleTimeUp();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quiz, currentIndex, submitted, completed]);

  // 超时处理
  const handleTimeUp = useCallback(() => {
    if (submitted) return;
    setSubmitted(true);
    setResult({
      correct: false,
      correctAnswer: quiz?.questions[currentIndex]?.correctAnswer ?? '',
      correctPatternName: '超时未答',
      explanation: '时间到！下次记得在限时内作答。',
    });
    setAnswers(prev => [...prev, { correct: false, patternName: '超时' }]);
  }, [submitted, quiz, currentIndex]);

  // 开始训练
  const startTraining = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiRequest('/api/v1/training/quiz', {
        method: 'POST',
        body: JSON.stringify({
          userId: user?.id ?? 'guest',
          questionCount: QUESTION_COUNT,
        }),
      });
      setQuiz(data);
      setCurrentIndex(0);
      setSelectedAnswer(null);
      setSubmitted(false);
      setResult(null);
      setCompleted(false);
      setCorrectCount(0);
      setAnswers([]);
      setStats([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败，请重试');
    } finally {
      setLoading(false);
    }
  }, [apiRequest, user]);

  // 提交答案
  const submitAnswer = useCallback(async () => {
    if (!quiz || (!selectedAnswer && timeLeft > 0)) return;
    if (timerRef.current) clearInterval(timerRef.current);
    setLoading(true);
    setError(null);
    try {
      const q = quiz.questions[currentIndex];
      const data = await apiRequest('/api/v1/training/submit', {
        method: 'POST',
        body: JSON.stringify({
          userId: user?.id ?? 'guest',
          problemId: q.problemId,
          answer: selectedAnswer ?? '__timeout__',
        }),
      });
      setResult(data);
      setSubmitted(true);
      if (data.correct) setCorrectCount(p => p + 1);
      setAnswers(p => [...p, { correct: data.correct, patternName: data.correctPatternName }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : '提交失败');
    } finally {
      setLoading(false);
    }
  }, [quiz, selectedAnswer, currentIndex, apiRequest, user, timeLeft]);

  // 下一题
  const nextQuestion = useCallback(async () => {
    if (!quiz) return;
    if (currentIndex + 1 >= quiz.questions.length) {
      setCompleted(true);
      try {
        const data = await apiRequest(`/api/v1/training/stats/${user?.id ?? 'guest'}`);
        setStats(Array.isArray(data) ? data : []);
      } catch { /* 忽略 */ }
    } else {
      setCurrentIndex(p => p + 1);
      setSelectedAnswer(null);
      setSubmitted(false);
      setResult(null);
    }
  }, [quiz, currentIndex, apiRequest, user]);

  // ===== 渲染：首页 =====

  if (!quiz) {
    return <HomePage stats={stats} loading={loading} error={error} onStart={startTraining} />;
  }

  // ===== 渲染：完成 =====

  if (completed) {
    return (
      <CompletionView
        totalQuestions={quiz.questions.length}
        correctCount={correctCount}
        answers={answers}
        stats={stats}
        onRestart={startTraining}
      />
    );
  }

  // ===== 渲染：答题 =====

  const q = quiz.questions[currentIndex];
  const timerPct = (timeLeft / TIME_LIMIT_SEC) * 100;
  const timerColor = timeLeft > 15 ? '#10B981' : timeLeft > 7 ? '#F59E0B' : '#EF4444';

  return (
    <div className="min-h-screen bg-[#0F1117] flex flex-col items-center px-4 pt-6 pb-12">
      {/* 顶部进度 + 计时器 */}
      <div className="max-w-2xl w-full mb-6">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-400">
              {currentIndex + 1} <span className="text-gray-600">/</span> {quiz.questions.length}
            </span>
            <div className="flex gap-1">
              {quiz.questions.map((_, i) => (
                <div
                  key={i}
                  className={`h-1.5 w-6 rounded-full transition-colors ${
                    i < currentIndex ? 'bg-indigo-500'
                    : i === currentIndex ? 'bg-indigo-400'
                    : 'bg-gray-700'
                  }`}
                />
              ))}
            </div>
          </div>
          {/* 计时器 */}
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 -rotate-90" viewBox="0 0 32 32">
              <circle cx="16" cy="16" r="13" fill="none" stroke="#1F2937" strokeWidth="3" />
              <circle cx="16" cy="16" r="13" fill="none"
                stroke={timerColor} strokeWidth="3"
                strokeDasharray={`${2 * Math.PI * 13}`}
                strokeDashoffset={`${2 * Math.PI * 13 * (1 - timerPct / 100)}`}
                style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.5s' }}
              />
            </svg>
            <span className="text-sm font-mono font-bold tabular-nums"
              style={{ color: timerColor }}>
              {timeLeft}s
            </span>
          </div>
        </div>
        {/* 总体进度条 */}
        <div className="h-1 w-full bg-gray-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-indigo-500 rounded-full transition-all duration-300"
            style={{ width: `${((currentIndex) / quiz.questions.length) * 100}%` }}
          />
        </div>
      </div>

      {/* 题目卡片 */}
      <div className="max-w-2xl w-full">
        <div className="rounded-2xl border border-gray-800 bg-[#141820] p-6 mb-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs text-gray-500 uppercase tracking-wider">题目描述</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-900/40 text-indigo-400">
              识别算法模式
            </span>
          </div>
          <p className="text-gray-200 leading-relaxed text-sm whitespace-pre-wrap">
            {q.problemDescription}
          </p>
        </div>

        {/* 选项 */}
        <div className="space-y-2.5 mb-5">
          {q.options.map((option, idx) => {
            const label = OPTION_LABELS[idx] ?? String(idx + 1);
            const isSelected = selectedAnswer === option.patternId;
            const isCorrect = result?.correctAnswer === option.patternId;
            const isWrong = submitted && isSelected && !isCorrect;

            return (
              <button
                key={option.patternId}
                onClick={() => { if (!submitted) setSelectedAnswer(option.patternId); }}
                disabled={submitted}
                className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-xl border
                  text-left transition-all duration-200 disabled:cursor-default
                  ${!submitted
                    ? isSelected
                      ? 'border-indigo-500 bg-indigo-900/20 shadow-indigo-900/30 shadow-sm'
                      : 'border-gray-700 bg-gray-800/30 hover:border-gray-600 hover:bg-gray-800/60'
                    : isCorrect
                      ? 'border-emerald-500 bg-emerald-900/20'
                      : isWrong
                        ? 'border-red-500 bg-red-900/20'
                        : 'border-gray-800 bg-gray-900/20 opacity-40'
                  }`}
              >
                {/* 字母标签 */}
                <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0
                  ${!submitted
                    ? isSelected ? 'bg-indigo-600 text-white' : 'bg-gray-700 text-gray-400'
                    : isCorrect ? 'bg-emerald-600 text-white'
                    : isWrong ? 'bg-red-600 text-white'
                    : 'bg-gray-800 text-gray-600'
                  }`}>
                  {label}
                </span>
                <span className={`flex-1 text-sm font-medium ${
                  !submitted ? (isSelected ? 'text-indigo-200' : 'text-gray-300')
                  : isCorrect ? 'text-emerald-200'
                  : isWrong ? 'text-red-200'
                  : 'text-gray-500'
                }`}>
                  {option.patternName}
                </span>
                {/* 结果图标 */}
                {submitted && isCorrect && (
                  <svg className="w-5 h-5 text-emerald-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                )}
                {submitted && isWrong && (
                  <svg className="w-5 h-5 text-red-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                )}
              </button>
            );
          })}
        </div>

        {/* 结果解析 */}
        {submitted && result && (
          <div className={`rounded-xl border p-4 mb-5 transition-all
            ${result.correct
              ? 'border-emerald-700/50 bg-emerald-900/20'
              : 'border-amber-700/50 bg-amber-900/20'
            }`}>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-base">{result.correct ? '🎉' : '💡'}</span>
              <span className={`text-sm font-semibold ${result.correct ? 'text-emerald-300' : 'text-amber-300'}`}>
                {result.correct ? '回答正确！' : `正确答案：${result.correctPatternName}`}
              </span>
            </div>
            <p className="text-xs text-gray-400 leading-relaxed">{result.explanation}</p>
          </div>
        )}

        {error && (
          <div className="mb-4 text-sm text-red-400 bg-red-900/20 border border-red-800/50 rounded-xl px-4 py-3">
            ⚠️ {error}
          </div>
        )}

        {/* 操作按钮 */}
        <div className="flex justify-between items-center">
          <button
            onClick={() => { setCompleted(true); }}
            className="text-xs text-gray-600 hover:text-gray-400 transition-colors"
          >
            结束本轮
          </button>
          {!submitted ? (
            <button
              onClick={submitAnswer}
              disabled={!selectedAnswer || loading}
              className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-xl
                transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {loading ? '提交中...' : '确认提交'}
            </button>
          ) : (
            <button
              onClick={nextQuestion}
              className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-xl transition-all"
            >
              {currentIndex + 1 >= quiz.questions.length ? '查看结果 →' : '下一题 →'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ===== 首页：训练模式选择 =====

function HomePage({ stats, loading, error, onStart }: {
  stats: PatternStat[];
  loading: boolean;
  error: string | null;
  onStart: () => void;
}) {
  const [activeTab, setActiveTab] = useState<'modes' | 'stats'>('modes');

  return (
    <div className="min-h-screen bg-[#0F1117] px-4 pt-6 pb-12">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* 标题区 */}
        <div>
          <h1 className="text-2xl font-bold text-gray-100">训练中心</h1>
          <p className="text-sm text-gray-500 mt-1">针对性提升算法模式识别能力</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-800/60 rounded-xl p-1 w-fit">
          {([['modes', '🏋️ 训练模式'], ['stats', '📊 薄弱分析']] as const).map(([t, label]) => (
            <button
              key={t}
              onClick={() => setActiveTab(t)}
              className={`px-4 py-1.5 text-sm rounded-lg transition-all font-medium
                ${activeTab === t
                  ? 'bg-indigo-600 text-white'
                  : 'text-gray-400 hover:text-gray-200'
                }`}
            >
              {label}
            </button>
          ))}
        </div>

        {error && (
          <div className="text-sm text-red-400 bg-red-900/20 border border-red-800/50 rounded-xl px-4 py-3">
            ⚠️ {error}
          </div>
        )}

        {activeTab === 'modes' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {TRAINING_MODES.map(mode => (
              <TrainingModeCard
                key={mode.id}
                mode={mode}
                loading={loading && mode.id === 'pattern'}
                onStart={mode.action ? undefined : onStart}
              />
            ))}
          </div>
        )}

        {activeTab === 'stats' && (
          <WeakStatsPanel stats={stats} onStartTraining={onStart} />
        )}
      </div>
    </div>
  );
}

// ===== 训练模式卡片 =====

function TrainingModeCard({ mode, loading, onStart }: {
  mode: typeof TRAINING_MODES[0];
  loading?: boolean;
  onStart?: () => void;
}) {
  const accentClasses: Record<string, { border: string; hover: string; btn: string }> = {
    indigo:  { border: 'border-indigo-700/40', hover: 'hover:border-indigo-600/70', btn: 'bg-indigo-600 hover:bg-indigo-500 text-white' },
    blue:    { border: 'border-blue-700/40',   hover: 'hover:border-blue-600/70',   btn: 'border border-blue-600 text-blue-400 hover:bg-blue-900/30' },
    purple:  { border: 'border-purple-700/40', hover: 'hover:border-purple-600/70', btn: 'border border-purple-600 text-purple-400 hover:bg-purple-900/30' },
    emerald: { border: 'border-emerald-700/40',hover: 'hover:border-emerald-600/70',btn: 'border border-emerald-600 text-emerald-400 hover:bg-emerald-900/30' },
  };
  const a = accentClasses[mode.accent] ?? accentClasses.indigo;

  const content = (
    <div className={`rounded-2xl border ${a.border} ${a.hover} bg-gray-900/60
      transition-all duration-200 p-5 h-full flex flex-col`}>
      <div className="text-3xl mb-3">{mode.icon}</div>
      <h3 className="font-semibold text-gray-100 mb-1.5">{mode.title}</h3>
      <p className="text-sm text-gray-500 leading-relaxed flex-1">{mode.desc}</p>
      <div className="mt-4">
        {onStart ? (
          <button
            onClick={onStart}
            disabled={loading}
            className={`w-full py-2 rounded-xl text-sm font-medium transition-all ${a.btn}
              disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-3.5 h-3.5 rounded-full border border-white/40 border-t-white animate-spin" />
                加载中...
              </span>
            ) : '开始训练 →'}
          </button>
        ) : (
          <div className={`w-full py-2 rounded-xl text-sm font-medium text-center ${a.btn}`}>
            前往训练 →
          </div>
        )}
      </div>
    </div>
  );

  if (mode.action) {
    return <Link href={mode.action} className="block h-full">{content}</Link>;
  }
  return <div>{content}</div>;
}

// ===== 薄弱点统计面板 =====

function WeakStatsPanel({ stats, onStartTraining }: {
  stats: PatternStat[];
  onStartTraining: () => void;
}) {
  const sorted = [...stats].sort((a, b) => a.accuracy - b.accuracy);
  const weakPatterns = sorted.filter(s => s.accuracy < 0.6);

  if (stats.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-gray-700 p-10 text-center">
        <div className="text-4xl mb-3">📊</div>
        <p className="text-gray-400 mb-4">完成训练后，这里会显示你的薄弱点分析</p>
        <button
          onClick={onStartTraining}
          className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm rounded-xl transition-all"
        >
          开始第一轮训练
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* 摘要 */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: '已训练模式', value: stats.length, color: 'text-indigo-400' },
          { label: '薄弱模式数', value: weakPatterns.length, color: 'text-amber-400' },
          { label: '整体正确率', value: stats.length > 0
            ? `${Math.round(stats.reduce((s,x) => s + x.accuracy, 0) / stats.length * 100)}%`
            : '-', color: 'text-emerald-400' },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-xl bg-gray-800/60 border border-gray-700 p-3 text-center">
            <div className={`text-xl font-bold ${color}`}>{value}</div>
            <div className="text-xs text-gray-500 mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      {/* 柱状图 */}
      <div className="rounded-2xl border border-gray-800 bg-gray-900/60 p-5">
        <h3 className="text-sm font-medium text-gray-300 mb-4">各模式正确率</h3>
        <div className="space-y-3">
          {sorted.map(stat => {
            const pct = Math.round(stat.accuracy * 100);
            const color = pct >= 80 ? '#10B981' : pct >= 60 ? '#F59E0B' : '#EF4444';
            return (
              <div key={stat.patternId} className="flex items-center gap-3">
                <span className="text-xs text-gray-400 w-20 truncate shrink-0" title={stat.patternName}>
                  {stat.patternName}
                </span>
                <div className="flex-1 h-3 rounded-full bg-gray-800 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${pct}%`, backgroundColor: color }}
                  />
                </div>
                <span className="text-xs font-mono tabular-nums w-8 text-right shrink-0"
                  style={{ color }}>{pct}%</span>
                <span className="text-xs text-gray-600 w-12 text-right shrink-0">
                  {stat.correctCount}/{stat.totalAttempts}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* 薄弱模式重点练习 */}
      {weakPatterns.length > 0 && (
        <div className="rounded-2xl border border-amber-800/40 bg-amber-900/10 p-5">
          <h3 className="text-sm font-medium text-amber-300 mb-3">⚠️ 需要重点练习的模式</h3>
          <div className="flex flex-wrap gap-2 mb-4">
            {weakPatterns.map(wp => (
              <Link
                key={wp.patternId}
                href={`/patterns/${wp.patternId.replace('pattern:', '')}`}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-xl
                  bg-amber-900/30 border border-amber-700/50 text-amber-300
                  hover:border-amber-500 transition-colors"
              >
                <span>{wp.patternName}</span>
                <span className="opacity-60">{Math.round(wp.accuracy * 100)}%</span>
              </Link>
            ))}
          </div>
          <button
            onClick={onStartTraining}
            className="w-full py-2 text-sm font-medium rounded-xl
              bg-amber-600/20 border border-amber-600/40 text-amber-300
              hover:bg-amber-600/30 transition-all"
          >
            针对薄弱点重新训练
          </button>
        </div>
      )}
    </div>
  );
}

// ===== 训练完成统计 =====

function CompletionView({ totalQuestions, correctCount, answers, stats, onRestart }: {
  totalQuestions: number;
  correctCount: number;
  answers: { correct: boolean; patternName: string }[];
  stats: PatternStat[];
  onRestart: () => void;
}) {
  const accuracy = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;
  const emoji = accuracy >= 80 ? '🏆' : accuracy >= 60 ? '👍' : '💪';
  const weakPatterns = stats.filter(s => s.accuracy < 0.6);

  return (
    <div className="min-h-screen bg-[#0F1117] px-4 pt-6 pb-12">
      <div className="max-w-2xl mx-auto space-y-5">
        {/* 总结卡片 */}
        <div className="rounded-2xl border border-gray-800 bg-[#141820] p-6 text-center">
          <div className="text-5xl mb-3">{emoji}</div>
          <h2 className="text-xl font-bold text-gray-100 mb-1">训练完成！</h2>
          <p className="text-gray-500 text-sm mb-5">本次训练结果</p>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: '总题数',  value: totalQuestions,  color: 'text-gray-200' },
              { label: '正确数',  value: correctCount,    color: 'text-emerald-400' },
              { label: '正确率',  value: `${accuracy}%`,
                color: accuracy >= 80 ? 'text-emerald-400' : accuracy >= 60 ? 'text-amber-400' : 'text-red-400' },
            ].map(({ label, value, color }) => (
              <div key={label} className="bg-gray-800/60 rounded-xl p-3">
                <div className={`text-2xl font-bold tabular-nums ${color}`}>{value}</div>
                <div className="text-xs text-gray-600 mt-0.5">{label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* 答题轨迹 */}
        <div className="rounded-2xl border border-gray-800 bg-[#141820] p-5">
          <h3 className="text-sm font-medium text-gray-400 mb-3">答题轨迹</h3>
          <div className="flex flex-wrap gap-2">
            {answers.map((a, i) => (
              <div key={i}
                title={`第${i + 1}题：${a.patternName}`}
                className={`w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold
                  ${a.correct
                    ? 'bg-emerald-900/40 border border-emerald-700/50 text-emerald-400'
                    : 'bg-red-900/40 border border-red-700/50 text-red-400'
                  }`}
              >
                {a.correct ? '✓' : '✗'}
              </div>
            ))}
          </div>
        </div>

        {/* 各模式正确率 */}
        {stats.length > 0 && (
          <div className="rounded-2xl border border-gray-800 bg-[#141820] p-5">
            <h3 className="text-sm font-medium text-gray-400 mb-4">各模式正确率</h3>
            <div className="space-y-2.5">
              {[...stats].sort((a, b) => a.accuracy - b.accuracy).map(stat => {
                const pct = Math.round(stat.accuracy * 100);
                const color = pct >= 80 ? '#10B981' : pct >= 60 ? '#F59E0B' : '#EF4444';
                return (
                  <div key={stat.patternId} className="flex items-center gap-3">
                    <span className="text-xs text-gray-400 w-20 truncate shrink-0">{stat.patternName}</span>
                    <div className="flex-1 h-2.5 rounded-full bg-gray-800 overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${pct}%`, backgroundColor: color }} />
                    </div>
                    <span className="text-xs font-mono w-8 text-right shrink-0" style={{ color }}>{pct}%</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 薄弱模式提示 */}
        {weakPatterns.length > 0 && (
          <div className="rounded-2xl border border-amber-800/40 bg-amber-900/10 p-5">
            <h3 className="text-sm font-semibold text-amber-300 mb-2">⚠️ 需要加强的模式</h3>
            <div className="flex flex-wrap gap-2">
              {weakPatterns.map(wp => (
                <Link
                  key={wp.patternId}
                  href={`/patterns/${wp.patternId.replace('pattern:', '')}`}
                  className="px-3 py-1 text-xs rounded-xl bg-amber-900/30 border border-amber-700/50
                    text-amber-300 hover:border-amber-500 transition-colors"
                >
                  {wp.patternName}（{Math.round(wp.accuracy * 100)}%）
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* 操作 */}
        <div className="flex gap-3 justify-center pb-4">
          <Link href="/training"
            className="px-5 py-2.5 rounded-xl border border-gray-700 text-gray-300
              text-sm hover:border-gray-500 transition-all">
            返回首页
          </Link>
          <button
            onClick={onRestart}
            className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white
              text-sm font-medium transition-all"
          >
            再来一轮
          </button>
        </div>
      </div>
    </div>
  );
}
