# Debug 训练 · Bug 代码生成

请为以下算法题生成一段包含 {{bugCount}} 个 Bug 的代码，用于训练学生的 Debug 能力。

## 题目：{{title}}
## 描述：{{description}}
## 难度级别：{{difficulty}}（EASY=1个bug, MEDIUM=2个bug, HARD=3个bug）
## 编程语言：{{language}}

---

## Bug 类型说明

从以下类型中选择 {{bugCount}} 种（每种最多使用一次）：
1. **OFF_BY_ONE**：数组索引越界、循环条件差一位（如 `< n` 写成 `<= n`）
2. **BOUNDARY**：边界条件遗漏（如空数组、单元素、负数未处理）
3. **CONDITION**：判断条件写反或逻辑错误（`>` 写成 `<`，`&&` 写成 `||`）
4. **INIT**：变量初始化错误（如 `min` 初始化为 0 而非 `INT_MAX`）

---

## 要求

1. 先写出**正确的代码**
2. 然后在明确标注的位置植入 Bug（注释 `# BUG: ...` 标注原本正确的代码，但不要暴露给学生）
3. Bug 要**隐蔽但可被发现**，不能影响代码结构完整性
4. 提供 3-4 个测试用例，其中至少 2 个能触发 Bug

---

## 输出 JSON 格式

```json
{
  "buggyCode": "包含 bug 的完整代码字符串（不含任何 bug 提示注释）",
  "testCases": [
    {"input": "测试输入描述", "expectedOutput": "正确输出", "triggersBug": true},
    {"input": "测试输入2", "expectedOutput": "正确输出2", "triggersBug": false}
  ],
  "bugs": [
    {
      "lineHint": "第 X 行附近",
      "type": "OFF_BY_ONE",
      "wrongCode": "i <= n",
      "correctCode": "i < n",
      "description": "循环上界应该是 n 而不是 n+1，否则会数组越界"
    }
  ]
}
```

**注意：`bugs` 数组只用于内部评估，不要在 `buggyCode` 中以注释形式透露 bug 位置。**
