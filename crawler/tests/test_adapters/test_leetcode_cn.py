"""力扣中文站适配器单元测试

使用 mock HTTP 响应验证 LeetCodeCNAdapter 的 GraphQL 采集和数据处理逻辑。
Validates: Requirements 2.1, 2.2, 17.2, 17.3, 17.4, 17.5, 17.6, 17.7
"""

import pytest
import httpx
from unittest.mock import AsyncMock, patch

from crawler_service.adapters.leetcode_cn import LeetCodeCNAdapter
from crawler_service.adapters.base import FetchOptions
from crawler_service.models.enums import Platform, PlatformCapability


# ---- 测试数据 ----

MOCK_PROBLEM_LIST_RESPONSE = {
    "data": {
        "problemsetQuestionList": {
            "hasMore": True,
            "total": 2800,
            "questions": [
                {
                    "frontendQuestionId": "1",
                    "titleSlug": "two-sum",
                    "title": "Two Sum",
                    "translatedTitle": "两数之和",
                    "difficulty": "Easy",
                    "topicTags": [
                        {"name": "Array", "translatedName": "数组", "slug": "array"},
                        {"name": "Hash Table", "translatedName": "哈希表", "slug": "hash-table"},
                    ],
                    "acRate": 52.8,
                    "paidOnly": False,
                    "status": "ac",
                },
                {
                    "frontendQuestionId": "2",
                    "titleSlug": "add-two-numbers",
                    "title": "Add Two Numbers",
                    "translatedTitle": "两数相加",
                    "difficulty": "Medium",
                    "topicTags": [
                        {"name": "Linked List", "translatedName": "链表", "slug": "linked-list"},
                    ],
                    "acRate": 42.1,
                    "paidOnly": False,
                    "status": None,
                },
            ],
        }
    }
}

MOCK_PROBLEM_LIST_NO_MORE = {
    "data": {
        "problemsetQuestionList": {
            "hasMore": False,
            "total": 1,
            "questions": [
                {
                    "frontendQuestionId": "100",
                    "titleSlug": "same-tree",
                    "title": "Same Tree",
                    "translatedTitle": "相同的树",
                    "difficulty": "Easy",
                    "topicTags": [],
                    "acRate": 60.0,
                    "paidOnly": False,
                    "status": None,
                },
            ],
        }
    }
}

MOCK_PROBLEM_DETAIL_RESPONSE = {
    "data": {
        "question": {
            "questionId": "1",
            "questionFrontendId": "1",
            "title": "Two Sum",
            "translatedTitle": "两数之和",
            "translatedContent": "<p>给定一个整数数组 <code>nums</code> 和一个整数目标值 <code>target</code>...</p>",
            "content": "<p>Given an array of integers nums...</p>",
            "difficulty": "Easy",
            "topicTags": [
                {"name": "Array", "translatedName": "数组", "slug": "array"},
                {"name": "Hash Table", "translatedName": "哈希表", "slug": "hash-table"},
            ],
            "hints": ["使用哈希表来解决。"],
            "sampleTestCase": "[2,7,11,15]\n9",
            "exampleTestcases": "[2,7,11,15]\n9\n[3,2,4]\n6",
            "constraints": "<li><code>2 <= nums.length <= 10<sup>4</sup></code></li>",
            "stats": '{"totalAccepted":"5M","totalSubmission":"10M"}',
            "acRate": 52.8,
            "likes": 18000,
            "dislikes": 200,
        }
    }
}

MOCK_PROBLEM_DETAIL_EMPTY = {
    "data": {"question": None}
}

