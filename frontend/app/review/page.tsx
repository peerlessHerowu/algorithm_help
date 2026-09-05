'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useAppStore } from '@/store';
import { reviewApi } from '@/lib/api';
import dynamic from 'next/dynamic';

const ActivityHeatmap = dynamic(() => import('@/components/heatmap/ActivityHeatmap'), { ssr: false });

// ===== 类型 =====
interface Card {
  id: string;
  problemId: string;
  cardType: string;
  easeFactor: number;
  interval: number;
  repetitions: number;
  nextReviewAt: number;
  lastReviewAt?: number;
  metadata?: string;
}

interface Stats {
  todayDue: number;
  total: number;
  mastered: number;
  masteryRate: number;
}

// ===== SM-2 评分配置（0-5 完整范围）=====
const QUALITY_CONFIG = [
  { q: 0, label: '完全忘了', emoji: '💀', next: '明天', color: '#EF4444', bg: 'bg-red-900/40',     border: 'border-red-700/60' },
  { q: 1, label: '很模糊',   emoji: '😟', next: '明天', color: '#F97316', bg: 'bg-orange-900/40', border: 'border-orange-700/60' },
  { q: 2, label: '想起来了', emoji: '😐', next: '明天', color: '#F59E0B', bg: 'bg-amber-900/40',  border: 'border-amber-700/60' },
  { q: 3, label: '模糊',     emoji: '🤔', next: '3天',  color: '#EAB308', bg: 'bg-yellow-900/40', border: 'border-yellow-700/60' },
  { q: 4, label: '记得',     emoji: '😊', next: '7天',  color: '#22C55E', bg: 'bg-emerald-900/40',border: 'border-emerald-600/60' },
  { q: 5, label: '秒杀',     emoji: '🚀', next: '14天', color: '#6366F1', bg: 'bg-indigo-900/40', border: 'border-indigo-700/60' },
];

// 卡片类型对应标签
const CARD_TYPE_LABEL: Record<string, string> = {
  EXPLAIN:          '📖 口述解题',
  PATTERN_QUIZ:     '🧩 模式识别',
  COMPLETE_CODE:    '💻 补全代码',
  GUESS_ALGO:       '🔍 猜算法',
  DIAGRAM_GUESS:    '📊 看图猜算法',
  CODE_REVIEW:      '🐛 代码审查',
  VARIANT:          '🔀 变体题',
  COMPLEXITY_GUESS: '⚡ 估复杂度',
};

function guestId() {
  if (typeof window === 'undefined') return 'guest';
  let id = localStorage.getItem('review-guest-id');
  if (!id) { id = `guest-${Date.now()}`; localStorage.setItem('review-guest-id', id); }
  return id;
}

