import { renderHook, act } from '@testing-library/react';
import { useReadingProgress } from '@/hooks/useReadingProgress';

const STORAGE_KEY = 'algorithm-help:reading-progress';

describe('useReadingProgress', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('初始状态：无记录时 getLastLevel 返回 null', () => {
    const { result } = renderHook(() => useReadingProgress());
    expect(result.current.getLastLevel('two-sum')).toBeNull();
  });

  it('recordLevel 保存后 getLastLevel 正确返回', () => {
    const { result } = renderHook(() => useReadingProgress());

    act(() => {
      result.current.recordLevel('two-sum', 3);
    });

    expect(result.current.getLastLevel('two-sum')).toBe(3);
  });

  it('recordLevel 更新级别后返回最新值', () => {
    const { result } = renderHook(() => useReadingProgress());

    act(() => {
      result.current.recordLevel('two-sum', 2);
    });
    act(() => {
      result.current.recordLevel('two-sum', 4);
    });

    expect(result.current.getLastLevel('two-sum')).toBe(4);
  });

  it('多题目独立记录', () => {
    const { result } = renderHook(() => useReadingProgress());

    act(() => {
      result.current.recordLevel('two-sum', 1);
      result.current.recordLevel('valid-parentheses', 3);
    });

    expect(result.current.getLastLevel('two-sum')).toBe(1);
    expect(result.current.getLastLevel('valid-parentheses')).toBe(3);
  });

  it('持久化到 localStorage', () => {
    const { result } = renderHook(() => useReadingProgress());

    act(() => {
      result.current.recordLevel('two-sum', 2);
    });

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(stored['two-sum']).toBeDefined();
    expect(stored['two-sum'].lastLevel).toBe(2);
    expect(stored['two-sum'].lastVisitAt).toBeGreaterThan(0);
  });

  it('从 localStorage 恢复进度', () => {
    const data = {
      'two-sum': { lastLevel: 3, lastVisitAt: Date.now() },
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));

    const { result } = renderHook(() => useReadingProgress());
    expect(result.current.getLastLevel('two-sum')).toBe(3);
  });

  it('LRU 淘汰：超过 200 条时移除最旧的', () => {
    // 预填充 200 条记录
    const data: Record<string, { lastLevel: number; lastVisitAt: number }> = {};
    for (let i = 0; i < 200; i++) {
      data[`problem-${i}`] = {
        lastLevel: 1,
        lastVisitAt: 1000 + i, // 0 最旧，199 最新
      };
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));

    const { result } = renderHook(() => useReadingProgress());

    // 添加第 201 条
    act(() => {
      result.current.recordLevel('new-problem', 5);
    });

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    const keys = Object.keys(stored);

    // 应该是 200 条（淘汰了最旧的 problem-0）
    expect(keys.length).toBe(200);
    expect(stored['new-problem']).toBeDefined();
    expect(stored['problem-0']).toBeUndefined();
    // 较新的应保留
    expect(stored['problem-199']).toBeDefined();
  });

  it('getRecordCount 返回正确数量', () => {
    const { result } = renderHook(() => useReadingProgress());

    act(() => {
      result.current.recordLevel('p1', 1);
      result.current.recordLevel('p2', 2);
      result.current.recordLevel('p3', 3);
    });

    expect(result.current.getRecordCount()).toBe(3);
  });

  it('localStorage 损坏时静默降级', () => {
    localStorage.setItem(STORAGE_KEY, 'invalid-json{{{');

    const { result } = renderHook(() => useReadingProgress());
    expect(result.current.getLastLevel('any')).toBeNull();
    expect(result.current.getRecordCount()).toBe(0);
  });
});
