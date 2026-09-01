"""LeetCode 国际站适配器单元测试

使用 mock HTTP 响应验证 LeetCodeGlobalAdapter 的 GraphQL 采集和数据处理逻辑。
Validates: Requirements 17.1, 17.3, 17.4, 17.5, 17.6, 17.7
"""

import pytest
from unittest.mock import patch

from crawler_service.adapters.leetcode_global import LeetCodeGlobalAdapter
from crawler_service.adapters.base import FetchOptions
from crawler_service.models.enums import Platform, PlatformCapability


# ---- 测试数据 ----

MOCK_PROBLEM_LIST_RESPONSE = {
    "data": {
        "problemsetQuestionList": {
            "total": 3000,
            "questions": [
                {
                    "frontendQuestionId": "1",
                    "titleSlug": "two-sum",
                    "title": "Two Sum",
                    "difficulty": "Easy",
                    "topicTags": [
                        {"name": "Array", "slug": "array"},
                        {"name": "Hash Table", "slug": "hash-table"},
                    ],
                    "acRate": 49.5,
                    "paidOnly": False,
                    "status": "ac",
                },
                {
                    "frontendQuestionId": "2",
                    "titleSlug": "add-two-numbers",
                    "title": "Add Two Numbers",
                    "difficulty": "Medium",
                    "topicTags": [
                        {"name": "Linked List", "slug": "linked-list"},
                    ],
                    "acRate": 40.2,
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
            "titleSlug": "two-sum",
            "content": "<p>Given an array of integers...</p>",
            "difficulty": "Easy",
            "topicTags": [
                {"name": "Array", "slug": "array"},
                {"name": "Hash Table", "slug": "hash-table"},
            ],
            "hints": ["Try using a hash map."],
            "exampleTestcases": "[2,7,11,15]\n9",
            "sampleTestCase": "[2,7,11,15]\n9",
            "metaData": '{"name":"twoSum"}',
            "stats": '{"totalAccepted":"10M"}',
            "acRate": 49.5,
            "likes": 50000,
            "dislikes": 1500,
            "isPaidOnly": False,
        }
    }
}

MOCK_SOLUTIONS_RESPONSE = {
    "data": {
        "questionSolutions": {
            "totalNum": 100,
            "solutions": [
                {
                    "id": 12345,
                    "title": "Hash Map Solution O(n)",
                    "slug": "hash-map-solution",
                    "voteCount": 500,
                    "content": "Use a hash map to store...",
                    "createdAt": "2023-01-15",
                    "author": {"username": "user123"},
                    "topicTags": [{"name": "Hash Table", "slug": "hash-table"}],
                },
                {
                    "id": 12346,
                    "title": "Brute Force",
                    "slug": "brute-force",
                    "voteCount": 200,
                    "content": "Check every pair...",
                    "createdAt": "2023-02-10",
                    "author": {"username": "user456"},
                    "topicTags": [],
                },
            ],
        }
    }
}

MOCK_EDITORIAL_RESPONSE = {
    "data": {
        "question": {
            "solution": {
                "id": 999,
                "content": "## Approach 1: Hash Map\n...",
                "contentTypeId": "markdown",
                "paidOnly": False,
                "rating": {"count": 120, "average": 4.5},
            }
        }
    }
}

MOCK_EDITORIAL_PAID_RESPONSE = {
    "data": {
        "question": {
            "solution": {
                "id": 1000,
                "content": "Premium content...",
                "contentTypeId": "markdown",
                "paidOnly": True,
                "rating": {"count": 50, "average": 4.0},
            }
        }
    }
}

MOCK_EDITORIAL_EMPTY_RESPONSE = {
    "data": {"question": {"solution": None}}
}

MOCK_GRAPHQL_ERROR_RESPONSE = {
    "data": {"question": None},
    "errors": [{"message": "You must be logged in to view this resource."}],
}


# ---- Fixtures ----


@pytest.fixture
def adapter():
    """创建 LeetCodeGlobalAdapter 实例"""
    return LeetCodeGlobalAdapter()


# ---- 基础属性测试 ----


class TestLeetCodeGlobalAdapterBasics:
    """适配器基础属性验证"""

    def test_get_platform(self, adapter):
        """验证返回正确的平台标识"""
        assert adapter.get_platform() == Platform.LEETCODE_GLOBAL

    def test_get_capabilities(self, adapter):
        """验证声明了全部四项能力"""
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
    async def test_fetch_problem_list_success(self, adapter):
        """验证正常采集题目列表并正确转换格式"""
        with patch.object(
            adapter, "_graphql_request", return_value=MOCK_PROBLEM_LIST_RESPONSE
        ):
            result = await adapter.fetch_problem_list(FetchOptions(offset=0, limit=50))

        assert len(result) == 2
        first = result[0]
        assert first["platform"] == "LEETCODE_GLOBAL"
        assert first["platform_id"] == "1"
        assert first["title_slug"] == "two-sum"
        assert first["title"] == "Two Sum"
        assert first["difficulty"] == "Easy"
        assert first["raw_tags"] == ["Array", "Hash Table"]
        assert first["ac_rate"] == 49.5
        assert first["paid_only"] is False
        assert "two-sum" in first["url"]

    @pytest.mark.asyncio
    async def test_fetch_problem_list_pagination(self, adapter):
        """验证分页参数正确传递到 GraphQL 变量"""
        captured_vars = {}

        async def capture_request(query, variables):
            captured_vars.update(variables)
            return MOCK_PROBLEM_LIST_RESPONSE

        with patch.object(adapter, "_graphql_request", side_effect=capture_request):
            await adapter.fetch_problem_list(FetchOptions(offset=50, limit=25))

        assert captured_vars["skip"] == 50
        assert captured_vars["limit"] == 25

    @pytest.mark.asyncio
    async def test_fetch_problem_list_empty(self, adapter):
        """验证空结果正常处理"""
        empty_response = {
            "data": {"problemsetQuestionList": {"total": 0, "questions": []}}
        }

        with patch.object(adapter, "_graphql_request", return_value=empty_response):
            result = await adapter.fetch_problem_list(FetchOptions())

        assert result == []


# ---- fetch_problem_detail 测试 ----


class TestFetchProblemDetail:
    """题目详情采集测试"""

    @pytest.mark.asyncio
    async def test_fetch_problem_detail_success(self, adapter):
        """验证正常采集题目详情并正确转换格式"""
        with patch.object(
            adapter, "_graphql_request", return_value=MOCK_PROBLEM_DETAIL_RESPONSE
        ):
            result = await adapter.fetch_problem_detail("two-sum")

        assert result["platform"] == "LEETCODE_GLOBAL"
        assert result["platform_id"] == "1"
        assert result["title"] == "Two Sum"
        assert result["title_slug"] == "two-sum"
        assert result["description_html"] == "<p>Given an array of integers...</p>"
        assert result["difficulty"] == "Easy"
        assert result["raw_tags"] == ["Array", "Hash Table"]
        assert result["hints"] == ["Try using a hash map."]
        assert result["likes"] == 50000
        assert result["paid_only"] is False

    @pytest.mark.asyncio
    async def test_fetch_problem_detail_not_found(self, adapter):
        """验证题目不存在时返回空字典"""
        with patch.object(
            adapter, "_graphql_request", return_value={"data": {"question": None}}
        ):
            result = await adapter.fetch_problem_detail("nonexistent-problem")

        assert result == {}


# ---- fetch_solutions 测试 ----


class TestFetchSolutions:
    """题解采集测试"""

    @pytest.mark.asyncio
    async def test_fetch_solutions_success(self, adapter):
        """验证正常采集高赞题解"""
        with patch.object(
            adapter, "_graphql_request", return_value=MOCK_SOLUTIONS_RESPONSE
        ):
            result = await adapter.fetch_solutions("two-sum", top_n=10)

        assert len(result) == 2
        first = result[0]
        assert first["platform"] == "LEETCODE_GLOBAL"
        assert first["platform_problem_id"] == "two-sum"
        assert first["solution_id"] == "12345"
        assert first["title"] == "Hash Map Solution O(n)"
        assert first["vote_count"] == 500
        assert first["author"] == "user123"
        assert "two-sum" in first["url"]

    @pytest.mark.asyncio
    async def test_fetch_solutions_empty(self, adapter):
        """验证无题解时返回空列表"""
        empty_response = {
            "data": {"questionSolutions": {"totalNum": 0, "solutions": []}}
        }

        with patch.object(adapter, "_graphql_request", return_value=empty_response):
            result = await adapter.fetch_solutions("hard-problem")

        assert result == []


# ---- fetch_editorial 测试 ----


class TestFetchEditorial:
    """官方 Editorial 采集测试"""

    @pytest.mark.asyncio
    async def test_fetch_editorial_success(self, adapter):
        """验证正常采集 Editorial"""
        with patch.object(
            adapter, "_graphql_request", return_value=MOCK_EDITORIAL_RESPONSE
        ):
            result = await adapter.fetch_editorial("two-sum")

        assert result is not None
        assert result["platform"] == "LEETCODE_GLOBAL"
        assert result["platform_problem_id"] == "two-sum"
        assert result["editorial_id"] == "999"
        assert "Approach 1" in result["content"]
        assert result["rating_count"] == 120
        assert result["rating_average"] == 4.5

    @pytest.mark.asyncio
    async def test_fetch_editorial_paid_only(self, adapter):
        """验证付费 Editorial 返回 None"""
        with patch.object(
            adapter, "_graphql_request", return_value=MOCK_EDITORIAL_PAID_RESPONSE
        ):
            result = await adapter.fetch_editorial("premium-problem")

        assert result is None

    @pytest.mark.asyncio
    async def test_fetch_editorial_not_exist(self, adapter):
        """验证无 Editorial 时返回 None"""
        with patch.object(
            adapter, "_graphql_request", return_value=MOCK_EDITORIAL_EMPTY_RESPONSE
        ):
            result = await adapter.fetch_editorial("no-editorial-problem")

        assert result is None


# ---- Cookie 认证测试 ----


class TestCookieAuthentication:
    """Cookie 认证测试"""

    @pytest.mark.asyncio
    async def test_graphql_error_logged(self, adapter):
        """验证 GraphQL 错误（如需要登录）被正确处理"""
        with patch.object(
            adapter, "_graphql_request", return_value=MOCK_GRAPHQL_ERROR_RESPONSE
        ):
            result = await adapter.fetch_problem_detail("restricted-problem")

        # GraphQL 返回 errors 时不抛异常，但 question 为 None 则返回空字典
        assert result == {}
