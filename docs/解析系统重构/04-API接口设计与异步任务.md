# API 接口设计与异步任务

## 一、接口总览

| 方法 | 路径 | 说明 | 鉴权 |
|------|------|------|------|
| GET | `/api/v1/enriched/{problemId}` | 获取某题的 enriched 解析列表 | 用户 |
| GET | `/api/v1/enriched/{problemId}/level/{level}` | 获取某题某级别的解析列表 | 用户 |
| POST | `/api/v1/enriched/{problemId}/generate` | 触发 AI 生成（异步） | 用户 |
| GET | `/api/v1/enriched/tasks/{taskId}` | 查询生成任务状态 | 用户 |
| GET | `/api/v1/raw-solutions/{problemId}` | 获取原始题解列表 | 用户 |
| POST | `/api/v1/raw-solutions/{solutionId}/enrich` | 对单条原始题解触发 AI 丰富 | 管理员 |
| POST | `/api/v1/admin/enriched/batch-generate` | 批量生成（管理后台） | 管理员 |
| PUT | `/api/v1/admin/enriched/{id}/status` | 审核：修改状态 | 管理员 |
| DELETE | `/api/v1/admin/enriched/{id}` | 删除 enriched 记录 | 管理员 |

---

## 二、接口详细定义

### 2.1 获取某题某级别的解析列表

```
GET /api/v1/enriched/{problemId}/level/{level}
```

**Query 参数：**

| 参数 | 类型 | 必选 | 说明 |
|------|------|------|------|
| sort | string | 否 | 排序方式：`quality`(默认) / `time` |
| status | string | 否 | 状态过滤：`PUBLISHED`(默认) / `ALL`(管理员) |

**Response 200：**

```json
{
  "code": 200,
  "data": {
    "problemId": "two-sum",
    "level": 3,
    "total": 3,
    "items": [
      {
        "id": "es-001",
        "title": "哈希表一次遍历",
        "summary": "利用哈希表在一次遍历中同时查找和存储...",
        "sourceType": "COMMUNITY",
        "sourceSolutionId": "cs-123",
        "qualityScore": 0.92,
        "tags": ["哈希表", "O(n)"],
        "languages": ["python", "java", "go", "cpp"],
        "createdAt": 1719500000000,
        "recommended": true
      }
    ]
  }
}
```

**设计要点：**
- 列表接口**只返回摘要**，不含 `content` 和 `codeImplementations`（节省带宽）
- `recommended: true` 标记 quality_score 最高的那条
- `sourceType` 枚举：`COMMUNITY`(基于社区题解) / `AI_ORIGINAL`(纯 AI) / `OFFICIAL`(基于官方 Editorial)

---

### 2.2 获取单条解析详情（展开时 lazy load）

```
GET /api/v1/enriched/{id}/detail
```

**Response 200：**

```json
{
  "code": 200,
  "data": {
    "id": "es-001",
    "content": "## 核心思路\n使用哈希表...\n## 代码实现\n...",
    "codeImplementations": {
      "python": "class Solution:\n    ...",
      "java": "class Solution {\n    ...",
      "go": "func twoSum(...) []int {\n    ...",
      "cpp": "class Solution {\npublic:\n    ..."
    },
    "processingSteps": ["error-check", "polish", "multi-lang"],
    "sourceAuthor": "leetcode_user_123",
    "sourceUrl": "https://leetcode.com/problems/two-sum/solutions/..."
  }
}
```

**设计要点：**
- 展开卡片时才请求详情，避免列表页一次性加载大量 Markdown
- 包含来源作者和原始链接，用于版权标注

---

### 2.3 触发 AI 生成（异步）

```
POST /api/v1/enriched/{problemId}/generate
```

**Request Body：**

```json
{
  "level": 3,
  "forceRegenerate": false
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| level | int | 目标级别 1-5，不传则生成全部级别 |
| forceRegenerate | boolean | 是否强制重新生成（忽略已有内容） |

**Response 202 (Accepted)：**

```json
{
  "code": 202,
  "data": {
    "taskId": "task-uuid-123",
    "estimatedSeconds": 45,
    "message": "生成任务已提交，请通过 taskId 查询进度"
  }
}
```

**幂等设计：**
- 如果该题+该级别已有活跃任务（Redis `gen:active:{problemId}:L{level}`），直接返回已有 taskId
- 避免重复触发

---

### 2.4 查询任务状态

```
GET /api/v1/enriched/tasks/{taskId}
```

**Response 200：**

```json
{
  "code": 200,
  "data": {
    "taskId": "task-uuid-123",
    "status": "PROCESSING",
    "progress": {
      "currentStep": "multi-lang",
      "totalSteps": 5,
      "completedSteps": 3
    },
    "result": null,
    "error": null,
    "createdAt": 1719500000000,
    "updatedAt": 1719500030000
  }
}
```

**状态枚举：**

```
PENDING → PROCESSING → COMPLETED / FAILED
```

| 状态 | 说明 |
|------|------|
| PENDING | 已入队，等待执行 |
| PROCESSING | 正在执行管线步骤 |
| COMPLETED | 生成完成，result 中有 enrichedSolutionId |
| FAILED | 生成失败，error 中有失败原因 |

**前端轮询策略：**
- 第 1-10 秒：每 2 秒轮询一次
- 10-60 秒：每 5 秒轮询一次
- 超过 60 秒：提示"生成时间较长，可稍后刷新查看"
- 后续可升级为 SSE（Server-Sent Events）推送

---

### 2.5 原始题解列表

```
GET /api/v1/raw-solutions/{problemId}
```

**Query 参数：**

| 参数 | 类型 | 说明 |
|------|------|------|
| sort | string | `votes`(默认) / `time` |
| lang | string | 按语言筛选：`python` / `java` / `go` / `cpp` |
| page | int | 页码，默认 1 |
| size | int | 每页条数，默认 10，最大 50 |

**Response 200：**

```json
{
  "code": 200,
  "data": {
    "total": 156,
    "page": 1,
    "size": 10,
    "items": [
      {
        "id": "cs-123",
        "title": "3 Method's || C++ || JAVA || PYTHON",
        "author": "Bhanu_Samal",
        "votes": 5674,
        "views": 1700000,
        "languages": ["cpp", "java", "python"],
        "createdAt": 1695792000000,
        "hasEnriched": true
      }
    ]
  }
}
```

---

## 三、异步任务状态机设计

### 3.1 任务生命周期

```
用户点击"AI 生成解析"
       │
       ▼
