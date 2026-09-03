/**
 * 题目列表页（HomeClient）集成测试
 * 测试点：搜索防抖、难度筛选、分页控制
 */
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { SWRConfig } from 'swr';
import HomeClient from '@/app/HomeClient';
import type { PageResponse, ProblemListItem } from '@/lib/types';

// ===== Mock 数据 =====

const mockProblems: ProblemListItem[] = [
  { id: '1', title: '两数之和', difficulty: 'EASY', tags: ['哈希表'], companyTags: ['Google'], hasExplanation: true },
  { id: '2', title: '三数之和', difficulty: 'MEDIUM', tags: ['双指针'], companyTags: ['Meta'], hasExplanation: true },
  { id: '3', title: '接雨水', difficulty: 'HARD', tags: ['单调栈'], companyTags: ['Amazon'], hasExplanation: false },
];

function buildPageResponse(items: ProblemListItem[], page = 0, totalPages = 2): PageResponse<ProblemListItem> {
  return {
    content: items,
    totalElements: items.length * totalPages,
    totalPages,
    size: 12,
    number: page,
    first: page === 0,
    last: page === totalPages - 1,
  };
}

// ===== Mock fetch =====

let lastFetchUrl = '';

const mockFetcher = jest.fn(async (url: string) => {
  lastFetchUrl = url;
  const params = new URLSearchParams(url.split('?')[1] || '');
  const keyword = params.get('keyword') || '';
  const difficulty = params.get('difficulty') || '';
  const page = parseInt(params.get('page') || '0', 10);

  let filtered = [...mockProblems];
  if (keyword) {
    filtered = filtered.filter(p => p.title.includes(keyword));
  }
  if (difficulty) {
    filtered = filtered.filter(p => p.difficulty === difficulty);
  }

  return buildPageResponse(filtered, page, filtered.length > 0 ? 2 : 0);
});

// Mock fetcher 模块
jest.mock('@/lib/fetcher', () => ({
  fetcher: (url: string) => mockFetcher(url),
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
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/problems',
}));

// Mock next/link
jest.mock('next/link', () => {
  return ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  );
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

describe('HomeClient 题目列表页集成测试', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockFetcher.mockClear();
    lastFetchUrl = '';
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('初始加载时渲染题目列表', async () => {
    renderWithSWR(<HomeClient />);

    await waitFor(() => {
      expect(screen.getByText('两数之和')).toBeInTheDocument();
      expect(screen.getByText('三数之和')).toBeInTheDocument();
      expect(screen.getByText('接雨水')).toBeInTheDocument();
    });
  });

  it('搜索输入触发 300ms 防抖后发起请求', async () => {
    renderWithSWR(<HomeClient />);

    // 等待初始加载完成
    await waitFor(() => {
      expect(screen.getByText('两数之和')).toBeInTheDocument();
    });

    const initialCallCount = mockFetcher.mock.calls.length;

    // 输入搜索词
    const searchInput = screen.getByPlaceholderText('搜索题目...');
    fireEvent.change(searchInput, { target: { value: '两数' } });

    // 300ms 内不应触发新请求
    act(() => { jest.advanceTimersByTime(200); });
    expect(mockFetcher.mock.calls.length).toBe(initialCallCount);

    // 300ms 后触发防抖
    act(() => { jest.advanceTimersByTime(150); });

    await waitFor(() => {
      // 检查最后一次请求包含 keyword 参数
      const calls = mockFetcher.mock.calls;
      const lastCall = calls[calls.length - 1][0] as string;
      expect(lastCall).toContain('keyword=');
    });
  });

  it('难度筛选变更后重新获取数据', async () => {
    renderWithSWR(<HomeClient />);

    await waitFor(() => {
      expect(screen.getByText('两数之和')).toBeInTheDocument();
    });

    // 选择 HARD 难度
    const select = screen.getByDisplayValue('全部难度');
    fireEvent.change(select, { target: { value: 'HARD' } });

    await waitFor(() => {
      const calls = mockFetcher.mock.calls;
      const lastCall = calls[calls.length - 1][0] as string;
      expect(lastCall).toContain('difficulty=HARD');
    });
  });

  it('分页按钮正确工作', async () => {
    renderWithSWR(<HomeClient />);

    await waitFor(() => {
      expect(screen.getByText('两数之和')).toBeInTheDocument();
    });

    // 应显示分页信息 "1 / 2"
    await waitFor(() => {
      expect(screen.getByText('1 / 2')).toBeInTheDocument();
    });

    // 点击下一页
    const nextBtn = screen.getByText('下一页');
    fireEvent.click(nextBtn);

    await waitFor(() => {
      const calls = mockFetcher.mock.calls;
      const lastCall = calls[calls.length - 1][0] as string;
      expect(lastCall).toContain('page=1');
    });
  });

  it('搜索无结果时显示空状态', async () => {
    // 临时修改 mock 返回空结果
    mockFetcher.mockImplementationOnce(async () => buildPageResponse([], 0, 0));

    renderWithSWR(<HomeClient />);

    await waitFor(() => {
      expect(screen.getByText('暂无匹配的题目')).toBeInTheDocument();
    });
  });
});
