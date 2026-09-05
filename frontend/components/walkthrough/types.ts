/**
 * 走流程（TeachingSequence）相关类型定义
 * 与后端 WalkthroughStep 生成的 JSON schema 一致
 */

export interface VariableState {
  name: string;
  value: string | number | null;
  changed: boolean;
  note?: string;
}

export interface AnimationInstruction {
  type: string;
  targetId: string;
  params: Record<string, unknown>;
  duration: number;
  delay?: number;
  easing?: string;
}

export interface NarrationData {
  text: string;
  keywords?: string[];
  isKeyDecision: boolean;
  keyDecisionNote?: string;
}

export interface TeachingStep {
  step: number;
  title: string;
  narration: NarrationData;
  animations: AnimationInstruction[];
  variables: VariableState[];
  codeHighlight?: {
    language: string;
    lineStart: number;
    lineEnd: number;
  };
  duration: number;
  pauseAfter: boolean;
}

export interface SceneElement {
  id: string;
  type: string;
  value?: string | number;
  index?: number;
  label?: string;
  style?: Record<string, string>;
}

export interface InitialScene {
  type: string; // array/linked_list/tree/dp_table/hash
  description: string;
  elements: SceneElement[];
}

export interface TeachingSequence {
  title: string;
  description: string;
  exampleType: 'standard' | 'boundary' | 'counterexample';
  input: string;
  totalSteps: number;
  estimatedDurationMs: number;
  initialScene: InitialScene;
  steps: TeachingStep[];
}

export interface WalkthroughData {
  status: 'ready' | 'not_generated' | 'generating';
  id?: string;
  problemId?: string;
  level?: number;
  scenarioType?: string;
  title?: string;
  totalSteps?: number;
  durationMs?: number;
  sequenceJson?: string;
  message?: string;
}

/** 播放状态 */
export type PlayerState = 'idle' | 'loading' | 'playing' | 'paused' | 'complete';

/** 场景类型 */
export type ScenarioType = 'standard' | 'boundary' | 'counterexample';
