'use client';

import { useState, useCallback } from 'react';

// ===== 类型定义 =====

interface QuizOption {
  patternId: string;
  patternName: string;
}

interface QuizQuestion {
  problemId: string;
  problemDescription: string;
  options: QuizOption[];
  correctAnswer: string;
}

interface Quiz {
  questions: QuizQuestion[];
}

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

const USER_ID = 'user1';
const QUESTION_COUNT = 10;
const API_BASE = '/api/training';

// ===== 主页面组件 =====

export default function TrainingPage() {
  // 测验数据
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  // 当前题目索引
  const [currentIndex, setCurrentIndex] = useState(0);
  // 选中的答案
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  // 是否已提交
  const [submitted, setSubmitted] = useState(false);
  // 提交结果
  const [result, setResult] = useState<QuizResult | null>(null);
  // 是否训练完成
  const [completed, setCompleted] = useState(false);
  // 正确答案计数
  const [correctCount, setCorrectCount] = useState(0);
  // 每题结果记录
  const [answers, setAnswers] = useState<{ correct: boolean; patternName: string }[]>([]);
  // 统计数据
  const [stats, setStats] = useState<PatternStat[]>([]);
  // 加载状态
  const [loading, setLoading] = useState(false);

  // ===== 开始训练 =====

  const startTraining = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/quiz`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: USER_ID, questionCount: QUESTION_COUNT }),
      });
      if (!res.ok) throw new Error('获取测验失败');
      const data: Quiz = await res.json();
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
      console.error('开始训练失败:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // ===== 提交答案 =====

  const submitAnswer = useCallback(async () => {
    if (!quiz || !selectedAnswer) return;
    setLoading(true);
    try {
      const currentQuestion = quiz.questions[currentIndex];
      const res = await fetch(`${API_BASE}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: USER_ID,
          problemId: currentQuestion.problemId,
          answer: selectedAnswer,
        }),
      });
      if (!res.ok) throw new Error('提交答案失败');
      const data: QuizResult = await res.json();
      setResult(data);
      setSubmitted(true);
      if (data.correct) {
        setCorrectCount((prev) => prev + 1);
      }
      setAnswers((prev) => [
        ...prev,
        { correct: data.correct, patternName: data.correctPatternName },
      ]);
    } catch (err) {
      console.error('提交答案失败:', err);
    } finally {
      setLoading(false);
    }
  }, [quiz, selectedAnswer, currentIndex]);

  // ===== 下一题 =====

  const nextQuestion = useCallback(async () => {
    if (!quiz) return;
    if (currentIndex + 1 >= quiz.questions.length) {
      // 训练结束，加载统计
      setCompleted(true);
      await loadStats();
    } else {
      setCurrentIndex((prev) => prev + 1);
      setSelectedAnswer(null);
      setSubmitted(false);
      setResult(null);
    }
  }, [quiz, currentIndex]);

  // ===== 加载统计数据 =====

  const loadStats = async () => {
    try {
      const res = await fetch(`${API_BASE}/stats/${USER_ID}`);
      if (res.ok) {
        const data: PatternStat[] = await res.json();
        setStats(data);
      }
    } catch (err) {
      console.error('加载统计失败:', err);
    }
  };

  // ===== 渲染：开始画面 =====

  if (!quiz) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-start justify-center p-4 pt-8">
        <div className="max-w-2xl w-full space-y-4">
          {/* 页面标题 */}
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">🏋️ 训练中心</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm">选择训练方式，针对性提升算法能力</p>

          {/* 训练方式网格 */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {/* 模式识别 */}
            <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-900">
              <div className="text-3xl mb-3">🧩</div>
              <h3 className="font-semibold text-gray-800 dark:text-gray-100 mb-1">模式识别训练</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                给出题目描述（隐藏标签），判断该用哪种算法模式。
              </p>
              <button onClick={startTraining} disabled={loading}
                className="w-full rounded-lg bg-indigo-600 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">
                {loading ? '加载中...' : '开始训练'}
              </button>
            </div>

            {/* Debug 训练 */}
            <a href="/training/debug"
              className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-900 cursor-pointer hover:border-blue-300 dark:hover:border-blue-700 transition-colors block">
              <div className="text-3xl mb-3">🐛</div>
              <h3 className="font-semibold text-gray-800 dark:text-gray-100 mb-1">Debug 训练</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                AI 生成有 Bug 的代码，找出错误并修复。提升代码审查能力。
              </p>
              <div className="w-full rounded-lg border border-blue-300 py-2 text-sm text-center font-medium text-blue-600 dark:border-blue-700 dark:text-blue-400">
                前往 Debug 训练 →
              </div>
            </a>

            {/* 反向费曼 */}
            <a href="/training/reverse-feynman"
              className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-900 cursor-pointer hover:border-purple-300 dark:hover:border-purple-700 transition-colors block">
              <div className="text-3xl mb-3">🔄</div>
              <h3 className="font-semibold text-gray-800 dark:text-gray-100 mb-1">反向费曼法</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                AI 故意讲错，你来找出错误并纠正。通过纠错加深对正确解法的记忆。
              </p>
              <div className="w-full rounded-lg border border-purple-300 py-2 text-sm text-center font-medium text-purple-600 dark:border-purple-700 dark:text-purple-400">
                前往反向费曼 →
              </div>
            </a>

            {/* 苏格拉底追问 */}
            <a href="/socratic"
              className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-900 cursor-pointer hover:border-green-300 dark:hover:border-green-700 transition-colors block">
              <div className="text-3xl mb-3">🦉</div>
              <h3 className="font-semibold text-gray-800 dark:text-gray-100 mb-1">苏格拉底追问</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                AI 不直接给答案，通过渐进式问题引导你自己推导解法。
              </p>
              <div className="w-full rounded-lg border border-green-300 py-2 text-sm text-center font-medium text-green-600 dark:border-green-700 dark:text-green-400">
                前往苏格拉底 →
              </div>
            </a>
          </div>
        </div>
      </div>
    );
  }

  // ===== 渲染：训练结束统计 =====

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

  // ===== 渲染：答题画面 =====

  const currentQuestion = quiz.questions[currentIndex];

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center p-4 pt-8">
      {/* 进度指示器 */}
      <ProgressBar current={currentIndex + 1} total={quiz.questions.length} />

      {/* 题目卡片 */}
      <div className="max-w-2xl w-full mt-6">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
          {/* 题目描述 */}
          <div className="mb-6">
            <h2 className="text-sm font-medium text-gray-400 mb-2">题目描述</h2>
            <p className="text-gray-800 leading-relaxed text-sm whitespace-pre-wrap">
              {currentQuestion.problemDescription}
            </p>
          </div>

          {/* 选项 */}
          <div className="space-y-3 mb-6">
            <h3 className="text-sm font-medium text-gray-400">选择算法模式</h3>
            {currentQuestion.options.map((option) => (
              <OptionButton
                key={option.patternId}
                option={option}
                selected={selectedAnswer === option.patternId}
                submitted={submitted}
                isCorrect={result?.correctAnswer === option.patternId}
                onClick={() => {
                  if (!submitted) setSelectedAnswer(option.patternId);
                }}
              />
            ))}
          </div>

          {/* 提交结果展示 */}
          {submitted && result && (
            <ResultBanner result={result} />
          )}

          {/* 操作按钮 */}
          <div className="flex justify-end gap-3 mt-4">
            {!submitted ? (
              <button
                onClick={submitAnswer}
                disabled={!selectedAnswer || loading}
                className="px-5 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-lg
                           hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed
                           transition-colors"
              >
                {loading ? '提交中...' : '提交'}
              </button>
            ) : (
              <button
                onClick={nextQuestion}
                className="px-5 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-lg
                           hover:bg-indigo-700 transition-colors"
              >
                {currentIndex + 1 >= quiz.questions.length ? '查看结果' : '下一题'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ===== 进度条组件 =====

function ProgressBar({ current, total }: { current: number; total: number }) {
  const percentage = (current / total) * 100;
  return (
    <div className="max-w-2xl w-full">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-gray-600">
          题目 {current}/{total}
        </span>
        <span className="text-xs text-gray-400">{Math.round(percentage)}%</span>
      </div>
      <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className="h-full bg-indigo-500 rounded-full transition-all duration-300"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

// ===== 选项按钮组件 =====

interface OptionButtonProps {
  option: QuizOption;
  selected: boolean;
  submitted: boolean;
  isCorrect: boolean;
  onClick: () => void;
}

function OptionButton({ option, selected, submitted, isCorrect, onClick }: OptionButtonProps) {
  const getStyle = () => {
    if (!submitted) {
      return selected
        ? 'border-indigo-500 bg-indigo-50 ring-2 ring-indigo-200'
        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50';
    }
    // 已提交后的样式
    if (isCorrect) {
      return 'border-green-500 bg-green-50 ring-2 ring-green-200';
    }
    if (selected && !isCorrect) {
      return 'border-red-500 bg-red-50 ring-2 ring-red-200';
    }
    return 'border-gray-200 opacity-50';
  };

  const getIcon = () => {
    if (!submitted) return null;
    if (isCorrect) return <span className="text-green-600 text-lg">✅</span>;
    if (selected && !isCorrect) return <span className="text-red-600 text-lg">❌</span>;
    return null;
  };

  return (
    <button
      onClick={onClick}
      disabled={submitted}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left
                  transition-all duration-200 disabled:cursor-default ${getStyle()}`}
    >
      <span className="flex-1 text-sm text-gray-800 font-medium">
        {option.patternName}
      </span>
      {getIcon()}
    </button>
  );
}

// ===== 结果提示横幅 =====

function ResultBanner({ result }: { result: QuizResult }) {
  return (
    <div
      className={`rounded-xl p-4 ${
        result.correct
          ? 'bg-green-50 border border-green-200'
          : 'bg-red-50 border border-red-200'
      }`}
    >
      <div className="flex items-center gap-2 mb-2">
        <span className="text-lg">{result.correct ? '🎉' : '💡'}</span>
        <span
          className={`text-sm font-semibold ${
            result.correct ? 'text-green-700' : 'text-red-700'
          }`}
        >
          {result.correct ? '回答正确！' : `正确答案：${result.correctPatternName}`}
        </span>
      </div>
      <p className="text-xs text-gray-600 leading-relaxed">{result.explanation}</p>
    </div>
  );
}

// ===== 训练完成统计视图 =====

interface CompletionViewProps {
  totalQuestions: number;
  correctCount: number;
  answers: { correct: boolean; patternName: string }[];
  stats: PatternStat[];
  onRestart: () => void;
}

function CompletionView({
  totalQuestions,
  correctCount,
  answers,
  stats,
  onRestart,
}: CompletionViewProps) {
  const accuracy = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;

  // 薄弱模式：正确率 < 60%
  const weakPatterns = stats.filter((s) => s.accuracy < 0.6);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center p-4 pt-8">
      <div className="max-w-2xl w-full space-y-6">
        {/* 总结卡片 */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 text-center">
          <div className="text-4xl mb-3">
            {accuracy >= 80 ? '🏆' : accuracy >= 60 ? '👍' : '💪'}
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-1">训练完成！</h2>
          <p className="text-gray-500 text-sm mb-4">以下是本次训练表现</p>

          {/* 统计数字 */}
          <div className="grid grid-cols-3 gap-4 mb-4">
            <StatCard label="总题数" value={`${totalQuestions}`} />
            <StatCard label="正确数" value={`${correctCount}`} color="text-green-600" />
            <StatCard label="正确率" value={`${accuracy}%`} color={accuracy >= 80 ? 'text-green-600' : accuracy >= 60 ? 'text-yellow-600' : 'text-red-600'} />
          </div>
        </div>

        {/* 每题回答记录 */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">答题记录</h3>
          <div className="grid grid-cols-5 gap-2">
            {answers.map((a, i) => (
              <div
                key={i}
                className={`flex items-center justify-center h-10 rounded-lg text-xs font-medium
                  ${a.correct
                    ? 'bg-green-50 text-green-700 border border-green-200'
                    : 'bg-red-50 text-red-700 border border-red-200'
                  }`}
                title={`第${i + 1}题：${a.patternName}`}
              >
                {a.correct ? '✓' : '✗'}
              </div>
            ))}
          </div>
        </div>

        {/* 各模式正确率 */}
        {stats.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">各模式正确率</h3>
            <div className="space-y-3">
              {stats.map((stat) => (
                <PatternAccuracyBar key={stat.patternId} stat={stat} />
              ))}
            </div>
          </div>
        )}

        {/* 薄弱模式提示 */}
        {weakPatterns.length > 0 && (
          <div className="bg-yellow-50 rounded-2xl border border-yellow-200 p-6">
            <h3 className="text-sm font-semibold text-yellow-800 mb-2">
              ⚠️ 需要加强的模式
            </h3>
            <div className="flex flex-wrap gap-2">
              {weakPatterns.map((wp) => (
                <span
                  key={wp.patternId}
                  className="px-3 py-1 bg-yellow-100 text-yellow-800 text-xs rounded-full
                             border border-yellow-300"
                >
                  {wp.patternName}（{Math.round(wp.accuracy * 100)}%）
                </span>
              ))}
            </div>
          </div>
        )}

        {/* 再来一次按钮 */}
        <div className="text-center pb-8">
          <button
            onClick={onRestart}
            className="px-6 py-3 bg-indigo-600 text-white font-medium rounded-lg
                       hover:bg-indigo-700 transition-colors text-sm"
          >
            再来一轮
          </button>
        </div>
      </div>
    </div>
  );
}

// ===== 统计数字卡片 =====

function StatCard({
  label,
  value,
  color = 'text-gray-900',
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div className="bg-gray-50 rounded-xl p-3">
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
      <div className="text-xs text-gray-500 mt-1">{label}</div>
    </div>
  );
}

// ===== 模式正确率柱状条 =====

function PatternAccuracyBar({ stat }: { stat: PatternStat }) {
  const percentage = Math.round(stat.accuracy * 100);
  const barColor =
    percentage >= 80 ? 'bg-green-500' : percentage >= 60 ? 'bg-yellow-500' : 'bg-red-500';

  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-gray-700 w-24 truncate" title={stat.patternName}>
        {stat.patternName}
      </span>
      <div className="flex-1 h-4 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${barColor}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <span className="text-xs text-gray-500 w-12 text-right">
        {percentage}%
      </span>
      <span className="text-xs text-gray-400 w-16 text-right">
        {stat.correctCount}/{stat.totalAttempts}
      </span>
    </div>
  );
}
