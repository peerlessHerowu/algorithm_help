import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import ProblemHeader from '@/components/enriched/ProblemHeader';

describe('ProblemHeader', () => {
  const baseProps = {
    title: 'Two Sum',
    titleCn: '两数之和',
    difficulty: 'EASY' as const,
    tags: ['数组', '哈希表'],
    lang: 'cn' as const,
    onToggleLang: jest.fn(),
    hasChineseContent: true,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('中文模式显示中文标题', () => {
    render(<ProblemHeader {...baseProps} />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('两数之和');
  });

  it('英文模式显示英文标题', () => {
    render(<ProblemHeader {...baseProps} lang="en" />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Two Sum');
  });

  it('无中文标题时始终显示英文标题', () => {
    render(<ProblemHeader {...baseProps} titleCn={undefined} lang="cn" />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Two Sum');
  });

  it('显示难度标签 - 简单/绿色', () => {
    render(<ProblemHeader {...baseProps} difficulty="EASY" />);
    const badge = screen.getByText('简单');
    expect(badge).toBeInTheDocument();
    expect(badge.className).toContain('bg-green');
  });

  it('显示难度标签 - 中等/黄色', () => {
    render(<ProblemHeader {...baseProps} difficulty="MEDIUM" />);
    const badge = screen.getByText('中等');
    expect(badge).toBeInTheDocument();
    expect(badge.className).toContain('bg-yellow');
  });

  it('显示难度标签 - 困难/红色', () => {
    render(<ProblemHeader {...baseProps} difficulty="HARD" />);
    const badge = screen.getByText('困难');
    expect(badge).toBeInTheDocument();
    expect(badge.className).toContain('bg-red');
  });

  it('显示分类标签', () => {
    render(<ProblemHeader {...baseProps} />);
    expect(screen.getByText('数组')).toBeInTheDocument();
    expect(screen.getByText('哈希表')).toBeInTheDocument();
  });

  it('空标签数组时不渲染标签区域', () => {
    const { container } = render(<ProblemHeader {...baseProps} tags={[]} />);
    expect(container.querySelectorAll('.flex.flex-wrap')).toHaveLength(0);
  });

  it('中文模式下显示 EN 切换按钮', () => {
    render(<ProblemHeader {...baseProps} lang="cn" />);
    expect(screen.getByText('EN')).toBeInTheDocument();
  });

  it('英文模式下显示 中 切换按钮', () => {
    render(<ProblemHeader {...baseProps} lang="en" />);
    expect(screen.getByText('中')).toBeInTheDocument();
  });

  it('点击切换按钮调用 onToggleLang', () => {
    render(<ProblemHeader {...baseProps} />);
    fireEvent.click(screen.getByText('EN'));
    expect(baseProps.onToggleLang).toHaveBeenCalledTimes(1);
  });

  it('无中文内容时不显示切换按钮', () => {
    render(<ProblemHeader {...baseProps} hasChineseContent={false} />);
    expect(screen.queryByText('EN')).not.toBeInTheDocument();
    expect(screen.queryByText('中')).not.toBeInTheDocument();
  });
});
