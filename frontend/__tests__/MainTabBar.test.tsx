/**
 * MainTabBar 组件单元测试
 * 测试点：渲染 4 Tab、激活状态、切换回调、指示条定位
 */
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import MainTabBar, { MAIN_TABS } from '@/components/enriched/MainTabBar';
import type { MainTabKey } from '@/components/enriched/MainTabBar';

describe('MainTabBar 组件', () => {
  const mockOnTabChange = jest.fn();

  beforeEach(() => {
    mockOnTabChange.mockClear();
  });

  it('渲染 4 个 Tab 按钮及其标签', () => {
    render(<MainTabBar activeTab="ai" onTabChange={mockOnTabChange} />);

    expect(screen.getByText('AI深度解析')).toBeInTheDocument();
    expect(screen.getByText('原始题解')).toBeInTheDocument();
    expect(screen.getByText('用户题解')).toBeInTheDocument();
    expect(screen.getByText('评论')).toBeInTheDocument();
  });

  it('渲染 4 个 Tab 的 emoji 图标', () => {
    render(<MainTabBar activeTab="ai" onTabChange={mockOnTabChange} />);

    expect(screen.getByText('📖')).toBeInTheDocument();
    expect(screen.getByText('📋')).toBeInTheDocument();
    expect(screen.getByText('📝')).toBeInTheDocument();
    expect(screen.getByText('💬')).toBeInTheDocument();
  });

  it('当前激活 Tab 具有正确的 aria-selected 属性', () => {
    render(<MainTabBar activeTab="raw" onTabChange={mockOnTabChange} />);

    const tabs = screen.getAllByRole('tab');
    // ai tab
    expect(tabs[0]).toHaveAttribute('aria-selected', 'false');
    // raw tab（激活）
    expect(tabs[1]).toHaveAttribute('aria-selected', 'true');
    // user tab
    expect(tabs[2]).toHaveAttribute('aria-selected', 'false');
    // comment tab
    expect(tabs[3]).toHaveAttribute('aria-selected', 'false');
  });

  it('点击 Tab 触发 onTabChange 回调并传入正确的 key', () => {
    render(<MainTabBar activeTab="ai" onTabChange={mockOnTabChange} />);

    fireEvent.click(screen.getByText('原始题解'));
    expect(mockOnTabChange).toHaveBeenCalledWith('raw');

    fireEvent.click(screen.getByText('用户题解'));
    expect(mockOnTabChange).toHaveBeenCalledWith('user');

    fireEvent.click(screen.getByText('评论'));
    expect(mockOnTabChange).toHaveBeenCalledWith('comment');

    fireEvent.click(screen.getByText('AI深度解析'));
    expect(mockOnTabChange).toHaveBeenCalledWith('ai');

    expect(mockOnTabChange).toHaveBeenCalledTimes(4);
  });

  it('激活 Tab 文本颜色为蓝色', () => {
    render(<MainTabBar activeTab="comment" onTabChange={mockOnTabChange} />);

    const commentTab = screen.getAllByRole('tab')[3];
    expect(commentTab.className).toContain('text-blue-600');

    const aiTab = screen.getAllByRole('tab')[0];
    expect(aiTab.className).toContain('text-gray-500');
  });

  it('MAIN_TABS 配置包含 4 个项目且顺序正确', () => {
    expect(MAIN_TABS).toHaveLength(4);
    expect(MAIN_TABS[0].key).toBe('ai');
    expect(MAIN_TABS[1].key).toBe('raw');
    expect(MAIN_TABS[2].key).toBe('user');
    expect(MAIN_TABS[3].key).toBe('comment');
  });
});
