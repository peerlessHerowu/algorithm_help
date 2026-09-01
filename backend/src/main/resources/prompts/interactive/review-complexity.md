# 复杂度直觉训练

生成一道复杂度估算训练题。

## 模式：{{mode}}
## 难度：{{difficulty}}

## 如果 mode = RANGE_GUESS
- 给出数据范围描述和问题
- 让用户猜测最优算法的时间复杂度

## 如果 mode = CODE_ESTIMATE
- 给出一段代码片段
- 让用户估计时间复杂度

## 输出格式

```json
{
  "mode": "RANGE_GUESS|CODE_ESTIMATE",
  "question": "问题描述",
  "code": "代码片段（仅 CODE_ESTIMATE 模式）",
  "options": ["O(n)", "O(n log n)", "O(n²)", "O(2^n)"],
  "correctAnswer": "O(n log n)",
  "explanation": "推理过程"
}
```
