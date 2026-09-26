/**
 * 题目列表页（SSG + 客户端搜索筛选）
 */

import ProblemsListClient from './ProblemsListClient';
import { Suspense } from 'react';

export const dynamic = 'force-static';

export default function ProblemsPage() {
  return <Suspense fallback={null}><ProblemsListClient /></Suspense>;
}
