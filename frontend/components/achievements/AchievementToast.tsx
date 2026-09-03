'use client';

import { useEffect, useState } from 'react';

export interface AchievementInfo {
  type: string;
  displayName: string;
  description: string;
  unlockRate?: number;
}

/**
 * 成就解锁弹窗 Toast
 * 解锁时居中弹窗展示，5秒后自动消失
 */
export function AchievementToast({ achievement, onClose }: {
  achievement: AchievementInfo;
  onClose: () => void;
}) {
  useEffect(() => {
    const t = setTimeout(onClose, 5000);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
      <div className="pointer-events-auto animate-[fadeInScale_0.3s_ease] rounded-2xl bg-gradient-to-br from-purple-600 to-blue-600 p-1 shadow-2xl">
        <div className="rounded-xl bg-white px-8 py-6 text-center dark:bg-gray-900">
          <div className="text-5xl mb-3">🏆</div>
          <div className="text-xs font-medium text-purple-600 dark:text-purple-400 mb-1">成就解锁！</div>
          <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-1">
            {achievement.displayName}
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">{achievement.description}</p>
          {achievement.unlockRate !== undefined && achievement.unlockRate < 0.1 && (
            <div className="rounded-full bg-purple-100 dark:bg-purple-900/30 px-3 py-1 text-xs text-purple-700 dark:text-purple-300 inline-block mb-3">
              🌟 仅 {(achievement.unlockRate * 100).toFixed(1)}% 的学习者解锁了此成就
            </div>
          )}
          <button onClick={onClose}
            className="rounded-lg bg-gray-100 px-4 py-1.5 text-sm text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400">
            太棒了！
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * 全服飘屏效果
 * 从右向左水平滚动，5秒后淡出
 */
export function BroadcastBanner({ nickname, achievementName, onDone }: {
  nickname: string;
  achievementName: string;
  onDone: () => void;
}) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => { setVisible(false); setTimeout(onDone, 500); }, 5000);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <div className={`fixed top-0 inset-x-0 z-40 pointer-events-none transition-opacity duration-500 ${visible ? 'opacity-100' : 'opacity-0'}`}>
      <div className="overflow-hidden bg-gradient-to-r from-purple-600 to-blue-600 py-1.5">
        <div className="animate-[marquee_8s_linear_infinite] flex whitespace-nowrap">
          <span className="mx-8 text-sm font-medium text-white">
            🏆 @{nickname} 解锁了「{achievementName}」！
          </span>
          <span className="mx-8 text-sm font-medium text-white">
            🏆 @{nickname} 解锁了「{achievementName}」！
          </span>
        </div>
      </div>
    </div>
  );
}

// tailwind.config 需要添加 marquee 动画，这里用 style 代替
const style = `
@keyframes marquee { from { transform: translateX(0) } to { transform: translateX(-50%) } }
@keyframes fadeInScale { from { opacity:0; transform:scale(0.8) } to { opacity:1; transform:scale(1) } }
`;
