"""AtCoder 适配器单元测试

使用 mock HTTP 响应验证 AtCoderAdapter 的采集和数据处理逻辑。
Validates: Requirements 19.2, 19.4, 19.5, 19.6
"""

import pytest
import httpx
from unittest.mock import AsyncMock, patch

from crawler_service.adapters.atcoder import AtCoderAdapter, ATCODER_PROBLEMS_API
from crawler_service.adapters.base import FetchOptions
from crawler_service.models.enums import Platform, PlatformCapability


# ---- 测试数据 ----

MOCK_PROBLEMS_RESPONSE = [
    {"id": "abc001_a", "contest_id": "abc001", "title": "積雪深差"},
    {"id": "abc001_b", "contest_id": "abc001", "title": "視程のستقبل"},
    {"id": "abc002_a", "contest_id": "abc002", "title": "正直者"},
    {"id": "arc100_a", "contest_id": "arc100", "title": "Linear Approximation"},
]

MOCK_DIFFICULTY_RESPONSE = {
    "abc001_a": {"slope": 0.1, "intercept": 0.5, "difficulty": 500},
    "abc001_b": {"slope": 0.2, "intercept": 0.6, "difficulty": 1200},
    "arc100_a": {"slope": 0.5, "intercept": 0.9, "difficulty": 2000},
}


# ---- Fixtures ----


@pytest.fixture
def adapter():
    """创建 AtCoderAdapter 实例"""
    return AtCoderAdapter()


def _mock_httpx_response(json_data, status_code=200):
    """构造 mock httpx Response"""
    response = httpx.Response(
        status_code=status_code,
        json=json_data,
        request=httpx.Request("GET", "https://test.com"),
    )
    return response


class TestAtCoderAdapterBasic:
    """测试 AtCoderAdapter 基本属性"""

    def test_get_platform(self, adapter):
        """platform 应为 ATCODER"""
        assert adapter.get_platform() == Platform.ATCODER

    def test_get_capabilities(self, adapter):
        """仅支持 PROBLEM_FETCH"""
        caps = adapter.get_capabilities()
        assert caps == {PlatformCapability.PROBLEM_FETCH}
        assert PlatformCapability.SOLUTION_FETCH not in caps
        assert PlatformCapability.EDITORIAL_FETCH not in caps
        assert PlatformCapability.COMMENT_FETCH not in caps

    @pytest.mark.asyncio
    async def test_fetch_solutions_returns_empty(self, adapter):
        """不支持的方法返回空列表"""
        result = await adapter.fetch_solutions("abc001_a")
        assert result == []

    @pytest.mark.asyncio
    async def test_fetch_editorial_returns_none(self, adapter):
        """不支持的方法返回 None"""
        result = await adapter.fetch_editorial("abc001_a")
        assert result is None

    @pytest.mark.asyncio
    async def test_fetch_comments_returns_empty(self, adapter):
        """不支持的方法返回空列表"""
        result = await adapter.fetch_comments("solution_123")
        assert result == []


