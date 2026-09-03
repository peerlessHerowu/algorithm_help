'use client';

import { useCallback, useEffect, useRef } from 'react';

/**
 * 键盘快捷键 Hook
 *
 * 支持的快捷键：
 * - J: 聚焦下一张卡片
 * - K: 聚焦上一张卡片
 * - Enter/Space: 展开/收起当前聚焦卡片
 * - 1-5: 切换到 L1-L5
 * - Esc: 收起当前展开的卡片
 *
 * 输入框获焦时自动禁用快捷键
 *
 * Requirements: 16.2, 16.9, 16.10
 */

export interface KeyboardShortcutsOptions {
  /** 卡片 ID 列表（按顺序） */
  cardIds: string[];
  /** 当前聚焦的卡片 ID */
  focusedCardId: string | null;
  /** 已展开的卡片 ID 集合 */
  expandedIds: Set<string>;
  /** 设置聚焦卡片 */
  onFocusChange: (id: string | null) => void;
  /** 展开/收起卡片 */
  onToggleCard: (id: string) => void;
  /** 切换级别 */
  onLevelChange: (level: number) => void;
  /** 是否启用（可用于条件禁用） */
  enabled?: boolean;
}

/** 判断当前焦点是否在输入元素上 */
function isInputFocused(): boolean {
  const active = document.activeElement;
  if (!active) return false;
  const tag = active.tagName.toLowerCase();
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
  if ((active as HTMLElement).isContentEditable) return true;
  return false;
}

export function useKeyboardShortcuts({
  cardIds,
  focusedCardId,
  expandedIds,
  onFocusChange,
  onToggleCard,
  onLevelChange,
  enabled = true,
}: KeyboardShortcutsOptions) {
  const optionsRef = useRef({
    cardIds,
    focusedCardId,
    expandedIds,
    onFocusChange,
    onToggleCard,
    onLevelChange,
  });

  // 保持最新引用
  useEffect(() => {
    optionsRef.current = {
      cardIds,
      focusedCardId,
      expandedIds,
      onFocusChange,
      onToggleCard,
      onLevelChange,
    };
  });

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // 输入框获焦时禁用快捷键
    if (isInputFocused()) return;

    const {
      cardIds: ids,
      focusedCardId: focused,
      expandedIds: expanded,
      onFocusChange: setFocus,
      onToggleCard: toggle,
      onLevelChange: setLevel,
    } = optionsRef.current;

    const key = e.key;

    switch (key) {
      case 'j':
      case 'J': {
        e.preventDefault();
        if (ids.length === 0) return;
        const currentIdx = focused ? ids.indexOf(focused) : -1;
        const nextIdx = Math.min(currentIdx + 1, ids.length - 1);
        setFocus(ids[nextIdx]);
        scrollCardIntoView(ids[nextIdx]);
        break;
      }

      case 'k':
      case 'K': {
        e.preventDefault();
        if (ids.length === 0) return;
        const currentIdx = focused ? ids.indexOf(focused) : ids.length;
        const prevIdx = Math.max(currentIdx - 1, 0);
        setFocus(ids[prevIdx]);
        scrollCardIntoView(ids[prevIdx]);
        break;
      }

      case 'Enter':
      case ' ': {
        if (focused) {
          e.preventDefault();
          toggle(focused);
        }
        break;
      }

      case 'Escape': {
        // 收起当前聚焦的卡片（如果已展开）
        if (focused && expanded.has(focused)) {
          e.preventDefault();
          toggle(focused);
        }
        break;
      }

      case '1':
      case '2':
      case '3':
      case '4':
      case '5': {
        e.preventDefault();
        setLevel(parseInt(key, 10));
        break;
      }

      default:
        break;
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [enabled, handleKeyDown]);
}

/** 将聚焦的卡片滚动到可视区域 */
function scrollCardIntoView(cardId: string) {
  const el = document.querySelector(`[data-card-id="${cardId}"]`);
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}
