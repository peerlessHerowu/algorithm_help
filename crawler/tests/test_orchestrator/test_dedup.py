"""
DeduplicationService 单元测试

验证：
- DeduResult 枚举值
- jaccard_similarity 计算正确性
- _tokenize 分词逻辑
- _constraint_similarity 约束比对
- check() 方法的精确/模糊匹配流程
"""

import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from crawler_service.orchestrator.dedup import DeduplicationService, DeduResult


class TestDeduResult:
    """DeduResult 枚举测试"""

    def test_enum_values(self):
        assert DeduResult.CREATE_NEW == "create_new"
        assert DeduResult.UPDATE_EXISTING == "update_existing"
        assert DeduResult.AUTO_MAP_CONFIRMED == "auto_map_confirmed"
        assert DeduResult.AUTO_MAP_PENDING == "auto_map_pending"

    def test_enum_count(self):
        assert len(DeduResult) == 4


class TestJaccardSimilarity:
    """jaccard_similarity 静态方法测试"""

    def test_identical_sets(self):
        """相同集合返回 1.0"""
        assert DeduplicationService.jaccard_similarity({"a", "b", "c"}, {"a", "b", "c"}) == 1.0

    def test_disjoint_sets(self):
        """完全不相交返回 0.0"""
        assert DeduplicationService.jaccard_similarity({"a", "b"}, {"c", "d"}) == 0.0

    def test_both_empty(self):
        """两个空集合返回 0.0"""
        assert DeduplicationService.jaccard_similarity(set(), set()) == 0.0

    def test_one_empty(self):
        """一个空集合返回 0.0"""
        assert DeduplicationService.jaccard_similarity({"a"}, set()) == 0.0
        assert DeduplicationService.jaccard_similarity(set(), {"a"}) == 0.0

    def test_partial_overlap(self):
        """部分重叠正确计算"""
        # {a,b,c} ∩ {b,c,d} = {b,c}, union = {a,b,c,d}
        result = DeduplicationService.jaccard_similarity({"a", "b", "c"}, {"b", "c", "d"})
        assert result == pytest.approx(2 / 4)

    def test_symmetry(self):
        """对称性：J(A,B) == J(B,A)"""
        a = {"x", "y", "z"}
        b = {"y", "z", "w"}
        assert DeduplicationService.jaccard_similarity(a, b) == DeduplicationService.jaccard_similarity(b, a)

    def test_subset(self):
        """子集关系"""
        # {a,b} ⊂ {a,b,c} → intersection=2, union=3
        result = DeduplicationService.jaccard_similarity({"a", "b"}, {"a", "b", "c"})
        assert result == pytest.approx(2 / 3)


class TestTokenize:
    """_tokenize 分词方法测试"""

    def test_empty_string(self):
        assert DeduplicationService._tokenize("") == set()

    def test_english_words(self):
        result = DeduplicationService._tokenize("Two Sum")
        assert "two" in result
        assert "sum" in result

    def test_chinese_chars(self):
        result = DeduplicationService._tokenize("两数之和")
        assert "两" in result
        assert "数" in result
        assert "之" in result
        assert "和" in result

    def test_mixed_content(self):
        result = DeduplicationService._tokenize("LeetCode 两数之和 Two Sum")
        assert "leetcode" in result
        assert "two" in result
        assert "sum" in result
        assert "两" in result
        assert "数" in result

    def test_case_insensitive(self):
        result = DeduplicationService._tokenize("ABC def GHI")
        assert "abc" in result
        assert "def" in result
        assert "ghi" in result


