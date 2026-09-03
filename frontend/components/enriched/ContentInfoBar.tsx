'use client';

/**
 * 底部全局信息栏
 * 展示内容来源和更新频率说明，建立用户信任感
 * 仅在有内容时显示，空状态/进度态隐藏
 */

interface ContentInfoBarProps {
  /** 是否可见：空状态或生成进度时传 false */
  visible: boolean;
}

export default function ContentInfoBar({ visible }: ContentInfoBarProps) {
  if (!visible) return null;

  return (
    <p className="mt-6 text-center text-xs text-gray-400 dark:text-gray-500">
      基于 Top N 高赞社区题解 + AI 丰富 · 内容持续更新
    </p>
  );
}

export type { ContentInfoBarProps };
