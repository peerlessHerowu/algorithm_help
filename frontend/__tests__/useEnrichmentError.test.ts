/**
 * useEnrichmentError + resolveErrorAction 单元测试
 */

import { ApiError } from '@/lib/api';
import {
  resolveErrorAction,
  persistRateLimitEndTime,
  loadRateLimitEndTime,
  clearRateLimitEndTime,
} from '@/hooks/useEnrichmentError';
import { EnrichmentErrorCode } from '@/lib/enriched-types';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();
Object.defineProperty(global, 'localStorage', { value: localStorageMock });

describe('resolveErrorAction', () => {
  it('处理重复任务错误码 40001', () => {
    const err = new ApiError(EnrichmentErrorCode.DUPLICATE_TASK, '已有活跃任务', {
      code: 40001,
      data: { taskId: 'task-123' },
    });
    const action = resolveErrorAction(err);
    expect(action).toEqual({ action: 'showProgress', taskId: 'task-123' });
  });

  it('处理频率超限错误码 40002', () => {
    const err = new ApiError(EnrichmentErrorCode.RATE_LIMIT, '频率超限', {
      code: 40002,
      data: { retryAfterSeconds: 120, usedCount: 5, maxCount: 5 },
    });
    const action = resolveErrorAction(err);
    expect(action).toEqual({
      action: 'showCountdown',
      seconds: 120,
      message: '已达上限(5/5次)',
    });
  });

  it('处理乐观锁冲突错误码 40004', () => {
    const err = new ApiError(EnrichmentErrorCode.OPTIMISTIC_LOCK, '版本冲突', {
      code: 40004,
    });
    const action = resolveErrorAction(err);
    expect(action).toEqual({
      action: 'refreshAndToast',
      message: '内容已更新，请查看最新版本',
    });
  });

  it('处理需要登录错误码 40403', () => {
    const err = new ApiError(EnrichmentErrorCode.LOGIN_REQUIRED, '需要登录', {
      code: 40403,
      data: { intent: 'upvote' },
    });
    const action = resolveErrorAction(err);
    expect(action).toEqual({
      action: 'showLoginModal',
      intent: 'upvote',
    });
  });

  it('处理 AI 不可用错误码 50001', () => {
    const err = new ApiError(EnrichmentErrorCode.AI_UNAVAILABLE, 'AI 服务不可用', {
      code: 50001,
    });
    const action = resolveErrorAction(err);
    expect(action).toEqual({
      action: 'showRetry',
      message: 'AI 服务暂时不可用',
    });
  });

  it('处理生成超时错误码 50002', () => {
    const err = new ApiError(EnrichmentErrorCode.GENERATION_TIMEOUT, '超时', {
      code: 50002,
    });
    const action = resolveErrorAction(err);
    expect(action).toEqual({ action: 'showBackgroundHint' });
  });

  it('处理重复投票错误码 40005 → ignore', () => {
    const err = new ApiError(EnrichmentErrorCode.DUPLICATE_VOTE, '已投票', {
      code: 40005,
    });
    const action = resolveErrorAction(err);
    expect(action).toEqual({ action: 'ignore' });
  });

  it('处理未知错误码 → showToast', () => {
    const err = new ApiError(99999, '未知业务错误', { code: 99999 });
    const action = resolveErrorAction(err);
    expect(action).toEqual({ action: 'showToast', message: '未知业务错误' });
  });

  it('处理非 ApiError 异常', () => {
    const err = new Error('网络超时');
    const action = resolveErrorAction(err);
    expect(action).toEqual({ action: 'showToast', message: '网络超时' });
  });
});

describe('RateLimit localStorage 持久化', () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  it('持久化并恢复倒计时数据', () => {
    const endTime = Date.now() + 60000; // 1 分钟后
    persistRateLimitEndTime({ endTime, usedCount: 3, maxCount: 5 });

    const loaded = loadRateLimitEndTime();
    expect(loaded).not.toBeNull();
    expect(loaded!.endTime).toBe(endTime);
    expect(loaded!.usedCount).toBe(3);
    expect(loaded!.maxCount).toBe(5);
  });

  it('过期数据返回 null 并清理', () => {
    const endTime = Date.now() - 1000; // 已过期
    persistRateLimitEndTime({ endTime, usedCount: 5, maxCount: 5 });

    const loaded = loadRateLimitEndTime();
    expect(loaded).toBeNull();
  });

  it('clearRateLimitEndTime 清除记录', () => {
    persistRateLimitEndTime({
      endTime: Date.now() + 60000,
      usedCount: 5,
      maxCount: 5,
    });
    clearRateLimitEndTime();
    const loaded = loadRateLimitEndTime();
    expect(loaded).toBeNull();
  });

  it('localStorage 为空时返回 null', () => {
    const loaded = loadRateLimitEndTime();
    expect(loaded).toBeNull();
  });
});
