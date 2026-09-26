// Regression: ISSUE-001 — failed session creation must not fake readiness or consume input.
// Found by /qa on 2026-09-26
// Report: .gstack/qa-reports/qa-report-localhost-2026-09-26.md
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import FeynmanPage from '@/app/feynman/page';
import SocraticPage from '@/app/socratic/page';

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
  feynmanApi: { start: () => Promise.reject(new Error('Service unavailable')) },
  socraticApi: { start: () => Promise.reject(new Error('Service unavailable')) },
  problemsApi: { get: jest.fn() },
}));

beforeAll(() => {
  Element.prototype.scrollIntoView = jest.fn();
});

describe('unavailable learning sessions', () => {
  it('keeps Feynman input and progress when no session was created', async () => {
    render(<FeynmanPage />);
    await waitFor(() => expect(screen.getAllByText('无法建立费曼会话，请检查服务后刷新页面重试。')).toHaveLength(1));

    const input = screen.getByRole('textbox', { name: /用你的话解释/ });
    fireEvent.change(input, { target: { value: '双指针从两端扫描' } });
    fireEvent.click(screen.getByRole('button', { name: '发送' }));

    expect(input).toHaveValue('双指针从两端扫描');
    expect(screen.getByText('当前轮次').parentElement).toHaveTextContent('0 / 20');
    expect(screen.queryByText('你：')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /结束并总结/ })).toBeDisabled();
  });

  it('keeps Socratic input and blocks summary without a session', async () => {
    render(<SocraticPage />);
    await waitFor(() => expect(screen.getAllByText('无法建立苏格拉底会话，请检查服务后刷新页面重试。')).toHaveLength(1));

    const input = screen.getByRole('textbox', { name: /分享你的解题思路/ });
    fireEvent.change(input, { target: { value: '先列出边界条件' } });
    fireEvent.click(screen.getByRole('button', { name: '回答' }));

    expect(input).toHaveValue('先列出边界条件');
    expect(screen.queryByText('先列出边界条件', { selector: 'div' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /我解出了/ })).toBeDisabled();
  });
});
