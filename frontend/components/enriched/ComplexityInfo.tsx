'use client';

/**
 * ComplexityInfo - 复杂度标注区组件
 * 展示时间复杂度和空间复杂度
 * 两者均为空时隐藏整个组件
 */

interface ComplexityInfoProps {
  /** 时间复杂度，如 "O(n)" */
  timeComplexity?: string | null;
  /** 空间复杂度，如 "O(1)" */
  spaceComplexity?: string | null;
  /** 自定义类名 */
  className?: string;
}

export default function ComplexityInfo({
  timeComplexity,
  spaceComplexity,
  className,
}: ComplexityInfoProps) {
  // 两者均为空时不渲染
  const hasTime = !!timeComplexity?.trim();
  const hasSpace = !!spaceComplexity?.trim();

  if (!hasTime && !hasSpace) return null;

  return (
    <div
      className={`flex items-center gap-4 rounded-lg bg-gray-50 px-4 py-2.5
        text-sm text-gray-600 dark:bg-gray-800/50 dark:text-gray-400 ${className || ''}`}
    >
      {hasTime && (
        <span className="inline-flex items-center gap-1">
          <span>⏱️</span>
          <span className="font-mono font-medium">{timeComplexity}</span>
        </span>
      )}
      {hasSpace && (
        <span className="inline-flex items-center gap-1">
          <span>💾</span>
          <span className="font-mono font-medium">{spaceComplexity}</span>
        </span>
      )}
    </div>
  );
}
