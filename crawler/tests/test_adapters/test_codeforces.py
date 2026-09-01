"""Codeforces 适配器单元测试

使用 mock HTTP 响应验证 CodeforcesAdapter 的采集和数据处理逻辑。
Validates: Requirements 18.1, 18.2, 18.3, 18.4, 18.5, 18.6
"""

import pytest
import httpx
from unittest.mock import AsyncMock, patch

from crawler_service.adapters.codeforces import CodeforcesAdapter
from crawler_service.adapters.base import FetchOptions
from crawler_service.models.enums import Platform, PlatformCapability


# ---- 测试数据 ----

MOCK_API_OK_RESPONSE = {
    "status": "OK",
    "result": {
        "problems": [
            {
                "contestId": 1,
                "index": "A",
                "name": "Theatre Square",
                "tags": ["math"],
                "rating": 1000,
            },
            {
                "contestId": 1,
                "index": "B",
                "name": "Spreadsheet",
                "tags": ["implementation", "math"],
                "rating": 1600,
            },
            {
                "contestId": 4,
                "index": "A",
                "name": "Watermelon",
                "tags": ["brute force", "math"],
                "rating": 800,
            },
            {
                "contestId": 1234,
                "index": "C",
                "name": "Hard Problem",
                "tags": ["dp", "graphs"],
                "rating": 2100,
            },
        ],
        "problemStatistics": [
            {"contestId": 1, "index": "A", "solvedCount": 200000},
            {"contestId": 1, "index": "B", "solvedCount": 80000},
            {"contestId": 4, "index": "A", "solvedCount": 350000},
            {"contestId": 1234, "index": "C", "solvedCount": 5000},
        ],
    },
}

MOCK_API_FAILED_RESPONSE = {
    "status": "FAILED",
    "comment": "Call limit exceeded",
}

MOCK_PROBLEM_HTML = """
<html>
<body>
<div class="problem-statement">
    <div class="header">
        <div class="title">A. Theatre Square</div>
        <div class="time-limit">time limit per test: 1 second</div>
        <div class="memory-limit">memory limit per test: 256 megabytes</div>
    </div>
    <div>
        <p>Theatre Square in the capital city has a rectangular shape with size n × m meters.</p>
        <p>Find the minimum number of flagstones needed.</p>
    </div>
    <div class="input-specification">
        <div class="section-title">Input</div>
        <p>The input contains three positive integers n, m and a.</p>
    </div>
    <div class="output-specification">
        <div class="section-title">Output</div>
        <p>Write the needed number of flagstones.</p>
    </div>
    <div class="sample-tests">
        <div class="sample-test">
            <div class="input"><pre>6 6 4</pre></div>
            <div class="output"><pre>4</pre></div>
        </div>
    </div>
</div>
</body>
</html>
"""


# ---- Fixtures ----


@pytest.fixture
def adapter():
    """创建 CodeforcesAdapter 实例"""
    return CodeforcesAdapter()


def _mock_httpx_response(json_data, status_code=200):
    """构造 mock httpx Response"""
    return httpx.Response(
        status_code=status_code,
        json=json_data,
        request=httpx.Request("GET", "https://codeforces.com/api/test"),
    )


def _mock_httpx_html_response(html: str, status_code=200):
    """构造 mock httpx HTML Response"""
    return httpx.Response(
        status_code=status_code,
        text=html,
        request=httpx.Request("GET", "https://codeforces.com/problemset/problem/1/A"),
    )


class TestCodeforcesAdapterBasic:
    """测试 CodeforcesAdapter 基本属性"""

    def test_get_platform(self, adapter):
        """platform 应为 CODEFORCES"""
        assert adapter.get_platform() == Platform.CODEFORCES

    def test_get_capabilities(self, adapter):
        """应支持 PROBLEM_FETCH 和 SOLUTION_FETCH"""
        caps = adapter.get_capabilities()
        assert PlatformCapability.PROBLEM_FETCH in caps
        assert PlatformCapability.SOLUTION_FETCH in caps
        assert PlatformCapability.EDITORIAL_FETCH not in caps
        assert PlatformCapability.COMMENT_FETCH not in caps


class TestParseProblemId:
    """测试 _parse_problem_id 静态方法"""

    def test_simple_id(self, adapter):
        """简单题号解析：1A → (1, 'A')"""
        contest_id, index = adapter._parse_problem_id("1A")
        assert contest_id == 1
        assert index == "A"

    def test_multi_digit_contest(self, adapter):
        """多位 contestId 解析：1234B → (1234, 'B')"""
        contest_id, index = adapter._parse_problem_id("1234B")
        assert contest_id == 1234
        assert index == "B"

    def test_index_with_number(self, adapter):
        """带数字的 index：1234B2 → (1234, 'B2')"""
        contest_id, index = adapter._parse_problem_id("1234B2")
        assert contest_id == 1234
        assert index == "B2"

    def test_empty_string(self, adapter):
        """空字符串返回 (None, '')"""
        contest_id, index = adapter._parse_problem_id("")
        assert contest_id is None
        assert index == ""

    def test_all_digits(self, adapter):
        """全是数字返回 (None, '')"""
        contest_id, index = adapter._parse_problem_id("1234")
        assert contest_id is None
        assert index == ""

    def test_starts_with_letter(self, adapter):
        """以字母开头返回 (None, '')"""
        contest_id, index = adapter._parse_problem_id("A1")
        assert contest_id is None
        assert index == ""


