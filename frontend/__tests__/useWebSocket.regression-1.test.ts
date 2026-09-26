// Regression: ISSUE-007 — WebSocket state changes must rerender consumers.
// Found by /qa on 2026-09-26
// Report: .gstack/qa-reports/qa-report-localhost-2026-09-26.md
import { renderHook, act } from '@testing-library/react';
import { useWebSocket } from '@/hooks/useWebSocket';

jest.mock('@/store', () => ({
  useAppStore: { getState: () => ({ token: 'test-token' }) },
}));

class MockWebSocket {
  static OPEN = 1;
  static instances: MockWebSocket[] = [];
  readyState = 0;
  onopen: (() => void) | null = null;
  onclose: ((event: { code: number; reason: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  onmessage: (() => void) | null = null;
  send = jest.fn();
  close = jest.fn();

  constructor(_url: string) {
    MockWebSocket.instances.push(this);
  }
}

it('publishes connected and reconnecting states to the caller', () => {
  const original = global.WebSocket;
  global.WebSocket = MockWebSocket as unknown as typeof WebSocket;
  try {
    const { result, unmount } = renderHook(() => useWebSocket({ autoConnect: false }));
    act(() => result.current.connect());
    expect(result.current.state).toBe('connecting');

    const socket = MockWebSocket.instances[0];
    act(() => { socket.readyState = MockWebSocket.OPEN; socket.onopen?.(); });
    expect(result.current.state).toBe('connected');

    act(() => socket.onclose?.({ code: 1006, reason: '' }));
    expect(result.current.state).toBe('reconnecting');
    unmount();
  } finally {
    global.WebSocket = original;
  }
});
