/**
 * 前端 TypeScript 类型定义
 * 对应后端 REST API 的数据结构
 */

// ============ 通用类型 ============

/** 后端统一响应包装 */
export interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
  timestamp: number;
}

/** 分页响应 */
export interface PageResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number; // 当前页码（从0开始）
  first: boolean;
  last: boolean;
}

// ============ 题目相关 ============

/** 难度枚举 */
export type Difficulty = 'EASY' | 'MEDIUM' | 'HARD';

/** 解析状态枚举 */
export type ExplanationStatus =
  | 'GENERATING'
  | 'PENDING_REVIEW'
  | 'PUBLISHED'
  | 'REJECTED'
  | 'ARCHIVED';

/** 关联关系类型 */
export type RelationType =
  | 'prerequisite'
  | 'variant'
  | 'similar_pattern'
  | 'follow_up'
  | 'harder_version';

/** 平台映射 */
export interface PlatformMapping {
  platform: string;
  platformId: string;
  url: string;
  frequency: number;
  companies: string[];
}

/** 数学基础关联数据（题目详情返回） */
export interface MathFoundation {
  /** 数学知识主题名称，如"递推关系" */
  mathTopicName: string;
  /** 关联的算法模式名称，如"动态规划" */
  patternName: string;
  /** 一句话说明数学与模式的关系 */
  oneSentence: string;
  /** 数学关联详情页 ID */
  mathRelationId: string;
}

/** 算法考古关联数据（题目详情页右侧"算法故事"卡片使用） */
export interface RelatedArchaeology {
  /** 算法故事 ID，用于跳转 /archaeology/{storyId} */
  storyId: string;
  /** 算法名称 */
  algorithmName: string;
  /** 100 字以内精简摘要 */
  shortSummary: string;
  /** 发明者姓名 */
  inventorName?: string;
  /** 发明年份 */
  year?: number;
}

/** 题目实体 */
export interface Problem {
  id: string;
  title: string;
  /** 中文标题（可选，无翻译时不存在） */
  titleCn?: string;
  /** 中文题目描述（可选，无翻译时不存在） */
  descriptionCn?: string;
  difficulty: Difficulty;
  tags: string[];
  description: string;
  constraints: string[];
  examples: string[];
  companyTags: string[];
  platforms: PlatformMapping[];
  /** 数学基础关联（仅当该题模式有 MATH_FOUNDATION 关系时存在） */
  mathFoundation?: MathFoundation;
  /** 算法考古关联（仅当该题关联的算法模式有考古内容时存在） */
  relatedArchaeology?: RelatedArchaeology;
  createdAt: number;
  updatedAt: number;
}

/** 生成状态枚举（题目列表中展示用） */
export type GenerationStatus = 'not_generated' | 'generating' | 'generated' | 'failed';

/** 题目列表项（轻量版，列表页使用） */
export interface ProblemListItem {
  id: string;
  title: string;
  difficulty: Difficulty;
  tags: string[];
  companyTags: string[];
  hasExplanation: boolean;
  /** 生成状态，用于列表中展示状态图标 */
  generationStatus?: GenerationStatus;
}

// ============ 解析相关 ============

/** 解法数据结构（嵌入在 Explanation.sections 中） */
export interface Approach {
  name: string;
  idea: string;
  code: Record<string, string>; // { python: "...", java: "..." }
  timeComplexity: string;
  spaceComplexity: string;
  whyThisWorks: string;
  whenToUse: string;
  limitations: string;
}

/** 内容段类型 */
export type ContentType = 'text' | 'code' | 'diagram' | 'video' | 'audio';

/** 内容段 */
export interface ContentSection {
  title: string;
  contentType: ContentType;
  content: string;
  approaches?: Approach[];
}

/** 解析实体 */
export interface Explanation {
  id: string;
  problemId: string;
  level: number;
  sections: ContentSection[];
  version: number;
  isLatest: boolean;
  status: ExplanationStatus;
  createdAt: number;
  updatedAt: number;
}

