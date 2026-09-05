'use client';

/**
 * WalkThroughPlayer — 走流程播放器主容器
 *
 * 整合：
 * - AlgoCanvas（可视化画布）
 * - NarrationPanel（解说面板）
 * - VarTracker（变量追踪表）
 * - PlayerControls（播放控制栏）
 * - ScenarioSelector（场景切换：标准/边界/反例）
 *
 * 数据流：
 * 1. 挂载时请求 GET /api/v1/enriched/{problemId}/walkthrough?level={n}
 * 2. sequenceJson 解析为 TeachingSequence
 * 3. 播放状态机管理步骤推进
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import AlgoCanvas from './AlgoCanvas';
import NarrationPanel from './NarrationPanel';
import VarTracker from './VarTracker';
import PlayerControls from './PlayerControls';
import type {
  TeachingSequence, TeachingStep, WalkthroughData,
  PlayerState, ScenarioType,
} from './types';

interface WalkThroughPlayerProps {
  problemId: string;
  level: number;
}

const SCENARIO_LABELS: Record<ScenarioType, string> = {
  standard:       '标准例子',
  boundary:       '边界场景',
  counterexample: '反例演示',
};

const DEFAULT_STEP_INTERVAL_MS = 4000; // 1x 速度下每步间隔

export default function WalkThroughPlayer({ problemId, level }: WalkThroughPlayerProps) {
  const [scenario, setScenario]     = useState<ScenarioType>('standard');
  const [playerState, setPlayerState] = useState<PlayerState>('idle');
  const [sequence, setSequence]     = useState<TeachingSequence | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [speed, setSpeed]           = useState(1);
  const [errorMsg, setErrorMsg]     = useState<string | null>(null);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const speedRef = useRef(speed);
  speedRef.current = speed;

  // ── 数据加载 ───────────────────────────────────────────────────────────
  const loadSequence = useCallback(async (sc: ScenarioType) => {
    setPlayerState('loading');
    setErrorMsg(null);
    setCurrentStep(0);

    try {
      const res = await fetch(
        `/api/v1/enriched/${encodeURIComponent(problemId)}/walkthrough?level=${level}&scenario=${sc}`
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: { code: number; data: WalkthroughData } = await res.json();
      const payload = data.data;

      if (payload.status === 'not_generated') {
        setPlayerState('idle');
        setSequence(null);
        setErrorMsg('走流程序列尚未生成，请先生成解析内容后等待约 60 秒。');
        return;
      }

      if (payload.status === 'generating') {
        setPlayerState('idle');
        setErrorMsg('走流程序列正在生成中，请稍后刷新...');
        return;
      }

      if (!payload.sequenceJson) throw new Error('序列数据为空');
      const seq: TeachingSequence = JSON.parse(payload.sequenceJson);
      setSequence(seq);
      setPlayerState('paused');
    } catch (e) {
      setPlayerState('idle');
      setErrorMsg(`加载失败：${e instanceof Error ? e.message : String(e)}`);
    }
  }, [problemId, level]);

  // 挂载 + 场景切换时加载
  useEffect(() => {
    loadSequence(scenario);
    return () => clearTimer();
  }, [scenario, loadSequence]);

  // ── 播放逻辑 ──────────────────────────────────────────────────────────
  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const scheduleNext = useCallback((step: number, seq: TeachingSequence) => {
    clearTimer();
    const stepData = seq.steps[step];
    const pauseAfter = stepData?.pauseAfter ?? false;
    const stepDuration = (stepData?.duration ?? DEFAULT_STEP_INTERVAL_MS) / speedRef.current;

    timerRef.current = setTimeout(() => {
      if (pauseAfter) {
        setPlayerState('paused');
        return;
      }
      const nextStep = step + 1;
      if (nextStep >= seq.totalSteps) {
        setPlayerState('complete');
        return;
      }
      setCurrentStep(nextStep);
      scheduleNext(nextStep, seq);
    }, stepDuration);
  }, []);

  const play = useCallback(() => {
    if (!sequence) return;
    setPlayerState('playing');
    scheduleNext(currentStep, sequence);
  }, [sequence, currentStep, scheduleNext]);

  const pause = useCallback(() => {
    clearTimer();
    setPlayerState('paused');
  }, []);

  const goTo = useCallback((step: number) => {
    clearTimer();
    if (!sequence) return;
    const clamped = Math.max(0, Math.min(sequence.totalSteps - 1, step));
    setCurrentStep(clamped);
    if (playerState === 'playing') {
      scheduleNext(clamped, sequence);
    } else {
      setPlayerState('paused');
    }
  }, [sequence, playerState, scheduleNext]);

  // speed 变化时，如果正在播放，重新 schedule
  useEffect(() => {
    if (playerState === 'playing' && sequence) {
      clearTimer();
      scheduleNext(currentStep, sequence);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [speed]);

  const currentStepData: TeachingStep | null = sequence?.steps[currentStep] ?? null;

  // ── 渲染 ──────────────────────────────────────────────────────────────
  if (errorMsg) {
    return (
      <div className="rounded-xl border border-dashed border-gray-200 dark:border-gray-700
        p-6 flex flex-col items-center gap-3 text-center">
        <div className="text-3xl">🎬</div>
        <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm">{errorMsg}</p>
        <button
          type="button"
          onClick={() => loadSequence(scenario)}
          className="text-xs text-blue-500 hover:text-blue-600 underline"
        >
          重新加载
        </button>
      </div>
    );
  }

  if (playerState === 'loading') {
    return (
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-8
        flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent
          rounded-full animate-spin" />
        <p className="text-sm text-gray-500">加载走流程数据...</p>
      </div>
    );
  }

  if (!sequence) return null;

  return (
    <div className="flex flex-col gap-3">
      {/* 场景切换 */}
      <div className="flex items-center gap-1 flex-wrap">
        {(Object.keys(SCENARIO_LABELS) as ScenarioType[]).map(sc => (
          <button
            key={sc}
            type="button"
            onClick={() => { clearTimer(); setScenario(sc); }}
            className={[
              'px-2.5 py-1 rounded-full text-xs font-medium transition-colors duration-150',
              scenario === sc
                ? 'bg-blue-500 text-white'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400',
              'hover:bg-blue-400 hover:text-white',
            ].join(' ')}
          >
            {SCENARIO_LABELS[sc]}
          </button>
        ))}
        {/* 输入描述 */}
        {sequence.input && (
          <span className="ml-2 text-xs text-gray-400 dark:text-gray-500">
            输入：{sequence.input}
          </span>
        )}
      </div>

      {/* 可视化画布 */}
      <AlgoCanvas
        initialScene={sequence.initialScene}
        currentStep={currentStepData}
        className="min-h-[200px] md:min-h-[240px]"
      />

      {/* 解说面板 */}
      <NarrationPanel
        narration={currentStepData?.narration ?? null}
        stepTitle={currentStepData ? `步骤 ${currentStepData.step}/${sequence.totalSteps}：${currentStepData.title}` : undefined}
      />

      {/* 变量追踪表 */}
      {sequence.steps.some(s => s.variables?.length) && (
        <VarTracker
          steps={sequence.steps}
          currentStep={currentStep}
        />
      )}

      {/* 播放控制栏 */}
      <PlayerControls
        state={playerState}
        currentStep={currentStep}
        totalSteps={sequence.totalSteps}
        speed={speed}
        onPlay={play}
        onPause={pause}
        onNext={() => goTo(currentStep + 1)}
        onPrev={() => goTo(currentStep - 1)}
        onFirst={() => goTo(0)}
        onLast={() => goTo(sequence.totalSteps - 1)}
        onSeek={goTo}
        onSpeedChange={s => { clearTimer(); setSpeed(s); }}
      />

      {/* 完成状态提示 */}
      {playerState === 'complete' && (
        <div className="rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200
          dark:border-green-800 p-3 flex items-center gap-2">
          <span className="text-green-500">✓</span>
          <p className="text-sm text-green-700 dark:text-green-400">
            演示完成！你已看完全部 {sequence.totalSteps} 步。
          </p>
          <button
            type="button"
            onClick={() => { setCurrentStep(0); setPlayerState('paused'); }}
            className="ml-auto text-xs text-green-600 hover:text-green-700 underline"
          >
            重播
          </button>
        </div>
      )}
    </div>
  );
}
