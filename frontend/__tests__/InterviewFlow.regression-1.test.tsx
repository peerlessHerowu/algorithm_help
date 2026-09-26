// Regression: interview startup must not fabricate a session or report when services fail.
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import InterviewPage from '@/app/interview/page';
import { interviewApi } from '@/lib/api';

jest.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(),
}));
jest.mock('@/store', () => ({
  useAppStore: () => ({ user: { id: 'user-1' }, token: 'token' }),
}));
jest.mock('@/hooks/useWebSocket', () => ({
  useWebSocket: () => ({ state: 'connected', send: jest.fn(), subscribe: () => jest.fn() }),
}));
jest.mock('@/lib/api', () => ({
  interviewApi: { start: jest.fn(), end: jest.fn() },
}));

it('keeps the configuration visible when session creation fails', async () => {
  jest.mocked(interviewApi.start).mockRejectedValueOnce(new Error('服务暂不可用'));
  render(<InterviewPage />);
  fireEvent.click(screen.getByRole('button', { name: '开始面试' }));
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('服务暂不可用'));
  expect(screen.getByRole('button', { name: '开始面试' })).toBeEnabled();
  expect(screen.queryByText('面试评分报告')).not.toBeInTheDocument();
});