/** 解析版本历史条目 */
export interface ExplanationVersion {
  id: string;
  version: number;
  status: ExplanationStatus;
  createdAt: number;
}

// ============ 模式相关 ============

/** 算法模式实体 */
export interface Pattern {
  id: string;
  name: string;
  category: string;
  template: Record<string, string>; // 多语言模板代码
  signals: string[];
  variants: string[];
  relatedProblems: string[];
  /** 跨域迁移映射数据（模式详情页底部展示） */
  crossDomainMappings?: CrossDomainMapping[];
  createdAt: number;
  updatedAt: number;
}

// ============ 关联题目 ============

/** 关联题目推荐项 */
export interface RelatedProblem {
  problemId: string;
  title: string;
  difficulty: Difficulty;
  type: RelationType;
  description: string;
  confidence: number;
}

// ============ 任务/生成相关 ============

/** 生成选项 */
export interface GenerateOptions {
  level?: number;
  languages?: string[];
  includeSteps?: boolean;
  includeDiagrams?: boolean;
  includeApplications?: boolean;
}

/** 任务状态 */
export interface TaskStatus {
  taskId: string;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'TIMEOUT';
  progress: number; // 0-100
  message?: string;
  createdAt: number;
  completedAt?: number;
}

// ============ 内容导入 ============

/** URL 导入结果 */
export interface ImportResult {
  problemId: string;
  title: string;
  source: string;
}

// ============ 请求参数类型 ============

/** 题目列表查询参数 */
export interface ProblemListParams {
  page?: number;
  size?: number;
  difficulty?: Difficulty;
  tag?: string;
  tagMode?: 'and' | 'or';
  company?: string;
  keyword?: string;
  status?: 'all' | 'generated' | 'not_generated';
  bookmarked?: boolean;
}

/** 公司标签及题目数 */
export interface CompanyTag {
  name: string;
  count: number;
}

// ============ 用户偏好 ============

/** 用户偏好设置 */
export interface UserPreferences {
  /** 默认解析级别 1-5 */
  defaultLevel: number;
  /** 默认代码语言 */
  defaultLanguage: string;
  /** 主题偏好 */
  theme: 'light' | 'dark' | 'system';
}

/** 通知偏好设置（各类型独立开关） */
export interface NotificationPreferences {
  /** 生成完成通知 */
  generationComplete: boolean;
  /** 复习提醒通知 */
  reviewReminder: boolean;
  /** 系统公告通知 */
  systemAnnouncement: boolean;
  /** 全服飘屏通知 */
  marquee: boolean;
}

/** 数据导出响应 */
export interface DataExportResponse {
  /** 导出文件下载 URL */
  downloadUrl: string;
}

// ============ 通知相关 ============

/** 通知类型枚举 */
export type NotificationType =
  | 'GENERATION_COMPLETE'
  | 'REVIEW_REMINDER'
  | 'COMMENT_REPLY'
  | 'SYSTEM_ANNOUNCEMENT';

/** 通知实体 */
export interface Notification {
  id: string;
  /** 通知类型 */
  type: NotificationType;
  /** 通知标题 */
  title: string;
  /** 通知内容摘要 */
  content: string;
  /** 是否已读 */
  read: boolean;
  /** 跳转链接（可选） */
  link?: string;
  /** 创建时间（UTC 毫秒时间戳） */
  createdAt: number;
}

/** 通知列表响应 */
export interface NotificationListResponse {
  items: Notification[];
  unreadCount: number;
  total: number;
}


// ============ 跨域映射相关 ============

/** 跨域映射行项（模式详情页"跨域迁移映射表"使用） */
export interface CrossDomainMapping {
  /** 唯一标识 */
  id: string;
  /** LeetCode 场景描述 */
  leetcode: string;
  /** 工作中场景描述 */
  work: string;
  /** AI/ML 场景描述 */
  aiMl: string;
  /** 日常生活类比描述 */
  daily: string;
  /** 展开详情：具体解释文字 */
  detailExplanation?: string;
  /** 展开详情：代码对比示例（多语言） */
  codeComparison?: Record<string, string>;
}
