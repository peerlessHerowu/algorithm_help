/**
 * KnowledgeGraph 动态导入包装器
 * 使用 next/dynamic 实现代码分割，ssr: false 避免服务端渲染
 * 消费方应导入此文件而非直接导入 KnowledgeGraph
 */

import dynamic from 'next/dynamic';

const KnowledgeGraphDynamic = dynamic(
  () => import('@/components/KnowledgeGraph'),
  {
    ssr: false,
    loading: () => (
      <div className="animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800 h-96 flex items-center justify-center">
        <span className="text-sm text-gray-400">知识图谱加载中...</span>
      </div>
    ),
  }
);

export default KnowledgeGraphDynamic;