// ===== 翻卡组件 =====
function FlipCard({ card, onRecord }: {
  card: Card;
  onRecord: (quality: number) => Promise<void>;
}) {
  const [flipped, setFlipped] = useState(false);
  const [recording, setRecording] = useState(false);
  const [selectedQ, setSelectedQ] = useState<number | null>(null);

  const typeLabel = CARD_TYPE_LABEL[card.cardType] ?? card.cardType;
  const daysUntilDue = card.interval > 0 ? card.interval : 0;
  const reps = card.repetitions ?? 0;

  const handleRecord = async (q: number) => {
    setSelectedQ(q);
    setRecording(true);
    await onRecord(q);
    setFlipped(false);
    setSelectedQ(null);
    setRecording(false);
  };

  return (
    <div className="max-w-lg mx-auto">
      {/* 卡片主体 */}
      <div className={`rounded-2xl border-2 transition-all duration-300 overflow-hidden
        ${flipped ? 'border-indigo-600/60' : 'border-gray-800 cursor-pointer hover:border-gray-600'}`}
        onClick={() => !flipped && setFlipped(true)}>

        {/* 正面 */}
        {!flipped ? (
          <div className="bg-[#141820] p-8 min-h-52 flex flex-col items-center justify-center gap-4 text-center">
            <span className="text-xs px-2.5 py-1 rounded-full bg-gray-800 border border-gray-700 text-gray-400">
              {typeLabel}
            </span>
            <h3 className="text-xl font-bold text-gray-100">{card.problemId}</h3>
            <p className="text-sm text-gray-500">
              {card.cardType === 'EXPLAIN'    ? '口述这道题的解题思路' :
               card.cardType === 'DIAGRAM_GUESS' ? '根据执行步骤猜测算法' :
               card.cardType === 'CODE_REVIEW'   ? '找出代码中的问题' :
               '回忆算法模式和解法'}
            </p>
            <div className="flex items-center gap-2 mt-2 text-xs text-gray-600">
              <span>EF: {card.easeFactor?.toFixed(2) ?? '2.50'}</span>
              <span>·</span>
              <span>{reps} 次复习</span>
              {daysUntilDue > 0 && <><span>·</span><span>间隔 {daysUntilDue}d</span></>}
            </div>
            <p className="text-[10px] text-gray-700 mt-1">点击翻转 ↓</p>
          </div>
        ) : (
          <div className="bg-[#141820]">
            {/* 反面头部 */}
            <div className="px-6 pt-5 pb-3 border-b border-gray-800">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs text-indigo-400 font-medium">{typeLabel}</span>
                <span className="text-xs text-gray-600">·</span>
                <Link href={`/problems/${card.problemId}`}
                  className="text-xs text-indigo-400 hover:text-indigo-300 underline"
                  onClick={e => e.stopPropagation()}>
                  查看题目
                </Link>
              </div>
              <h3 className="text-lg font-bold text-gray-100">{card.problemId}</h3>
            </div>

            {/* SM-2 评分区 */}
            <div className="px-6 py-5">
              <p className="text-xs text-gray-500 mb-3">按记忆程度评分（影响下次复习间隔）：</p>
              <div className="grid grid-cols-3 gap-2 mb-3">
                {QUALITY_CONFIG.slice(0, 3).map(({ q, label, emoji, next, bg, border }) => (
                  <button key={q} onClick={() => handleRecord(q)}
                    disabled={recording}
                    className={`rounded-xl border py-3 px-2 text-center transition-all
                      hover:opacity-90 disabled:opacity-40
                      ${selectedQ === q ? 'ring-2 ring-white/30 scale-95' : ''}
                      ${bg} ${border}`}>
                    <div className="text-xl mb-1">{emoji}</div>
                    <div className="text-xs font-medium text-gray-200">{label}</div>
                    <div className="text-[10px] text-gray-500 mt-0.5">{next}后</div>
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-3 gap-2">
                {QUALITY_CONFIG.slice(3).map(({ q, label, emoji, next, bg, border }) => (
                  <button key={q} onClick={() => handleRecord(q)}
                    disabled={recording}
                    className={`rounded-xl border py-3 px-2 text-center transition-all
                      hover:opacity-90 disabled:opacity-40
                      ${selectedQ === q ? 'ring-2 ring-white/30 scale-95' : ''}
                      ${bg} ${border}`}>
                    <div className="text-xl mb-1">{emoji}</div>
                    <div className="text-xs font-medium text-gray-200">{label}</div>
                    <div className="text-[10px] text-gray-500 mt-0.5">{next}后</div>
                  </button>
                ))}
              </div>
              {recording && (
                <div className="text-center mt-3">
                  <span className="text-xs text-gray-500">更新间隔中...</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ===== SM-2 说明面板 =====
function SM2Guide() {
  return (
    <div className="rounded-2xl border border-indigo-900/50 bg-indigo-900/10 p-4 space-y-2">
      <p className="text-xs font-medium text-indigo-300">📚 SM-2 间隔复习原理</p>
      <ul className="space-y-1 text-[10px] text-gray-500">
        <li>• 评分 0-2：明天再复习（重置间隔）</li>
        <li>• 评分 3-5：间隔递增（3天→7天→14天...）</li>
        <li>• 评分越高，EF（难易因子）越大，间隔越长</li>
        <li>• EF 范围 1.3-2.5，影响间隔增长速度</li>
      </ul>
    </div>
  );
}

// ===== 主页面 =====
export default function ReviewPage() {
  const { user } = useAppStore();
  const uid = user?.id ?? guestId();

  const [cards, setCards]         = useState<Card[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [stats, setStats]         = useState<Stats | null>(null);
  const [loading, setLoading]     = useState(true);
  const [completed, setCompleted] = useState(0);
  const [activeTab, setActiveTab] = useState<'flip' | 'all'>('flip');

  useEffect(() => {
    Promise.all([
      reviewApi.today(uid),
      reviewApi.stats(uid),
    ]).then(([todayCards, reviewStats]) => {
      setCards(Array.isArray(todayCards) ? todayCards as Card[] : []);
      setStats(reviewStats as Stats);
    }).catch(() => { setCards([]); })
    .finally(() => setLoading(false));
  }, [uid]);

  const handleRecord = useCallback(async (quality: number) => {
    const card = cards[currentIdx];
    if (!card) return;
    await reviewApi.record(card.id, quality).catch(() => {});
    setCompleted(c => c + 1);
    setCurrentIdx(i => i + 1);
  }, [cards, currentIdx]);

  const currentCard = cards[currentIdx];
  const allDone     = !loading && currentIdx >= cards.length && cards.length > 0;
  const noCards     = !loading && cards.length === 0;
  const progressPct = cards.length > 0 ? (currentIdx / cards.length) * 100 : 0;

  return (
    <div className="min-h-screen bg-[#0F1117]">
      <div className="mx-auto max-w-4xl px-4 py-6">
        {/* 标题 */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <span className="text-2xl">📅</span>
            <div>
              <h1 className="text-lg font-bold text-gray-100">复习中心</h1>
              <p className="text-xs text-gray-500">SM-2 间隔重复算法</p>
            </div>
          </div>
          {stats && (
            <div className="flex items-center gap-4 text-xs text-gray-500">
              <span>总卡片 <span className="text-gray-200 font-bold">{stats.total}</span></span>
              <span>掌握率 <span className="text-emerald-400 font-bold">{Math.round(stats.masteryRate)}%</span></span>
            </div>
          )}
        </div>

        {/* 统计格 */}
        {stats && (
          <div className="grid grid-cols-4 gap-3 mb-6">
            {[
              { label: '今日待复习', value: stats.todayDue, color: 'text-amber-400' },
              { label: '今日已完成', value: completed,       color: 'text-emerald-400' },
              { label: '总卡片数',   value: stats.total,     color: 'text-indigo-400' },
              { label: '已掌握',     value: stats.mastered,  color: 'text-purple-400' },
            ].map(({ label, value, color }) => (
              <div key={label} className="rounded-2xl border border-gray-800 bg-[#141820] p-3 text-center">
                <div className={`text-2xl font-bold tabular-nums ${color}`}>{value}</div>
                <div className="text-[10px] text-gray-600 mt-0.5">{label}</div>
              </div>
            ))}
          </div>
        )}

        {/* 学习热力图 */}
        <div className="rounded-2xl border border-gray-800 bg-[#141820] p-4 mb-5">
          <p className="text-xs font-medium text-gray-400 mb-3">📅 学习活跃热力图</p>
          <ActivityHeatmap userId={uid} />
        </div>

        {/* Tab */}
        <div className="flex gap-2 mb-5">          {([['flip', '🃏 翻卡复习'], ['all', '📋 所有卡片']] as const).map(([t, l]) => (
            <button key={t} onClick={() => setActiveTab(t)}
              className={`px-4 py-2 text-sm rounded-xl transition-all font-medium
                ${activeTab === t
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-800/60 text-gray-400 hover:text-gray-300'
                }`}>
              {l}
            </button>
          ))}
        </div>

        {/* 加载中 */}
        {loading && (
          <div className="flex h-48 items-center justify-center">
            <div className="w-8 h-8 rounded-full border-2 border-indigo-700 border-t-indigo-400 animate-spin" />
          </div>
        )}

        {/* 翻卡复习 Tab */}
        {!loading && activeTab === 'flip' && (
          <>
            {noCards && (
              <div className="flex flex-col items-center gap-4 py-16 text-center">
                <div className="text-5xl">✨</div>
                <h2 className="text-lg font-bold text-gray-200">今日无待复习卡片</h2>
                <p className="text-sm text-gray-500">刷完题后，AI 会自动将题目加入复习计划</p>
                <Link href="/problems"
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-all">
                  去刷题
                </Link>
              </div>
            )}

            {allDone && (
              <div className="flex flex-col items-center gap-5 py-12 text-center">
                <div className="text-6xl">🎉</div>
                <h2 className="text-xl font-bold text-gray-100">今日复习完成！</h2>
                <p className="text-gray-400 text-sm">共复习 {completed} 张卡片，继续保持！</p>
                <div className="grid grid-cols-3 gap-3 w-full max-w-xs">
                  {[
                    { label: '已复习', value: completed,    color: 'text-emerald-400' },
                    { label: '待明日', value: cards.length - completed, color: 'text-amber-400' },
                    { label: '总计',   value: cards.length, color: 'text-indigo-400' },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="rounded-xl bg-gray-800/60 border border-gray-700 p-3 text-center">
                      <div className={`text-xl font-bold ${color}`}>{value}</div>
                      <div className="text-[10px] text-gray-600">{label}</div>
                    </div>
                  ))}
                </div>
                <div className="flex gap-3">
                  <button onClick={() => { setCurrentIdx(0); setCompleted(0); }}
                    className="px-5 py-2 rounded-xl border border-gray-700 text-gray-300 text-sm hover:border-gray-600">
                    再复习一遍
                  </button>
                  <Link href="/problems"
                    className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium">
                    去刷题
                  </Link>
                </div>
              </div>
            )}

            {!noCards && !allDone && currentCard && (
              <div className="space-y-5">
                {/* 进度条 */}
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-500 tabular-nums shrink-0">
                    {currentIdx + 1}/{cards.length}
                  </span>
                  <div className="flex-1 h-2 rounded-full bg-gray-800 overflow-hidden">
                    <div className="h-2 rounded-full bg-indigo-500 transition-all duration-500"
                      style={{ width: `${progressPct}%` }} />
                  </div>
                  <span className="text-xs text-gray-600 tabular-nums shrink-0">
                    {Math.round(progressPct)}%
                  </span>
                </div>

                <FlipCard card={currentCard} onRecord={handleRecord} />
                <SM2Guide />
              </div>
            )}
          </>
        )}

        {/* 所有卡片 Tab */}
        {!loading && activeTab === 'all' && (
          <AllCardsPanel uid={uid} />
        )}
      </div>
    </div>
  );
}

// ===== 所有卡片面板 =====
function AllCardsPanel({ uid }: { uid: string }) {
  const [cards, setCards]     = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    reviewApi.cards(uid).then((data: unknown) => {
      setCards(Array.isArray(data) ? data as Card[] : []);
    }).catch(() => setCards([])).finally(() => setLoading(false));
  }, [uid]);

  if (loading) return (
    <div className="flex h-32 items-center justify-center">
      <div className="w-6 h-6 rounded-full border-2 border-indigo-700 border-t-indigo-400 animate-spin" />
    </div>
  );

  if (cards.length === 0) return (
    <div className="text-center py-12 space-y-2">
      <div className="text-3xl">📭</div>
      <p className="text-gray-400">暂无复习卡片</p>
      <p className="text-xs text-gray-600">完成互动学习后会自动创建</p>
    </div>
  );

  const now = Date.now();
  const overdue = cards.filter(c => c.nextReviewAt && c.nextReviewAt <= now);
  const upcoming = cards.filter(c => c.nextReviewAt && c.nextReviewAt > now);

  return (
    <div className="space-y-5">
      {overdue.length > 0 && (
        <div>
          <p className="text-xs font-medium text-amber-400 mb-2">⏰ 待复习（{overdue.length}）</p>
          <CardList cards={overdue} />
        </div>
      )}
      {upcoming.length > 0 && (
        <div>
          <p className="text-xs font-medium text-gray-400 mb-2">📅 即将到期（{upcoming.length}）</p>
          <CardList cards={upcoming} />
        </div>
      )}
    </div>
  );
}

function CardList({ cards }: { cards: Card[] }) {
  return (
    <div className="space-y-2">
      {cards.slice(0, 20).map(c => {
        const daysLeft = c.nextReviewAt
          ? Math.ceil((c.nextReviewAt - Date.now()) / 86400000)
          : 0;
        return (
          <div key={c.id}
            className="flex items-center gap-3 rounded-xl border border-gray-800 bg-[#141820] px-4 py-3">
            <span className="text-xs text-gray-500 w-6 shrink-0">{CARD_TYPE_LABEL[c.cardType]?.split(' ')[0] ?? '📋'}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-200 truncate">{c.problemId}</p>
              <p className="text-[10px] text-gray-600">
                EF {c.easeFactor?.toFixed(2)} · {c.repetitions}次 · 间隔{c.interval}d
              </p>
            </div>
            <span className="text-xs tabular-nums shrink-0"
              style={{ color: daysLeft <= 0 ? '#F59E0B' : '#6B7280' }}>
              {daysLeft <= 0 ? '待复习' : `${daysLeft}d后`}
            </span>
          </div>
        );
      })}
    </div>
  );
}
