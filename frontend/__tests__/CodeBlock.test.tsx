/**
 * CodeBlock 组件单元测试
 * 验证语言 Tab 切换和复制功能
 */
import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import CodeBlock from '@/components/CodeBlock';

// Mock navigator.clipboard
const mockWriteText = jest.fn().mockResolvedValue(undefined);
Object.assign(navigator, {
  clipboard: { writeText: mockWriteText },
});

describe('CodeBlock', () => {
  const mockCode = {
    python: 'def two_sum(nums, target):\n    pass',
    java: 'public int[] twoSum(int[] nums, int target) {}',
    cpp: 'vector<int> twoSum(vector<int>& nums, int target) {}',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('渲染所有语言 Tab', () => {
    render(<CodeBlock code={mockCode} />);
    expect(screen.getByText('Python')).toBeInTheDocument();
    expect(screen.getByText('Java')).toBeInTheDocument();
    expect(screen.getByText('C++')).toBeInTheDocument();
  });

  it('默认显示第一种语言的代码', () => {
    render(<CodeBlock code={mockCode} />);
    // 第一种语言是 python
    expect(screen.getByText('Python').className).toContain('text-blue-600');
  });

  it('点击语言 Tab 切换显示对应代码', () => {
    render(<CodeBlock code={mockCode} />);
    // 切换到 Java
    fireEvent.click(screen.getByText('Java'));
    // Java Tab 应该变为激活状态
    expect(screen.getByText('Java').className).toContain('text-blue-600');
    // Python Tab 应该取消激活
    expect(screen.getByText('Python').className).not.toContain('text-blue-600');
  });

  it('点击复制按钮调用 clipboard API', async () => {
    render(<CodeBlock code={mockCode} />);
    const copyBtn = screen.getByTitle('复制代码');
    await act(async () => {
      fireEvent.click(copyBtn);
    });
    expect(mockWriteText).toHaveBeenCalledWith(mockCode.python);
  });

  it('复制成功后显示"已复制"文案', async () => {
    render(<CodeBlock code={mockCode} />);
    const copyBtn = screen.getByTitle('复制代码');
    await act(async () => {
      fireEvent.click(copyBtn);
    });
    expect(screen.getByText('已复制')).toBeInTheDocument();
  });

  it('复制"已复制"提示 2 秒后消失', async () => {
    render(<CodeBlock code={mockCode} />);
    const copyBtn = screen.getByTitle('复制代码');
    await act(async () => {
      fireEvent.click(copyBtn);
    });
    expect(screen.getByText('已复制')).toBeInTheDocument();
    act(() => {
      jest.advanceTimersByTime(2000);
    });
    expect(screen.queryByText('已复制')).not.toBeInTheDocument();
    expect(screen.getByText('复制')).toBeInTheDocument();
  });

  it('切换语言后复制当前语言代码', async () => {
    render(<CodeBlock code={mockCode} />);
    fireEvent.click(screen.getByText('Java'));
    const copyBtn = screen.getByTitle('复制代码');
    await act(async () => {
      fireEvent.click(copyBtn);
    });
    expect(mockWriteText).toHaveBeenCalledWith(mockCode.java);
  });

  it('无代码时显示空状态', () => {
    render(<CodeBlock code={{}} />);
    expect(screen.getByText('暂无代码')).toBeInTheDocument();
  });
});
