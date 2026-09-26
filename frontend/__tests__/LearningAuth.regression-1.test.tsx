// Regression: ISSUE-008 — guest sessions cannot pass the JWT WebSocket handshake.
// Found by /qa on 2026-09-26
// Report: .gstack/qa-reports/qa-report-localhost-2026-09-26.md
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import FeynmanPage from '@/app/feynman/page';
import SocraticPage from '@/app/socratic/page';
import { feynmanApi, socraticApi } from '@/lib/api';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
jest.mock('@/store', () => ({
  useAppStore: () => ({ user: null, token: null }),
}));
jest.mock('@/hooks/useWebSocket', () => ({
  useWebSocket: () => ({ state: 'disconnected', send: jest.fn(), subscribe: () => jest.fn() }),
}));
jest.mock('@/lib/api', () => ({
  feynmanApi: { start: jest.fn() },
  socraticApi: { start: jest.fn() },
  problemsApi: { get: jest.fn() },
}));

it.each([
  ['费曼学习', FeynmanPage],
  ['苏格拉底追问', SocraticPage],
])('%s asks guests to log in before creating a session', (_name, Page) => {
  render(<Page />);
  expect(screen.getByText('登录后开始 AI 对话')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '去登录' })).toBeInTheDocument();
  expect(feynmanApi.start).not.toHaveBeenCalled();
  expect(socraticApi.start).not.toHaveBeenCalled();
});