class TestConstraintSimilarity:
    """_constraint_similarity 方法测试"""

    def test_both_empty(self):
        assert DeduplicationService._constraint_similarity("", "") == 0.0

    def test_one_empty(self):
        assert DeduplicationService._constraint_similarity("1 <= n <= 100", "") == 0.0
        assert DeduplicationService._constraint_similarity("", "1 <= n <= 100") == 0.0

    def test_identical_constraints(self):
        c = "1 <= n <= 10^5, -10^9 <= nums[i] <= 10^9"
        result = DeduplicationService._constraint_similarity(c, c)
        assert result == 1.0

    def test_different_numbers(self):
        a = "1 <= n <= 100"
        b = "1 <= n <= 200"
        # numbers_a = {"1", "100"}, numbers_b = {"1", "200"}
        # intersection = {"1"}, union = {"1", "100", "200"}
        result = DeduplicationService._constraint_similarity(a, b)
        assert result == pytest.approx(1 / 3)


class TestCheckMethod:
    """check() 方法集成测试（使用 mock）"""

    @pytest.fixture
    def mock_session(self):
        """模拟 AsyncSession"""
        session = AsyncMock()
        return session

    @pytest.fixture
    def mock_mapping_repo(self):
        """模拟 PlatformMappingRepository"""
        repo = AsyncMock()
        return repo

    @pytest.fixture
    def service(self, mock_session, mock_mapping_repo):
        """创建 DeduplicationService 实例"""
        return DeduplicationService(
            session=mock_session,
            mapping_repo=mock_mapping_repo,
            jaccard_threshold_high=0.8,
            jaccard_threshold_low=0.5,
        )

    @pytest.mark.asyncio
    async def test_exact_match_returns_update(self, service, mock_session):
        """精确匹配命中时返回 UPDATE_EXISTING"""
        # 模拟精确匹配命中
        mock_result = MagicMock()
        mock_result.scalars.return_value.first.return_value = MagicMock()
        mock_session.execute.return_value = mock_result

        raw = {"platform_id": "1", "title": "Two Sum"}
        result = await service.check(raw, "leetcode_global")
        assert result == DeduResult.UPDATE_EXISTING

    @pytest.mark.asyncio
    async def test_no_match_returns_create_new(self, service, mock_session):
        """无匹配时返回 CREATE_NEW"""
        # 精确匹配未命中
        exact_result = MagicMock()
        exact_result.scalars.return_value.first.return_value = None
        # 模糊匹配也无结果（空列表）
        fuzzy_result = MagicMock()
        fuzzy_result.scalars.return_value.all.return_value = []

        mock_session.execute.side_effect = [exact_result, fuzzy_result]

        raw = {"platform_id": "999", "title": "Unique Problem"}
        result = await service.check(raw, "leetcode_global")
        assert result == DeduResult.CREATE_NEW

    @pytest.mark.asyncio
    async def test_high_confidence_returns_auto_confirmed(
        self, service, mock_session, mock_mapping_repo
    ):
        """模糊匹配高置信度时返回 AUTO_MAP_CONFIRMED"""
        # 精确匹配未命中
        exact_result = MagicMock()
        exact_result.scalars.return_value.first.return_value = None

        # 模糊匹配：存在高度相似的记录
        mock_raw_source = MagicMock()
        mock_raw_source.platform = "codeforces"
        mock_raw_source.platform_id = "cf_1"
        mock_raw_source.raw_json = json.dumps({
            "title": "Two Sum",
            "constraints": "1 <= n <= 10000",
        })
        mock_raw_source.id = 12345

        fuzzy_result = MagicMock()
        fuzzy_result.scalars.return_value.all.return_value = [mock_raw_source]

        # 查找 unified_id
        unified_result = MagicMock()
        unified_result.scalars.return_value.first.return_value = 99999

        mock_session.execute.side_effect = [exact_result, fuzzy_result, unified_result]

        raw = {
            "platform_id": "lc_1",
            "title": "Two Sum",
            "constraints": "1 <= n <= 10000",
            "url": "https://leetcode.com/problems/two-sum",
        }
        result = await service.check(raw, "leetcode_global")
        assert result == DeduResult.AUTO_MAP_CONFIRMED
        # 验证写入 mapping 时 confirmed=True
        mock_mapping_repo.save_mapping.assert_called_once()
        call_kwargs = mock_mapping_repo.save_mapping.call_args[1]
        assert call_kwargs["confirmed"] is True
        assert call_kwargs["confidence"] >= 0.8
