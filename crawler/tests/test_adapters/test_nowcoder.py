"""牛客网适配器单元测试

使用 mock HTTP 响应验证 NowcoderAdapter 的 HTML 解析和 API 采集逻辑。
Validates: Requirements 2.1, 2.2, 19.1, 19.4, 19.5, 19.6
"""

import pytest
import httpx
from unittest.mock import AsyncMock, patch

from crawler_service.adapters.nowcoder import NowcoderAdapter
from crawler_service.adapters.base import FetchOptions
from crawler_service.models.enums import Platform, PlatformCapability


# ---- 测试数据 ----

MOCK_PROBLEM_LIST_API_RESPONSE = {
    "data": {
        "list": [
            {
                "questionId": 12345,
                "title": "反转链表",
                "difficulty": 2,
                "tags": [
                    {"name": "链表"},
                    {"name": "递归"},
                ],
            },
            {
                "questionId": 67890,
                "title": "二叉树的层序遍历",
                "difficulty": 3,
                "tags": [
                    {"name": "树"},
                    {"name": "BFS"},
                ],
            },
        ]
    }
}

MOCK_PROBLEM_LIST_EMPTY = {
    "data": {"list": []}
}

MOCK_PROBLEM_DETAIL_API_RESPONSE = {
    "data": {
        "title": "反转链表",
        "content": "<p>给你单链表的头节点 <code>head</code>，请反转链表，并返回反转后的链表。</p>",
        "difficulty": 2,
        "tags": [
            {"name": "链表"},
            {"name": "递归"},
        ],
        "examples": [
            {"input": "[1,2,3,4,5]", "output": "[5,4,3,2,1]"},
        ],
        "constraints": "链表中节点数目在 [0, 5000] 范围内",
    }
}

MOCK_PROBLEM_DETAIL_EMPTY = {
    "data": {}
}

MOCK_PROBLEM_HTML_PAGE = """
<html>
<head><title>反转链表 - 牛客网</title></head>
<body>
<h1>反转链表</h1>
<div class="question-content">
    <p>给你单链表的头节点 <code>head</code>，请反转链表。</p>
    <p><strong>示例：</strong></p>
    <pre>输入：[1,2,3,4,5]
输出：[5,4,3,2,1]</pre>
</div>
<div class="tags">
    <a href="/tag/linked-list">链表</a>
    <a href="/tag/recursion">递归</a>
</div>
<span class="difficulty">中等</span>
</body>
</html>
"""

MOCK_PROBLEM_HTML_MINIMAL = """
<html>
<head><title>简单题 - 牛客网</title></head>
<body>
<h1>简单题</h1>
<div class="nc-post-content">
    <p>这是一道简单题。</p>
</div>
</body>
</html>
"""


# ---- 辅助函数 ----


def _mock_json_response(json_data, status_code=200):
    """构造 mock httpx JSON Response"""
    return httpx.Response(
        status_code=status_code,
        json=json_data,
        request=httpx.Request("GET", "https://www.nowcoder.com/api/test"),
    )


def _mock_html_response(html: str, status_code=200):
    """构造 mock httpx HTML Response"""
    return httpx.Response(
        status_code=status_code,
        text=html,
        request=httpx.Request("GET", "https://www.nowcoder.com/practice/12345"),
    )


def _mock_http_error_response(status_code=500):
    """构造 mock httpx 错误 Response"""
    return httpx.Response(
        status_code=status_code,
        request=httpx.Request("GET", "https://www.nowcoder.com/api/test"),
    )


# ---- Fixtures ----


@pytest.fixture
def adapter():
    """创建 NowcoderAdapter 实例"""
    return NowcoderAdapter()


# ---- 基础属性测试 ----


class TestNowcoderAdapterBasics:
    """适配器基础属性验证"""

    def test_get_platform(self, adapter):
        """验证返回正确的平台标识"""
        assert adapter.get_platform() == Platform.NOWCODER

    def test_get_capabilities(self, adapter):
        """验证仅支持 PROBLEM_FETCH"""
        caps = adapter.get_capabilities()
        assert PlatformCapability.PROBLEM_FETCH in caps
        assert PlatformCapability.SOLUTION_FETCH not in caps
        assert PlatformCapability.EDITORIAL_FETCH not in caps
        assert PlatformCapability.COMMENT_FETCH not in caps
        assert len(caps) == 1

    def test_is_platform_adapter_instance(self, adapter):
        """验证继承自 PlatformAdapter"""
        from crawler_service.adapters.base import PlatformAdapter
        assert isinstance(adapter, PlatformAdapter)


# ---- 不支持的功能测试 ----


