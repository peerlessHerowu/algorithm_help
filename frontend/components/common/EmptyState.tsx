import { ReactNode } from 'react';

interface EmptyStateProps {
  /** 顶部图标 */
  icon?: ReactNode;
  /** 标题文字 */
  title: string;
  /** 描述文字 */
  description?: string;
  /** 操作按钮区域 */
  action?: ReactNode;
  className?: string;
}

/**
 * 空状态占位组件
 * 居中展示图标、标题、描述和操作区
 */
export default function EmptyState({
  icon,
  title,
  description,
  action,
  className = '',
}: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center py-16 text-center ${className}`}
    >
      {icon && (
        <div className="mb-4 text-gray-400 dark:text-gray-500">
          {icon}
        </div>
      )}
      <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
        {title}
      </h3>
      {description && (
        <p className="mt-2 max-w-sm text-sm text-gray-500 dark:text-gray-400">
          {description}
        </p>
      )}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