┌─────────────┐    幂等检查（Redis）    ┌───────────────┐
│ 前端 POST   │───────────────────────→│ 返回已有 taskId │
│ /generate   │   已存在活跃任务        └───────────────┘
└─────────────┘
       │ 无活跃任务
       ▼
┌─────────────┐
│  PENDING    │  写入 Redis + 任务队列
└─────────────┘
       │ 线程池取出执行
       ▼
┌─────────────┐
│ PROCESSING  │  逐步执行管线，更新 progress
└─────────────┘
       │
   ┌───┴───┐
   ▼       ▼
┌──────┐ ┌──────┐
│COMPL.│ │FAILED│
└──────┘ └──────┘
   │         │
   ▼         ▼
 清理 key   记录失败原因
 通知前端   支持重试（最多 3 次）
```

### 3.2 Redis 数据结构

```
# 活跃任务标记（防重复提交）TTL = 5 分钟
gen:active:{problemId}:L{level} → taskId

# 任务状态（完整信息）TTL = 1 小时
gen:task:{taskId} → {
  "status": "PROCESSING",
  "problemId": "two-sum",
  "level": 3,
  "progress": { "currentStep": "polish", "totalSteps": 5, "completedSteps": 2 },
  "result": null,
  "error": null,
  "retryCount": 0,
  "createdAt": 1719500000000
}
```

### 3.3 失败重试策略

| 失败类型 | 重试 | 说明 |
|---------|------|------|
| AI 调用超时 | 自动重试 2 次，间隔 5s/15s | 指数退避 |
| AI 返回格式错误 | 自动重试 1 次 | 可能是偶发 |
| AI 内容质量不过关 | 不自动重试 | 标记 FAILED，人工介入 |
| 系统异常（DB/Redis） | 自动重试 1 次 | 基础设施问题 |
| 题目不存在 | 不重试 | 直接报错 |

### 3.4 超时与兜底

- 单个任务最大执行时间：**3 分钟**（超时自动标记 FAILED）
- 前端 60 秒后转为"后台生成中"状态，用户可离开页面
- 完成后下次打开自动展示结果（查列表接口即可）

---

## 四、权限模型

### 4.1 角色定义

| 角色 | 权限 |
|------|------|
| 游客 | 查看已发布的 enriched 解析、查看原始题解 |
| 登录用户 | 游客权限 + 触发 AI 生成（有频率限制） |
| 管理员 | 全部权限 + 审核 + 批量操作 + 删除 |

### 4.2 频率限制（Rate Limit）

| 操作 | 限制 |
|------|------|
| 普通用户触发生成 | 每用户每小时 5 次 |
| 普通用户触发"AI 丰富" | 不开放，仅管理员 |
| 管理员批量生成 | 每批最多 50 题 |

### 4.3 原始题解的"AI 丰富"按钮

- **Phase 1**：仅管理员可见，点击后指定目标级别生成一条 enriched 解析
- **Phase 2**（后续）：开放给用户，但需要消耗"生成额度"

---

## 五、错误处理规范

### 5.1 统一错误响应格式

```json
{
  "code": 40001,
  "message": "该题目正在生成中，请稍后查看",
  "data": {
    "taskId": "existing-task-id"
  }
}
```

### 5.2 业务错误码

| 错误码 | 含义 | 前端处理 |
|--------|------|---------|
| 40001 | 重复提交（已有活跃任务） | 展示进度，不重复请求 |
| 40002 | 频率超限 | 提示"请稍后再试" |
| 40003 | 题目无原始题解可供丰富 | 提示"暂无社区题解，使用纯 AI 生成" |
| 40401 | 题目不存在 | 404 页面 |
| 40402 | enriched 记录不存在 | 展示空状态 |
| 50001 | AI 服务不可用 | 提示"AI 服务暂时不可用，请稍后重试" |
| 50002 | 生成超时 | 提示"生成时间过长，已转为后台任务" |

---

## 六、缓存策略

### 6.1 缓存层级

```
前端 → CDN (静态资源) → API 响应缓存 (Redis) → 数据库
```

### 6.2 缓存 Key 设计（v2 适配列表模式）

```
# enriched 列表缓存（按题目+级别）TTL = 1 小时
enriched:list:{problemId}:L{level} → [摘要列表 JSON]

# enriched 详情缓存（按单条 ID）TTL = 24 小时
enriched:detail:{id} → {完整内容 JSON}

# 原始题解列表缓存 TTL = 6 小时（爬取频率较低）
raw-solutions:{problemId}:page{n} → [列表 JSON]
```

### 6.3 缓存失效时机

| 事件 | 失效的 Key |
|------|-----------|
| 新增 enriched 解析 | `enriched:list:{problemId}:L{level}` |
| 修改 enriched 状态 | 同上 + `enriched:detail:{id}` |
| 重新爬取原始题解 | `raw-solutions:{problemId}:*` |
| 用户投票（影响排序） | `enriched:list:{problemId}:L{level}` |
