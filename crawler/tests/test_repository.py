"""
数据库仓储层单元测试

使用 SQLite 内存数据库 + aiosqlite 进行异步测试，
验证 CrawlTaskRepository、RawSourceRepository、PlatformMappingRepository 的 CRUD 逻辑。
"""

import pytest
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from crawler_service.database.repository import (
    CrawlTaskRepository,
    PlatformMappingRepository,
    RawSourceRepository,
)
from crawler_service.models.entities import Base


@pytest.fixture
async def session():
    """创建内存 SQLite 异步 session，每个测试独立"""
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with factory() as sess:
        yield sess

    await engine.dispose()


# ===== CrawlTaskRepository 测试 =====

class TestCrawlTaskRepository:
    """CrawlTaskRepository 单元测试"""

    async def test_create_task(self, session: AsyncSession):
        """创建任务应返回正确字段"""
        repo = CrawlTaskRepository(session)
        task = await repo.create(
            platform="LEETCODE_GLOBAL",
            task_type="PROBLEM_SYNC",
            trigger_type="MANUAL",
        )

        assert task.id > 0
        assert task.platform == "LEETCODE_GLOBAL"
        assert task.task_type == "PROBLEM_SYNC"
        assert task.status == "PENDING"
        assert task.trigger_type == "MANUAL"
        assert task.project == "algorithm-help"
        assert task.created_at > 0

    async def test_get_by_id(self, session: AsyncSession):
        """按 ID 查询应返回对应任务"""
        repo = CrawlTaskRepository(session)
        task = await repo.create("CODEFORCES", "SOLUTION_SYNC", "SCHEDULED")

        found = await repo.get_by_id(task.id)
        assert found is not None
        assert found.id == task.id
        assert found.platform == "CODEFORCES"

    async def test_get_by_id_not_found(self, session: AsyncSession):
        """不存在的 ID 应返回 None"""
        repo = CrawlTaskRepository(session)
        found = await repo.get_by_id(999999999)
        assert found is None

    async def test_update_progress(self, session: AsyncSession):
        """更新进度后应持久化"""
        repo = CrawlTaskRepository(session)
        task = await repo.create("LEETCODE_CN", "PROBLEM_SYNC", "INCREMENTAL")

        task.status = "RUNNING"
        task.progress = {"total": 100, "completed": 10, "failed": 0}
        await repo.update_progress(task)

        found = await repo.get_by_id(task.id)
        assert found is not None
        assert found.status == "RUNNING"
        assert found.progress["completed"] == 10

    async def test_save_task(self, session: AsyncSession):
        """save 应 merge 并持久化修改"""
        repo = CrawlTaskRepository(session)
        task = await repo.create("ATCODER", "SINGLE_FETCH", "MANUAL")

        task.status = "COMPLETED"
        task.completed_at = 1700000000000
        await repo.save(task)

        found = await repo.get_by_id(task.id)
        assert found is not None
        assert found.status == "COMPLETED"
        assert found.completed_at == 1700000000000

    async def test_list_tasks_pagination(self, session: AsyncSession):
        """分页查询应正确返回结果和总数"""
        repo = CrawlTaskRepository(session)
        # 创建 5 个任务
        for i in range(5):
            await repo.create("LEETCODE_GLOBAL", "PROBLEM_SYNC", "SCHEDULED")

        tasks, total = await repo.list_tasks(page=1, page_size=3)
        assert total == 5
        assert len(tasks) == 3

        tasks2, total2 = await repo.list_tasks(page=2, page_size=3)
        assert total2 == 5
        assert len(tasks2) == 2

    async def test_list_tasks_filter_by_platform(self, session: AsyncSession):
        """按 platform 筛选应只返回对应平台"""
        repo = CrawlTaskRepository(session)
        await repo.create("LEETCODE_GLOBAL", "PROBLEM_SYNC", "MANUAL")
        await repo.create("CODEFORCES", "PROBLEM_SYNC", "MANUAL")
        await repo.create("LEETCODE_GLOBAL", "SOLUTION_SYNC", "MANUAL")

        tasks, total = await repo.list_tasks(platform="CODEFORCES")
        assert total == 1
        assert tasks[0].platform == "CODEFORCES"

    async def test_list_tasks_filter_by_status(self, session: AsyncSession):
        """按 status 筛选应只返回对应状态"""
        repo = CrawlTaskRepository(session)
        t1 = await repo.create("LEETCODE_GLOBAL", "PROBLEM_SYNC", "MANUAL")
        await repo.create("LEETCODE_GLOBAL", "PROBLEM_SYNC", "MANUAL")

        t1.status = "RUNNING"
        await repo.update_progress(t1)

        tasks, total = await repo.list_tasks(status="RUNNING")
        assert total == 1
        assert tasks[0].id == t1.id


