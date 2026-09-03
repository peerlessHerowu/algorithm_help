/**
 * 算法模式详情页（ISR 增量静态再生成）
 * 缓存 1 小时，过期后后台重新生成
 */

import PatternDetailClient from './PatternDetailClient';

// ISR: 增量静态再生成，缓存 1 小时
export const revalidate = 3600;

export default function PatternDetailPage() {
  return <PatternDetailClient />;
}
