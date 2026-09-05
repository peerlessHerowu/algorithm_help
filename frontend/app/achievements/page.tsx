'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAppStore } from '@/store';
import { fetcher } from '@/lib/fetcher';
import useSWR from 'swr';

// ===== 类型 =====
interface AchievementDef {
  type: string;
  displayName: string;
  description: string;
  unlockCondition: string;
  unlockRate: number;
  unlockedCount: number;
}

interface UserAchievement {
  id: string;
  userId: string;
  type: string;
  unlockedAt: number;
}

// ===== 成就分类 =====
const CATEGORY_CONFIG: { label: string; icon: string; types: string[] }[] = [
  {
    label: '入门成就', icon: '🌱',
    types: ['FIRST_PROBLEM', 'PATTERN_MASTER'],
  },
  {
    label: '坚持系列', icon: '🔥',
    types: ['STREAK_7', 'STREAK_30', 'STREAK_100', 'STREAK_365'],
  },
  {
    label: '费曼学习', icon: '🧠',
    types: ['FEYNMAN_SCHOLAR_5', 'FEYNMAN_SCHOLAR_20', 'FEYNMAN_SCHOLAR_50', 'FEYNMAN_SCHOLAR_100'],
  },
  {
    label: '专项成就', icon: '⚡',
    types: ['INTERVIEW_PRO', 'BUG_HUNTER', 'SPEED_DEMON', 'COMPLEXITY_MASTER'],
  },
];

// 成就 emoji 映射
const ACHIEVEMENT_EMOJI: Record<string, string> = {
  FIRST_PROBLEM:        '🎯',
  PATTERN_MASTER:       '🧩',
  STREAK_7:             '🔥',
  STREAK_30:            '💪',
  STREAK_100:           '🏆',
  STREAK_365:           '👑',
  FEYNMAN_SCHOLAR_5:    '📚',
  FEYNMAN_SCHOLAR_20:   '🎓',
  FEYNMAN_SCHOLAR_50:   '🌟',
  FEYNMAN_SCHOLAR_100:  '✨',
  INTERVIEW_PRO:        '💼',
  BUG_HUNTER:           '🐛',
  SPEED_DEMON:          '⚡',
  COMPLEXITY_MASTER:    '📊',
};

function guestId() {
  if (typeof window === 'undefined') return 'guest';
  let id = localStorage.getItem('ach-guest-id');
  if (!id) { id = `guest-${Date.now()}`; localStorage.setItem('ach-guest-id', id); }
  return id;
}

// ===== 解锁弹窗动效 =====
function UnlockModal({ achievement, onClose }: {
  achievement: AchievementDef | null;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!achievement) return;
    const t = setTimeout(onClose, 4000);
    return () => clearTimeout(t);
  }, [achievement, onClose]);

  if (!achievement) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
      {/* 背景遮罩 */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm pointer-events-auto"
        onClick={onClose} />

      {/* 弹窗 */}
      <div className="relative z-10 pointer-events-auto
        bg-gradient-to-br from-amber-900/90 to-yellow-900/90
        border border-amber-500/50 rounded-3xl p-8 text-center
        shadow-2xl shadow-amber-900/50 max-w-sm w-full mx-4
        animate-bounce-in">
        {/* 粒子效果（CSS 实现） */}
        <div className="absolute -top-4 left-1/2 -translate-x-1/2 text-4xl animate-ping opacity-75">✨</div>

        <div className="text-7xl mb-4 animate-bounce-slow">
          {ACHIEVEMENT_EMOJI[achievement.type] ?? '🏆'}
        </div>
        <div className="text-xs uppercase tracking-widest text-amber-300 mb-1 font-medium">
          成就解锁！
        </div>
        <h2 className="text-2xl font-black text-white mb-2">{achievement.displayName}</h2>
        <p className="text-sm text-amber-200/80 leading-relaxed mb-4">{achievement.description}</p>
        <div className="text-xs text-amber-300/60">
          全球 {(achievement.unlockRate * 100).toFixed(1)}% 的用户达成此成就
        </div>
        <button onClick={onClose}
          className="mt-4 px-5 py-2 rounded-xl bg-amber-600/40 border border-amber-500/50
            text-amber-200 text-sm hover:bg-amber-600/60 transition-colors">
          继续学习
        </button>
      </div>
    </div>
  );
}

