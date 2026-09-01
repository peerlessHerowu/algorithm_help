#!/bin/bash
# ============================================================
# 迷你案例代码验证脚本
# 功能：遍历种子数据中所有迷你案例代码，检查行数是否超过 50 行
# 用法：bash scripts/verify-mini-cases.sh
# ============================================================

set -euo pipefail

# 种子数据文件路径
SEED_FILE="backend/src/main/resources/data/seed/application-mappings.json"
MAX_LINES=50

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m' # 无颜色

echo "========================================="
echo "  迷你案例代码验证"
echo "========================================="
echo ""

# 检查种子数据文件是否存在
if [ ! -f "$SEED_FILE" ]; then
    echo -e "${RED}[错误] 种子数据文件不存在: ${SEED_FILE}${NC}"
    exit 1
fi

# 检查 jq 是否可用
if ! command -v jq &> /dev/null; then
    echo -e "${RED}[错误] 需要安装 jq 工具（brew install jq）${NC}"
    exit 1
fi

# 统计变量
TOTAL=0
PASS=0
FAIL=0

# 遍历所有迷你案例
ENTRY_COUNT=$(jq 'length' "$SEED_FILE")
echo "共发现 ${ENTRY_COUNT} 条应用映射记录"
echo ""

for i in $(seq 0 $((ENTRY_COUNT - 1))); do
    TITLE=$(jq -r ".[$i].title" "$SEED_FILE")
    LANG=$(jq -r ".[$i].miniCaseLanguage // \"unknown\"" "$SEED_FILE")
    CODE=$(jq -r ".[$i].miniCaseCode // \"\"" "$SEED_FILE")
    RUNTIME=$(jq -r ".[$i].runtimeRequirements // \"未指定\"" "$SEED_FILE")

    # 跳过没有代码的记录
    if [ -z "$CODE" ] || [ "$CODE" = "null" ]; then
        continue
    fi

    TOTAL=$((TOTAL + 1))

    # 计算代码行数（通过换行符）
    LINE_COUNT=$(echo "$CODE" | wc -l | tr -d ' ')

    if [ "$LINE_COUNT" -gt "$MAX_LINES" ]; then
        echo -e "${RED}[超限] ${TITLE} (${LANG}): ${LINE_COUNT} 行（超过${MAX_LINES}行限制）${NC}"
        echo "       运行环境: ${RUNTIME}"
        FAIL=$((FAIL + 1))
    else
        echo -e "${GREEN}[通过] ${TITLE} (${LANG}): ${LINE_COUNT} 行${NC}"
        echo "       运行环境: ${RUNTIME}"
        PASS=$((PASS + 1))
    fi
done

# 输出汇总
echo ""
echo "========================================="
echo "  验证结果汇总"
echo "========================================="
echo "  总计检查: ${TOTAL} 个迷你案例"
echo -e "  通过: ${GREEN}${PASS}${NC}"
echo -e "  超限: ${RED}${FAIL}${NC}"
echo "========================================="

# 有超限则返回非零退出码
if [ "$FAIL" -gt 0 ]; then
    echo ""
    echo -e "${YELLOW}[提示] 请将超限代码拆分为"核心代码"+"完整版链接"${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}所有迷你案例代码均在 ${MAX_LINES} 行以内 ✓${NC}"
exit 0
