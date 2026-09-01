# LeetCode 爬虫完整调研记录

## 调研时间：2026-06-28

---

## 一、付费题调研

### 1.1 直接请求验证（无 Cookie）

测试脚本 `research_premium.py` 的核心逻辑：

```python
# 已知付费题 slug
PREMIUM_SLUGS = ["meeting-rooms", "missing-ranges", 
    "longest-substring-with-at-most-two-distinct-characters"]

# GraphQL 请求获取详情
query questionData($titleSlug: String!) {
    question(titleSlug: $titleSlug) {
        questionId, title, content, isPaidOnly, difficulty
    }
}
```

**测试结果：**

| 题目 | isPaidOnly | content |
|------|-----------|---------|
| Two Sum II (对照) | false | ✅ 完整 HTML |
| Meeting Rooms (LC 252) | true | ❌ null/empty |
| Missing Ranges (LC 163) | true | ❌ null/empty |
| Longest Substring w/ 2 Distinct (LC 159) | true | ❌ null/empty |

**结论：** 无 Cookie 时，付费题 `content` 字段返回 null。

### 1.2 不用 Premium 账号的替代方案调研

测试脚本 `research_premium_free.py` 验证了 4 个方案：

#### 方案 A：力扣中国站（leetcode.cn）

```python
url = "https://leetcode.cn/graphql"
# 请求 meeting-rooms, missing-ranges, palindrome-permutation
```

**结果：** 全部返回 HTTP 403（中国站对无 Cookie 请求有反爬限制）。

#### 方案 B：GitHub 开源数据集

```python
# AkashSingh3031/Complete-LeetCode-Premium-Problems
api_url = "https://api.github.com/repos/AkashSingh3031/Complete-LeetCode-Premium-Problems/contents"
```

**结果：**
- ✅ 仓库可访问，包含 **93 个** Premium 题目录
- 每个目录含 `README.md`（题目描述）+ 代码文件（C++/Python/Java）
- 示例：`0252-meeting-rooms/README.md` (877 bytes)

#### 方案 C：LintCode 同题映射

```python
resp = await client.get("https://www.lintcode.com/api/problems/",
    params={"search": "meeting rooms", "page": 1, "limit": 5})
```

**结果：**
- ✅ HTTP 200，搜索到 "Meeting Rooms" 和 "Meeting Rooms II"
- LintCode 上这些题免费可做

#### 方案 D：从讨论区还原题目描述

```python
# 尝试获取付费题 LC 252 的讨论区
variables = {"questionId": "252", "first": 3, "skip": 0, "orderBy": "most_votes"}
```

**结果：** `totalNum: 0`——付费题的讨论区也被锁定，不能用这个方案。

### 1.3 付费题方案总结

| 方案 | 可行性 | 数据量 | 推荐度 |
|------|--------|--------|--------|
| GitHub 数据集导入 | ✅ | 93 道高频 Premium 题 | ⭐⭐⭐ |
| LintCode 同题映射 | ✅ | 搜索 API 可用 | ⭐⭐ |
| 力扣中国站 | ❌ 403 | — | — |
| 讨论区还原 | ❌ 锁定 | — | — |
| Premium Cookie | ✅ 但需账号 | 709 道全部 | 需付费 |

---

## 二、题解 API 调研

### 2.1 旧版 API 验证（已失效）

测试脚本 `research_solutions_api.py` 验证了以下旧版查询：

```graphql
# 旧版 communitySolutions（代码中原有的查询）
query communitySolutions($questionSlug: String!, $skip: Int!, $first: Int!, $orderBy: TopicSortingOption) {
    questionSolutions(questionSlug: $questionSlug, skip: $skip, first: $first, orderBy: $orderBy) {
        totalNum
        solutions { id title slug voteCount content author { username } }
    }
}
```

**错误信息：**
```
Unknown argument "questionSlug" on field "questionSolutions" of type "Query"
Unknown argument "skip" on field "questionSolutions" of type "Query"
```

同样失效的变体：
- `communityQuestionSolutions` → 400
- `ugcArticleQuestionSolutions` → 400（字段不存在）
- `questionSolutionArticles` → 400（`SolutionArticleOrderBy` 类型不存在）

