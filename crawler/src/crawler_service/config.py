"""
Pydantic Settings 配置模型

从 config/settings.yaml 加载配置，支持 watchfiles 文件热更新（30 秒内生效）。
提供 get_settings() 全局单例用于依赖注入。
"""

import threading
from pathlib import Path
from typing import Dict, List, Optional

import structlog
import yaml
from pydantic import BaseModel, Field
from pydantic_settings import BaseSettings

logger = structlog.get_logger()

# 默认配置文件路径（config.py → crawler_service → src → crawler → config/settings.yaml）
DEFAULT_CONFIG_PATH = Path(__file__).parent.parent.parent / "config" / "settings.yaml"


# ---- 子配置模型 ----


class PlatformConfig(BaseModel):
    """单平台采集配置"""

    enabled: bool = True
    base_url: str = ""
    api_url: str = ""
    graphql_url: Optional[str] = None
    rate_limit: int = 30
    retry_max: int = 3
    retry_delay_ms: int = 1000
    cookie_key: str = ""
    capabilities: list[str] = Field(default_factory=list)
    solution_fetch_enabled: bool = True
    request_delay_ms: list[int] = Field(default_factory=lambda: [1000, 3000])

    model_config = {"extra": "ignore"}


class CircuitBreakerConfig(BaseModel):
    """熔断器配置"""

    failure_threshold: int = 5
    wait_duration_ms: int = 300000

    model_config = {"extra": "ignore"}


class ProxyConfig(BaseModel):
    """代理池配置"""

    enabled: bool = False
    provider: str = ""

    model_config = {"extra": "ignore"}


class AntiDetectConfig(BaseModel):
    """反爬策略配置"""

    user_agents: list[str] = Field(default_factory=lambda: [
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0",
    ])
    request_delay_ms: list[int] = Field(default_factory=lambda: [1000, 3000])
    circuit_breaker: CircuitBreakerConfig = Field(default_factory=CircuitBreakerConfig)
    proxy: ProxyConfig = Field(default_factory=ProxyConfig)

    model_config = {"extra": "ignore"}


class DatabaseConfig(BaseModel):
    """数据库配置（异步 MySQL）"""

    url: str = "mysql+asyncmy://root:password@localhost:3306/algorithm_help"
    pool_size: int = 10
    max_overflow: int = 20

    model_config = {"extra": "ignore"}


class RedisConfig(BaseModel):
    """Redis 配置"""

    url: str = "redis://localhost:6379/0"
    max_connections: int = 10

    model_config = {"extra": "ignore"}


class MinioConfig(BaseModel):
    """MinIO 对象存储配置"""

    endpoint: str = "localhost:9000"
    access_key: str = "minioadmin"
    secret_key: str = "minioadmin"
    secure: bool = False
    bucket_crawler_assets: str = "crawler-assets"
    bucket_user_uploads: str = "user-uploads"

    model_config = {"extra": "ignore"}


class AiConfig(BaseModel):
    """AI 服务配置"""

    base_url: str = "http://localhost:8100"
    api_key: str = ""
    timeout: int = 60
    batch_rate_limit: int = 10
    daily_budget: int = 1000

    model_config = {"extra": "ignore"}


# ---- 顶层 Settings ----


class Settings(BaseSettings):
    """
    顶层配置模型

    从 YAML 文件加载，支持 watchfiles 文件监听热更新。
    """

    project: str = "algorithm-help"
    platforms: dict[str, PlatformConfig] = Field(default_factory=dict)
    anti_detect: AntiDetectConfig = Field(default_factory=AntiDetectConfig)
    database: DatabaseConfig = Field(default_factory=DatabaseConfig)
    redis: RedisConfig = Field(default_factory=RedisConfig)
    minio: MinioConfig = Field(default_factory=MinioConfig)
    ai: AiConfig = Field(default_factory=AiConfig)

    model_config = {"extra": "ignore"}

    def get_platform(self, platform: str) -> Optional[PlatformConfig]:
        """获取指定平台配置，不存在时返回 None"""
        return self.platforms.get(platform)


# ---- YAML 配置加载 ----


def load_settings_from_yaml(path: Optional[Path] = None) -> Settings:
    """从 YAML 文件加载配置并构建 Settings 实例，支持 settings.local.yaml 覆盖"""
    config_path = path or DEFAULT_CONFIG_PATH
    local_path = config_path.parent / "settings.local.yaml"

    data: dict = {}

    if config_path.exists():
        with open(config_path, "r", encoding="utf-8") as f:
            data = yaml.safe_load(f) or {}
    else:
        logger.warning("配置文件不存在，使用默认配置", path=str(config_path))
        return Settings()

    # 本地覆盖配置（优先级更高，gitignore）
    if local_path.exists():
        with open(local_path, "r", encoding="utf-8") as f:
            local_data = yaml.safe_load(f) or {}
        _deep_merge(data, local_data)

    return Settings(**data)


def _deep_merge(base: dict, override: dict) -> None:
    """深度合并字典，override 中的值覆盖 base 中的值"""
    for key, value in override.items():
        if key in base and isinstance(base[key], dict) and isinstance(value, dict):
            _deep_merge(base[key], value)
        else:
            base[key] = value


# ---- 全局单例 + watchfiles 热更新 ----

_settings: Optional[Settings] = None
_settings_lock = threading.Lock()
_watcher_started = False


def get_settings() -> Settings:
    """获取全局 Settings 单例（线程安全），用于 FastAPI 依赖注入"""
    global _settings
    if _settings is None:
        with _settings_lock:
            if _settings is None:
                _settings = load_settings_from_yaml()
    return _settings


def reload_settings(config_path: Optional[Path] = None) -> Settings:
    """重新加载配置文件并更新全局单例"""
    global _settings
    try:
        new_settings = load_settings_from_yaml(config_path)
        with _settings_lock:
            _settings = new_settings
        logger.info("配置热更新成功")
        return _settings
    except Exception as e:
        logger.error("配置热更新失败", error=str(e))
        return get_settings()


def start_config_watcher() -> None:
    """
    启动 watchfiles 后台线程监听 settings.yaml 变更。

    文件变更后自动重新加载配置，30 秒内生效。
    """
    global _watcher_started
    if _watcher_started:
        return

    config_path = DEFAULT_CONFIG_PATH
    if not config_path.exists():
        logger.warning("配置文件不存在，跳过热更新监听", path=str(config_path))
        return

    def _watch_loop() -> None:
        from watchfiles import watch

        logger.info("启动配置文件监听", path=str(config_path))
        for _changes in watch(config_path):
            logger.info("检测到配置文件变更", changes=str(_changes))
            reload_settings()

    thread = threading.Thread(target=_watch_loop, daemon=True, name="config-watcher")
    thread.start()
    _watcher_started = True
    logger.info("配置热更新监听线程已启动")


def reset_settings() -> None:
    """重置全局配置（测试用）"""
    global _settings, _watcher_started
    with _settings_lock:
        _settings = None
    _watcher_started = False
