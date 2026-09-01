"""HTML→Markdown 转换器

使用 BeautifulSoup 清洗 HTML（移除 script/style/nav 等干扰标签），
然后通过 markdownify 转换为 Markdown 格式。
"""

from bs4 import BeautifulSoup
from markdownify import markdownify


class HtmlToMarkdownConverter:
    """HTML → Markdown 转换器

    负责将各平台采集的 HTML 格式题目描述转换为干净的 Markdown 格式。
    清洗阶段移除 script、style、nav 等非内容标签，保留语义内容。
    """

    # 需要移除的标签列表
    _TAGS_TO_REMOVE = ["script", "style", "nav"]

    def convert(self, html: str) -> str:
        """清洗 HTML 并转换为 Markdown

        Args:
            html: 原始 HTML 字符串

        Returns:
            转换后的 Markdown 字符串，输入为空时返回空字符串
        """
        if not html:
            return ""
        soup = BeautifulSoup(html, "html.parser")
        # 移除脚本、样式、导航等干扰标签
        for tag in soup.find_all(self._TAGS_TO_REMOVE):
            tag.decompose()
        return markdownify(str(soup), heading_style="ATX", code_language="python")
