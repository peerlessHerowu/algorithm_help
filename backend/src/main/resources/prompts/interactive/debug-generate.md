# Debug 训练题生成

生成一段包含 bug 的算法代码供学生训练。

## 题目：{{title}}
## 难度：{{difficulty}}
## Bug 数量：{{bugCount}}

## Bug 类型范围
- off-by-one：循环边界差一
- boundary：未处理空输入或极端值
- condition：条件判断逻辑错误
- initialization：变量初始化不正确

## 输出格式

```json
{
  "language": "java",
  "buggyCode": "包含 bug 的完整代码",
  "bugs": [
    {"lineNumber": 5, "type": "off-by-one", "description": "循环应该是 < 而非 <=", "correctCode": "正确行"}
  ],
  "testCases": [
    {"input": "输入", "expected": "期望输出", "actual": "buggy 代码的实际输出"}
  ]
}
```

## 规则
- 代码必须是完整可编译的（除了 bug）
- Bug 要自然隐蔽，不要太明显
- 每个 bug 独立可修复
