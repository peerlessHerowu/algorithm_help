/**
 * 首页 - 题目列表页（SSG 静态生成）
 * 构建时预渲染 HTML 壳，客户端水合后通过 SWR 获取数据
 */

import HomeClient from './HomeClient';

// SSG: 强制静态生成，构建时预渲染
export const dynamic = 'force-static';

export default function HomePage() {
  return <HomeClient />;
}
