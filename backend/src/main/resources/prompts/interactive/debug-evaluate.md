# Debug 训练 · 学生修复评估

请评估学生对以下 Bug 代码的修复方案是否正确。

## 原始有 Bug 的代码
```
{{buggyCode}}
```

## 实际存在的 Bugs（内部信息，不要直接告诉学生）
{{bugsJson}}

## 学生提交的修复内容
{{userFix}}

---

## 评估任务

1. 判断学生标注的 Bug 位置是否正确（行数附近）
2. 判断学生的修复方案是否正确（语义上等价即可，不要求字符完全相同）
3. 判断是否遗漏了其他 Bug

---

## 输出 JSON 格式

```json
{
  "foundBugs": [
    {
      "type": "OFF_BY_ONE",
      "studentFound": true,
      "studentFixCorrect": true,
      "feedback": "正确！你准确找到了循环越界的问题。"
    }
  ],
  "missedBugs": [
    {
      "type": "BOUNDARY",
      "hint": "还有一个边界条件的问题，想想空数组的情况..."
    }
  ],
  "allFound": false,
  "score": 60,
  "overallFeedback": "你找到了 1 个 Bug，还有 1 个遗漏了。整体思路正确，注意边界条件处理。"
}
```