# ===== RawSourceRepository 测试 =====

class TestRawSourceRepository:
    """RawSourceRepository 单元测试"""

    async def test_save_raw(self, session: AsyncSession):
        """保存原始数据应正确序列化 JSON"""
        repo = RawSourceRepository(session)
        raw_data = {"platform_id": "two-sum", "title": "Two Sum", "difficulty": "Easy"}

        raw_source = await repo.save_raw(
            raw_data=raw_data,
            platform="LEETCODE_GLOBAL",
            project="algorithm-help",
            content_type="PROBLEM",
        )

        assert raw_source.id > 0
        assert raw_source.platform == "LEETCODE_GLOBAL"
        assert raw_source.platform_id == "two-sum"
        assert raw_source.content_type == "PROBLEM"
        assert raw_source.process_status == "PENDING"
        assert raw_source.fetched_at > 0
        assert '"title": "Two Sum"' in raw_source.raw_json

    async def test_get_by_platform_id(self, session: AsyncSession):
        """按平台和 platform_id 查询应返回对应记录"""
        repo = RawSourceRepository(session)
        await repo.save_raw(
            {"platform_id": "1", "title": "Two Sum"},
            platform="LEETCODE_GLOBAL",
            project="algorithm-help",
        )

        found = await repo.get_by_platform_id("LEETCODE_GLOBAL", "1")
        assert found is not None
        assert found.platform_id == "1"

    async def test_get_by_platform_id_not_found(self, session: AsyncSession):
        """不存在的记录应返回 None"""
        repo = RawSourceRepository(session)
        found = await repo.get_by_platform_id("LEETCODE_GLOBAL", "nonexist")
        assert found is None

    async def test_update_status_completed(self, session: AsyncSession):
        """更新为 COMPLETED 应记录 processed_at"""
        repo = RawSourceRepository(session)
        raw = await repo.save_raw(
            {"platform_id": "abc", "title": "Test"},
            platform="CODEFORCES",
            project="algorithm-help",
        )

        await repo.update_status(raw.id, "COMPLETED")

        found = await repo.get_by_platform_id("CODEFORCES", "abc")
        assert found is not None
        assert found.process_status == "COMPLETED"
        assert found.processed_at is not None
        assert found.processed_at > 0

    async def test_update_status_failed_with_message(self, session: AsyncSession):
        """更新为 FAILED 应记录 error_message"""
        repo = RawSourceRepository(session)
        raw = await repo.save_raw(
            {"platform_id": "xyz", "title": "Fail Test"},
            platform="NOWCODER",
            project="algorithm-help",
        )

        await repo.update_status(raw.id, "FAILED", "解析异常：字段缺失")

        found = await repo.get_by_platform_id("NOWCODER", "xyz")
        assert found is not None
        assert found.process_status == "FAILED"
        assert found.error_message == "解析异常：字段缺失"


# ===== PlatformMappingRepository 测试 =====

class TestPlatformMappingRepository:
    """PlatformMappingRepository 单元测试"""

    async def test_save_mapping(self, session: AsyncSession):
        """保存映射应正确设置所有字段"""
        repo = PlatformMappingRepository(session)
        mapping = await repo.save_mapping(
            unified_problem_id=10001,
            platform="LEETCODE_GLOBAL",
            platform_problem_id="1",
            platform_url="https://leetcode.com/problems/two-sum/",
            confidence=0.95,
            confirmed=True,
            project="algorithm-help",
        )

        assert mapping.id > 0
        assert mapping.unified_problem_id == 10001
        assert mapping.platform == "LEETCODE_GLOBAL"
        assert mapping.platform_problem_id == "1"
        assert mapping.confidence == 0.95
        assert mapping.confirmed is True
        assert mapping.created_at > 0

    async def test_find_by_platform_and_id(self, session: AsyncSession):
        """按平台和题号查询应返回对应映射"""
        repo = PlatformMappingRepository(session)
        await repo.save_mapping(
            unified_problem_id=10002,
            platform="CODEFORCES",
            platform_problem_id="1A",
            platform_url="https://codeforces.com/problemset/problem/1/A",
            confidence=0.85,
            confirmed=False,
        )

        found = await repo.find_by_platform_and_id("CODEFORCES", "1A")
        assert found is not None
        assert found.platform_problem_id == "1A"
        assert found.unified_problem_id == 10002

    async def test_find_by_platform_and_id_not_found(self, session: AsyncSession):
        """不存在的映射应返回 None"""
        repo = PlatformMappingRepository(session)
        found = await repo.find_by_platform_and_id("ATCODER", "abc123_a")
        assert found is None