### 2.2 新版 API 探测过程

通过 `research_solutions2.py` 和 `research_solutions3.py` 逐步探测：

**第一轮探测（research_solutions2.py）：**

| 查询名 | 状态 | 结果 |
|--------|------|------|
| `topicComments(topicId: 127810)` | ✅ 200 | 成功获取评论！ |
| `questionSolutionArticles(questionSlug)` | ❌ 400 | 类型 `SolutionArticleOrderBy` 不存在 |
| `solutionArticle(slug)` | ❌ 400 | 字段名提示用 `ugcArticleSolutionArticle` |
| `officialSolution(titleSlug)` | ✅ 200 | 成功获取官方题解 Markdown！ |

**关键发现：**
- `topicComments` 可用于获取**评论**
- `officialSolution` 可获取**官方题解**（部分需 Premium）
- 题解列表 API 字段名全部变更

**第二轮探测（research_solutions3.py）——基于错误提示修正：**

| 查询名 | 状态 | 错误提示/修正线索 |
|--------|------|---------|
| `ugcArticleQuestionSolutions` | ❌ | 提示用 `ugcArticleSolutionTags` |
| `ugcArticleSolutionArticle(slug)` | ❌ 400 | `username` → 应为 `userName`，`voteCount` → 应为 `hitCount` |
| `userSolutionTopics(questionSlug)` | ❌ | `questionSlug` 参数不存在 |
| `questionTopicsList(questionId)` | ❌ | `voteCount` 字段不存在于 `TopicRelayNode` |

**第三轮探测（research_solutions4.py）——修正字段名：**

```graphql
# 最终可用的题解列表查询
query questionTopicsList($questionId: String!, $first: Int!, $skip: Int!, $orderBy: TopicSortingOption) {
    questionTopicsList(questionId: $questionId, first: $first, skip: $skip, orderBy: $orderBy) {
        totalNum
        edges {
            node {
                id
                title
                viewCount
                commentCount
                post {
                    content       # 完整 Markdown 内容
                    voteCount     # 点赞数（在 post 而非 node 上）
                    author { username }
                    creationDate  # Unix 时间戳
                }
            }
        }
    }
}
```

**参数说明：**
- `questionId`: 题目的**数字字符串 ID**（如 "1" = Two Sum，非 slug）
- `orderBy`: `"most_votes"` | `"newest_to_oldest"` | `"oldest_to_newest"`
- `first`: 每页条数，`skip`: 偏移量

**验证结果：**
```
HTTP 200 ✅
Two Sum (questionId="1") 共有 46,731 条讨论/题解
Top 1: "✅3 Method's || C++ || JAVA || PYTHON || Beginner Friendly🔥"
       viewCount: 1,719,168 | commentCount: 361 | voteCount: (在 post 内)
       content: 完整 Markdown，含代码块和解题思路
```

### 2.3 评论 API

