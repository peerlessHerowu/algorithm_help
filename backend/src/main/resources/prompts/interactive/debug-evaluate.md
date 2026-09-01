# Debug 修复评估

评估学生提交的 bug 修复方案。

## 原始 buggy 代码
{{buggyCode}}

## 已知 bug 列表
{{bugsJson}}

## 学生提交的修复
{{userFix}}

## 评估要求
1. 检查学生是否正确识别了所有 bug
2. 检查修复后代码是否正确
3. 是否引入了新 bug

## 输出格式

```json
{
  "foundBugs": [{"lineNumber": 5, "correct": true}],
  "missedBugs": [{"lineNumber": 12, "hint": "这行附近还有一个边界问题"}],
  "newBugsIntroduced": false,
  "score": 80,
  "feedback": "评价文字"
}
```
