'use client';

/**
 * 优化图片组件
 * 封装 next/image，提供统一的图片优化能力：
 * - 自动 WebP 转换
 * - 懒加载（默认）
 * - 响应式尺寸适配
 * - 加载占位符（blur 或 skeleton）
 * - 错误降级处理
 */

import Image, { ImageProps } from 'next/image';
import { useState } from 'react';

interface OptimizedImageProps extends Omit<ImageProps, 'onError'> {
  /** 加载失败时的降级文本 */
  fallbackText?: string;
  /** 是否显示加载骨架屏 */
  showSkeleton?: boolean;
  /** 自定义样式类名 */
  className?: string;
}

export default function OptimizedImage({
  fallbackText = '图片加载失败',
  showSkeleton = true,
  className,
  alt,
  ...props
}: OptimizedImageProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  // 加载失败降级：显示占位文字
  if (hasError) {
    return (
      <div
        className={`flex items-center justify-center bg-gray-100 dark:bg-gray-800
                    text-gray-400 dark:text-gray-500 text-sm rounded ${className ?? ''}`}
        style={{ width: props.width ?? '100%', height: props.height ?? 200 }}
        role="img"
        aria-label={alt}
      >
        {fallbackText}
      </div>
    );
  }

  return (
    <div className={`relative ${className ?? ''}`}>
      {/* 加载骨架屏 */}
      {showSkeleton && isLoading && (
        <div
          className="absolute inset-0 bg-gray-200 dark:bg-gray-700 animate-pulse rounded"
          aria-hidden="true"
        />
      )}
      <Image
        alt={alt}
        onLoad={() => setIsLoading(false)}
        onError={() => setHasError(true)}
        loading="lazy"
        {...props}
      />
    </div>
  );
}
