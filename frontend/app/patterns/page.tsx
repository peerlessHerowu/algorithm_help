/**
 * 算法模式列表页（SSG 静态生成）
 * 构建时预渲染 HTML 壳，客户端水合后通过 SWR 获取数据
 */

import PatternsClient from './PatternsClient';

// SSG: 强制静态生成，构建时预渲染
export const dynamic = 'force-static';

export default function PatternsPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-6 pb-20 md:pb-6">
      <PatternsClient />
    </div>
  );
}
