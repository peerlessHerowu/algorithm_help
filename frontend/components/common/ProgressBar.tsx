'use client';

interface ProgressBarProps {
  /** 进度值 0-100 */
  progress: number;
  /** 状态文字（可选，显示在右侧） */
  status?: string;
  className?: string;
}

/**
 * 进度条组件
 * 带动画过渡效果，支持状态文字展示
 */
export default function ProgressBar({
  progress,
  status,
  className = '',
}: ProgressBarProps) {
  // 限制在 0-100 范围
  const clampedProgress = Math.min(100, Math.max(0, progress));

  return (
    <div className={`w-full ${className}`}>
      {/* 状态文字行 */}
      {status && (
        <div className="mb-1 flex items-center justify-between text-sm">
          <span className="text-gray-600 dark:text-gray-400">{status}</span>
          <span className="font-medium text-gray-900 dark:text-gray-100">
            {clampedProgress}%
          </span>
        </div>
      )}
      {/* 进度条轨道 */}
      <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
        <div
          className="h-full rounded-full bg-primary-500 transition-all duration-500 ease-out"
          style={{ width: `${clampedProgress}%` }}
        />
      </div>
    </div>
  );
}
