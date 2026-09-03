import type { MetadataRoute } from 'next';

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://algorithm-help.com';

/**
 * 站点地图生成
 * - 静态路由（首页、模式页、图谱页、训练页）
 * - 题目详情页 URL 暂时返回空（后续从 API 动态获取）
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // 静态路由
  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: BASE_URL,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1.0,
    },
    {
      url: `${BASE_URL}/patterns`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/graph`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.7,
    },
    {
      url: `${BASE_URL}/training`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.7,
    },
  ];

  // TODO: 从 API 动态获取题目列表生成详情页 URL
  // const problems = await fetch(`${API_BASE}/api/v1/problems?size=1000`);
  // const problemRoutes = problems.map(p => ({ url: `${BASE_URL}/problems/${p.id}` }));

  return staticRoutes;
}
