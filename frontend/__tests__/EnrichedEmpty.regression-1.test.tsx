// Regression: ISSUE-002 — backend source=empty must activate the parent empty state.
// Found by /qa on 2026-09-26
// Report: .gstack/qa-reports/qa-report-localhost-2026-09-26.md
import { render, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import EnrichedSolutionList from '@/components/enriched/EnrichedSolutionList';

jest.mock('@/components/enriched/CollapsibleCard', () => ({
  __esModule: true,
  default: () => <div>解析卡片</div>,
}));

const fetchList = jest.fn(async () => ({ source: 'empty' as const, enrichedList: null }));
const fetchTags = jest.fn(async () => []);
const fetchDetail = jest.fn(async () => null);

it('reports empty after the backend returns an empty explanation', async () => {
  const onSourceChange = jest.fn();
  render(
    <EnrichedSolutionList
      problemId="42"
      levelCounts={{}}
      fetchList={fetchList}
      fetchTags={fetchTags}
      fetchDetail={fetchDetail}
      onSourceChange={onSourceChange}
    />
  );

  await waitFor(() => expect(onSourceChange).toHaveBeenLastCalledWith('', false));
  expect(fetchList).toHaveBeenCalledWith('42', expect.any(Number));
  expect(fetchTags).toHaveBeenCalledWith('42', expect.any(Number));
});