class TestFetchProblemList:
    """测试 fetch_problem_list 方法"""

    @pytest.mark.asyncio
    async def test_returns_problems_with_stats(self, adapter):
        """题目列表应包含合并的统计信息"""
        with patch("httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client_cls.return_value.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client_cls.return_value.__aexit__ = AsyncMock(return_value=False)
            mock_client.get = AsyncMock(return_value=_mock_httpx_response(MOCK_API_OK_RESPONSE))

            options = FetchOptions(offset=0, limit=50)
            result = await adapter.fetch_problem_list(options)

        assert len(result) == 4

        # 验证第一条题目
        first = result[0]
        assert first["platform_id"] == "1A"
        assert first["title"] == "Theatre Square"
        assert first["raw_tags"] == ["math"]
        assert first["raw_difficulty"] == 1000
        assert first["solved_count"] == 200000
        assert first["platform"] == "CODEFORCES"
        assert "codeforces.com/problemset/problem/1/A" in first["url"]

    @pytest.mark.asyncio
    async def test_pagination(self, adapter):
        """分页参数应正确裁剪结果"""
        with patch("httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client_cls.return_value.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client_cls.return_value.__aexit__ = AsyncMock(return_value=False)
            mock_client.get = AsyncMock(return_value=_mock_httpx_response(MOCK_API_OK_RESPONSE))

            options = FetchOptions(offset=1, limit=2)
            result = await adapter.fetch_problem_list(options)

        assert len(result) == 2
        assert result[0]["platform_id"] == "1B"
        assert result[1]["platform_id"] == "4A"

    @pytest.mark.asyncio
    async def test_api_failed_retries(self, adapter):
        """API FAILED 状态应重试后最终返回空列表"""
        with patch("httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client_cls.return_value.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client_cls.return_value.__aexit__ = AsyncMock(return_value=False)
            # 始终返回 FAILED
            mock_client.get = AsyncMock(
                return_value=_mock_httpx_response(MOCK_API_FAILED_RESPONSE)
            )

            with patch("asyncio.sleep", new_callable=AsyncMock):
                options = FetchOptions(offset=0, limit=50)
                result = await adapter.fetch_problem_list(options)

        assert result == []
        # 应该重试了 3 次
        assert mock_client.get.call_count == 3

    @pytest.mark.asyncio
    async def test_api_failed_then_ok(self, adapter):
        """API FAILED 后重试成功应返回数据"""
        with patch("httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client_cls.return_value.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client_cls.return_value.__aexit__ = AsyncMock(return_value=False)
            # 第一次 FAILED，第二次 OK
            mock_client.get = AsyncMock(side_effect=[
                _mock_httpx_response(MOCK_API_FAILED_RESPONSE),
                _mock_httpx_response(MOCK_API_OK_RESPONSE),
            ])

            with patch("asyncio.sleep", new_callable=AsyncMock):
                options = FetchOptions(offset=0, limit=50)
                result = await adapter.fetch_problem_list(options)

        assert len(result) == 4


class TestFetchProblemDetail:
    """测试 fetch_problem_detail 方法"""

    @pytest.mark.asyncio
    async def test_parses_html_page(self, adapter):
        """应正确解析 Codeforces HTML 题面"""
        with patch("httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client_cls.return_value.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client_cls.return_value.__aexit__ = AsyncMock(return_value=False)
            mock_client.get = AsyncMock(return_value=_mock_httpx_html_response(MOCK_PROBLEM_HTML))

            result = await adapter.fetch_problem_detail("1A")

        assert result["platform_id"] == "1A"
        assert "Theatre Square" in result.get("title", "")
        assert result.get("description_html") is not None
        assert result.get("description_md") is not None
        assert "rectangular shape" in result.get("description_md", "")
        assert result.get("constraints") != ""
        assert "1 second" in result["constraints"]
        assert "256 megabytes" in result["constraints"]

    @pytest.mark.asyncio
    async def test_extracts_examples(self, adapter):
        """应正确提取样例"""
        with patch("httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client_cls.return_value.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client_cls.return_value.__aexit__ = AsyncMock(return_value=False)
            mock_client.get = AsyncMock(return_value=_mock_httpx_html_response(MOCK_PROBLEM_HTML))

            result = await adapter.fetch_problem_detail("1A")

        examples = result.get("examples", [])
        assert len(examples) == 1
        assert "6 6 4" in examples[0]["input"]
        assert "4" in examples[0]["output"]

    @pytest.mark.asyncio
    async def test_invalid_id_returns_empty(self, adapter):
        """无效题号应返回空字典"""
        result = await adapter.fetch_problem_detail("invalid")
        assert result == {}

    @pytest.mark.asyncio
    async def test_empty_id_returns_empty(self, adapter):
        """空题号应返回空字典"""
        result = await adapter.fetch_problem_detail("")
        assert result == {}


class TestBuildStatsMap:
    """测试 _build_stats_map 静态方法"""

    def test_builds_correct_map(self, adapter):
        """应正确构建统计映射"""
        statistics = [
            {"contestId": 1, "index": "A", "solvedCount": 100},
            {"contestId": 1, "index": "B", "solvedCount": 50},
        ]
        stats_map = adapter._build_stats_map(statistics)
        assert stats_map["1A"]["solvedCount"] == 100
        assert stats_map["1B"]["solvedCount"] == 50

    def test_handles_empty_list(self, adapter):
        """空列表返回空字典"""
        stats_map = adapter._build_stats_map([])
        assert stats_map == {}
