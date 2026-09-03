'use client';

import { useRouter } from 'next/navigation';
import { useAppStore } from '@/store';

interface InteractiveActionsProps {
  /** 当前题目 ID */
  problemId: string;
}

/** 交互功能入口配置 */
const actions = [
  {
    key: 'feynman',
    label: '费曼教学',
    description: '用自己的话解释算法思路，加深理解',
    href: (id: string) => `/feynman?problemId=${id}`,
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth={1.5} className="h-6 w-6">
        <path strokeLinecap="round" strokeLinejoin="round"
          d="M4.26 10.147a60.438 60.438 0 0 0-.491 6.347A48.62 48.62 0 0 1 12 20.904a48.62 48.62 0 0 1 8.232-4.41 60.46 60.46 0 0 0-.491-6.347m-15.482 0a50.636 50.636 0 0 0-2.658-.813A59.906 59.906 0 0 1 12 3.493a59.903 59.903 0 0 1 10.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0 1 12 13.489a50.702 50.702 0 0 1 7.74-3.342" />
      </svg>
    ),
  },
  {
    key: 'interview',
    label: '模拟面试',
    description: '在限时环境中练习讲解与编码',
    href: (id: string) => `/interview?problemId=${id}`,
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth={1.5} className="h-6 w-6">
        <path strokeLinecap="round" strokeLinejoin="round"
          d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 0 1-.825-.242m9.345-8.334a2.126 2.126 0 0 0-.476-.095 48.64 48.64 0 0 0-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0 0 11.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155" />
      </svg>
    ),
  },
  {
    key: 'review',
    label: '引导推导',
    description: '通过间隔重复巩固已学算法',
    href: () => '/review',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth={1.5} className="h-6 w-6">
        <path strokeLinecap="round" strokeLinejoin="round"
          d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
      </svg>
    ),
  },
];

/**
 * 交互功能入口组件
 * 在题目详情页底部展示三个入口按钮
 * 未登录时点击弹出提示
 */
export default function InteractiveActions({ problemId }: InteractiveActionsProps) {
  const router = useRouter();
  const isAuthenticated = useAppStore((s) => s.isAuthenticated);

  const handleClick = (getHref: (id: string) => string) => {
    if (!isAuthenticated) {
      alert('请先登录后使用此功能');
      return;
    }
    router.push(getHref(problemId));
  };

  return (
    <div className="mt-8 border-t border-gray-200 pt-6 dark:border-gray-700">
      <h3 className="mb-4 text-lg font-semibold">互动学习</h3>
      <div className="grid gap-4 sm:grid-cols-3">
        {actions.map((action) => (
          <button
            key={action.key}
            onClick={() => handleClick(action.href)}
            className="flex flex-col items-center gap-2 rounded-lg border border-gray-200 p-4 text-center transition-colors hover:border-primary-300 hover:bg-primary-50 dark:border-gray-700 dark:hover:border-primary-700 dark:hover:bg-primary-900/10"
          >
            <span className="text-primary-600 dark:text-primary-400">
              {action.icon}
            </span>
            <span className="text-sm font-medium">{action.label}</span>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {action.description}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