class TestFetchProblemList:
    """测试 fetch_problem_list 方法"""

    @pytest.mark.asyncio
    async def test_returns_problems_with_difficulty(self, adapter):
        """题目列表应包含合并的难度信息"""
        with patch("httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client_cls.return_value.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client_cls.return_value.__aexit__ = AsyncMock(return_value=False)

            # 第一次调用获取题目列表，第二次获取难度模型
            mock_client.get = AsyncMock(side_effect=[
                _mock_httpx_response(MOCK_PROBLEMS_RESPONSE),
                _mock_httpx_response(MOCK_DIFFICULTY_RESPONSE),
            ])

            options = FetchOptions(offset=0, limit=50)
            result = await adapter.fetch_problem_list(options)

        assert len(result) == 4
        # 验证有难度数据的题目
        abc001_a = next(p for p in result if p["id"] == "abc001_a")
        assert abc001_a["difficulty"] == 500
        assert abc001_a["raw_difficulty"] == 500
        assert abc001_a["platform_id"] == "abc001_a"
        assert abc001_a["title"] == "積雪深差"
        assert "atcoder.jp" in abc001_a["url"]

    @pytest.mark.asyncio
    async def test_pagination_offset_and_limit(self, adapter):
        """分页参数应正确裁剪结果"""
        with patch("httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client_cls.return_value.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client_cls.return_value.__aexit__ = AsyncMock(return_value=False)

            mock_client.get = AsyncMock(side_effect=[
                _mock_httpx_response(MOCK_PROBLEMS_RESPONSE),
                _mock_httpx_response(MOCK_DIFFICULTY_RESPONSE),
            ])

            options = FetchOptions(offset=1, limit=2)
            result = await adapter.fetch_problem_list(options)

        assert len(result) == 2
        assert result[0]["id"] == "abc001_b"
        assert result[1]["id"] == "abc002_a"

    @pytest.mark.asyncio
    async def test_no_difficulty_marked_as_none(self, adapter):
        """没有难度数据的题目 difficulty 应为 None"""
        with patch("httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client_cls.return_value.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client_cls.return_value.__aexit__ = AsyncMock(return_value=False)

            mock_client.get = AsyncMock(side_effect=[
                _mock_httpx_response(MOCK_PROBLEMS_RESPONSE),
                _mock_httpx_response(MOCK_DIFFICULTY_RESPONSE),
            ])

            options = FetchOptions(offset=0, limit=50)
            result = await adapter.fetch_problem_list(options)

        # abc002_a 没有难度数据
        abc002_a = next(p for p in result if p["id"] == "abc002_a")
        assert abc002_a["difficulty"] is None
        assert abc002_a["raw_difficulty"] is None


class TestFetchProblemDetail:
    """测试 fetch_problem_detail 方法"""

    @pytest.mark.asyncio
    async def test_returns_existing_problem(self, adapter):
        """查询存在的题目应返回完整数据"""
        with patch("httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client_cls.return_value.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client_cls.return_value.__aexit__ = AsyncMock(return_value=False)

            mock_client.get = AsyncMock(side_effect=[
                _mock_httpx_response(MOCK_PROBLEMS_RESPONSE),
                _mock_httpx_response(MOCK_DIFFICULTY_RESPONSE),
            ])

            result = await adapter.fetch_problem_detail("arc100_a")

        assert result["id"] == "arc100_a"
        assert result["difficulty"] == 2000
        assert result["url"] == "https://atcoder.jp/contests/arc100/tasks/arc100_a"

    @pytest.mark.asyncio
    async def test_returns_empty_for_nonexistent(self, adapter):
        """查询不存在的题目应返回空骨架"""
        with patch("httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client_cls.return_value.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client_cls.return_value.__aexit__ = AsyncMock(return_value=False)

            mock_client.get = AsyncMock(side_effect=[
                _mock_httpx_response(MOCK_PROBLEMS_RESPONSE),
                _mock_httpx_response(MOCK_DIFFICULTY_RESPONSE),
            ])

            result = await adapter.fetch_problem_detail("nonexistent_problem")

        assert result["id"] == "nonexistent_problem"
        assert result["title"] == ""


class TestCaching:
    """测试内存缓存机制"""

    @pytest.mark.asyncio
    async def test_cache_avoids_repeated_http_calls(self, adapter):
        """第二次调用应使用缓存，不重复请求"""
        with patch("httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client_cls.return_value.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client_cls.return_value.__aexit__ = AsyncMock(return_value=False)

            mock_client.get = AsyncMock(side_effect=[
                _mock_httpx_response(MOCK_PROBLEMS_RESPONSE),
                _mock_httpx_response(MOCK_DIFFICULTY_RESPONSE),
            ])

            options = FetchOptions(offset=0, limit=50)
            await adapter.fetch_problem_list(options)

        # 第二次调用不需要再 mock HTTP（使用缓存）
        result = await adapter.fetch_problem_list(FetchOptions(offset=0, limit=2))
        assert len(result) == 2

    def test_clear_cache_resets(self, adapter):
        """clear_cache 应清除缓存"""
        adapter._problems_cache = [{"id": "test"}]
        adapter._difficulty_cache = {"test": {}}

        adapter.clear_cache()

        assert adapter._problems_cache is None
        assert adapter._difficulty_cache is None


class TestEnrichWithDifficulty:
    """测试难度合并逻辑"""

    def test_enriches_with_matching_difficulty(self, adapter):
        """有匹配的难度数据应被合并"""
        problems = [{"id": "abc001_a", "title": "Test"}]
        difficulty_map = {"abc001_a": {"difficulty": 800}}

        result = adapter._enrich_with_difficulty(problems, difficulty_map)

        assert result[0]["difficulty"] == 800
        assert result[0]["raw_difficulty"] == 800

    def test_none_difficulty_for_missing_model(self, adapter):
        """无匹配难度数据应为 None"""
        problems = [{"id": "unknown_problem", "title": "Test"}]
        difficulty_map = {}

        result = adapter._enrich_with_difficulty(problems, difficulty_map)

        assert result[0]["difficulty"] is None
        assert result[0]["raw_difficulty"] is None

    def test_none_difficulty_field_in_model(self, adapter):
        """模型中 difficulty 为 None 时标记为 None"""
        problems = [{"id": "abc001_a", "title": "Test"}]
        difficulty_map = {"abc001_a": {"difficulty": None}}

        result = adapter._enrich_with_difficulty(problems, difficulty_map)

        assert result[0]["difficulty"] is None

    def test_does_not_mutate_original_list(self, adapter):
        """合并操作不应修改原始列表"""
        problems = [{"id": "abc001_a", "title": "Test"}]
        difficulty_map = {"abc001_a": {"difficulty": 500}}

        adapter._enrich_with_difficulty(problems, difficulty_map)

        assert "difficulty" not in problems[0]