// ===== 成就卡片 =====
function AchievementCard({ def, unlocked, unlockedAt }: {
  def: AchievementDef;
  unlocked: boolean;
  unlockedAt?: number;
}) {
  const emoji = ACHIEVEMENT_EMOJI[def.type] ?? '🏆';
  const ratePercent = (def.unlockRate * 100).toFixed(1);

  return (
    <div className={`rounded-2xl border p-4 transition-all duration-200 group
      ${unlocked
        ? 'border-amber-700/60 bg-gradient-to-br from-amber-900/20 to-yellow-900/15 hover:border-amber-500/80'
        : 'border-gray-800/60 bg-gray-900/20 hover:border-gray-700/60'
      }`}>
      {/* 成就图标 */}
      <div className={`text-4xl mb-3 transition-all
        ${unlocked ? '' : 'grayscale opacity-30'}`}>
        {emoji}
      </div>

      {/* 成就名 */}
      <h3 className={`text-sm font-semibold mb-1 ${unlocked ? 'text-amber-200' : 'text-gray-500'}`}>
        {def.displayName}
      </h3>

      {/* 描述 */}
      <p className={`text-xs leading-relaxed mb-3 ${unlocked ? 'text-gray-400' : 'text-gray-700'}`}>
        {def.description}
      </p>

      {/* 解锁条件 */}
      <div className={`text-[10px] px-2 py-1 rounded-lg
        ${unlocked
          ? 'bg-amber-900/30 border border-amber-800/40 text-amber-400'
          : 'bg-gray-800/40 border border-gray-700/40 text-gray-600'
        }`}>
        {def.unlockCondition}
      </div>

      {/* 解锁时间 / 全球解锁率 */}
      <div className="mt-3 flex items-center justify-between text-[10px]">
        {unlocked && unlockedAt ? (
          <span className="text-emerald-400">
            ✓ {new Date(unlockedAt).toLocaleDateString('zh-CN')} 解锁
          </span>
        ) : (
          <span className="text-gray-700">未解锁</span>
        )}
        <span className="text-gray-600">{ratePercent}% 达成</span>
      </div>

      {/* 稀有度进度条 */}
      <div className="mt-2 h-1 w-full rounded-full bg-gray-800/60 overflow-hidden">
        <div className={`h-1 rounded-full transition-all duration-700
          ${unlocked ? 'bg-amber-400' : 'bg-gray-700'}`}
          style={{ width: `${Math.max(5, def.unlockRate * 100)}%` }} />
      </div>
    </div>
  );
}

