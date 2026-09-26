// Regression: ISSUE-003 — interactive API must use the store's named export.
// Found by /qa on 2026-09-26
// Report: .gstack/qa-reports/qa-report-localhost-2026-09-26.md
import { feynmanApi } from '@/lib/api';

jest.mock('@/store', () => ({
  useAppStore: { getState: () => ({ token: 'test-token' }) },
}));

it('starts a Feynman session with the current auth token', async () => {
  const fetchMock = jest.fn(async () => ({
    ok: true,
    json: async () => ({ code: 200, data: { sessionId: 'session-42' } }),
  }));
  global.fetch = fetchMock as unknown as typeof fetch;

  await expect(feynmanApi.start('user-1', 'problem-2')).resolves.toEqual({ sessionId: 'session-42' });
  expect(fetchMock).toHaveBeenCalledWith(
    expect.stringContaining('/api/v1/feynman/start'),
    expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({ Authorization: 'Bearer test-token' }),
      body: JSON.stringify({ userId: 'user-1', problemId: 'problem-2' }),
    })
  );
});
