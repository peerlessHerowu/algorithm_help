"""配置模块单元测试"""

import tempfile
import time
from pathlib import Path

import pytest
import yaml

from crawler_service.config import (
    AiConfig,
    AntiDetectConfig,
    DatabaseConfig,
    MinioConfig,
    PlatformConfig,
    RedisConfig,
    Settings,
    load_settings_from_yaml,
    get_settings,
    reset_settings,
)


class TestPlatformConfig:
    """PlatformConfig 模型测试"""

    def test_default_values(self):
        cfg = PlatformConfig()
        assert cfg.enabled is True
        assert cfg.rate_limit == 30
        assert cfg.retry_max == 3
        assert cfg.solution_fetch_enabled is True
        assert cfg.request_delay_ms == [1000, 3000]
        assert cfg.graphql_url is None

    def test_from_dict(self):
        data = {
            "enabled": False,
            "base_url": "https://example.com",
            "rate_limit": 60,
            "capabilities": ["problem_fetch", "solution_fetch"],
        }
        cfg = PlatformConfig(**data)
        assert cfg.enabled is False
        assert cfg.base_url == "https://example.com"
        assert cfg.rate_limit == 60
        assert cfg.capabilities == ["problem_fetch", "solution_fetch"]


class TestAntiDetectConfig:
    """AntiDetectConfig 模型测试"""

    def test_default_values(self):
        cfg = AntiDetectConfig()
        assert len(cfg.user_agents) == 2
        assert cfg.request_delay_ms == [1000, 3000]
        assert cfg.circuit_breaker.failure_threshold == 5
        assert cfg.circuit_breaker.wait_duration_ms == 300000
        assert cfg.proxy.enabled is False


class TestSettings:
    """Settings 顶层模型测试"""

    def test_default_settings(self):
        s = Settings()
        assert s.project == "algorithm-help"
        assert s.platforms == {}
        assert isinstance(s.anti_detect, AntiDetectConfig)
        assert isinstance(s.database, DatabaseConfig)
        assert isinstance(s.redis, RedisConfig)
        assert isinstance(s.minio, MinioConfig)
        assert isinstance(s.ai, AiConfig)

    def test_settings_with_platforms(self):
        s = Settings(platforms={
            "leetcode_global": PlatformConfig(
                enabled=True,
                base_url="https://leetcode.com",
                rate_limit=30,
            )
        })
        assert "leetcode_global" in s.platforms
        assert s.platforms["leetcode_global"].rate_limit == 30


class TestLoadSettingsFromYaml:
    """YAML 配置加载测试"""

    def test_load_from_valid_yaml(self, tmp_path):
        config_file = tmp_path / "settings.yaml"
        data = {
            "project": "test-project",
            "platforms": {
                "codeforces": {
                    "enabled": True,
                    "base_url": "https://codeforces.com",
                    "rate_limit": 20,
                }
            },
            "database": {
                "url": "mysql+asyncmy://user:pass@db:3306/test",
                "pool_size": 5,
                "max_overflow": 10,
            },
        }
        config_file.write_text(yaml.dump(data), encoding="utf-8")

        settings = load_settings_from_yaml(config_file)
        assert settings.project == "test-project"
        assert "codeforces" in settings.platforms
        assert settings.platforms["codeforces"].rate_limit == 20
        assert settings.database.pool_size == 5

    def test_load_missing_file_returns_defaults(self, tmp_path):
        missing = tmp_path / "nonexistent.yaml"
        settings = load_settings_from_yaml(missing)
        assert settings.project == "algorithm-help"

    def test_load_empty_yaml(self, tmp_path):
        config_file = tmp_path / "empty.yaml"
        config_file.write_text("", encoding="utf-8")
        settings = load_settings_from_yaml(config_file)
        assert settings.project == "algorithm-help"


class TestGetSettings:
    """get_settings 单例测试"""

    def setup_method(self):
        reset_settings()

    def teardown_method(self):
        reset_settings()

    def test_singleton_returns_same_instance(self):
        s1 = get_settings()
        s2 = get_settings()
        assert s1 is s2

    def test_reset_clears_singleton(self):
        s1 = get_settings()
        reset_settings()
        s2 = get_settings()
        assert s1 is not s2


class TestLoadDefaultConfigFile:
    """加载项目默认 config/settings.yaml 测试"""

    def test_default_config_loads_all_platforms(self):
        from crawler_service.config import DEFAULT_CONFIG_PATH
        settings = load_settings_from_yaml(DEFAULT_CONFIG_PATH)
        assert "leetcode_global" in settings.platforms
        assert "leetcode_cn" in settings.platforms
        assert "codeforces" in settings.platforms
        assert "nowcoder" in settings.platforms
        assert "atcoder" in settings.platforms
        assert "luogu" in settings.platforms

    def test_luogu_disabled_by_default(self):
        from crawler_service.config import DEFAULT_CONFIG_PATH
        settings = load_settings_from_yaml(DEFAULT_CONFIG_PATH)
        assert settings.platforms["luogu"].enabled is False

    def test_leetcode_global_has_graphql_url(self):
        from crawler_service.config import DEFAULT_CONFIG_PATH
        settings = load_settings_from_yaml(DEFAULT_CONFIG_PATH)
        assert settings.platforms["leetcode_global"].graphql_url is not None