// ===== 主页面 =====
export default function AchievementsPage() {
  const { user } = useAppStore();
  const uid = user?.id ?? guestId();

  const [unlockModal, setUnlockModal] = useState<AchievementDef | null>(null);
  const [checking, setChecking] = useState(false);
  const [activeCategory, setActiveCategory] = useState('all');

  // 成就定义
  const { data: defs } = useSWR<AchievementDef[]>(
    '/api/v1/achievements/definitions',
    fetcher
  );

  // 用户已解锁
  const { data: unlocked, mutate: mutateUnlocked } = useSWR<UserAchievement[]>(
    uid ? `/api/v1/achievements/me?userId=${encodeURIComponent(uid)}` : null,
    fetcher
  );

  const unlockedSet = new Set(unlocked?.map(a => a.type) ?? []);
  const unlockedMap = new Map(unlocked?.map(a => [a.type, a.unlockedAt]) ?? []);

  // 触发成就检查
  const handleCheck = useCallback(async () => {
    setChecking(true);
    try {
      const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8080';
      const res = await fetch(`${API_BASE}/api/v1/achievements/check?userId=${encodeURIComponent(uid)}`, {
        method: 'POST',
      });
      const json = await res.json();
      const newCount = json?.data?.newlyUnlocked ?? 0;
      if (newCount > 0) {
        await mutateUnlocked();
        // 找到新解锁的成就并弹出
        const newTypes = (await (await fetch(`${API_BASE}/api/v1/achievements/me?userId=${encodeURIComponent(uid)}`)).json())
          ?.data as UserAchievement[] ?? [];
        const newest = newTypes.sort((a, b) => (b.unlockedAt ?? 0) - (a.unlockedAt ?? 0))[0];
        if (newest && defs) {
          const def = defs.find(d => d.type === newest.type);
          if (def) setUnlockModal(def);
        }
      }
    } catch { /* 忽略 */ }
    finally { setChecking(false); }
  }, [uid, mutateUnlocked, defs]);

  // 过滤后的成就定义
  const filteredDefs = defs?.filter(d => {
    if (activeCategory === 'all') return true;
    if (activeCategory === 'unlocked') return unlockedSet.has(d.type);
    if (activeCategory === 'locked') return !unlockedSet.has(d.type);
    const cat = CATEGORY_CONFIG.find(c => c.label === activeCategory);
    return cat ? cat.types.includes(d.type) : true;
  }) ?? [];

  const totalCount   = defs?.length ?? 0;
  const unlockedCount = unlockedSet.size;
  const progressPct  = totalCount > 0 ? (unlockedCount / totalCount) * 100 : 0;

  return (
    <div className="min-h-screen bg-[#0F1117]">
      <div className="mx-auto max-w-4xl px-4 py-6">
        {/* 标题栏 */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🏆</span>
            <div>
              <h1 className="text-lg font-bold text-gray-100">成就系统</h1>
              <p className="text-xs text-gray-500">解锁成就见证你的学习之旅</p>
            </div>
          </div>
          <button
            onClick={handleCheck}
            disabled={checking}
            className="flex items-center gap-1.5 px-4 py-2 text-xs rounded-xl
              bg-amber-700/40 border border-amber-600/50 text-amber-300
              hover:bg-amber-700/60 transition-all disabled:opacity-50"
          >
            {checking ? (
              <><span className="w-3 h-3 rounded-full border border-amber-300/40 border-t-amber-300 animate-spin" />检查中...</>
            ) : '🔍 检查新成就'}
          </button>
        </div>

        {/* 总进度 */}
        <div className="rounded-2xl border border-gray-800 bg-[#141820] p-5 mb-6">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-gray-300">总体进度</span>
            <span className="text-sm font-bold tabular-nums text-amber-400">
              {unlockedCount} / {totalCount}
            </span>
          </div>
          <div className="h-3 w-full rounded-full bg-gray-800 overflow-hidden">
            <div
              className="h-3 rounded-full bg-gradient-to-r from-amber-600 to-yellow-400 transition-all duration-700"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <div className="flex justify-between mt-2 text-[10px] text-gray-600">
            <span>已解锁 {Math.round(progressPct)}%</span>
            <span>{totalCount - unlockedCount} 个待解锁</span>
          </div>
        </div>

        {/* 分类 Tab */}
        <div className="flex gap-2 flex-wrap mb-5">
          {[
            { key: 'all',      label: '全部' },
            { key: 'unlocked', label: '✓ 已解锁' },
            { key: 'locked',   label: '🔒 未解锁' },
            ...CATEGORY_CONFIG.map(c => ({ key: c.label, label: `${c.icon} ${c.label}` })),
          ].map(({ key, label }) => (
            <button key={key} onClick={() => setActiveCategory(key)}
              className={`px-3 py-1.5 text-xs rounded-xl border transition-all font-medium
                ${activeCategory === key
                  ? 'bg-amber-700/40 border-amber-600/60 text-amber-300'
                  : 'border-gray-800 text-gray-500 hover:border-gray-700 hover:text-gray-300'
                }`}>
              {label}
            </button>
          ))}
        </div>

        {/* 成就网格 */}
        {filteredDefs.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredDefs.map(def => (
              <AchievementCard
                key={def.type}
                def={def}
                unlocked={unlockedSet.has(def.type)}
                unlockedAt={unlockedMap.get(def.type)}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-16 space-y-3">
            <div className="text-4xl">🎯</div>
            <p className="text-gray-400">继续学习，解锁更多成就</p>
          </div>
        )}
      </div>

      {/* 解锁弹窗 */}
      <UnlockModal achievement={unlockModal} onClose={() => setUnlockModal(null)} />

      <style jsx global>{`
        @keyframes bounce-in {
          0%   { transform: scale(0.3) translateY(20px); opacity: 0; }
          60%  { transform: scale(1.05) translateY(-5px); opacity: 1; }
          100% { transform: scale(1) translateY(0); }
        }
        .animate-bounce-in { animation: bounce-in 0.5s ease-out; }
        @keyframes bounce-slow {
          0%, 100% { transform: translateY(0); }
          50%       { transform: translateY(-8px); }
        }
        .animate-bounce-slow { animation: bounce-slow 2s ease-in-out infinite; }
      `}</style>
    </div>
  );
}
