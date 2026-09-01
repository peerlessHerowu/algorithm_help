# 反向费曼 · 含错误解释生成

请为以下算法题生成一段**包含 {{errorCount}} 个隐蔽错误**的解题解释，用于测试学生的纠错能力。

## 题目：{{title}}
## 描述：{{description}}
## 错误难度：{{difficulty}}（EASY=逻辑/数值错误，MEDIUM=边界/复杂度错误，HARD=概念性错误）

---

## 错误类型要求

按难度选择错误类型：
- **EASY**：LOGIC（逻辑叙述有错）、NUMERIC（数值计算有误）
- **MEDIUM**：BOUNDARY（边界条件遗漏）、COMPLEXITY（复杂度分析有误）
- **HARD**：CONCEPT（核心概念理解错误，且很难察觉）

---

## 要求

1. 先写一段完全**正确**的解释（3-5段）
2. 然后植入 {{errorCount}} 个错误：
   - 错误要**足够隐蔽**（不能一眼就看出来）
   - 但**必须可以被发现**（不能太抽象）
   - 每个错误集中在一个段落内
3. 解释结构：背景分析 → 核心思路 → 关键步骤 → 复杂度分析

---

## 输出 JSON 格式

```json
{
  "explanation": [
    {
      "id": "p1",
      "content": "段落1文字内容（可能含错误也可能正确）",
      "hasError": false
    },
    {
      "id": "p2",
      "content": "段落2文字内容",
      "hasError": true
    }
  ],
  "errors": [
    {
      "paragraphId": "p2",
      "errorType": "LOGIC",
      "wrongStatement": "原文中错误的表述",
      "correctStatement": "正确的表述是什么",
      "hint": "给学生的渐进提示（Level 1：段落范围提示）"
    }
  ]
}
```

**注意：`explanation` 数组中不要暴露 `hasError` 字段给前端，那是内部信息。**
