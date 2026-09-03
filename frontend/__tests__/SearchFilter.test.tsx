/**
 * SearchFilter 组件单元测试
 * 验证搜索输入、难度筛选切换、回调触发
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import SearchFilter from '@/components/SearchFilter';

describe('SearchFilter', () => {
  const defaultProps = {
    keyword: '',
    difficulty: '' as const,
    onKeywordChange: jest.fn(),
    onDifficultyChange: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('渲染搜索输入框和难度下拉框', () => {
    render(<SearchFilter {...defaultProps} />);
    expect(screen.getByPlaceholderText('搜索题目...')).toBeInTheDocument();
    expect(screen.getByText('全部难度')).toBeInTheDocument();
  });

  it('输入搜索关键词触发 onKeywordChange 回调', () => {
    const onKeywordChange = jest.fn();
    render(<SearchFilter {...defaultProps} onKeywordChange={onKeywordChange} />);
    const input = screen.getByPlaceholderText('搜索题目...');
    fireEvent.change(input, { target: { value: '两数之和' } });
    expect(onKeywordChange).toHaveBeenCalledWith('两数之和');
  });

  it('选择难度筛选触发 onDifficultyChange 回调', () => {
    const onDifficultyChange = jest.fn();
    render(<SearchFilter {...defaultProps} onDifficultyChange={onDifficultyChange} />);
    const select = screen.getByDisplayValue('全部难度');
    fireEvent.change(select, { target: { value: 'EASY' } });
    expect(onDifficultyChange).toHaveBeenCalledWith('EASY');
  });

  it('展示所有难度选项', () => {
    render(<SearchFilter {...defaultProps} />);
    const select = screen.getByDisplayValue('全部难度');
    const options = select.querySelectorAll('option');
    expect(options).toHaveLength(4);
    expect(options[0].textContent).toBe('全部难度');
    expect(options[1].textContent).toBe('简单');
    expect(options[2].textContent).toBe('中等');
    expect(options[3].textContent).toBe('困难');
  });

  it('回显当前关键词值', () => {
    render(<SearchFilter {...defaultProps} keyword="动态规划" />);
    const input = screen.getByPlaceholderText('搜索题目...') as HTMLInputElement;
    expect(input.value).toBe('动态规划');
  });

  it('回显当前难度筛选值', () => {
    render(<SearchFilter {...defaultProps} difficulty="HARD" />);
    const select = screen.getByDisplayValue('困难') as HTMLSelectElement;
    expect(select.value).toBe('HARD');
  });
});
