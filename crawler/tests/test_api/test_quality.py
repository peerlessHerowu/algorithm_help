"""
质量统计 API 端点单元测试

使用 SQLite 内存数据库 + httpx AsyncClient 测试 GET /api/v1/quality/stats。
"""

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from crawler_service.api.quality import router
from crawler_service.database.session import get_async_session
from crawler_service.models.entities import Base, RawSource
from crawler_service.models.schemas import ApiResponse


@pytest.fixture
async def session_and_app():
    """创建内存 SQLite + FastAPI 测试 app"""
    from fastapi import FastAPI

    engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async def override_session():
        async with factory() as sess:
            try:
                yield sess
                await sess.commit()
            except Exception:
                await sess.rollback()
                raise

    app = FastAPI()
    app.include_router(router)
    app.dependency_overrides[get_async_session] = override_session

    # 返回 factory 用于预填充数据
    async with factory() as setup_session:
        yield setup_session, app

    await engine.dispose()


def _make_raw_source(
    id_val: int,
    platform: str,
    process_status: str,
    platform_id: str = "test-1",
) -> RawSource:
    """创建 RawSource 测试实体"""
    return RawSource(
        id=id_val,
        platform=platform,
        platform_id=platform_id,
        content_type="PROBLEM",
        raw_json='{"title":"test"}',
        process_status=process_status,
        project="algorithm-help",
        fetched_at=1700000000000,
    )


class TestQualityStatsEndpoint:
    """GET /api/v1/quality/stats 端点测试"""

    async def test_empty_database_returns_empty_stats(self, session_and_app):
        """数据库为空时应返回空统计列表"""
        _, app = session_and_app
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.get("/api/v1/quality/stats")

        assert resp.status_code == 200
        body = resp.json()
        assert body["code"] == 0
        assert body["data"]["stats"] == []
        assert body["data"]["total_incomplete"] == 0
        assert body["data"]["total_low_quality"] == 0

    async def test_single_platform_stats(self, session_and_app):
        """单平台多状态数据应正确统计"""
        session, app = session_and_app

        # 预填充：3 COMPLETED + 1 INCOMPLETE + 1 LOW_QUALITY = 5 total
        records = [
            _make_raw_source(1, "LEETCODE_GLOBAL", "COMPLETED", "p1"),
            _make_raw_source(2, "LEETCODE_GLOBAL", "COMPLETED", "p2"),
            _make_raw_source(3, "LEETCODE_GLOBAL", "COMPLETED", "p3"),
            _make_raw_source(4, "LEETCODE_GLOBAL", "INCOMPLETE", "p4"),
            _make_raw_source(5, "LEETCODE_GLOBAL", "LOW_QUALITY", "p5"),
        ]
        session.add_all(records)
        await session.commit()

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.get("/api/v1/quality/stats")

        assert resp.status_code == 200
        body = resp.json()
        stats = body["data"]["stats"]
        assert len(stats) == 1

        lc_stat = stats[0]
        assert lc_stat["platform"] == "LEETCODE_GLOBAL"
        assert lc_stat["total"] == 5
        assert lc_stat["completed"] == 3
        assert lc_stat["success_rate"] == 0.6
        assert lc_stat["incomplete_count"] == 1
        assert lc_stat["low_quality_count"] == 1
        assert body["data"]["total_incomplete"] == 1
        assert body["data"]["total_low_quality"] == 1

    async def test_multi_platform_stats(self, session_and_app):
        """多平台数据应按平台分组统计"""
        session, app = session_and_app

        records = [
            # LEETCODE_GLOBAL: 2 COMPLETED, 1 INCOMPLETE
            _make_raw_source(10, "LEETCODE_GLOBAL", "COMPLETED", "lc1"),
            _make_raw_source(11, "LEETCODE_GLOBAL", "COMPLETED", "lc2"),
            _make_raw_source(12, "LEETCODE_GLOBAL", "INCOMPLETE", "lc3"),
            # CODEFORCES: 1 COMPLETED, 2 LOW_QUALITY
            _make_raw_source(20, "CODEFORCES", "COMPLETED", "cf1"),
            _make_raw_source(21, "CODEFORCES", "LOW_QUALITY", "cf2"),
            _make_raw_source(22, "CODEFORCES", "LOW_QUALITY", "cf3"),
        ]
        session.add_all(records)
        await session.commit()

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.get("/api/v1/quality/stats")

        assert resp.status_code == 200
        body = resp.json()
        stats = body["data"]["stats"]
        assert len(stats) == 2

        # 按 platform 排序后，CODEFORCES 在前
        cf_stat = next(s for s in stats if s["platform"] == "CODEFORCES")
        assert cf_stat["total"] == 3
        assert cf_stat["completed"] == 1
        assert cf_stat["success_rate"] == round(1 / 3, 4)
        assert cf_stat["incomplete_count"] == 0
        assert cf_stat["low_quality_count"] == 2

        lc_stat = next(s for s in stats if s["platform"] == "LEETCODE_GLOBAL")
        assert lc_stat["total"] == 3
        assert lc_stat["completed"] == 2
        assert lc_stat["success_rate"] == round(2 / 3, 4)
        assert lc_stat["incomplete_count"] == 1
        assert lc_stat["low_quality_count"] == 0

        assert body["data"]["total_incomplete"] == 1
        assert body["data"]["total_low_quality"] == 2

    async def test_pending_and_failed_counted_in_total(self, session_and_app):
        """PENDING 和 FAILED 状态应计入 total 但不计入成功率分子"""
        session, app = session_and_app

        records = [
            _make_raw_source(30, "ATCODER", "PENDING", "at1"),
            _make_raw_source(31, "ATCODER", "FAILED", "at2"),
            _make_raw_source(32, "ATCODER", "COMPLETED", "at3"),
        ]
        session.add_all(records)
        await session.commit()

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.get("/api/v1/quality/stats")

        assert resp.status_code == 200
        body = resp.json()
        stats = body["data"]["stats"]
        assert len(stats) == 1

        at_stat = stats[0]
        assert at_stat["platform"] == "ATCODER"
        assert at_stat["total"] == 3
        assert at_stat["completed"] == 1
        assert at_stat["success_rate"] == round(1 / 3, 4)
        assert at_stat["incomplete_count"] == 0
        assert at_stat["low_quality_count"] == 0
