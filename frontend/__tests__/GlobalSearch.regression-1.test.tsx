// Regression: ISSUE-006 — global search must not present hard-coded problem results.
// Found by /qa on 2026-09-26
// Report: .gstack/qa-reports/qa-report-localhost-2026-09-26.md
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import GlobalSearch from '@/components/search/GlobalSearch';

const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

it('routes a query to the real problem list without showing sample matches', () => {
  render(<GlobalSearch />);
  fireEvent(window, new Event('open-global-search'));

  const input = screen.getByPlaceholderText('搜索题目或快速跳转...');
  fireEvent.change(input, { target: { value: '双指针' } });

  expect(screen.getByText('搜索“双指针”')).toBeInTheDocument();
  expect(screen.queryByText('三数之和')).not.toBeInTheDocument();
  fireEvent.keyDown(input, { key: 'Enter' });
  expect(mockPush).toHaveBeenCalledWith('/problems?keyword=%E5%8F%8C%E6%8C%87%E9%92%88');
});
