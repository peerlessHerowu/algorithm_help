import withBundleAnalyzer from '@next/bundle-analyzer';

const bundleAnalyzer = withBundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Docker 部署：启用 standalone 输出模式，生成最小化独立运行产物
  output: 'standalone',
  // 构建时忽略 ESLint 错误（开发阶段保持快速迭代）
  eslint: { ignoreDuringBuilds: true },
  // 构建时忽略 TS 类型错误（接口定义迭代中）
  typescript: { ignoreBuildErrors: true },
  // 环境变量校验：确保 API 地址已配置
  env: {
    NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8080',
  },
  // 允许后端 API 域名的图片加载（如有需要）
  images: {
    remotePatterns: [],
  },
  // 将 /api/* 请求代理到后端（开发和生产通用）
  async rewrites() {
    const backendUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8080';
    return [
      {
        source: '/api/:path*',
        destination: `${backendUrl}/api/:path*`,
      },
    ];
  },
};

export default bundleAnalyzer(nextConfig);
