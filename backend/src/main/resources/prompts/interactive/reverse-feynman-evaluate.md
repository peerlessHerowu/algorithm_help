# 反向费曼 · 纠错评估

请评估学生对以下错误的纠正是否准确。

## 原文错误信息
- 段落 ID：{{paragraphId}}
- 原文错误表述：{{wrongStatement}}
- 正确表述：{{correctStatement}}
- 错误类型：{{errorType}}

## 学生的纠正
{{studentAnswer}}

---

## 评估任务

1. 判断学生是否找到了正确的错误点
2. 判断学生给出的正确说法是否符合实际
3. 给出鼓励性反馈

---

## 输出 JSON 格式

```json
{
  "passed": true,
  "identifiedCorrectly": true,
  "correctionAccurate": true,
  "feedback": "准确！原文说'...是错误的，正确的是...'",
  "compliment": "很好的观察力！你注意到了这个细节。",
  "explanation": "完整的正确解释（1-2段）"
}
```

如果学生答案不对：
```json
{
  "passed": false,
  "identifiedCorrectly": false,
  "correctionAccurate": false,
  "feedback": "这个方向不太对，你找到的不是主要错误。",
  "hint": "再仔细看看这段话的逻辑，特别关注[...]部分",
  "explanation": ""
}
```
