'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import useSWR, { mutate } from 'swr';
import ProgressBar from './ProgressBar';
import { fetcher } from '@/lib/fetcher';
import { api } from '@/lib/api';
import type { TaskStatus } from '@/lib/types';

interface GenerationStatusProps {
  /** 题目 ID */
  problemId: string;
  /** 生成的级别 */
  level: number;
  /** 生成完成后的回调（让父组件刷新数据） */
  onComplete?: () => void;
  className?: string;
}

type Phase = 'idle' | 'generating' | 'completed' | 'failed';

/** 生成步骤定义 */
const GENERATION_STEPS = [
  { label: '分析题目', threshold: 20 },
  { label: '生成思路', threshold: 40 },
  { label: '编写代码', threshold: 60 },
  { label: '生成图解', threshold: 80 },
  { label: '质量校验', threshold: 100 },
];

/** 根据进度百分比获取当前步骤索引 */
function getCurrentStepIndex(progress: number): number {
  for (let i = 0; i < GENERATION_STEPS.length; i++) {
    if (progress <= GENERATION_STEPS[i].threshold) {
      return i;
    }
  }
  return GENERATION_STEPS.length - 1;
}

/** 估算剩余时间（假设总生成时间约 45 秒） */
function estimateRemainingTime(progress: number): string {
  if (progress >= 100) return '';
  const totalEstimate = 45; // 预估总秒数
  const remaining = Math.max(1, Math.round(totalEstimate * (100 - progress) / 100));
  if (remaining >= 60) {
    return `约 ${Math.ceil(remaining / 60)} 分钟`;
  }
  return `约 ${remaining} 秒`;
}

/**
 * 生成进度轮询组件
 *
 * 状态流转：
 * - idle：展示"尚未生成"+ 触发生成按钮
 * - generating：展示 ProgressBar + 当前步骤 + 预计剩余时间，每 3 秒轮询
 * - completed：自动 mutate SWR 缓存刷新内容
 * - failed：展示错误原因 + 重试按钮
 */
export default function GenerationStatus({
  problemId,
  level,
  onComplete,
  className = '',
}: GenerationStatusProps) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [taskId, setTaskId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const completedRef = useRef(false);

  // 使用 SWR 轮询任务状态，仅在 generating 阶段启用
  const { data: taskStatus } = useSWR<TaskStatus>(
    phase === 'generating' && taskId
      ? `/api/v1/tasks/${encodeURIComponent(taskId)}/status`
      : null,
    fetcher,
    {
      refreshInterval: 3000,
      revalidateOnFocus: false,
      dedupingInterval: 2000,
    }
  );

  // 监听 taskStatus 变化，处理完成/失败状态转换
  useEffect(() => {
    if (!taskStatus || phase !== 'generating') return;

    if (taskStatus.status === 'COMPLETED' && !completedRef.current) {
      completedRef.current = true;
      setPhase('completed');
      // 自动 mutate SWR 缓存，刷新解析内容
      mutate(
        `/api/v1/problems/${encodeURIComponent(problemId)}/explanation?level=${level}`
      );
      onComplete?.();
    } else if (taskStatus.status === 'FAILED' || taskStatus.status === 'TIMEOUT') {
      setPhase('failed');
      setErrorMessage(taskStatus.message || '生成失败，请重试');
    }
  }, [taskStatus, phase, problemId, level, onComplete]);

  /** 触发生成 */
  const handleGenerate = useCallback(async () => {
    setPhase('generating');
    setErrorMessage('');
    completedRef.current = false;

    try {
      const newTaskId = await api.problems.generate(problemId, { level });
      setTaskId(newTaskId);
    } catch (err) {
      setPhase('failed');
      setErrorMessage(
        err instanceof Error ? err.message : '触发生成失败'
      );
    }
  }, [problemId, level]);

  // ─── idle：展示触发按钮 ───
  if (phase === 'idle') {
    return (
      <div className={`rounded-lg border border-dashed border-gray-300 bg-gray-50 p-6 text-center dark:border-gray-600 dark:bg-gray-900/50 ${className}`}>
        <div className="mb-3">
          <span className="text-3xl">🚀</span>
        </div>
        <p className="mb-1 text-base font-medium text-gray-700 dark:text-gray-300">
          尚未生成 L{level} 解析
        </p>
        <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
          预计等待 30-60 秒
        </p>
        <button
          onClick={handleGenerate}
          className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          AI 生成解析
        </button>
      </div>
    );
  }

  // ─── generating：展示进度条 + 步骤 + 预计时间 ───
  if (phase === 'generating') {
    const progress = taskStatus?.progress ?? 0;
    const currentStepIndex = getCurrentStepIndex(progress);
    const currentStep = GENERATION_STEPS[currentStepIndex];
    const remaining = estimateRemainingTime(progress);

    return (
      <div className={`rounded-lg border border-blue-200 bg-blue-50/50 p-6 dark:border-blue-800 dark:bg-blue-900/20 ${className}`}>
        {/* 步骤标签 */}
        <div className="mb-4 flex items-center justify-center gap-1 flex-wrap">
          {GENERATION_STEPS.map((step, idx) => (
            <span key={step.label} className="flex items-center text-xs">
              <span
                className={`rounded-full px-2 py-0.5 font-medium transition-colors ${
                  idx < currentStepIndex
                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                    : idx === currentStepIndex
                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                    : 'bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-500'
                }`}
              >
                {step.label}
              </span>
              {idx < GENERATION_STEPS.length - 1 && (
                <span className="mx-1 text-gray-300 dark:text-gray-600">→</span>
              )}
            </span>
          ))}
        </div>

        {/* 进度条 */}
        <ProgressBar
          progress={progress}
          status={`${currentStep.label}中...`}
        />

        {/* 预计剩余时间 */}
        {remaining && (
          <p className="mt-3 text-center text-xs text-gray-500 dark:text-gray-400">
            预计剩余 {remaining}
          </p>
        )}
      </div>
    );
  }

  // ─── completed：展示完成提示 ───
  if (phase === 'completed') {
    return (
      <div className={`rounded-lg border border-green-200 bg-green-50 p-4 text-center dark:border-green-800 dark:bg-green-900/20 ${className}`}>
        <p className="text-sm font-medium text-green-700 dark:text-green-400">
          ✓ L{level} 解析生成完成
        </p>
      </div>
    );
  }

  // ─── failed：展示错误原因 + 重试按钮 ───
  return (
    <div className={`rounded-lg border border-red-200 bg-red-50 p-6 text-center dark:border-red-800 dark:bg-red-900/20 ${className}`}>
      <div className="mb-2">
        <span className="text-2xl">⚠️</span>
      </div>
      <p className="mb-4 text-sm text-red-700 dark:text-red-400">
        {errorMessage}
      </p>
      <button
        onClick={handleGenerate}
        className="rounded-lg bg-red-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-red-700 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
      >
        重试
      </button>
    </div>
  );
}
