'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/store';
import { reviewApi, analyticsApi } from '@/lib/api';

type ReviewMode = 'flip'|'pattern-quiz'|'complexity';

interface Card {
  id: string; problemId: string; problemTitle: string;
  difficulty: 'EASY'|'MEDIUM'|'HARD'; cardType: string;
  intervalDays: number; easeFactor: number; nextReviewAt: number;
}

const QUALITY_BUTTONS = [
  { quality: 1, label: '😟 忘了', desc: '明天复习', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 border-red-200 dark:border-red-800' },
  { quality: 3, label: '🤔 模糊', desc: '3天后', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300 border-orange-200 dark:border-orange-800' },
  { quality: 4, label: '😊 记得', desc: '7天后', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 border-green-200 dark:border-green-800' },
  { quality: 5, label: '🚀 秒杀', desc: '14天后', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border-blue-200 dark:border-blue-800' },
];

const DIFF_COLORS: Record<string, string> = {
  EASY: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  MEDIUM: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  HARD: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

// ============ 翻卡复习 ============
function FlipCard({ card, onRecord }: { card: Card; onRecord: (quality: number) => void }) {
  const [flipped, setFlipped] = useState(false);
  const [recording, setRecording] = useState(false);

  const handleRecord = async (quality: number) => {
    setRecording(true);
    await onRecord(quality);
    setFlipped(false);
    setRecording(false);
  };

  return (
    <div className="mx-auto max-w-lg">
      {/* 卡片 */}
      <div onClick={() => !flipped && setFlipped(true)} className="cursor-pointer">
        <div className={`relative rounded-2xl border-2 transition-all duration-500 ${
          flipped ? 'border-green-300 dark:border-green-700' : 'border-gray-200 dark:border-gray-700'
        } bg-white dark:bg-gray-900 shadow-lg`}>
          {/* 正面 */}
          {!flipped && (
            <div className="p-8 text-center min-h-48 flex flex-col items-center justify-center">
              <span className={`mb-3 rounded-full px-2 py-0.5 text-xs font-medium ${DIFF_COLORS[card.difficulty]}`}>
                {card.difficulty}
              </span>
              <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-2">{card.problemTitle}</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {card.cardType === 'EXPLAIN' ? '口述解题思路' : '回忆算法模式'}
              </p>
              <p className="mt-4 text-xs text-gray-400">点击翻转查看答案</p>
            </div>
          )}
          {/* 反面 */}
          {flipped && (
            <div className="p-6">
              <div className="mb-3 text-xs text-green-600 dark:text-green-400 font-medium">✓ 回想起来了？</div>
              <div className="rounded-lg bg-gray-50 dark:bg-gray-800 p-4 text-sm text-gray-700 dark:text-gray-300">
                <p className="font-medium mb-2">{card.problemTitle}</p>
                <p className="text-gray-500 dark:text-gray-400 text-xs">上次间隔：{card.intervalDays} 天 | 容易度：{card.easeFactor?.toFixed(1)}</p>
              </div>
              <div className="mt-4 grid grid-cols-4 gap-2">
                {QUALITY_BUTTONS.map(({ quality, label, desc, color }) => (
                  <button key={quality} onClick={() => handleRecord(quality)} disabled={recording}
                    className={`rounded-xl border px-2 py-3 text-center transition-colors hover:opacity-80 disabled:opacity-50 ${color}`}>
                    <div className="text-sm font-medium">{label}</div>
                    <div className="mt-0.5 text-xs opacity-70">{desc}</div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============ 主页面 ============
export default function ReviewPage() {
  const router = useRouter();
  const { user, isAuthenticated } = useAppStore();

  const [mode, setMode] = useState<ReviewMode>('flip');
  const [cards, setCards] = useState<Card[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [stats, setStats] = useState<any>(null);
  const [plan, setPlan] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [completed, setCompleted] = useState(0);

  useEffect(() => {
    if (!user?.id) return;
    Promise.all([
      reviewApi.today(user.id),
      reviewApi.stats(user.id),
      analyticsApi.dailyPlan(user.id),
    ]).then(([todayCards, reviewStats, dailyPlan]: any[]) => {
      setCards(Array.isArray(todayCards) ? todayCards : []);
      setStats(reviewStats);
      setPlan(dailyPlan);
    }).catch(() => {
      setCards([]);
    }).finally(() => setLoading(false));
  }, [user]);

  const handleRecord = useCallback(async (quality: number) => {
    const card = cards[currentIdx];
    if (!card) return;
    await reviewApi.record(card.id, quality).catch(() => {});
    setCompleted(c => c + 1);
    if (currentIdx < cards.length - 1) {
      setCurrentIdx(i => i + 1);
    } else {
      setCurrentIdx(cards.length); // 完成标记
    }
  }, [cards, currentIdx]);

  if (!isAuthenticated) return (
    <div className="flex h-[60vh] flex-col items-center justify-center gap-4">
      <p className="text-gray-500">复习中心需要登录</p>
      <button onClick={() => router.push('/auth/login')} className="rounded-lg bg-blue-600 px-6 py-2 text-sm text-white">去登录</button>
    </div>
  );

  const currentCard = cards[currentIdx];
  const allDone = currentIdx >= cards.length && cards.length > 0;

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <h1 className="mb-4 text-xl font-bold text-gray-800 dark:text-gray-100">📅 复习中心</h1>

      {/* 今日计划卡片 */}
      {plan && (
        <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-900/10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-blue-600 dark:text-blue-400 text-lg">📅</span>
              <div>
                <p className="text-sm font-medium text-blue-800 dark:text-blue-300">今日学习计划</p>
                <p className="text-xs text-blue-600 dark:text-blue-400">{plan.recommendation}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{plan.reviewCardCount || 0}</p>
              <p className="text-xs text-blue-500 dark:text-blue-500">待复习</p>
            </div>
          </div>
        </div>
      )}

      {/* 统计格子 */}
      {stats && (
        <div className="mb-4 grid grid-cols-4 gap-3">
          {[
            { label: '今日待复习', val: stats.todayDue, color: 'text-orange-600' },
            { label: '已完成今日', val: completed, color: 'text-green-600' },
            { label: '总卡片', val: stats.total, color: 'text-blue-600' },
            { label: '已掌握', val: stats.mastered, color: 'text-purple-600' },
          ].map(({ label, val, color }) => (
            <div key={label} className="rounded-xl border border-gray-200 bg-white p-3 text-center dark:border-gray-700 dark:bg-gray-900">
              <div className={`text-2xl font-bold ${color}`}>{val}</div>
              <div className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{label}</div>
            </div>
          ))}
        </div>
      )}

      {/* 复习方式 Tab */}
      <div className="mb-4 flex gap-2 overflow-x-auto">
        {([
          ['flip', '🃏 翻卡复习'],
          ['pattern-quiz', '🧩 模式识别'],
          ['complexity', '⚡ 复杂度训练'],
        ] as const).map(([m, label]) => (
          <button key={m} onClick={() => setMode(m)}
            className={`shrink-0 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              mode === m ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400'
            }`}>
            {label}
          </button>
        ))}
      </div>

      {/* 主内容区 */}
      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
        </div>
      ) : mode === 'flip' && (
        <>
          {allDone ? (
            <div className="flex flex-col items-center gap-4 py-12 text-center">
              <div className="text-5xl">🎉</div>
              <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">今日复习完成！</h2>
              <p className="text-gray-500 dark:text-gray-400">共复习 {completed} 张卡片，继续保持！</p>
              <div className="flex gap-3 mt-2">
                <button onClick={() => { setCurrentIdx(0); setCompleted(0); }}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
                  再复习一遍
                </button>
                <button onClick={() => router.push('/problems')}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-800">
                  去刷题
                </button>
              </div>
            </div>
          ) : cards.length === 0 ? (
            <div className="flex flex-col items-center gap-4 py-12 text-center">
              <div className="text-5xl">✨</div>
              <h2 className="text-lg font-bold text-gray-700 dark:text-gray-300">今日无待复习卡片</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">继续刷题，学完的题目会自动加入复习计划</p>
              <button onClick={() => router.push('/problems')}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
                去刷题
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* 进度 */}
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-500 dark:text-gray-400">{currentIdx + 1} / {cards.length}</span>
                <div className="flex-1 h-2 rounded-full bg-gray-100 dark:bg-gray-700">
                  <div className="h-2 rounded-full bg-blue-500 transition-all"
                    style={{ width: `${(currentIdx/cards.length)*100}%` }} />
                </div>
              </div>
              <FlipCard card={currentCard} onRecord={handleRecord} />
            </div>
          )}
        </>
      )}

      {mode === 'pattern-quiz' && (
        <div className="flex flex-col items-center gap-4 py-12 text-center rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-700">
          <div className="text-4xl">🧩</div>
          <h3 className="font-medium text-gray-700 dark:text-gray-300">模式识别训练</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">根据 Mermaid 图或题目描述，猜测算法模式</p>
          <button onClick={() => router.push('/training')}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700">
            前往训练页面
          </button>
        </div>
      )}

      {mode === 'complexity' && (
        <div className="flex flex-col items-center gap-4 py-12 text-center rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-700">
          <div className="text-4xl">⚡</div>
          <h3 className="font-medium text-gray-700 dark:text-gray-300">复杂度直觉训练</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">看数据范围猜算法 / 看代码估复杂度</p>
          <button onClick={() => router.push('/training?mode=complexity')}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700">
            开始训练
          </button>
        </div>
      )}
    </div>
  );
}
