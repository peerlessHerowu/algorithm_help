/**
 * 题目详情页（ISR 增量静态再生成）
 * 已生成内容缓存 1 小时，过期后后台重新生成
 */

import ProblemDetailClient from './ProblemDetailClient';

// ISR: 增量静态再生成，缓存 1 小时
export const revalidate = 3600;

export default function ProblemDetailPage() {
  return <ProblemDetailClient />;
}
