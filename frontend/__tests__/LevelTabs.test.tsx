/**
 * LevelTabs 组件单元测试
 * 验证点击切换级别回调、禁用状态
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import LevelTabs from '@/components/LevelTabs';

describe('LevelTabs', () => {
  const defaultProps = {
    activeLevel: 3,
    onLevelChange: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('渲染 L1-L5 五个标签按钮', () => {
    render(<LevelTabs {...defaultProps} />);
    expect(screen.getByText('L1')).toBeInTheDocument();
    expect(screen.getByText('L2')).toBeInTheDocument();
    expect(screen.getByText('L3')).toBeInTheDocument();
    expect(screen.getByText('L4')).toBeInTheDocument();
    expect(screen.getByText('L5')).toBeInTheDocument();
  });

  it('当前选中级别有高亮样式', () => {
    render(<LevelTabs {...defaultProps} activeLevel={3} />);
    const activeButton = screen.getByText('L3').closest('button')!;
    expect(activeButton.className).toContain('bg-white');
    expect(activeButton.className).toContain('text-blue-600');
    expect(activeButton).toHaveAttribute('aria-selected', 'true');
  });

  it('非选中级别无高亮样式', () => {
    render(<LevelTabs {...defaultProps} activeLevel={3} />);
    const inactiveButton = screen.getByText('L1').closest('button')!;
    expect(inactiveButton.className).toContain('text-gray-600');
    expect(inactiveButton).toHaveAttribute('aria-selected', 'false');
  });

  it('点击非当前级别触发 onLevelChange 回调', () => {
    const onLevelChange = jest.fn();
    render(<LevelTabs {...defaultProps} onLevelChange={onLevelChange} />);
    fireEvent.click(screen.getByText('L1').closest('button')!);
    expect(onLevelChange).toHaveBeenCalledWith(1);
  });

  it('点击当前级别不触发 onLevelChange 回调', () => {
    const onLevelChange = jest.fn();
    render(<LevelTabs {...defaultProps} activeLevel={3} onLevelChange={onLevelChange} />);
    fireEvent.click(screen.getByText('L3').closest('button')!);
    expect(onLevelChange).not.toHaveBeenCalled();
  });

  it('loading 状态下按钮被禁用', () => {
    render(<LevelTabs {...defaultProps} loading={true} />);
    const buttons = screen.getAllByRole('tab');
    buttons.forEach((btn) => {
      expect(btn).toBeDisabled();
    });
  });

  it('loading 状态下点击不触发 onLevelChange', () => {
    const onLevelChange = jest.fn();
    render(<LevelTabs {...defaultProps} loading={true} onLevelChange={onLevelChange} />);
    fireEvent.click(screen.getByText('L1').closest('button')!);
    expect(onLevelChange).not.toHaveBeenCalled();
  });

  it('loading 状态下按钮有透明度样式', () => {
    render(<LevelTabs {...defaultProps} loading={true} />);
    const button = screen.getByText('L1').closest('button')!;
    expect(button.className).toContain('opacity-60');
    expect(button.className).toContain('cursor-not-allowed');
  });
});
