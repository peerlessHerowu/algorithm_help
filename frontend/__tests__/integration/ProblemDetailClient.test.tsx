/**
 * 题目详情页（ProblemDetailClient）集成测试
 * 测试点：级别 Tab 切换、内容渲染、API 调用正确性
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { SWRConfig } from 'swr';
import ProblemDetailClient from '@/app/problems/[id]/ProblemDetailClient';
import type { Problem, Explanation, RelatedProblem } from '@/lib/types';

// ===== Mock 数据 =====

const mockProblem: Problem = {
  id: 'two-sum',
  title: '两数之和',
  difficulty: 'EASY',
  tags: ['哈希表', '数组'],
  description: '给定一个整数数组 nums 和一个目标值 target...',
  constraints: ['2 <= nums.length <= 10^4', '-10^9 <= nums[i] <= 10^9'],
  examples: ['输入: nums = [2,7,11,15], target = 9\n输出: [0,1]'],
  companyTags: ['Google', 'Amazon'],
  platforms: [],
  createdAt: 1700000000000,
  updatedAt: 1700000000000,
};

const mockExplanationL3: Explanation = {
  id: 'exp-1',
  problemId: 'two-sum',
  level: 3,
  sections: [
    {
      title: '核心思路',
      contentType: 'text',
      content: '使用哈希表存储已遍历的元素，实现 O(1) 查找。',
    },
    {
      title: '代码实现',
      contentType: 'code',
      content: '',
      approaches: [
        {
          name: '哈希表解法',
          idea: '利用哈希表记录已遍历元素',
          code: { python: 'def two_sum(nums, target):\n    seen = {}\n    for i, num in enumerate(nums):\n        if target - num in seen:\n            return [seen[target - num], i]\n        seen[num] = i', java: 'class Solution {}' },
          timeComplexity: 'O(n)',
          spaceComplexity: 'O(n)',
          whyThisWorks: '哈希表提供 O(1) 的查找',
          whenToUse: '需要快速查找配对元素时',
          limitations: '额外空间开销',
        },
      ],
    },
  ],
  version: 1,
  isLatest: true,
  status: 'PUBLISHED',
  createdAt: 1700000000000,
  updatedAt: 1700000000000,
};

const mockExplanationL1: Explanation = {
  ...mockExplanationL3,
  id: 'exp-l1',
  level: 1,
  sections: [
    {
      title: '直觉理解',
      contentType: 'text',
      content: '想象你在书架上找一本书，哈希表就像一个索引目录。',
    },
  ],
};

const mockRelated: RelatedProblem[] = [
  {
    problemId: 'three-sum',
    title: '三数之和',
    difficulty: 'MEDIUM',
    type: 'variant',
    description: '找到所有和为零的三元组',
    confidence: 0.9,
  },
];

// ===== Mock 设置 =====

let fetchCalls: string[] = [];

jest.mock('@/lib/fetcher', () => ({
  fetcher: async (url: string) => {
    fetchCalls.push(url);

    if (url.includes('/explanation?level=1')) {
      return mockExplanationL1;
    }
    if (url.includes('/explanation')) {
      return mockExplanationL3;
    }
    if (url.includes('/related')) {
      return mockRelated;
    }
    if (url.includes('/problems/')) {
      return mockProblem;
    }
    return null;
  },
  FetchError: class FetchError extends Error {
    status: number;
    constructor(msg: string, status: number) {
      super(msg);
      this.status = status;
    }
  },
}));

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useParams: () => ({ id: 'two-sum' }),
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/problems/two-sum',
}));

// Mock next/link
jest.mock('next/link', () => {
  return ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  );
});

// Mock 动态导入的 Mermaid 渲染组件
jest.mock('@/components/MermaidRendererDynamic', () => {
  return function MockMermaidRenderer({ code }: { code: string }) {
    return <div data-testid="mermaid-renderer">{code}</div>;
  };
});

// Mock MarkdownRenderer（react-markdown 是 ESM 模块，无法在 Jest 中直接转换）
jest.mock('@/components/MarkdownRenderer', () => {
  return function MockMarkdownRenderer({ content }: { content: string }) {
    return <div data-testid="markdown-renderer">{content}</div>;
  };
});

// Mock CodeBlock
jest.mock('@/components/CodeBlock', () => {
  return function MockCodeBlock({ code }: { code: Record<string, string> }) {
    return (
      <div data-testid="code-block">
        {Object.entries(code).map(([lang, src]) => (
          <pre key={lang} data-lang={lang}>{src}</pre>
        ))}
      </div>
    );
  };
});

// Mock ApproachComparison
jest.mock('@/components/content/ApproachComparison', () => {
  return function MockApproachComparison({ approaches }: { approaches: unknown[] }) {
    return <div data-testid="approach-comparison">解法对比: {approaches.length} 种</div>;
  };
});

// ===== 测试工具 =====

function renderWithSWR(ui: React.ReactElement) {
  return render(
    <SWRConfig value={{ dedupingInterval: 0, provider: () => new Map() }}>
      {ui}
    </SWRConfig>
  );
}

// ===== 测试用例 =====

describe('ProblemDetailClient 题目详情页集成测试', () => {
  beforeEach(() => {
    fetchCalls = [];
  });

  it('正确渲染题目基本信息', async () => {
    renderWithSWR(<ProblemDetailClient />);

    await waitFor(() => {
      expect(screen.getByText('两数之和')).toBeInTheDocument();
    });

    // 难度标签
    expect(screen.getByText('简单')).toBeInTheDocument();
    // 算法标签
    expect(screen.getByText('哈希表')).toBeInTheDocument();
    expect(screen.getByText('数组')).toBeInTheDocument();
  });

  it('默认加载 L3 级别解析内容', async () => {
    renderWithSWR(<ProblemDetailClient />);

    await waitFor(() => {
      expect(screen.getByText('核心思路')).toBeInTheDocument();
    });

    // Markdown 内容渲染
    expect(screen.getByText(/使用哈希表存储已遍历的元素/)).toBeInTheDocument();
    // 代码区域渲染
    expect(screen.getByText('哈希表解法')).toBeInTheDocument();
  });

  it('点击级别 Tab 切换到 L1 并获取对应数据', async () => {
    renderWithSWR(<ProblemDetailClient />);

    // 等待初始内容加载
    await waitFor(() => {
      expect(screen.getByText('核心思路')).toBeInTheDocument();
    });

    // 点击 L1 Tab
    const l1Tab = screen.getByText('L1');
    fireEvent.click(l1Tab);

    // 等待 L1 内容渲染
    await waitFor(() => {
      expect(screen.getByText('直觉理解')).toBeInTheDocument();
    });

    // 验证 L1 内容
    expect(screen.getByText(/想象你在书架上找一本书/)).toBeInTheDocument();

    // 验证 API 调用中包含 level=1
    const l1Calls = fetchCalls.filter(url => url.includes('level=1'));
    expect(l1Calls.length).toBeGreaterThan(0);
  });

  it('展示关联题目列表', async () => {
    renderWithSWR(<ProblemDetailClient />);

    await waitFor(() => {
      expect(screen.getByText('三数之和')).toBeInTheDocument();
    });

    expect(screen.getByText('找到所有和为零的三元组')).toBeInTheDocument();
  });

  it('展示题目描述和约束条件', async () => {
    renderWithSWR(<ProblemDetailClient />);

    await waitFor(() => {
      expect(screen.getByText(/给定一个整数数组 nums/)).toBeInTheDocument();
    });

    // 约束条件
    expect(screen.getByText('2 <= nums.length <= 10^4')).toBeInTheDocument();
  });
});
