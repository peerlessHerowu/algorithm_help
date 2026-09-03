/**
 * useVote Hook 单元测试
 * 验证：乐观更新、互斥逻辑、未登录拦截、API 失败回滚、取消投票
 */
import { renderHook, act, waitFor } from '@testing-library/react';
import { useVote, type VoteState } from '@/hooks/useVote';

// Mock fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Mock useAppStore
jest.mock('@/store', () => ({
  useAppStore: {
    getState: () => ({ token: 'test-token' }),
  },
}));

/** 构造成功的 API 响应 */
function mockSuccess(data: unknown = {}) {
  return Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ code: 200, data }),
  } as Response);
}

/** 构造失败的 API 响应 */
function mockFailure(status = 500, message = '服务器错误') {
  return Promise.resolve({
    ok: false,
    status,
    json: () => Promise.resolve({ message }),
  } as Response);
}

describe('useVote', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockReset();
  });

  describe('初始状态', () => {
    it('默认状态为 NONE，计数为 0', () => {
      const { result } = renderHook(() =>
        useVote({ enrichedId: 'test-1', isLoggedIn: true })
      );
      expect(result.current.voteState).toBe('NONE');
      expect(result.current.upvoteCount).toBe(0);
      expect(result.current.downvoteCount).toBe(0);
      expect(result.current.isLoading).toBe(false);
    });

    it('使用传入的初始值', () => {
      const { result } = renderHook(() =>
        useVote({
          enrichedId: 'test-1',
          initialUpvoteCount: 10,
          initialDownvoteCount: 3,
          initialVoteState: 'UP',
          isLoggedIn: true,
        })
      );
      expect(result.current.voteState).toBe('UP');
      expect(result.current.upvoteCount).toBe(10);
      expect(result.current.downvoteCount).toBe(3);
    });
  });

  describe('未登录拦截', () => {
    it('未登录点赞时触发 onLoginRequired', async () => {
      const onLoginRequired = jest.fn();
      const { result } = renderHook(() =>
        useVote({
          enrichedId: 'test-1',
          isLoggedIn: false,
          onLoginRequired,
        })
      );

      await act(async () => {
        await result.current.handleUpvote();
      });

      expect(onLoginRequired).toHaveBeenCalledWith('upvote');
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('未登录点踩时触发 onLoginRequired', async () => {
      const onLoginRequired = jest.fn();
      const { result } = renderHook(() =>
        useVote({
          enrichedId: 'test-1',
          isLoggedIn: false,
          onLoginRequired,
        })
      );

      await act(async () => {
        await result.current.handleDownvote();
      });

      expect(onLoginRequired).toHaveBeenCalledWith('downvote');
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe('乐观更新：点赞', () => {
    it('从 NONE → UP：upvoteCount + 1', async () => {
      mockFetch.mockReturnValue(mockSuccess());
      const { result } = renderHook(() =>
        useVote({
          enrichedId: 'test-1',
          initialUpvoteCount: 5,
          initialDownvoteCount: 2,
          isLoggedIn: true,
        })
      );

      await act(async () => {
        await result.current.handleUpvote();
      });

      expect(result.current.voteState).toBe('UP');
      expect(result.current.upvoteCount).toBe(6);
      expect(result.current.downvoteCount).toBe(2);
    });

    it('从 DOWN → UP：downvoteCount - 1, upvoteCount + 1', async () => {
      mockFetch.mockReturnValue(mockSuccess());
      const { result } = renderHook(() =>
        useVote({
          enrichedId: 'test-1',
          initialUpvoteCount: 5,
          initialDownvoteCount: 2,
          initialVoteState: 'DOWN',
          isLoggedIn: true,
        })
      );

      await act(async () => {
        await result.current.handleUpvote();
      });

      expect(result.current.voteState).toBe('UP');
      expect(result.current.upvoteCount).toBe(6);
      expect(result.current.downvoteCount).toBe(1);
    });

    it('从 UP 再点赞 → 取消（NONE）：upvoteCount - 1', async () => {
      mockFetch.mockReturnValue(mockSuccess());
      const { result } = renderHook(() =>
        useVote({
          enrichedId: 'test-1',
          initialUpvoteCount: 5,
          initialVoteState: 'UP',
          isLoggedIn: true,
        })
      );

      await act(async () => {
        await result.current.handleUpvote();
      });

      expect(result.current.voteState).toBe('NONE');
      expect(result.current.upvoteCount).toBe(4);
    });
  });

  describe('乐观更新：踩', () => {
    it('从 NONE → DOWN：downvoteCount + 1', async () => {
      mockFetch.mockReturnValue(mockSuccess());
      const { result } = renderHook(() =>
        useVote({
          enrichedId: 'test-1',
          initialUpvoteCount: 5,
          initialDownvoteCount: 2,
          isLoggedIn: true,
        })
      );

      await act(async () => {
        await result.current.handleDownvote();
      });

      expect(result.current.voteState).toBe('DOWN');
      expect(result.current.downvoteCount).toBe(3);
      expect(result.current.upvoteCount).toBe(5);
    });

    it('从 UP → DOWN：upvoteCount - 1, downvoteCount + 1', async () => {
      mockFetch.mockReturnValue(mockSuccess());
      const { result } = renderHook(() =>
        useVote({
          enrichedId: 'test-1',
          initialUpvoteCount: 5,
          initialDownvoteCount: 2,
          initialVoteState: 'UP',
          isLoggedIn: true,
        })
      );

      await act(async () => {
        await result.current.handleDownvote();
      });

      expect(result.current.voteState).toBe('DOWN');
      expect(result.current.upvoteCount).toBe(4);
      expect(result.current.downvoteCount).toBe(3);
    });

    it('从 DOWN 再点踩 → 取消（NONE）：downvoteCount - 1', async () => {
      mockFetch.mockReturnValue(mockSuccess());
      const { result } = renderHook(() =>
        useVote({
          enrichedId: 'test-1',
          initialDownvoteCount: 2,
          initialVoteState: 'DOWN',
          isLoggedIn: true,
        })
      );

      await act(async () => {
        await result.current.handleDownvote();
      });

      expect(result.current.voteState).toBe('NONE');
      expect(result.current.downvoteCount).toBe(1);
    });
  });

  describe('API 失败回滚', () => {
    it('点赞 API 失败时回滚到原始状态', async () => {
      mockFetch.mockReturnValue(mockFailure(500, '服务器错误'));
      const onError = jest.fn();
      const { result } = renderHook(() =>
        useVote({
          enrichedId: 'test-1',
          initialUpvoteCount: 5,
          initialDownvoteCount: 2,
          isLoggedIn: true,
          onError,
        })
      );

      await act(async () => {
        await result.current.handleUpvote();
      });

      // 应该回滚
      expect(result.current.voteState).toBe('NONE');
      expect(result.current.upvoteCount).toBe(5);
      expect(result.current.downvoteCount).toBe(2);
      expect(onError).toHaveBeenCalledWith('服务器错误');
    });

    it('踩 API 失败时回滚到原始状态', async () => {
      mockFetch.mockReturnValue(mockFailure(500, '网络异常'));
      const onError = jest.fn();
      const { result } = renderHook(() =>
        useVote({
          enrichedId: 'test-1',
          initialUpvoteCount: 5,
          initialDownvoteCount: 2,
          isLoggedIn: true,
          onError,
        })
      );

      await act(async () => {
        await result.current.handleDownvote();
      });

      expect(result.current.voteState).toBe('NONE');
      expect(result.current.upvoteCount).toBe(5);
      expect(result.current.downvoteCount).toBe(2);
      expect(onError).toHaveBeenCalledWith('网络异常');
    });
  });

  describe('取消投票', () => {
    it('handleCancelVote 从 UP → NONE', async () => {
      mockFetch.mockReturnValue(mockSuccess());
      const { result } = renderHook(() =>
        useVote({
          enrichedId: 'test-1',
          initialUpvoteCount: 5,
          initialVoteState: 'UP',
          isLoggedIn: true,
        })
      );

      await act(async () => {
        await result.current.handleCancelVote();
      });

      expect(result.current.voteState).toBe('NONE');
      expect(result.current.upvoteCount).toBe(4);
    });

    it('handleCancelVote 从 DOWN → NONE', async () => {
      mockFetch.mockReturnValue(mockSuccess());
      const { result } = renderHook(() =>
        useVote({
          enrichedId: 'test-1',
          initialDownvoteCount: 3,
          initialVoteState: 'DOWN',
          isLoggedIn: true,
        })
      );

      await act(async () => {
        await result.current.handleCancelVote();
      });

      expect(result.current.voteState).toBe('NONE');
      expect(result.current.downvoteCount).toBe(2);
    });

    it('NONE 状态下 handleCancelVote 无操作', async () => {
      const { result } = renderHook(() =>
        useVote({
          enrichedId: 'test-1',
          isLoggedIn: true,
        })
      );

      await act(async () => {
        await result.current.handleCancelVote();
      });

      expect(mockFetch).not.toHaveBeenCalled();
      expect(result.current.voteState).toBe('NONE');
    });
  });

  describe('API 调用正确性', () => {
    it('upvote 调用 POST /enriched/{id}/upvote', async () => {
      mockFetch.mockReturnValue(mockSuccess());
      const { result } = renderHook(() =>
        useVote({ enrichedId: 'abc-123', isLoggedIn: true })
      );

      await act(async () => {
        await result.current.handleUpvote();
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8080/api/v1/enriched/abc-123/upvote',
        expect.objectContaining({ method: 'POST' })
      );
    });

    it('downvote 调用 POST /enriched/{id}/downvote', async () => {
      mockFetch.mockReturnValue(mockSuccess());
      const { result } = renderHook(() =>
        useVote({ enrichedId: 'abc-123', isLoggedIn: true })
      );

      await act(async () => {
        await result.current.handleDownvote();
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8080/api/v1/enriched/abc-123/downvote',
        expect.objectContaining({ method: 'POST' })
      );
    });

    it('cancel 调用 DELETE /enriched/{id}/vote', async () => {
      mockFetch.mockReturnValue(mockSuccess());
      const { result } = renderHook(() =>
        useVote({
          enrichedId: 'abc-123',
          initialVoteState: 'UP',
          isLoggedIn: true,
        })
      );

      await act(async () => {
        await result.current.handleCancelVote();
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8080/api/v1/enriched/abc-123/vote',
        expect.objectContaining({ method: 'DELETE' })
      );
    });

    it('请求携带 Authorization header', async () => {
      mockFetch.mockReturnValue(mockSuccess());
      const { result } = renderHook(() =>
        useVote({ enrichedId: 'abc-123', isLoggedIn: true })
      );

      await act(async () => {
        await result.current.handleUpvote();
      });

      const fetchCall = mockFetch.mock.calls[0];
      const headers = fetchCall[1].headers;
      expect(headers['Authorization']).toBe('Bearer test-token');
    });
  });
});
