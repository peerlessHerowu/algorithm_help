# LeetCode API 调研报告

## 调研时间：2025-06-25

---

## 1. 付费题爬取

### 结论

| 场景 | 结果 |
|------|------|
| 无 Cookie 请求付费题 | `content` 返回 null，`isPaidOnly=true` |
| 有 Premium Cookie | 可正常获取完整 `content` |

### 方案

1. 需要一个 LeetCode Premium 账号的 `LEETCODE_SESSION` Cookie
2. 获取方式：浏览器登录 → F12 → Application → Cookies → `LEETCODE_SESSION`
3. Cookie 有效期约 2 周，需定期手动更新
4. 项目已有 `RedisCookieStore` 支持存储和读取 Cookie
5. 适配器代码 `_get_cookies()` 已实现从 Redis 读取 Cookie 的逻辑

### 付费题数量

- 总题目约 3500 道
- 付费题约 709 道（约 20%）
- 涵盖高频面试题如 Meeting Rooms、Missing Ranges 等

### 风险

- Cookie 过期后需手动更新
- 大量请求可能触发风控（建议并发≤2，间隔≥1s）
- 不建议自动化刷新 Cookie（涉及账号安全）

---

## 2. 题解采集

### 可用 API

#### 2.1 题解列表：`questionTopicsList`

```graphql
query questionTopicsList(
    $questionId: String!,
    $first: Int!,
    $skip: Int!,
    $orderBy: TopicSortingOption
) {
    questionTopicsList(
        questionId: $questionId,
        first: $first,
        skip: $skip,
        orderBy: $orderBy
    ) {
        totalNum
        edges {
            node {
                id
                title
                viewCount
                commentCount
                post {
                    content      # 完整 Markdown 内容
                    voteCount    # 点赞数
                    author { username }
                    creationDate # Unix 时间戳
                }
            }
        }
    }
}
```

**参数说明：**
- `questionId`: 题目的数字 ID（如 "1" 对应 Two Sum）
- `orderBy`: "most_votes" | "newest_to_oldest" | "oldest_to_newest"
- 实测 Two Sum 有 46,731 条题解/讨论

#### 2.2 官方题解：`question.solution`

```graphql
query officialSolution($titleSlug: String!) {
    question(titleSlug: $titleSlug) {
        solution {
            id
            content        # 完整 Markdown（含视频嵌入）
            contentTypeId
            paidOnly       # 部分官方题解也需要 Premium
        }
    }
}
```

**注意：** 部分官方题解 `paidOnly=true`，需要 Premium Cookie。

#### 2.3 评论：`topicComments`

```graphql
query topicComments(
    $topicId: Int!,
    $orderBy: String,
    $pageNo: Int,
    $numPerPage: Int
) {
    topicComments(
        topicId: $topicId,
        orderBy: $orderBy,
        pageNo: $pageNo,
        numPerPage: $numPerPage
    ) {
        data {
            id
            post {
                content
                voteCount
                author { username }
                creationDate
            }
        }
    }
}
```

**参数说明：**
- `topicId`: 题解/讨论帖的 ID（从 questionTopicsList 返回的 `node.id`）
- `orderBy`: "best" | "newest_to_oldest"

### 已失效的 API（2025 年）

| 旧 API | 状态 | 替代方案 |
|---------|------|---------|
| `questionSolutions(questionSlug, skip, first, orderBy)` | ❌ 400 | 用 `questionTopicsList` |
| `communitySolutions` | ❌ 字段不存在 | 用 `questionTopicsList` |
| `ugcArticleQuestionSolutions` | ❌ 字段不存在 | 用 `questionTopicsList` |

---

## 3. 题解中的图片/动图

### 分析

题解 `post.content` 返回的是 Markdown 格式，图片以标准语法存在：

```markdown
![image](https://assets.leetcode.com/uploads/xxx.png)
![animation](https://assets.leetcode.com/uploads/xxx.gif)
```

### 已有处理能力

项目 `pipeline/image_handler.py` 已实现：
- ✅ 正则扫描 Markdown 中的图片链接
- ✅ 下载到 MinIO 对象存储
- ✅ GIF 动图保持原格式
- ✅ 替换为内部 URL
- ✅ AI 多模态接口生成 alt 文本描述

### 需要补充的

- ❌ 视频嵌入（iframe）的处理
- ❌ 动图分帧说明（复杂动画的文字化解释）
- ❌ 代码动画可视化（step by step）

---

## 4. 现有项目能力总结

| 能力 | 代码是否存在 | 是否跑通 | 差距 |
|------|-------------|---------|------|
| 题目列表采集 | ✅ | ✅ 已采集 2762 道 | 无 |
| 付费题采集 | ✅ 代码支持 | ❌ 缺 Cookie | 需要 Premium Cookie |
| 题解列表采集 | ⚠️ 旧 API 失效 | ❌ | 需更新为 `questionTopicsList` |
| 官方 Editorial | ✅ | ✅ 可用 | 部分需 Premium |
| 评论采集 | ⚠️ 接口定义了但没实现 | ❌ | 需实现 `topicComments` 调用 |
| 图片/GIF 下载存储 | ✅ ImageHandler | 未实际跑过 | 需要 MinIO 启动 |
| AI 图片描述 | ✅ 多模态接口调用 | ❌ | 需要 AI 服务 |
| AI 润色题解 | ❌ 不存在 | ❌ | 需要新增 pipeline |

---

## 5. 下一步行动建议

### 优先级 1：付费题（快）
1. 获取 Premium Cookie 存入 Redis
2. 重新运行采集脚本补充 709 道付费题

### 优先级 2：题解采集（中）
1. 更新 `LeetCodeGlobalAdapter.fetch_solutions` 使用 `questionTopicsList` API
2. 实现 `fetch_comments` 使用 `topicComments` API
3. 需要获取每题的 `questionId`（数字 ID），可从 `fetch_problem_detail` 的返回中拿到

### 优先级 3：AI 增强（需设计）
1. 题解纠错：AI 检查题解代码正确性
2. 内容润色：格式规范化、补充复杂度分析
3. 可视化增强：判断题目类型（需要举例 vs 需要说明本质）
4. 图片/动图处理：启动 MinIO + 运行 ImageHandler
