/**
 * 题目列表页（SSG + 客户端搜索筛选）
 */

import ProblemsListClient from './ProblemsListClient';

export const dynamic = 'force-static';

export default function ProblemsPage() {
  return <ProblemsListClient />;
}