MOCK_SOLUTIONS_RESPONSE = {
    "data": {
        "questionSolutionArticles": {
            "totalNum": 50,
            "edges": [
                {
                    "node": {
                        "slug": "hash-map-jie-fa",
                        "title": "哈希表解法 O(n)",
                        "summary": "使用哈希表一次遍历即可...",
                        "content": "## 思路\n使用哈希表存储每个元素...",
                        "solutionTags": [
                            {"name": "哈希表", "slug": "hash-table"},
                        ],
                        "author": {"username": "leetcode_cn_user"},
                        "voteCount": 1200,
                        "createdAt": "2023-06-15T10:00:00Z",
                    }
                },
                {
                    "node": {
                        "slug": "bao-li-jie-fa",
                        "title": "暴力解法",
                        "summary": "双层循环遍历...",
                        "content": "## 暴力法\n遍历每对元素...",
                        "solutionTags": [],
                        "author": {"username": "user_abc"},
                        "voteCount": 300,
                        "createdAt": "2023-07-01T08:30:00Z",
                    }
                },
            ],
        }
    }
}

MOCK_SOLUTIONS_EMPTY = {
    "data": {
        "questionSolutionArticles": {
            "totalNum": 0,
            "edges": [],
        }
    }
}

MOCK_EDITORIAL_RESPONSE = {
    "data": {
        "question": {
            "solution": {
                "id": 888,
                "title": "官方题解：两数之和",
                "content": "## 方法一：暴力枚举\n...\n## 方法二：哈希表\n...",
                "contentTypeId": "markdown",
                "paidOnly": False,
            }
        }
    }
}

MOCK_EDITORIAL_PAID = {
    "data": {
        "question": {
            "solution": {
                "id": 889,
                "title": "官方题解",
                "content": "付费内容...",
                "contentTypeId": "markdown",
                "paidOnly": True,
            }
        }
    }
}

MOCK_EDITORIAL_NONE = {
    "data": {"question": {"solution": None}}
}


# ---- 辅助函数 ----


def _mock_httpx_response(json_data, status_code=200):
    """构造 mock httpx Response"""
    return httpx.Response(
        status_code=status_code,
        json=json_data,
        request=httpx.Request("POST", "https://leetcode.cn/graphql"),
    )


# ---- Fixtures ----


@pytest.fixture
def adapter():
    """创建 LeetCodeCNAdapter 实例"""
    return LeetCodeCNAdapter()


# ---- 基础属性测试 ----


class TestLeetCodeCNAdapterBasics:
    """适配器基础属性验证"""

    def test_get_platform(self, adapter):
        """验证返回正确的平台标识"""
        assert adapter.get_platform() == Platform.LEETCODE_CN

    def test_get_capabilities(self, adapter):
        """验证声明了全部四项采集能力"""
        caps = adapter.get_capabilities()
        assert PlatformCapability.PROBLEM_FETCH in caps
        assert PlatformCapability.SOLUTION_FETCH in caps
        assert PlatformCapability.EDITORIAL_FETCH in caps
        assert PlatformCapability.COMMENT_FETCH in caps
        assert len(caps) == 4

    def test_is_platform_adapter_instance(self, adapter):
        """验证继承自 PlatformAdapter"""
        from crawler_service.adapters.base import PlatformAdapter
        assert isinstance(adapter, PlatformAdapter)


# ---- fetch_problem_list 测试 ----


