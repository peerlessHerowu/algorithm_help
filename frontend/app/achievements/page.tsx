'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/store';
import { achievementsApi } from '@/lib/api';
import { AchievementToast, type AchievementInfo } from '@/components/achievements/AchievementToast';

interface Achievement {
  id: string; type: string; unlockedAt: number; metadata?: string;
}
interface AchievementDef {
  type: string; displayName: string; description: string;
  icon: string; unlockCondition: string; unlockRate?: number;
}

// 成就图标映射
const ICONS: Record<string, string> = {
  FIRST_PROBLEM: '🎯',
  PATTERN_MASTER: '🧩',
  STREAK_7: '🔥',
  STREAK_30: '💪',
  STREAK_100: '🏃',
  STREAK_365: '🏆',
  FEYNMAN_SCHOLAR_5: '📚',
  FEYNMAN_SCHOLAR_20: '🧪',
  FEYNMAN_SCHOLAR_50: '🎓',
  FEYNMAN_SCHOLAR_100: '👨‍🏫',
  INTERVIEW_PRO: '💼',
  BUG_HUNTER: '🐛',
  SPEED_DEMON: '⚡',
  COMPLEXITY_MASTER: '📊',
};

const CATEGORIES: { label: string; types: string[] }[] = [
  { label: '基础', types: ['FIRST_PROBLEM', 'PATTERN_MASTER'] },
  { label: '连续学习', types: ['STREAK_7','STREAK_30','STREAK_100','STREAK_365'] },
  { label: '费曼学习', types: ['FEYNMAN_SCHOLAR_5','FEYNMAN_SCHOLAR_20','FEYNMAN_SCHOLAR_50','FEYNMAN_SCHOLAR_100'] },
  { label: '专项', types: ['INTERVIEW_PRO','BUG_HUNTER','SPEED_DEMON','COMPLEXITY_MASTER'] },
];

export default function AchievementsPage() {
  const router = useRouter();
  const { user, isAuthenticated } = useAppStore();

  const [unlocked, setUnlocked] = useState<Achievement[]>([]);
  const [defs, setDefs] = useState<AchievementDef[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<AchievementInfo | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    Promise.all([
      achievementsApi.mine(user.id),
      achievementsApi.definitions(),
    ]).then(([mine, definitions]: any[]) => {
      setUnlocked(Array.isArray(mine) ? mine : []);
      setDefs(Array.isArray(definitions) ? definitions : []);
    }).catch(() => {
      // 降级：显示空状态
    }).finally(() => setLoading(false));
  }, [user]);

  const unlockedTypes = new Set(unlocked.map(a => a.type));
  const unlockedMap: Record<string, Achievement> = {};
  unlocked.forEach(a => { unlockedMap[a.type] = a; });

  const defMap: Record<string, AchievementDef> = {};
  defs.forEach(d => { defMap[d.type] = d; });

  if (!isAuthenticated) return (
    <div className="flex h-[60vh] flex-col items-center justify-center gap-4">
      <p className="text-gray-500">成就系统需要登录后查看</p>
      <button onClick={() => router.push('/auth/login')} className="rounded-lg bg-blue-600 px-6 py-2 text-sm text-white">去登录</button>
    </div>
  );

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      {/* 成就解锁 Toast */}
      {toast && <AchievementToast achievement={toast} onClose={() => setToast(null)} />}

      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-800 dark:text-gray-100">🏆 我的成就</h1>
        <div className="text-sm text-gray-500 dark:text-gray-400">
          已解锁 {unlocked.length} / {CATEGORIES.reduce((acc, c) => acc + c.types.length, 0)} 个
        </div>
      </div>

      {/* 解锁进度条 */}
      <div className="mb-6 rounded-xl border border-purple-200 bg-purple-50/50 p-4 dark:border-purple-800 dark:bg-purple-900/10">
        <div className="flex justify-between text-sm text-purple-700 dark:text-purple-400 mb-2">
          <span>解锁进度</span>
          <span>{Math.round(unlocked.length / Math.max(1, CATEGORIES.reduce((acc, c) => acc + c.types.length, 0)) * 100)}%</span>
        </div>
        <div className="w-full h-3 rounded-full bg-purple-100 dark:bg-purple-900/30">
          <div className="h-3 rounded-full bg-gradient-to-r from-purple-500 to-blue-500 transition-all"
            style={{ width: `${unlocked.length / Math.max(1, CATEGORIES.reduce((acc, c) => acc + c.types.length, 0)) * 100}%` }} />
        </div>
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-purple-600 border-t-transparent" />
        </div>
      ) : (
        <div className="space-y-6">
          {CATEGORIES.map(category => (
            <div key={category.label}>
              <h2 className="mb-3 text-sm font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">
                {category.label}
              </h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {category.types.map(type => {
                  const isUnlocked = unlockedTypes.has(type);
                  const def = defMap[type];
                  const achievement = unlockedMap[type];
                  const icon = ICONS[type] || '🎖️';
                  const unlockRate = def?.unlockRate;

                  return (
                    <div key={type}
                      className={`relative rounded-xl border p-4 transition-all ${
                        isUnlocked
                          ? 'border-purple-200 bg-gradient-to-br from-purple-50 to-blue-50 dark:border-purple-700 dark:from-purple-900/20 dark:to-blue-900/20'
                          : 'border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900 opacity-60'
                      }`}>
                      <div className="flex items-start gap-3">
                        <span className={`text-2xl ${!isUnlocked ? 'grayscale' : ''}`}>{isUnlocked ? icon : '🔒'}</span>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-semibold truncate ${
                            isUnlocked ? 'text-gray-800 dark:text-gray-100' : 'text-gray-400 dark:text-gray-600'
                          }`}>
                            {def?.displayName || type}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-500 mt-0.5 line-clamp-2">
                            {isUnlocked ? def?.description : (def?.unlockCondition || '完成特定目标解锁')}
                          </p>
                          {isUnlocked && achievement.unlockedAt && (
                            <p className="text-xs text-purple-500 mt-1">
                              {new Date(achievement.unlockedAt).toLocaleDateString('zh-CN')}
                            </p>
                          )}
                        </div>
                      </div>
                      {/* 稀缺度标签 */}
                      {isUnlocked && unlockRate !== undefined && unlockRate < 0.1 && (
                        <div className="mt-2 rounded-full bg-purple-100 dark:bg-purple-900/30 px-2 py-0.5 text-xs text-purple-700 dark:text-purple-300 text-center">
                          ✨ 仅 {(unlockRate * 100).toFixed(1)}% 解锁
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 演示：点击触发飘屏 */}
      {unlocked.length === 0 && !loading && (
        <div className="mt-8 rounded-xl border-2 border-dashed border-gray-300 p-8 text-center dark:border-gray-700">
          <p className="text-4xl mb-3">🌱</p>
          <h3 className="font-medium text-gray-700 dark:text-gray-300">还未解锁任何成就</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">开始学习，解锁你的第一个成就！</p>
          <button onClick={() => router.push('/problems')}
            className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
            开始刷题
          </button>
        </div>
      )}
    </div>
  );
}
