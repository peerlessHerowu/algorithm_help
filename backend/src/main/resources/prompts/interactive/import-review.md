# 内容正确性审查

审查以下导入的算法文章内容，检查逻辑错误和不准确说法。

## 待审内容
{{content}}

## 审查要点
1. 算法逻辑是否正确
2. 复杂度分析是否准确
3. 代码示例是否有 bug
4. 术语使用是否恰当

## 输出格式

```json
{
  "hasErrors": false,
  "errors": [{"location": "位置", "issue": "问题", "severity": "error|warning"}],
  "overallQuality": "high|medium|low"
}
```
