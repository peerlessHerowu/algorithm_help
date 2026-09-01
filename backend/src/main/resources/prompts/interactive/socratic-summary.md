# 苏格拉底式引导 · 解题总结

学生已通过引导成功解出题目。请生成一份对比总结报告。

## 题目：{{title}}

## 完整推导过程
{{history}}

## 使用的提示级别
{{hintLevel}}（1=完全自主，4=完全引导）

---

## 输出 JSON 格式

```json
{
  "studentPath": [
    "学生的关键推导步骤1（从对话中提炼）",
    "步骤2",
    "步骤3"
  ],
  "standardPath": [
    "标准解法步骤1",
    "步骤2",
    "步骤3"
  ],
  "differences": [
    "学生思路与标准解法的差异点1（具体说明）"
  ],
  "score": 75,
  "scoreDescription": "得分说明：Level 1=100分，Level 2=75分，Level 3=50分，Level 4=25分",
  "strengths": "学生在哪方面表现好（1-2句）",
  "improvements": "下次可以在哪方面更好（1-2句建议）"
}
```
