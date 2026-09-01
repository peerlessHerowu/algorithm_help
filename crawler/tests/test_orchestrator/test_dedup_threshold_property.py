"""
去重阈值判断正确性 - Property Test

**Validates: Requirements 5.3, 5.4, 5.5**

使用 hypothesis 生成随机 confidence 值，验证 DeduplicationService.check() 的阈值判断逻辑：
1. confidence >= 0.8 → DeduResult.AUTO_MAP_CONFIRMED (confirmed=true)
2. 0.5 <= confidence < 0.8 → DeduResult.AUTO_MAP_PENDING (confirmed=false)
3. confidence < 0.5 → DeduResult.CREATE_NEW

通过 mock _exact_match 返回 None 和 _fuzzy_match 返回控制的 confidence 值，
隔离测试阈值判断逻辑。
"""

from unittest.mock import AsyncMock, patch

import pytest
from hypothesis import given, settings, assume
from hypothesis import strategies as st

from crawler_service.orchestrator.dedup import DeduplicationService, DeduResult


# 固定的 matched_problem_id，用于模糊匹配返回
MATCHED_PROBLEM_ID = 10001


def _make_service() -> DeduplicationService:
    """创建带 mock session 和 repo 的 DeduplicationService"""
    session = AsyncMock()
    mapping_repo = AsyncMock()
    return DeduplicationService(
        session=session,
        mapping_repo=mapping_repo,
        jaccard_threshold_high=0.8,
        jaccard_threshold_low=0.5,
    )


def _raw_data() -> dict:
    """构造最小化的原始数据"""
    return {
        "platform_id": "test_123",
        "title": "Test Problem",
        "constraints": "1 <= n <= 100",
        "url": "https://example.com/problem/123",
    }


class TestDeduThresholdProperty:
    """Property 11: 去重阈值判断正确性"""

    @given(confidence=st.floats(min_value=0.8, max_value=1.0, allow_nan=False))
    @settings(max_examples=100)
    @pytest.mark.asyncio
    async def test_high_confidence_returns_auto_map_confirmed(self, confidence):
        """
        **Validates: Requirements 5.3**

        Property: 当 confidence >= 0.8 且存在匹配的 problem_id 时，
        check() 返回 DeduResult.AUTO_MAP_CONFIRMED，且写入 mapping 时 confirmed=True。
        """
        service = _make_service()

        # mock _exact_match 返回 None（无精确匹配）
        service._exact_match = AsyncMock(return_value=None)
        # mock _fuzzy_match 返回控制的 confidence 和 matched_problem_id
        service._fuzzy_match = AsyncMock(return_value=(confidence, MATCHED_PROBLEM_ID))

        result = await service.check(_raw_data(), "leetcode_global")

        assert result == DeduResult.AUTO_MAP_CONFIRMED, (
            f"confidence={confidence} 应返回 AUTO_MAP_CONFIRMED，实际返回 {result}"
        )
        # 验证写入 mapping 时 confirmed=True
        service._mapping_repo.save_mapping.assert_called_once()
        call_kwargs = service._mapping_repo.save_mapping.call_args[1]
        assert call_kwargs["confirmed"] is True
        assert call_kwargs["confidence"] == confidence

    @given(confidence=st.floats(min_value=0.5, max_value=0.8, allow_nan=False,
                                exclude_max=True))
    @settings(max_examples=100)
    @pytest.mark.asyncio
    async def test_medium_confidence_returns_auto_map_pending(self, confidence):
        """
        **Validates: Requirements 5.4**

        Property: 当 0.5 <= confidence < 0.8 且存在匹配的 problem_id 时，
        check() 返回 DeduResult.AUTO_MAP_PENDING，且写入 mapping 时 confirmed=False。
        """
        assume(confidence < 0.8)  # 确保严格小于 0.8

        service = _make_service()
        service._exact_match = AsyncMock(return_value=None)
        service._fuzzy_match = AsyncMock(return_value=(confidence, MATCHED_PROBLEM_ID))

        result = await service.check(_raw_data(), "leetcode_global")

        assert result == DeduResult.AUTO_MAP_PENDING, (
            f"confidence={confidence} 应返回 AUTO_MAP_PENDING，实际返回 {result}"
        )
        # 验证写入 mapping 时 confirmed=False
        service._mapping_repo.save_mapping.assert_called_once()
        call_kwargs = service._mapping_repo.save_mapping.call_args[1]
        assert call_kwargs["confirmed"] is False
        assert call_kwargs["confidence"] == confidence

    @given(confidence=st.floats(min_value=0.0, max_value=0.5, allow_nan=False,
                                exclude_max=True))
    @settings(max_examples=100)
    @pytest.mark.asyncio
    async def test_low_confidence_returns_create_new(self, confidence):
        """
        **Validates: Requirements 5.5**

        Property: 当 confidence < 0.5 时，
        check() 返回 DeduResult.CREATE_NEW，且不写入 mapping。
        """
        assume(confidence < 0.5)  # 确保严格小于 0.5

        service = _make_service()
        service._exact_match = AsyncMock(return_value=None)
        service._fuzzy_match = AsyncMock(return_value=(confidence, MATCHED_PROBLEM_ID))

        result = await service.check(_raw_data(), "leetcode_global")

        assert result == DeduResult.CREATE_NEW, (
            f"confidence={confidence} 应返回 CREATE_NEW，实际返回 {result}"
        )
        # 验证没有写入 mapping
        service._mapping_repo.save_mapping.assert_not_called()

    @given(confidence=st.floats(min_value=0.0, max_value=1.0, allow_nan=False))
    @settings(max_examples=100)
    @pytest.mark.asyncio
    async def test_threshold_boundaries_are_consistent(self, confidence):
        """
        **Validates: Requirements 5.3, 5.4, 5.5**

        Property: 对于任意 confidence ∈ [0, 1]，check() 的返回值必然属于
        {AUTO_MAP_CONFIRMED, AUTO_MAP_PENDING, CREATE_NEW} 之一，
        且与阈值判断逻辑一致（三个区间互斥且覆盖完整 [0,1]）。
        """
        service = _make_service()
        service._exact_match = AsyncMock(return_value=None)
        service._fuzzy_match = AsyncMock(return_value=(confidence, MATCHED_PROBLEM_ID))

        result = await service.check(_raw_data(), "leetcode_global")

        # 结果必须是三种之一（排除 UPDATE_EXISTING，因为精确匹配已被 mock 为 None）
        assert result in (
            DeduResult.AUTO_MAP_CONFIRMED,
            DeduResult.AUTO_MAP_PENDING,
            DeduResult.CREATE_NEW,
        ), f"意外的结果: {result}"

        # 验证与阈值对应关系
        if confidence >= 0.8:
            assert result == DeduResult.AUTO_MAP_CONFIRMED
        elif confidence >= 0.5:
            assert result == DeduResult.AUTO_MAP_PENDING
        else:
            assert result == DeduResult.CREATE_NEW