```graphql
query topicComments($topicId: Int!, $orderBy: String, $pageNo: Int, $numPerPage: Int) {
    topicComments(topicId: $topicId, orderBy: $orderBy, pageNo: $pageNo, numPerPage: $numPerPage) {
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

**验证结果：** ✅ 成功获取评论，`topicId` 来自题解列表返回的 `node.id`。

### 2.4 官方题解 API

```graphql
query officialSolution($titleSlug: String!) {
    question(titleSlug: $titleSlug) {
        solution {
            id
            content        # 完整 Markdown（含视频 iframe 嵌入）
            contentTypeId
            paidOnly
        }
    }
}
```

**验证结果：** ✅ Two Sum 返回完整官方题解（含 Vimeo 视频嵌入）。部分题目 `paidOnly=true`。

---

## 三、题解采集实际执行

### 3.1 采集脚本

脚本 `import_solutions.py` 的采集逻辑：

1. 从 MySQL 获取前 200 道题的 `problem_id`
2. 提取数字 ID 作为 `questionId`
3. 对每题调用 `questionTopicsList` 获取前 10 条高赞题解
4. 并发限制 3，礼貌延迟 0.5s
5. 存入 `crawled_solutions` 表

### 3.2 采集结果

```
🎉 完成！共采集 1,540 条高赞题解（来自 200 道题）
📊 数据库总计: 1,540 条题解，覆盖 154 道题
```

每条题解含：
- 完整 Markdown 内容（含代码块、图片链接）
- 作者、点赞数、浏览量、评论数
- 创建时间


### 3.3 数据样例

```json
{
  "id": "lcsol-3619262",
  "problem_id": "lc-1",
  "title": "✅3 Method's || C++ || JAVA || PYTHON || Beginner Friendly🔥",
  "content": "# Intuition\nThe Two Sum problem asks us to find two numbers...\n# Approach\n...\n# Code\n```python\nclass Solution:\n    def twoSum(self, nums, target):\n        ...\n```",
  "author": "Bhanu_Samal",
  "vote_count": 5674,
  "view_count": 1719168,
  "comment_count": 361,
  "source": "LEETCODE_GLOBAL"
}
```

---

## 四、现有代码架构能力分析

### 4.1 爬虫层（crawler 项目）

| 模块 | 文件 | 功能 | 状态 |
|------|------|------|------|
| 适配器基类 | `adapters/base.py` | 定义统一接口 | ✅ 完善 |
| LeetCode 适配器 | `adapters/leetcode_global.py` | GraphQL 采集 | ⚠️ 题解查询需更新 |
| 反爬管理 | `anticrawl/` | 限流+断路器+UA+Cookie | ✅ 完善 |
| 数据标准化 | `pipeline/standardizer.py` | 格式统一 | ✅ 完善 |
| 图片处理 | `pipeline/image_handler.py` | 下载→MinIO→替换URL→AI描述 | ✅ 代码完整 |
| 编排器 | `orchestrator/engine.py` | 采集全流程协调 | ✅ 完善 |
| 数据存储 | `database/repository.py` | RawSource 存储 | ✅ 完善 |

### 4.2 后端 AI 生成引擎（backend 项目）

| 功能 | 状态 | 说明 |
|------|------|------|
| 分级解析生成（L1-L5） | ✅ 架构已有 | 需要 AI provider 配置 |
| 题解 AI 润色 | ❌ 未实现 | 需新增 pipeline |
| 图片/动图智能描述 | ✅ ImageHandler 有 AI 接口 | 需部署 AI 服务 |
| 错误检测/纠正 | ❌ 未实现 | |
| 可视化/举例自动生成 | ❌ 未实现 | |
| 根据题型选择解释策略 | ❌ 未实现 | |

---

## 五、已验证的完整 API 清单

| API 用途 | GraphQL Query | 关键参数 | 状态 |
|---------|--------------|---------|------|
| 题目列表 | `problemsetQuestionList` | categorySlug, limit, skip | ✅ |
| 题目详情 | `question(titleSlug)` | titleSlug | ✅ |
| 官方题解 | `question.solution` | titleSlug | ✅（部分 Premium）|
| 社区题解列表 | `questionTopicsList` | questionId(数字), first, skip, orderBy | ✅ |
| 题解评论 | `topicComments` | topicId(从题解列表获取), orderBy, pageNo | ✅ |
| 付费题检测 | `question.isPaidOnly` | — | ✅ |

---

## 六、调研脚本索引

| 脚本 | 用途 |
|------|------|
| `research_premium.py` | 验证付费题限制 + Cookie 方案 |
| `research_premium_free.py` | 不用 Premium 的 4 种替代方案 |
| `research_solutions_api.py` | 旧版题解 API 失效确认 |
| `research_solutions2.py` | 新版 API 第一轮探测 |
| `research_solutions3.py` | 基于错误提示修正参数 |
| `research_solutions4.py` | 最终验证 `questionTopicsList` |
| `test_leetcode.py` | 适配器基本功能验证 |
| `import_leetcode.py` | 前 200 题采集 |
| `import_leetcode_full.py` | 全量 3500 题采集 |
| `import_solutions.py` | 高赞题解批量采集 |