class TestUnsupportedCapabilities:
    """验证不支持的功能返回空结果"""

    @pytest.mark.asyncio
    async def test_fetch_solutions_returns_empty(self, adapter):
        """题解采集应返回空列表"""
        result = await adapter.fetch_solutions("12345")
        assert result == []

    @pytest.mark.asyncio
    async def test_fetch_editorial_returns_none(self, adapter):
        """Editorial 采集应返回 None"""
        result = await adapter.fetch_editorial("12345")
        assert result is None

    @pytest.mark.asyncio
    async def test_fetch_comments_returns_empty(self, adapter):
        """评论采集应返回空列表"""
        result = await adapter.fetch_comments("12345")
        assert result == []


# ---- fetch_problem_list 测试 ----


class TestFetchProblemList:
    """题目列表采集测试"""

    @pytest.mark.asyncio
    async def test_success(self, adapter):
        """验证正常采集题目列表"""
        with patch("httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client_cls.return_value.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client_cls.return_value.__aexit__ = AsyncMock(return_value=False)
            mock_client.get = AsyncMock(
                return_value=_mock_json_response(MOCK_PROBLEM_LIST_API_RESPONSE)
            )

            result = await adapter.fetch_problem_list(FetchOptions(offset=0, limit=20))

        assert len(result) == 2
        first = result[0]
        assert first["platform_id"] == "12345"
        assert first["title"] == "反转链表"
        assert first["raw_difficulty"] == 2
        assert first["raw_tags"] == ["链表", "递归"]
        assert "nowcoder.com/practice/12345" in first["url"]

    @pytest.mark.asyncio
    async def test_second_problem(self, adapter):
        """验证第二条题目数据正确"""
        with patch("httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client_cls.return_value.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client_cls.return_value.__aexit__ = AsyncMock(return_value=False)
            mock_client.get = AsyncMock(
                return_value=_mock_json_response(MOCK_PROBLEM_LIST_API_RESPONSE)
            )

            result = await adapter.fetch_problem_list(FetchOptions(offset=0, limit=20))

        second = result[1]
        assert second["platform_id"] == "67890"
        assert second["title"] == "二叉树的层序遍历"
        assert second["raw_tags"] == ["树", "BFS"]

    @pytest.mark.asyncio
    async def test_empty_list(self, adapter):
        """验证空题目列表正常处理"""
        with patch("httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client_cls.return_value.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client_cls.return_value.__aexit__ = AsyncMock(return_value=False)
            mock_client.get = AsyncMock(
                return_value=_mock_json_response(MOCK_PROBLEM_LIST_EMPTY)
            )

            result = await adapter.fetch_problem_list(FetchOptions())

        assert result == []

    @pytest.mark.asyncio
    async def test_http_error_raises(self, adapter):
        """验证 HTTP 错误被正确抛出"""
        with patch("httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client_cls.return_value.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client_cls.return_value.__aexit__ = AsyncMock(return_value=False)
            mock_client.get = AsyncMock(
                return_value=_mock_http_error_response(500)
            )

            with pytest.raises(httpx.HTTPStatusError):
                await adapter.fetch_problem_list(FetchOptions())


# ---- fetch_problem_detail 测试 ----


class TestFetchProblemDetail:
    """题目详情采集测试"""

    @pytest.mark.asyncio
    async def test_success_from_api(self, adapter):
        """验证通过 API 获取题目详情"""
        with patch("httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client_cls.return_value.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client_cls.return_value.__aexit__ = AsyncMock(return_value=False)
            mock_client.get = AsyncMock(
                return_value=_mock_json_response(MOCK_PROBLEM_DETAIL_API_RESPONSE)
            )

            result = await adapter.fetch_problem_detail("12345")

        assert result["platform_id"] == "12345"
        assert result["title"] == "反转链表"
        assert "单链表" in result["description_html"]
        assert result["raw_difficulty"] == 2
        assert result["raw_tags"] == ["链表", "递归"]
        assert result["constraints"] == "链表中节点数目在 [0, 5000] 范围内"
        assert len(result["examples"]) == 1

    @pytest.mark.asyncio
    async def test_fallback_to_html_on_empty_api(self, adapter):
        """验证 API 返回空数据时回退到 HTML 解析"""
        with patch("httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client_cls.return_value.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client_cls.return_value.__aexit__ = AsyncMock(return_value=False)
            # 第一次 API 返回空，第二次 HTML 页面
            mock_client.get = AsyncMock(side_effect=[
                _mock_json_response(MOCK_PROBLEM_DETAIL_EMPTY),
                _mock_html_response(MOCK_PROBLEM_HTML_PAGE),
            ])

            result = await adapter.fetch_problem_detail("12345")

        assert result["platform_id"] == "12345"
        assert result["title"] == "反转链表"
        assert "单链表" in result["description_html"]
        assert result["raw_tags"] == ["链表", "递归"]
        assert result["raw_difficulty"] == "中等"

    @pytest.mark.asyncio
    async def test_fallback_to_html_on_http_error(self, adapter):
        """验证 API HTTP 错误时回退到 HTML 解析"""
        api_error_resp = httpx.Response(
            status_code=403,
            request=httpx.Request("GET", "https://www.nowcoder.com/api/questionbank/detail"),
        )
        with patch("httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client_cls.return_value.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client_cls.return_value.__aexit__ = AsyncMock(return_value=False)
            # 第一个 client: API 403, 第二个 client: HTML 正常
            mock_client.get = AsyncMock(side_effect=[
                api_error_resp,
                _mock_html_response(MOCK_PROBLEM_HTML_PAGE),
            ])

            result = await adapter.fetch_problem_detail("12345")

        assert result["platform_id"] == "12345"
        assert result["title"] == "反转链表"


# ---- HTML 解析逻辑测试 ----


class TestHtmlParsing:
    """HTML 页面解析内部方法测试"""

    def test_extract_title(self, adapter):
        """验证从 HTML 提取标题"""
        from bs4 import BeautifulSoup
        soup = BeautifulSoup(MOCK_PROBLEM_HTML_PAGE, "html.parser")
        title = adapter._extract_title(soup)
        assert title == "反转链表"

    def test_extract_description(self, adapter):
        """验证从 HTML 提取描述（question-content）"""
        from bs4 import BeautifulSoup
        soup = BeautifulSoup(MOCK_PROBLEM_HTML_PAGE, "html.parser")
        desc = adapter._extract_description(soup)
        assert "单链表" in desc
        assert "head" in desc

    def test_extract_description_fallback(self, adapter):
        """验证回退到 nc-post-content"""
        from bs4 import BeautifulSoup
        soup = BeautifulSoup(MOCK_PROBLEM_HTML_MINIMAL, "html.parser")
        desc = adapter._extract_description(soup)
        assert "简单题" in desc

    def test_extract_tags(self, adapter):
        """验证从 HTML 提取标签"""
        from bs4 import BeautifulSoup
        soup = BeautifulSoup(MOCK_PROBLEM_HTML_PAGE, "html.parser")
        tags = adapter._extract_tags(soup)
        assert "链表" in tags
        assert "递归" in tags

    def test_extract_tags_empty(self, adapter):
        """验证无标签时返回空列表"""
        from bs4 import BeautifulSoup
        soup = BeautifulSoup(MOCK_PROBLEM_HTML_MINIMAL, "html.parser")
        tags = adapter._extract_tags(soup)
        assert tags == []

    def test_extract_difficulty(self, adapter):
        """验证从 HTML 提取难度"""
        from bs4 import BeautifulSoup
        soup = BeautifulSoup(MOCK_PROBLEM_HTML_PAGE, "html.parser")
        diff = adapter._extract_difficulty(soup)
        assert diff == "中等"

    def test_extract_difficulty_missing(self, adapter):
        """验证无难度信息时返回空字符串"""
        from bs4 import BeautifulSoup
        soup = BeautifulSoup(MOCK_PROBLEM_HTML_MINIMAL, "html.parser")
        diff = adapter._extract_difficulty(soup)
        assert diff == ""


# ---- _parse_list_item 测试 ----


class TestParseListItem:
    """测试列表项解析方法"""

    def test_valid_item(self, adapter):
        """验证正常项解析"""
        item = {
            "questionId": 999,
            "title": "测试题",
            "difficulty": 1,
            "tags": [{"name": "数组"}, {"name": "排序"}],
        }
        result = adapter._parse_list_item(item)
        assert result["platform_id"] == "999"
        assert result["title"] == "测试题"
        assert result["raw_difficulty"] == 1
        assert result["raw_tags"] == ["数组", "排序"]

    def test_missing_question_id(self, adapter):
        """验证缺少 questionId 返回 None"""
        item = {"title": "无 ID 题", "difficulty": 1, "tags": []}
        result = adapter._parse_list_item(item)
        assert result is None

    def test_empty_tags(self, adapter):
        """验证标签为空时正常处理"""
        item = {"questionId": 1, "title": "题", "difficulty": 1, "tags": []}
        result = adapter._parse_list_item(item)
        assert result["raw_tags"] == []