class TestFetchProblemList:
    """题目列表采集测试"""

    @pytest.mark.asyncio
    async def test_success_with_translated_title(self, adapter):
        """验证采集题目列表时优先使用中文翻译标题"""
        with patch("httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client_cls.return_value.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client_cls.return_value.__aexit__ = AsyncMock(return_value=False)
            # hasMore=True 第一次, hasMore=False 第二次停止
            mock_client.post = AsyncMock(side_effect=[
                _mock_httpx_response(MOCK_PROBLEM_LIST_RESPONSE),
                _mock_httpx_response(MOCK_PROBLEM_LIST_NO_MORE),
            ])

            result = await adapter.fetch_problem_list(FetchOptions(offset=0, limit=50))

        # 应返回 2 + 1 = 3 条
        assert len(result) == 3
        first = result[0]
        assert first["platform"] == "LEETCODE_CN"
        assert first["platform_id"] == "1"
        assert first["title"] == "两数之和"  # 使用 translatedTitle
        assert first["title_en"] == "Two Sum"
        assert first["raw_difficulty"] == "Easy"
        assert first["raw_tags"] == ["数组", "哈希表"]  # 使用 translatedName
        assert first["ac_rate"] == 52.8
        assert first["paid_only"] is False

    @pytest.mark.asyncio
    async def test_stops_when_no_more(self, adapter):
        """验证 hasMore=False 时停止翻页"""
        with patch("httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client_cls.return_value.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client_cls.return_value.__aexit__ = AsyncMock(return_value=False)
            mock_client.post = AsyncMock(
                return_value=_mock_httpx_response(MOCK_PROBLEM_LIST_NO_MORE)
            )

            result = await adapter.fetch_problem_list(FetchOptions(offset=0, limit=50))

        assert len(result) == 1
        assert result[0]["title"] == "相同的树"
        # 只请求一次（hasMore=False 直接停止）
        assert mock_client.post.call_count == 1

    @pytest.mark.asyncio
    async def test_empty_response(self, adapter):
        """验证空题目列表正常处理"""
        empty = {
            "data": {
                "problemsetQuestionList": {
                    "hasMore": False,
                    "total": 0,
                    "questions": [],
                }
            }
        }
        with patch("httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client_cls.return_value.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client_cls.return_value.__aexit__ = AsyncMock(return_value=False)
            mock_client.post = AsyncMock(return_value=_mock_httpx_response(empty))

            result = await adapter.fetch_problem_list(FetchOptions())

        assert result == []

    @pytest.mark.asyncio
    async def test_http_error_raises(self, adapter):
        """验证 HTTP 错误被正确抛出"""
        error_resp = httpx.Response(
            status_code=500,
            request=httpx.Request("POST", "https://leetcode.cn/graphql"),
        )
        with patch("httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client_cls.return_value.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client_cls.return_value.__aexit__ = AsyncMock(return_value=False)
            mock_client.post = AsyncMock(return_value=error_resp)

            with pytest.raises(httpx.HTTPStatusError):
                await adapter.fetch_problem_list(FetchOptions())


# ---- fetch_problem_detail 测试 ----


class TestFetchProblemDetail:
    """题目详情采集测试"""

    @pytest.mark.asyncio
    async def test_success_with_translated_content(self, adapter):
        """验证优先使用 translatedContent 作为描述"""
        with patch("httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client_cls.return_value.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client_cls.return_value.__aexit__ = AsyncMock(return_value=False)
            mock_client.post = AsyncMock(
                return_value=_mock_httpx_response(MOCK_PROBLEM_DETAIL_RESPONSE)
            )

            result = await adapter.fetch_problem_detail("two-sum")

        assert result["platform"] == "LEETCODE_CN"
        assert result["platform_id"] == "1"
        assert result["title"] == "两数之和"
        assert result["title_en"] == "Two Sum"
        # 应优先取 translatedContent
        assert "整数数组" in result["description_html"]
        assert result["raw_difficulty"] == "Easy"
        assert result["raw_tags"] == ["数组", "哈希表"]
        assert result["hints"] == ["使用哈希表来解决。"]
        assert result["likes"] == 18000
        assert result["constraints"] is not None

    @pytest.mark.asyncio
    async def test_detail_not_found(self, adapter):
        """验证题目不存在时返回空字典"""
        with patch("httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client_cls.return_value.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client_cls.return_value.__aexit__ = AsyncMock(return_value=False)
            mock_client.post = AsyncMock(
                return_value=_mock_httpx_response(MOCK_PROBLEM_DETAIL_EMPTY)
            )

            result = await adapter.fetch_problem_detail("nonexistent")

        assert result == {}


# ---- fetch_solutions 测试 ----


class TestFetchSolutions:
    """题解采集测试"""

    @pytest.mark.asyncio
    async def test_success(self, adapter):
        """验证正常采集高赞题解"""
        with patch("httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client_cls.return_value.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client_cls.return_value.__aexit__ = AsyncMock(return_value=False)
            mock_client.post = AsyncMock(
                return_value=_mock_httpx_response(MOCK_SOLUTIONS_RESPONSE)
            )

            result = await adapter.fetch_solutions("two-sum", top_n=10)

        assert len(result) == 2
        first = result[0]
        assert first["platform"] == "LEETCODE_CN"
        assert first["platform_problem_id"] == "two-sum"
        assert first["solution_id"] == "hash-map-jie-fa"
        assert first["title"] == "哈希表解法 O(n)"
        assert first["vote_count"] == 1200
        assert first["author"] == "leetcode_cn_user"
        assert first["tags"] == ["哈希表"]

    @pytest.mark.asyncio
    async def test_empty_solutions(self, adapter):
        """验证无题解时返回空列表"""
        with patch("httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client_cls.return_value.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client_cls.return_value.__aexit__ = AsyncMock(return_value=False)
            mock_client.post = AsyncMock(
                return_value=_mock_httpx_response(MOCK_SOLUTIONS_EMPTY)
            )

            result = await adapter.fetch_solutions("hard-problem")

        assert result == []

    @pytest.mark.asyncio
    async def test_http_failure_returns_empty(self, adapter):
        """验证 HTTP 失败时返回空列表（不抛异常）"""
        with patch("httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client_cls.return_value.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client_cls.return_value.__aexit__ = AsyncMock(return_value=False)
            mock_client.post = AsyncMock(side_effect=httpx.ConnectError("连接超时"))

            result = await adapter.fetch_solutions("two-sum")

        assert result == []


# ---- fetch_editorial 测试 ----


class TestFetchEditorial:
    """官方 Editorial 采集测试"""

    @pytest.mark.asyncio
    async def test_success(self, adapter):
        """验证正常采集 Editorial"""
        with patch("httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client_cls.return_value.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client_cls.return_value.__aexit__ = AsyncMock(return_value=False)
            mock_client.post = AsyncMock(
                return_value=_mock_httpx_response(MOCK_EDITORIAL_RESPONSE)
            )

            result = await adapter.fetch_editorial("two-sum")

        assert result is not None
        assert result["platform"] == "LEETCODE_CN"
        assert result["platform_problem_id"] == "two-sum"
        assert result["editorial_id"] == "888"
        assert result["title"] == "官方题解：两数之和"
        assert "暴力枚举" in result["content_html"]

    @pytest.mark.asyncio
    async def test_paid_editorial_returns_none(self, adapter):
        """验证付费 Editorial 返回 None"""
        with patch("httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client_cls.return_value.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client_cls.return_value.__aexit__ = AsyncMock(return_value=False)
            mock_client.post = AsyncMock(
                return_value=_mock_httpx_response(MOCK_EDITORIAL_PAID)
            )

            result = await adapter.fetch_editorial("paid-problem")

        assert result is None

    @pytest.mark.asyncio
    async def test_no_editorial_returns_none(self, adapter):
        """验证无 Editorial 时返回 None"""
        with patch("httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client_cls.return_value.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client_cls.return_value.__aexit__ = AsyncMock(return_value=False)
            mock_client.post = AsyncMock(
                return_value=_mock_httpx_response(MOCK_EDITORIAL_NONE)
            )

            result = await adapter.fetch_editorial("no-editorial")

        assert result is None

    @pytest.mark.asyncio
    async def test_http_failure_returns_none(self, adapter):
        """验证网络异常时返回 None（不抛异常）"""
        with patch("httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client_cls.return_value.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client_cls.return_value.__aexit__ = AsyncMock(return_value=False)
            mock_client.post = AsyncMock(side_effect=httpx.ConnectError("timeout"))

            result = await adapter.fetch_editorial("two-sum")

        assert result is None
