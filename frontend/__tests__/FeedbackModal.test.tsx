/**
 * FeedbackModal 组件单元测试
 * 验证：弹窗渲染、表单校验、提交流程、toast 提示、关闭行为、无障碍属性
 */
import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import FeedbackModal from '@/components/enriched/FeedbackModal';

describe('FeedbackModal', () => {
  const defaultProps = {
    isOpen: true,
    enrichedId: 'enriched-123',
    onSubmit: jest.fn().mockResolvedValue(undefined),
    onClose: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('isOpen=false 时不渲染', () => {
    render(<FeedbackModal {...defaultProps} isOpen={false} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('isOpen=true 时渲染弹窗', () => {
    render(<FeedbackModal {...defaultProps} />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('🐛 纠错反馈')).toBeInTheDocument();
  });

  it('渲染所有错误类型选项', () => {
    render(<FeedbackModal {...defaultProps} />);
    const select = screen.getByLabelText('错误类型');
    expect(select).toBeInTheDocument();
    expect(screen.getByText('代码错误')).toBeInTheDocument();
    expect(screen.getByText('逻辑错误')).toBeInTheDocument();
    expect(screen.getByText('表述不清')).toBeInTheDocument();
    expect(screen.getByText('内容过时')).toBeInTheDocument();
    expect(screen.getByText('其他')).toBeInTheDocument();
  });

  it('描述不足 10 字时提交显示校验错误', () => {
    render(<FeedbackModal {...defaultProps} />);
    const textarea = screen.getByLabelText('错误描述');
    fireEvent.change(textarea, { target: { value: '太短了' } });
    fireEvent.click(screen.getByText('提交反馈'));
    expect(screen.getByText(/描述至少 10 字/)).toBeInTheDocument();
    expect(defaultProps.onSubmit).not.toHaveBeenCalled();
  });

  it('描述为空时提交显示校验错误', () => {
    render(<FeedbackModal {...defaultProps} />);
    fireEvent.click(screen.getByText('提交反馈'));
    expect(screen.getByText(/描述至少 10 字/)).toBeInTheDocument();
  });

  it('描述满足条件时成功提交', async () => {
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    render(<FeedbackModal {...defaultProps} onSubmit={onSubmit} />);

    const textarea = screen.getByLabelText('错误描述');
    fireEvent.change(textarea, { target: { value: '这里有一个代码逻辑上的错误需要修复' } });

    const select = screen.getByLabelText('错误类型');
    fireEvent.change(select, { target: { value: 'LOGIC_ERROR' } });

    fireEvent.click(screen.getByText('提交反馈'));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        errorType: 'LOGIC_ERROR',
        description: '这里有一个代码逻辑上的错误需要修复',
      });
    });
  });

  it('提交成功后显示 toast 并关闭弹窗', async () => {
    const onClose = jest.fn();
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    render(<FeedbackModal {...defaultProps} onSubmit={onSubmit} onClose={onClose} />);

    const textarea = screen.getByLabelText('错误描述');
    fireEvent.change(textarea, { target: { value: '这个代码示例中有一个 off-by-one 错误' } });
    fireEvent.click(screen.getByText('提交反馈'));

    await waitFor(() => {
      expect(screen.getByText('反馈已提交，感谢你的贡献！')).toBeInTheDocument();
    });

    // toast 1.5 秒后关闭弹窗
    act(() => { jest.advanceTimersByTime(1500); });
    expect(onClose).toHaveBeenCalled();
  });

  it('提交失败时显示错误 toast', async () => {
    const onSubmit = jest.fn().mockRejectedValue(new Error('网络错误'));
    render(<FeedbackModal {...defaultProps} onSubmit={onSubmit} />);

    const textarea = screen.getByLabelText('错误描述');
    fireEvent.change(textarea, { target: { value: '这个代码示例中有一个 off-by-one 错误' } });
    fireEvent.click(screen.getByText('提交反馈'));

    await waitFor(() => {
      expect(screen.getByText('提交失败，请稍后重试')).toBeInTheDocument();
    });
  });

  it('按 Escape 键调用 onClose', () => {
    const onClose = jest.fn();
    render(<FeedbackModal {...defaultProps} onClose={onClose} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('点击遮罩层调用 onClose', () => {
    const onClose = jest.fn();
    render(<FeedbackModal {...defaultProps} onClose={onClose} />);
    const overlay = screen.getByRole('dialog');
    fireEvent.click(overlay);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('点击取消按钮调用 onClose', () => {
    const onClose = jest.fn();
    render(<FeedbackModal {...defaultProps} onClose={onClose} />);
    fireEvent.click(screen.getByText('取消'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('弹窗有正确的无障碍属性', () => {
    render(<FeedbackModal {...defaultProps} />);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-labelledby', 'feedback-modal-title');
  });

  it('显示字数统计', () => {
    render(<FeedbackModal {...defaultProps} />);
    expect(screen.getByText('0/500')).toBeInTheDocument();
  });
});
