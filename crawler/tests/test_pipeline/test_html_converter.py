"""HtmlToMarkdownConverter 单元测试"""

import pytest

from crawler_service.pipeline.html_converter import HtmlToMarkdownConverter


@pytest.fixture
def converter():
    return HtmlToMarkdownConverter()


class TestHtmlToMarkdownConverter:
    """测试 HTML→Markdown 转换器"""

    def test_empty_input_returns_empty(self, converter):
        """空输入返回空字符串"""
        assert converter.convert("") == ""
        assert converter.convert(None) == ""

    def test_plain_text_preserved(self, converter):
        """纯文本内容保留"""
        html = "<p>Hello World</p>"
        result = converter.convert(html)
        assert "Hello World" in result

    def test_script_tags_removed(self, converter):
        """script 标签及其内容被移除"""
        html = '<p>Content</p><script>alert("xss")</script>'
        result = converter.convert(html)
        assert "alert" not in result
        assert "script" not in result
        assert "Content" in result

    def test_style_tags_removed(self, converter):
        """style 标签及其内容被移除"""
        html = "<style>.red { color: red; }</style><p>Visible</p>"
        result = converter.convert(html)
        assert "color" not in result
        assert "red" not in result.lower() or "Visible" in result
        assert "Visible" in result

    def test_nav_tags_removed(self, converter):
        """nav 标签及其内容被移除"""
        html = "<nav><a href='/home'>Home</a></nav><p>Main content</p>"
        result = converter.convert(html)
        assert "Home" not in result
        assert "Main content" in result

    def test_heading_converted_to_atx(self, converter):
        """标题转换为 ATX 风格（# 号）"""
        html = "<h1>Title</h1><h2>Subtitle</h2>"
        result = converter.convert(html)
        assert "# Title" in result
        assert "## Subtitle" in result

    def test_code_block_preserved(self, converter):
        """代码块内容保留"""
        html = "<pre><code>def hello():\n    pass</code></pre>"
        result = converter.convert(html)
        assert "def hello():" in result

    def test_links_converted(self, converter):
        """超链接转换为 Markdown 格式"""
        html = '<a href="https://example.com">Click here</a>'
        result = converter.convert(html)
        assert "Click here" in result
        assert "https://example.com" in result

    def test_multiple_unwanted_tags_all_removed(self, converter):
        """多个需移除的标签全部清除"""
        html = (
            "<script>var x=1;</script>"
            "<style>body{}</style>"
            "<nav><ul><li>Nav item</li></ul></nav>"
            "<div><p>Real content here</p></div>"
        )
        result = converter.convert(html)
        assert "var x" not in result
        assert "body{}" not in result
        assert "Nav item" not in result
        assert "Real content here" in result

    def test_nested_script_removed(self, converter):
        """嵌套在其他标签内的 script 也被移除"""
        html = '<div><p>Text</p><script type="text/javascript">code()</script></div>'
        result = converter.convert(html)
        assert "code()" not in result
        assert "Text" in result
