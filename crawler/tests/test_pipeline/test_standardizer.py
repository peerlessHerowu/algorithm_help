"""DataStandardizer 主管线单元测试

验证五阶段管线的串联逻辑和 standardize_solution 方法。
"""

import pytest
from unittest.mock import AsyncMock, MagicMock

from crawler_service.pipeline.standardizer import DataStandardizer
from crawler_service.pipeline.html_converter import HtmlToMarkdownConverter
from crawler_service.pipeline.difficulty_mapper import DifficultyMapper
from crawler_service.pipeline.tag_mapper import TagMapper
from crawler_service.pipeline.quality_checker import QualityChecker, QualityResult


@pytest.fixture
def html_converter():
    return HtmlToMarkdownConverter()


@pytest.fixture
def image_handler():
    """使用 AsyncMock 模拟 ImageHandler，避免真实网络请求"""
    handler = AsyncMock()
    # 默认行为：原样返回输入 markdown
    handler.process = AsyncMock(side_effect=lambda md, platform: md)
    return handler


@pytest.fixture
def diff_mapper():
    return DifficultyMapper()


@pytest.fixture
def tag_mapper():
    return TagMapper()


@pytest.fixture
def quality_checker():
    return QualityChecker()


@pytest.fixture
def standardizer(html_converter, image_handler, diff_mapper, tag_mapper, quality_checker):
    return DataStandardizer(
        html_converter=html_converter,
        image_handler=image_handler,
        diff_mapper=diff_mapper,
        tag_mapper=tag_mapper,
        quality_checker=quality_checker,
    )


@pytest.mark.asyncio
async def test_standardize_full_pipeline(standardizer):
    """测试完整管线：HTML→Markdown、难度映射、标签映射、质量检查"""
    raw = {
        "platform_id": "two-sum",
        "title": "Two Sum",
        "description_html": "<p>Given an array of integers nums.</p>",
        "raw_difficulty": "Easy",
        "raw_tags": ["Array", "Hash Table"],
        "constraints": "2 <= nums.length <= 10^4",
        "examples": [{"input": "[2,7,11,15]", "output": "[0,1]"}],
        "url": "https://leetcode.com/problems/two-sum",
    }

    result = await standardizer.standardize(raw, "leetcode_global")

    assert result["platform_id"] == "two-sum"
    assert result["title"] == "Two Sum"
    assert "Given an array" in result["description"]
    assert result["difficulty"] == "EASY"
    assert len(result["tags"]) == 2
    assert result["tags"][0]["name"] == "array"
    assert result["tags"][0]["confirmed"] is True
    assert result["tags"][1]["name"] == "hash-table"
    assert result["quality_status"] == "OK"
    assert result["platform"] == "leetcode_global"
    assert result["url"] == "https://leetcode.com/problems/two-sum"


@pytest.mark.asyncio
async def test_standardize_incomplete_data(standardizer):
    """测试缺失必填字段时，quality_status 为 INCOMPLETE"""
    raw = {
        "platform_id": "123",
        "title": "",
        "description_html": "<p>Some content</p>",
        "raw_difficulty": "Medium",
        "raw_tags": [],
    }

    result = await standardizer.standardize(raw, "leetcode_global")

    assert result["quality_status"] == "INCOMPLETE"
    assert "title" in result["quality_message"]


@pytest.mark.asyncio
async def test_standardize_empty_description(standardizer):
    """测试 description 为空时，quality_status 为 INCOMPLETE"""
    raw = {
        "platform_id": "456",
        "title": "Some Title",
        "description_html": "",
        "raw_difficulty": "Hard",
        "raw_tags": ["Array"],
    }

    result = await standardizer.standardize(raw, "leetcode_global")

    assert result["quality_status"] == "INCOMPLETE"
    assert "description" in result["quality_message"]


@pytest.mark.asyncio
async def test_standardize_codeforces_rating(standardizer):
    """测试 Codeforces rating 到难度的映射"""
    raw = {
        "platform_id": "1A",
        "title": "Theatre Square",
        "description_html": "<p>Theatre Square in the capital.</p>",
        "raw_difficulty": "1000",
        "raw_tags": ["math", "greedy"],
    }

    result = await standardizer.standardize(raw, "codeforces")

    assert result["difficulty"] == "EASY"


@pytest.mark.asyncio
async def test_standardize_solution_ok(standardizer):
    """测试题解标准化 —— 内容充足时返回标准化结果"""
    raw_solution = {
        "platform_id": "sol-001",
        "author": "user123",
        "title": "Python 双指针解法",
        "content_html": "<p>" + "这是一段很长的题解内容，" * 20 + "</p>",
        "upvotes": 42,
        "language": "python",
    }

    result = await standardizer.standardize_solution(raw_solution)

    assert result is not None
    assert result["platform_id"] == "sol-001"
    assert result["author"] == "user123"
    assert result["upvotes"] == 42
    assert result["quality_status"] == "OK"


@pytest.mark.asyncio
async def test_standardize_solution_low_quality(standardizer):
    """测试题解标准化 —— 内容过短时返回 None"""
    raw_solution = {
        "platform_id": "sol-002",
        "author": "user456",
        "title": "短解法",
        "content_html": "<p>太短了</p>",
        "upvotes": 1,
        "language": "java",
    }

    result = await standardizer.standardize_solution(raw_solution)

    assert result is None


@pytest.mark.asyncio
async def test_standardize_solution_plain_text_fallback(standardizer):
    """测试题解标准化 —— 无 HTML 时使用 content 字段"""
    raw_solution = {
        "platform_id": "sol-003",
        "author": "user789",
        "title": "纯文本解法",
        "content": "这是一段纯文本的题解内容，" * 15,
        "upvotes": 10,
        "language": "cpp",
    }

    result = await standardizer.standardize_solution(raw_solution)

    assert result is not None
    assert "纯文本的题解内容" in result["content"]
    assert result["quality_status"] == "OK"


@pytest.mark.asyncio
async def test_standardize_image_handler_called(image_handler):
    """测试图片处理阶段确实被调用"""
    # 让 image_handler 模拟替换 URL
    image_handler.process = AsyncMock(
        return_value="![alt](http://minio/internal/img.png)"
    )

    standardizer = DataStandardizer(
        html_converter=HtmlToMarkdownConverter(),
        image_handler=image_handler,
        diff_mapper=DifficultyMapper(),
        tag_mapper=TagMapper(),
        quality_checker=QualityChecker(),
    )

    raw = {
        "platform_id": "img-test",
        "title": "Image Test",
        "description_html": "<p>See image: <img src='http://external/img.png'/></p>",
        "raw_difficulty": "Easy",
        "raw_tags": [],
    }

    result = await standardizer.standardize(raw, "leetcode_global")

    image_handler.process.assert_called_once()
    assert "minio/internal" in result["description"]
