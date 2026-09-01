# 种子数据说明

## 目录结构

```
data/seed/
├── graph-nodes.json          # 知识图谱节点（模式、题目、数学、论文）
├── graph-edges.json          # 知识图谱边（关联关系）
├── learning-paths.json       # 学习路径定义
├── archaeology.json          # 算法考古（发明故事）
├── paper-bridges.json        # 论文桥梁路径
├── platform-mappings.csv     # 多平台题目映射
└── README.md                 # 本文件
```

## platform-mappings.csv 格式说明

### CSV 列定义

| 列名 | 类型 | 必填 | 说明 |
|------|------|------|------|
| platform | String | 是 | 刷题平台枚举值，可选：LEETCODE、NOWCODER、HACKERRANK、CODEFORCES、LUOGU、ATCODER |
| platformId | String | 是 | 平台上的题目编号或 slug（如 LeetCode 的 "1"、牛客的 "NC001"） |
| platformUrl | String | 否 | 题目在该平台的完整 URL |
| unifiedProblemId | String | 是 | 系统内部统一题目 ID，格式为 `problem:{英文短标识}`（如 `problem:two-sum`） |

### 示例数据

```csv
platform,platformId,platformUrl,unifiedProblemId
LEETCODE,1,https://leetcode.cn/problems/two-sum/,problem:two-sum
NOWCODER,NC001,https://www.nowcoder.com/practice/20ef0972485e41019e39543e8e895b7f,problem:two-sum
```

### 统一题目 ID 命名规则

- 格式：`problem:{英文短标识}`
- 使用小写字母 + 连字符分隔单词
- 尽量与 LeetCode 题目 slug 保持一致
- 示例：`problem:two-sum`、`problem:longest-increasing-subsequence`

## 导入方式

### 方式一：API 导入（推荐）

通过 `POST /api/v1/mapping/import` 端点上传 CSV 文件：

```bash
curl -X POST http://localhost:8080/api/v1/mapping/import \
  -F "file=@platform-mappings.csv"
```

响应格式：

```json
{
  "totalRows": 100,
  "successCount": 100,
  "errorCount": 0,
  "errors": []
}
```

### 方式二：应用启动自动加载

通过 `GraphSeedDataLoader` 在应用首次启动时自动读取并导入种子数据。加载器使用幂等逻辑，重复运行不会产生重复记录。

## 注意事项

1. CSV 文件使用 **UTF-8** 编码
2. 第一行为 header，导入时自动跳过
3. 同一个 `unifiedProblemId` 可以有多条记录（分别对应不同平台）
4. 同一平台同一 `platformId` 不可重复（唯一约束）
5. 导入时格式错误的行会被跳过，不影响其他行导入
6. 牛客 ID 使用 `NC` 前缀 + 三位数字编号（如 NC001）
7. 新增映射时请同时添加 LEETCODE 和 NOWCODER 两条记录
