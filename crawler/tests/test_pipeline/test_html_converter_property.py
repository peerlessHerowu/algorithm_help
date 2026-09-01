"""
HTML→Markdown 清洗不变量 - Property Test

**Validates: Requirements 4.2**

使用 hypothesis 生成随机 HTML 内容，验证：
1. 转换后输出永远不包含 script/style/nav 标签或其内容
2. <p> 标签内的纯文本内容在转换后保留
"""

from hypothesis import given, settings, assume
from hypothesis import strategies as st

from crawler_service.pipeline.html_converter import HtmlToMarkdownConverter


# ============================================================
# 策略定义：生成合理的 HTML 片段
# ============================================================

# 生成安全的纯文本（排除 HTML 特殊字符，确保可识别）
_safe_text = st.text(
    alphabet=st.characters(
        whitelist_categories=("L", "N", "Zs"),
        whitelist_characters=(" ",),
    ),
    min_size=3,
    max_size=50,
).map(str.strip).filter(lambda t: len(t) >= 3)

# 生成 script 标签内容
_script_content = st.text(
    alphabet=st.characters(whitelist_categories=("L", "N", "P")),
    min_size=5,
    max_size=80,
)

# 生成 style 标签内容
_style_content = st.text(
    alphabet=st.characters(whitelist_categories=("L", "N", "P", "S")),
    min_size=5,
    max_size=80,
)

# 生成 nav 标签内容
_nav_content = st.text(
    alphabet=st.characters(whitelist_categories=("L", "N", "Zs")),
    min_size=5,
    max_size=80,
)


def _build_html_with_unwanted_tags(
    body_text: str,
    script_text: str,
    style_text: str,
    nav_text: str,
) -> str:
    """构建包含 script/style/nav 的 HTML 文档"""
    return (
        f"<div>"
        f"<script>{script_text}</script>"
        f"<style>{style_text}</style>"
        f"<nav>{nav_text}</nav>"
        f"<p>{body_text}</p>"
        f"</div>"
    )


class TestHtmlCleansingInvariant:
    """Property 6: HTML→Markdown 清洗不变量"""

    @given(
        body_text=_safe_text,
        script_text=_script_content,
        style_text=_style_content,
        nav_text=_nav_content,
    )
    @settings(max_examples=100)
    def test_output_never_contains_script_style_nav(
        self,
        body_text: str,
        script_text: str,
        style_text: str,
        nav_text: str,
    ):
        """
        **Validates: Requirements 4.2**

        Property: 转换后的 Markdown 输出中永远不包含
        <script>/<style>/<nav> 标签或其内部内容。
        """
        html = _build_html_with_unwanted_tags(body_text, script_text, style_text, nav_text)
        converter = HtmlToMarkdownConverter()
        result = converter.convert(html)

        # 不包含标签本身
        assert "<script" not in result.lower(), (
            f"输出包含 <script> 标签: {result!r}"
        )
        assert "<style" not in result.lower(), (
            f"输出包含 <style> 标签: {result!r}"
        )
        assert "<nav" not in result.lower(), (
            f"输出包含 <nav> 标签: {result!r}"
        )

        # 不包含 script/style/nav 的内容（当内容足够长且不与 body 重叠时）
        if script_text.strip() and script_text.strip() not in body_text:
            assert script_text.strip() not in result, (
                f"输出包含 script 内容 '{script_text.strip()}'"
            )
        if style_text.strip() and style_text.strip() not in body_text:
            assert style_text.strip() not in result, (
                f"输出包含 style 内容 '{style_text.strip()}'"
            )
        if nav_text.strip() and nav_text.strip() not in body_text:
            assert nav_text.strip() not in result, (
                f"输出包含 nav 内容 '{nav_text.strip()}'"
            )

    @given(body_text=_safe_text)
    @settings(max_examples=100)
    def test_plain_text_in_p_tags_preserved(self, body_text: str):
        """
        **Validates: Requirements 4.2**

        Property: <p> 标签内的纯文本内容在转换后的 Markdown 中保留。
        原始可见文本不会因清洗而丢失。
        """
        html = f"<p>{body_text}</p>"
        converter = HtmlToMarkdownConverter()
        result = converter.convert(html)

        # 纯文本内容必须在输出中保留
        assert body_text in result, (
            f"<p> 中的文本 '{body_text}' 在输出中丢失。输出: {result!r}"
        )
