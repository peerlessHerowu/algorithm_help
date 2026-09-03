# 内容导入 · AI 质量审查

请对以下算法题解内容进行质量审查，重点检查：

## 待审查内容
{{content}}

---

## 审查维度

### 1. 内容正确性（最重要）
- 算法逻辑是否正确？
- 复杂度分析是否准确？
- 代码是否有明显 Bug？

### 2. 内容完整性
- 是否有解题思路说明？
- 是否有代码实现？
- 是否有复杂度分析？

### 3. 内容质量
- 表达是否清晰？
- 是否有易于理解的例子？
- 是否有关键步骤缺失？

---

## 输出 JSON 格式

```json
{
  "overallScore": 85,
  "correctness": {
    "score": 90,
    "issues": ["复杂度分析遗漏了最坏情况"]
  },
  "completeness": {
    "score": 80,
    "missing": ["缺少完整代码"]
  },
  "quality": {
    "score": 85,
    "suggestions": ["建议补充示例"]
  },
  "recommendation": "IMPORT",
  "summary": "内容质量良好，算法逻辑正确，建议补充完整代码后导入。"
}
```

`recommendation` 枚举值：
- `IMPORT`：建议直接导入（分数 ≥ 70）
- `IMPORT_WITH_REVIEW`：建议导入但人工核查（分数 50-69）
- `REJECT`：质量太低，不建议导入（分数 < 50）
