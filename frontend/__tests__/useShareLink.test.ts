/**
 * useShareLink Hook 单元测试
 *
 * 测试：
 * 1. generateShareUrl 生成正确格式 URL
 * 2. copyShareLink 复制链接 + 显示 toast
 * 3. copyCodeContent 复制代码 + 显示 toast
 * 4. resolveDeepLink 正确解析 URL 参数
 * 5. applyDeepLink 无效 solutionId 时显示容错 toast
 * 6. applyDeepLink 有效 solutionId 时调用展开+滚动回调
 * 7. applyDeepLink 只执行一次（防重复）
 */

import { renderHook, act } from '@testing-library/react';
import { useShareLink } from '@/hooks/useShareLink';

// Mock next/navigation
const mockSearchParams = new URLSearchParams();
jest.mock('next/navigation', () => ({
  useSearchParams: () => mockSearchParams,
}));

// Mock clipboard API
const mockWriteText = jest.fn().mockResolvedValue(undefined);
Object.assign(navigator, {
  clipboard: { writeText: mockWriteText },
});

describe('useShareLink', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSearchParams.delete('tab');
    mockSearchParams.delete('level');
    mockSearchParams.delete('solution');
    // Reset window.location.origin
    Object.defineProperty(window, 'location', {
      value: { origin: 'https://example.com', href: 'https://example.com/problems/two-sum' },
      writable: true,
    });
  });

  describe('generateShareUrl', () => {
    it('应生成正确格式的分享链接', () => {
      const { result } = renderHook(() => useShareLink());

      const url = result.current.generateShareUrl('two-sum', 3, 'abc123');

      expect(url).toBe('https://example.com/problems/two-sum?tab=ai&level=3&solution=abc123');
    });

    it('应正确 encode 特殊字符的 problemId', () => {
      const { result } = renderHook(() => useShareLink());

      const url = result.current.generateShareUrl('两数之和', 2, 'xyz');

      expect(url).toContain(encodeURIComponent('两数之和'));
      expect(url).toContain('tab=ai');
      expect(url).toContain('level=2');
      expect(url).toContain('solution=xyz');
    });
  });


  describe('copyShareLink', () => {
    it('应复制链接到剪贴板并显示 toast', async () => {
      const { result } = renderHook(() => useShareLink());

      let success: boolean = false;
      await act(async () => {
        success = await result.current.copyShareLink('two-sum', 3, 'abc123');
      });

      expect(success).toBe(true);
      expect(mockWriteText).toHaveBeenCalledWith(
        'https://example.com/problems/two-sum?tab=ai&level=3&solution=abc123'
      );
      expect(result.current.toastMessage).toBe('✓ 链接已复制');
    });

    it('剪贴板失败时显示错误 toast', async () => {
      mockWriteText.mockRejectedValueOnce(new Error('clipboard denied'));
      const { result } = renderHook(() => useShareLink());

      let success: boolean = false;
      await act(async () => {
        success = await result.current.copyShareLink('two-sum', 3, 'abc123');
      });

      expect(success).toBe(false);
      expect(result.current.toastMessage).toBe('复制失败，请手动复制');
    });
  });

  describe('copyCodeContent', () => {
    it('应复制代码内容并显示 toast', async () => {
      const { result } = renderHook(() => useShareLink());

      let success: boolean = false;
      await act(async () => {
        success = await result.current.copyCodeContent('const x = 1;');
      });

      expect(success).toBe(true);
      expect(mockWriteText).toHaveBeenCalledWith('const x = 1;');
      expect(result.current.toastMessage).toBe('✓ 代码已复制');
    });
  });


  describe('resolveDeepLink', () => {
    it('应正确解析完整 URL 参数', () => {
      mockSearchParams.set('tab', 'ai');
      mockSearchParams.set('level', '4');
      mockSearchParams.set('solution', 'sol-001');

      const { result } = renderHook(() => useShareLink());
      const link = result.current.resolveDeepLink();

      expect(link.tab).toBe('ai');
      expect(link.level).toBe(4);
      expect(link.solutionId).toBe('sol-001');
    });

    it('无参数时返回 null', () => {
      const { result } = renderHook(() => useShareLink());
      const link = result.current.resolveDeepLink();

      expect(link.tab).toBeNull();
      expect(link.level).toBeNull();
      expect(link.solutionId).toBeNull();
    });

    it('无效 level 参数返回 null', () => {
      mockSearchParams.set('level', '9');
      const { result } = renderHook(() => useShareLink());
      const link = result.current.resolveDeepLink();

      expect(link.level).toBeNull();
    });

    it('level=0 返回 null', () => {
      mockSearchParams.set('level', '0');
      const { result } = renderHook(() => useShareLink());
      const link = result.current.resolveDeepLink();

      expect(link.level).toBeNull();
    });
  });

  describe('applyDeepLink', () => {
    it('无效 solutionId 时显示容错 toast', () => {
      mockSearchParams.set('tab', 'ai');
      mockSearchParams.set('level', '3');
      mockSearchParams.set('solution', 'not-exist');

      const { result } = renderHook(() => useShareLink());

      const callbacks = {
        availableIds: ['sol-001', 'sol-002', 'sol-003'],
        setActiveTab: jest.fn(),
        setLevel: jest.fn(),
        expandCard: jest.fn(),
        scrollToCard: jest.fn(),
      };

      act(() => {
        result.current.applyDeepLink(callbacks);
      });

      expect(callbacks.setActiveTab).toHaveBeenCalledWith('ai');
      expect(callbacks.setLevel).toHaveBeenCalledWith(3);
      expect(callbacks.expandCard).not.toHaveBeenCalled();
      expect(result.current.toastMessage).toBe('该解析已不存在');
    });

    it('有效 solutionId 时调用展开和滚动', () => {
      mockSearchParams.set('tab', 'ai');
      mockSearchParams.set('level', '2');
      mockSearchParams.set('solution', 'sol-002');

      const { result } = renderHook(() => useShareLink());

      const callbacks = {
        availableIds: ['sol-001', 'sol-002', 'sol-003'],
        setActiveTab: jest.fn(),
        setLevel: jest.fn(),
        expandCard: jest.fn(),
        scrollToCard: jest.fn(),
      };

      act(() => {
        result.current.applyDeepLink(callbacks);
      });

      expect(callbacks.setActiveTab).toHaveBeenCalledWith('ai');
      expect(callbacks.setLevel).toHaveBeenCalledWith(2);
      expect(callbacks.expandCard).toHaveBeenCalledWith('sol-002');
    });

    it('只执行一次（防重复应用）', () => {
      mockSearchParams.set('tab', 'ai');
      mockSearchParams.set('level', '3');
      mockSearchParams.set('solution', 'sol-001');

      const { result } = renderHook(() => useShareLink());

      const callbacks = {
        availableIds: ['sol-001'],
        setActiveTab: jest.fn(),
        setLevel: jest.fn(),
        expandCard: jest.fn(),
        scrollToCard: jest.fn(),
      };

      act(() => {
        result.current.applyDeepLink(callbacks);
      });
      act(() => {
        result.current.applyDeepLink(callbacks);
      });

      // 只调用一次
      expect(callbacks.setLevel).toHaveBeenCalledTimes(1);
      expect(callbacks.expandCard).toHaveBeenCalledTimes(1);
    });

    it('无 solution 参数时不执行定位', () => {
      mockSearchParams.set('tab', 'ai');
      mockSearchParams.set('level', '3');
      // 不设置 solution

      const { result } = renderHook(() => useShareLink());

      const callbacks = {
        availableIds: ['sol-001'],
        setActiveTab: jest.fn(),
        setLevel: jest.fn(),
        expandCard: jest.fn(),
        scrollToCard: jest.fn(),
      };

      act(() => {
        result.current.applyDeepLink(callbacks);
      });

      expect(callbacks.setActiveTab).not.toHaveBeenCalled();
      expect(callbacks.setLevel).not.toHaveBeenCalled();
    });
  });

  describe('dismissToast', () => {
    it('应立即隐藏 toast', async () => {
      const { result } = renderHook(() => useShareLink());

      await act(async () => {
        await result.current.copyCodeContent('test');
      });
      expect(result.current.toastMessage).toBe('✓ 代码已复制');

      act(() => {
        result.current.dismissToast();
      });
      expect(result.current.toastMessage).toBeNull();
    });
  });
});
