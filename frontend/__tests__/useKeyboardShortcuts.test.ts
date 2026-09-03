/**
 * useKeyboardShortcuts Hook 测试
 * 验证键盘快捷键的核心逻辑：
 * - J/K 聚焦切换
 * - Enter/Space 展开/收起
 * - 1-5 切换级别
 * - Esc 收起卡片
 * - 输入框获焦时禁用快捷键
 */

import { renderHook } from '@testing-library/react';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';

// 模拟 scrollIntoView
Element.prototype.scrollIntoView = jest.fn();

describe('useKeyboardShortcuts', () => {
  const mockCardIds = ['card-1', 'card-2', 'card-3'];
  const mockOnFocusChange = jest.fn();
  const mockOnToggleCard = jest.fn();
  const mockOnLevelChange = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    // 添加 data-card-id 元素到 DOM
    document.body.innerHTML = mockCardIds
      .map((id) => `<div data-card-id="${id}"></div>`)
      .join('');
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  function renderShortcuts(overrides = {}) {
    return renderHook(() =>
      useKeyboardShortcuts({
        cardIds: mockCardIds,
        focusedCardId: null,
        expandedIds: new Set(),
        onFocusChange: mockOnFocusChange,
        onToggleCard: mockOnToggleCard,
        onLevelChange: mockOnLevelChange,
        ...overrides,
      })
    );
  }

  function pressKey(key: string) {
    document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
  }

  it('J 键聚焦下一张卡片', () => {
    renderShortcuts({ focusedCardId: 'card-1' });
    pressKey('j');
    expect(mockOnFocusChange).toHaveBeenCalledWith('card-2');
  });

  it('K 键聚焦上一张卡片', () => {
    renderShortcuts({ focusedCardId: 'card-2' });
    pressKey('k');
    expect(mockOnFocusChange).toHaveBeenCalledWith('card-1');
  });

  it('J 键在最后一张时不越界', () => {
    renderShortcuts({ focusedCardId: 'card-3' });
    pressKey('j');
    expect(mockOnFocusChange).toHaveBeenCalledWith('card-3');
  });

  it('K 键在第一张时不越界', () => {
    renderShortcuts({ focusedCardId: 'card-1' });
    pressKey('k');
    expect(mockOnFocusChange).toHaveBeenCalledWith('card-1');
  });

  it('Enter 键展开当前聚焦卡片', () => {
    renderShortcuts({ focusedCardId: 'card-2' });
    pressKey('Enter');
    expect(mockOnToggleCard).toHaveBeenCalledWith('card-2');
  });

  it('Space 键展开当前聚焦卡片', () => {
    renderShortcuts({ focusedCardId: 'card-1' });
    pressKey(' ');
    expect(mockOnToggleCard).toHaveBeenCalledWith('card-1');
  });

  it('Esc 键收起当前已展开卡片', () => {
    renderShortcuts({
      focusedCardId: 'card-1',
      expandedIds: new Set(['card-1']),
    });
    pressKey('Escape');
    expect(mockOnToggleCard).toHaveBeenCalledWith('card-1');
  });

  it('Esc 键在卡片未展开时不触发', () => {
    renderShortcuts({
      focusedCardId: 'card-1',
      expandedIds: new Set(),
    });
    pressKey('Escape');
    expect(mockOnToggleCard).not.toHaveBeenCalled();
  });

  it('数字键 1-5 切换级别', () => {
    renderShortcuts();
    pressKey('3');
    expect(mockOnLevelChange).toHaveBeenCalledWith(3);
    pressKey('5');
    expect(mockOnLevelChange).toHaveBeenCalledWith(5);
  });

  it('输入框获焦时禁用快捷键', () => {
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();

    renderShortcuts({ focusedCardId: 'card-1' });
    pressKey('j');
    expect(mockOnFocusChange).not.toHaveBeenCalled();
    
    input.blur();
  });

  it('enabled=false 时快捷键不生效', () => {
    renderShortcuts({ enabled: false, focusedCardId: 'card-1' });
    pressKey('j');
    expect(mockOnFocusChange).not.toHaveBeenCalled();
  });
});
