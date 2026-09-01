"""
采集管理 API 端点单元测试

使用 FastAPI TestClient + mock 依赖验证各端点行为。
"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from fastapi import FastAPI
from fastapi.testclient import TestClient

from crawler_service.api.crawl import (
    get_ai_trigger,
    get_orchestrator,
    get_task_repo,
    router,
    set_dependencies,
)
from crawler_service.models.entities import CrawlTask
from crawler_service.models.enums import TaskStatus, TaskType, TriggerType


# ---- 测试用 fixture ----


def _make_task(
    task_id: int = 100001,
    platform: str = "LEETCODE_GLOBAL",
    task_type: str = "PROBLEM_SYNC",
    status: str = "PENDING",
    project: str = "algorithm-help",
) -> CrawlTask:
    """创建测试用 CrawlTask 实体"""
    task = CrawlTask(
        id=task_id,
        platform=platform,
        task_type=task_type,
        status=status,
        trigger_type="MANUAL",
        project=project,
        created_at=1700000000000,
    )
    return task


@pytest.fixture
def mock_task_repo():
    """模拟 CrawlTaskRepository"""
    repo = AsyncMock()
    repo.create = AsyncMock(side_effect=lambda **kwargs: _make_task(
        platform=kwargs.get("platform", "LEETCODE_GLOBAL"),
        task_type=kwargs.get("task_type", "PROBLEM_SYNC"),
    ))
    repo.list_tasks = AsyncMock(return_value=([_make_task()], 1))
    repo.get_by_id = AsyncMock(return_value=_make_task())
    repo.save = AsyncMock()
    return repo


@pytest.fixture
def mock_orchestrator():
    """模拟 CrawlOrchestrator"""
    orch = MagicMock()
    orch.execute_crawl = AsyncMock()
    orch.cancel = MagicMock()
    return orch


@pytest.fixture
def mock_ai_trigger():
    """模拟 AiTriggerService"""
    trigger = AsyncMock()
    trigger.retry_ai = AsyncMock(return_value=True)
    return trigger


@pytest.fixture
def app(mock_task_repo, mock_orchestrator, mock_ai_trigger):
    """创建带 mock 依赖的 FastAPI 测试应用"""
    test_app = FastAPI()
    test_app.include_router(router)

    # 覆盖依赖
    test_app.dependency_overrides[get_orchestrator] = lambda: mock_orchestrator
    test_app.dependency_overrides[get_task_repo] = lambda: mock_task_repo
    test_app.dependency_overrides[get_ai_trigger] = lambda: mock_ai_trigger

    return test_app


@pytest.fixture
def client(app):
    """FastAPI TestClient"""
    return TestClient(app)


# ---- POST /api/v1/crawl/trigger ----


class TestTriggerCrawl:
    """触发采集端点测试"""

    @patch("crawler_service.api.crawl.get_settings")
    def test_trigger_single_platform(
        self, mock_settings, client, mock_task_repo
    ):
        """指定平台触发采集，返回 code=0 和任务 DTO"""
        # 配置 mock settings
        mock_cfg = MagicMock()
        mock_cfg.platforms = {"LEETCODE_GLOBAL": MagicMock(enabled=True)}
        mock_settings.return_value = mock_cfg

        resp = client.post("/api/v1/crawl/trigger", json={
            "platform": "LEETCODE_GLOBAL",
            "task_type": "PROBLEM_SYNC",
        })

        assert resp.status_code == 200
        data = resp.json()
        assert data["code"] == 0
        assert data["message"] == "success"
        assert data["data"]["platform"] == "LEETCODE_GLOBAL"
        assert data["data"]["task_type"] == "PROBLEM_SYNC"
        mock_task_repo.create.assert_called_once()

    @patch("crawler_service.api.crawl.get_settings")
    def test_trigger_all_platforms(
        self, mock_settings, client, mock_task_repo
    ):
        """不传 platform，对所有 enabled 平台触发"""
        mock_cfg = MagicMock()
        mock_cfg.platforms = {
            "LEETCODE_GLOBAL": MagicMock(enabled=True),
            "CODEFORCES": MagicMock(enabled=True),
            "LUOGU": MagicMock(enabled=False),
        }
        mock_settings.return_value = mock_cfg

        resp = client.post("/api/v1/crawl/trigger", json={
            "task_type": "PROBLEM_SYNC",
        })

        assert resp.status_code == 200
        data = resp.json()
        assert data["code"] == 0
        # 应为 enabled 的平台创建任务（LEETCODE_GLOBAL + CODEFORCES）
        assert mock_task_repo.create.call_count == 2

    @patch("crawler_service.api.crawl.get_settings")
    def test_trigger_no_platforms_available(
        self, mock_settings, client, mock_task_repo
    ):
        """所有平台都 disabled 时返回错误"""
        mock_cfg = MagicMock()
        mock_cfg.platforms = {
            "LUOGU": MagicMock(enabled=False),
        }
        mock_settings.return_value = mock_cfg

        resp = client.post("/api/v1/crawl/trigger", json={
            "task_type": "PROBLEM_SYNC",
            "platform": None,
        })

        assert resp.status_code == 200
        data = resp.json()
        assert data["code"] == 400
        assert "无可用平台" in data["message"]


# ---- GET /api/v1/crawl/tasks ----


class TestListTasks:
    """任务列表端点测试"""

    def test_list_tasks_default_pagination(self, client, mock_task_repo):
        """默认分页参数返回成功"""
        resp = client.get("/api/v1/crawl/tasks")

        assert resp.status_code == 200
        data = resp.json()
        assert data["code"] == 0
        assert data["data"]["total"] == 1
        assert data["data"]["page"] == 1
        assert data["data"]["page_size"] == 20
        assert len(data["data"]["items"]) == 1

    def test_list_tasks_with_filters(self, client, mock_task_repo):
        """带 platform 和 status 筛选"""
        resp = client.get(
            "/api/v1/crawl/tasks",
            params={"platform": "CODEFORCES", "status": "COMPLETED", "page": 2, "page_size": 10},
        )

        assert resp.status_code == 200
        mock_task_repo.list_tasks.assert_called_once_with(
            page=2, page_size=10, platform="CODEFORCES", status="COMPLETED"
        )

    def test_list_tasks_invalid_page_size(self, client):
        """page_size 超出范围返回 422 校验错误"""
        resp = client.get("/api/v1/crawl/tasks", params={"page_size": 200})
        assert resp.status_code == 422


# ---- GET /api/v1/crawl/tasks/{id} ----


class TestGetTaskDetail:
    """任务详情端点测试"""

    def test_get_existing_task(self, client, mock_task_repo):
        """查询存在的任务返回详情"""
        resp = client.get("/api/v1/crawl/tasks/100001")

        assert resp.status_code == 200
        data = resp.json()
        assert data["code"] == 0
        assert data["data"]["id"] == 100001
        assert data["data"]["platform"] == "LEETCODE_GLOBAL"

    def test_get_nonexistent_task(self, client, mock_task_repo):
        """查询不存在的任务返回 404"""
        mock_task_repo.get_by_id = AsyncMock(return_value=None)

        resp = client.get("/api/v1/crawl/tasks/999999")

        assert resp.status_code == 200
        data = resp.json()
        assert data["code"] == 404
        assert "不存在" in data["message"]


# ---- POST /api/v1/crawl/tasks/{id}/cancel ----


class TestCancelTask:
    """任务取消端点测试"""

    def test_cancel_pending_task(self, client, mock_task_repo, mock_orchestrator):
        """取消 PENDING 状态任务，直接标记 CANCELLED"""
        mock_task_repo.get_by_id = AsyncMock(
            return_value=_make_task(status="PENDING")
        )

        resp = client.post("/api/v1/crawl/tasks/100001/cancel")

        assert resp.status_code == 200
        data = resp.json()
        assert data["code"] == 0
        mock_orchestrator.cancel.assert_called_once_with(100001)
        mock_task_repo.save.assert_called_once()

    def test_cancel_running_task(self, client, mock_task_repo, mock_orchestrator):
        """取消 RUNNING 状态任务，设置取消标志"""
        mock_task_repo.get_by_id = AsyncMock(
            return_value=_make_task(status="RUNNING")
        )

        resp = client.post("/api/v1/crawl/tasks/100001/cancel")

        assert resp.status_code == 200
        data = resp.json()
        assert data["code"] == 0
        mock_orchestrator.cancel.assert_called_once_with(100001)

    def test_cancel_completed_task(self, client, mock_task_repo):
        """取消已完成任务返回 400 错误"""
        mock_task_repo.get_by_id = AsyncMock(
            return_value=_make_task(status="COMPLETED")
        )

        resp = client.post("/api/v1/crawl/tasks/100001/cancel")

        assert resp.status_code == 200
        data = resp.json()
        assert data["code"] == 400
        assert "无法取消" in data["message"]

    def test_cancel_nonexistent_task(self, client, mock_task_repo):
        """取消不存在的任务返回 404"""
        mock_task_repo.get_by_id = AsyncMock(return_value=None)

        resp = client.post("/api/v1/crawl/tasks/999999/cancel")

        assert resp.status_code == 200
        data = resp.json()
        assert data["code"] == 404


# ---- POST /api/v1/crawl/retry-ai/{raw_source_id} ----


class TestRetryAi:
    """AI 加工重触发端点测试"""

    def test_retry_ai_success(self, client, mock_ai_trigger):
        """成功重触发 AI 加工"""
        resp = client.post("/api/v1/crawl/retry-ai/200001")

        assert resp.status_code == 200
        data = resp.json()
        assert data["code"] == 0
        assert data["data"]["raw_source_id"] == 200001
        assert data["data"]["status"] == "queued"
        mock_ai_trigger.retry_ai.assert_called_once_with(200001)

    def test_retry_ai_failure(self, client, mock_ai_trigger):
        """AI 加工重触发失败返回 500"""
        mock_ai_trigger.retry_ai = AsyncMock(return_value=False)

        resp = client.post("/api/v1/crawl/retry-ai/200001")

        assert resp.status_code == 200
        data = resp.json()
        assert data["code"] == 500
        assert "失败" in data["message"]


# ---- ApiResponse 格式一致性 ----


class TestApiResponseFormat:
    """验证所有端点返回统一 ApiResponse 格式"""

    @patch("crawler_service.api.crawl.get_settings")
    def test_trigger_response_format(self, mock_settings, client):
        """trigger 端点返回 code/message/data"""
        mock_cfg = MagicMock()
        mock_cfg.platforms = {"LEETCODE_GLOBAL": MagicMock(enabled=True)}
        mock_settings.return_value = mock_cfg

        resp = client.post("/api/v1/crawl/trigger", json={
            "platform": "LEETCODE_GLOBAL",
            "task_type": "PROBLEM_SYNC",
        })
        data = resp.json()
        assert "code" in data
        assert "message" in data
        assert "data" in data

    def test_list_response_format(self, client):
        """list 端点返回 code/message/data"""
        resp = client.get("/api/v1/crawl/tasks")
        data = resp.json()
        assert "code" in data
        assert "message" in data
        assert "data" in data

    def test_detail_response_format(self, client):
        """detail 端点返回 code/message/data"""
        resp = client.get("/api/v1/crawl/tasks/100001")
        data = resp.json()
        assert "code" in data
        assert "message" in data
        assert "data" in data
