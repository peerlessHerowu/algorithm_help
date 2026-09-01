"""配置管理 API 端点测试"""

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from crawler_service.api.config_api import router
from crawler_service.config import PlatformConfig, Settings, get_settings, reset_settings


@pytest.fixture(autouse=True)
def _reset_config():
    """每个测试前后重置全局配置"""
    reset_settings()
    yield
    reset_settings()


@pytest.fixture
def app():
    """创建测试用 FastAPI 应用"""
    test_app = FastAPI()
    test_app.include_router(router)
    return test_app


@pytest.fixture
def client(app):
    """创建测试客户端"""
    return TestClient(app)


@pytest.fixture
def _setup_platforms(monkeypatch):
    """注入包含平台配置的 Settings"""
    test_settings = Settings(
        platforms={
            "leetcode_global": PlatformConfig(
                enabled=True,
                base_url="https://leetcode.com",
                rate_limit=30,
                retry_max=3,
                solution_fetch_enabled=True,
                request_delay_ms=[1000, 3000],
                capabilities=["PROBLEM_FETCH", "SOLUTION_FETCH"],
            ),
            "codeforces": PlatformConfig(
                enabled=False,
                base_url="https://codeforces.com",
                rate_limit=20,
                retry_max=2,
                solution_fetch_enabled=False,
                request_delay_ms=[2000, 5000],
                capabilities=["PROBLEM_FETCH"],
            ),
        }
    )
    import crawler_service.config as config_module
    monkeypatch.setattr(config_module, "_settings", test_settings)


class TestGetAllConfigs:
    """GET /api/v1/config 测试"""

    def test_returns_all_platforms(self, client, _setup_platforms):
        """返回所有平台配置"""
        resp = client.get("/api/v1/config")
        assert resp.status_code == 200
        body = resp.json()
        assert body["code"] == 0
        assert body["message"] == "success"
        platforms = body["data"]["platforms"]
        assert len(platforms) == 2

    def test_platform_fields_correct(self, client, _setup_platforms):
        """验证平台配置字段正确"""
        resp = client.get("/api/v1/config")
        platforms = resp.json()["data"]["platforms"]
        lc = next(p for p in platforms if p["platform"] == "leetcode_global")
        assert lc["enabled"] is True
        assert lc["base_url"] == "https://leetcode.com"
        assert lc["rate_limit"] == 30
        assert lc["retry_max"] == 3
        assert lc["solution_fetch_enabled"] is True
        assert lc["request_delay_ms"] == [1000, 3000]
        assert lc["capabilities"] == ["PROBLEM_FETCH", "SOLUTION_FETCH"]

    def test_empty_platforms(self, client, monkeypatch):
        """无平台配置时返回空列表"""
        import crawler_service.config as config_module
        monkeypatch.setattr(config_module, "_settings", Settings(platforms={}))
        resp = client.get("/api/v1/config")
        assert resp.status_code == 200
        assert resp.json()["data"]["platforms"] == []


class TestUpdatePlatformConfig:
    """PUT /api/v1/config/{platform} 测试"""

    def test_update_rate_limit(self, client, _setup_platforms):
        """修改 rate_limit"""
        resp = client.put(
            "/api/v1/config/leetcode_global",
            json={"rate_limit": 60},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["code"] == 0
        assert body["data"]["rate_limit"] == 60
        # 确认全局配置也已更新
        settings = get_settings()
        assert settings.platforms["leetcode_global"].rate_limit == 60

    def test_update_enabled(self, client, _setup_platforms):
        """修改 enabled 状态"""
        resp = client.put(
            "/api/v1/config/codeforces",
            json={"enabled": True},
        )
        assert resp.status_code == 200
        assert resp.json()["data"]["enabled"] is True

    def test_update_solution_fetch_enabled(self, client, _setup_platforms):
        """修改 solution_fetch_enabled"""
        resp = client.put(
            "/api/v1/config/leetcode_global",
            json={"solution_fetch_enabled": False},
        )
        assert resp.status_code == 200
        assert resp.json()["data"]["solution_fetch_enabled"] is False

    def test_update_request_delay_ms(self, client, _setup_platforms):
        """修改 request_delay_ms"""
        resp = client.put(
            "/api/v1/config/leetcode_global",
            json={"request_delay_ms": [500, 2000]},
        )
        assert resp.status_code == 200
        assert resp.json()["data"]["request_delay_ms"] == [500, 2000]

    def test_partial_update_preserves_other_fields(self, client, _setup_platforms):
        """部分更新不影响其他字段"""
        resp = client.put(
            "/api/v1/config/leetcode_global",
            json={"rate_limit": 100},
        )
        data = resp.json()["data"]
        # 未修改的字段保持不变
        assert data["enabled"] is True
        assert data["solution_fetch_enabled"] is True
        assert data["retry_max"] == 3

    def test_update_nonexistent_platform_returns_404(self, client, _setup_platforms):
        """修改不存在的平台返回 404"""
        resp = client.put(
            "/api/v1/config/nonexistent",
            json={"rate_limit": 10},
        )
        assert resp.status_code == 404

    def test_invalid_request_delay_ms_length(self, client, _setup_platforms):
        """request_delay_ms 元素数量不为 2 返回 400"""
        resp = client.put(
            "/api/v1/config/leetcode_global",
            json={"request_delay_ms": [1000]},
        )
        assert resp.status_code == 400

    def test_invalid_request_delay_ms_order(self, client, _setup_platforms):
        """request_delay_ms[0] > [1] 返回 400"""
        resp = client.put(
            "/api/v1/config/leetcode_global",
            json={"request_delay_ms": [5000, 1000]},
        )
        assert resp.status_code == 400

    def test_invalid_rate_limit_zero(self, client, _setup_platforms):
        """rate_limit <= 0 返回 422（Pydantic 校验）"""
        resp = client.put(
            "/api/v1/config/leetcode_global",
            json={"rate_limit": 0},
        )
        assert resp.status_code == 422
