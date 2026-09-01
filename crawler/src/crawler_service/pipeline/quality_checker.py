"""数据质量检查器

对采集数据执行完整性和质量校验：
- 题目必填字段校验（title/description/difficulty）
- 题解最小内容长度校验
"""

from dataclasses import dataclass


@dataclass
class QualityResult:
    """质量检查结果

    status 取值：
    - "OK": 数据质量合格
    - "INCOMPLETE": 缺失必填字段
    - "LOW_QUALITY": 内容质量过低（如题解过短）
    """

    status: str
    message: str = ""


class QualityChecker:
    """数据质量检查器

    负责对采集的题目和题解数据执行质量校验，
    确保低质量或不完整的数据不进入正式内容库。
    """

    # 题解内容最小长度要求（字符数）
    MIN_SOLUTION_LENGTH = 100

    def check(self, data: dict) -> QualityResult:
        """检查题目数据质量

        对题目执行完整性校验：title、description、difficulty 三个字段为必填，
        缺失任一则标记为 INCOMPLETE。

        Args:
            data: 题目数据字典，应包含 title、description、difficulty 字段

        Returns:
            QualityResult: 检查结果
        """
        title = data.get("title", "")
        description = data.get("description", "")
        difficulty = data.get("difficulty", "")

        if not title or not description or not difficulty:
            missing = []
            if not title:
                missing.append("title")
            if not description:
                missing.append("description")
            if not difficulty:
                missing.append("difficulty")
            return QualityResult(
                status="INCOMPLETE",
                message=f"缺失必填字段: {', '.join(missing)}",
            )
        return QualityResult(status="OK")

    def check_solution(self, content: str) -> QualityResult:
        """检查题解内容质量

        对题解执行最小内容长度校验：正文内容少于 MIN_SOLUTION_LENGTH 字符
        的题解标记为 LOW_QUALITY。

        Args:
            content: 题解正文内容

        Returns:
            QualityResult: 检查结果
        """
        if len(content) < self.MIN_SOLUTION_LENGTH:
            return QualityResult(
                status="LOW_QUALITY",
                message=f"题解内容过短: {len(content)} 字符，最低要求 {self.MIN_SOLUTION_LENGTH}",
            )
        return QualityResult(status="OK")
