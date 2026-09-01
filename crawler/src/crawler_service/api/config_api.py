"""配置管理 API 端点

提供平台配置查看和动态修改功能。
- GET /api/v1/config：查看各平台配置状态
- PUT /api/v1/config/{platform}：动态修改平台配置
"""

from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from crawler_service.config import get_settings
from crawler_service.models.schemas import ApiResponse

router = APIRouter(prefix="/api/v1/config", tags=["配置管理"])


class PlatformConfigDTO(BaseModel):
    """平台配置响应 DTO"""

    platform: str = Field(description="平台标识")
    enabled: bool = Field(description="是否启用")
    base_url: str = Field(description="基础 URL")
    rate_limit: int = Field(description="每分钟最大请求数")
    retry_max: int = Field(description="最大重试次数")
    solution_fetch_enabled: bool = Field(description="是否启用题解采集")
    request_delay_ms: list[int] = Field(description="请求延迟范围(毫秒)")
    capabilities: list[str] = Field(description="平台支持的采集能力")


class PlatformConfigUpdateRequest(BaseModel):
    """平台配置更新请求（部分更新，所有字段可选）"""

    enabled: Optional[bool] = Field(default=None, description="是否启用")
    rate_limit: Optional[int] = Field(default=None, description="每分钟最大请求数", gt=0)
    retry_max: Optional[int] = Field(default=None, description="最大重试次数", ge=0)
    solution_fetch_enabled: Optional[bool] = Field(default=None, description="是否启用题解采集")
    request_delay_ms: Optional[list[int]] = Field(
        default=None, description="请求延迟范围(毫秒)，需要两个元素 [min, max]"
    )


class AllPlatformConfigsDTO(BaseModel):
    """所有平台配置汇总"""

    platforms: list[PlatformConfigDTO] = Field(description="各平台配置列表")


@router.get("", response_model=ApiResponse[AllPlatformConfigsDTO])
async def get_all_configs() -> ApiResponse[AllPlatformConfigsDTO]:
    """查看各平台配置状态"""
    settings = get_settings()
    platform_configs = []
    for platform_key, cfg in settings.platforms.items():
        platform_configs.append(
            PlatformConfigDTO(
                platform=platform_key,
                enabled=cfg.enabled,
                base_url=cfg.base_url,
                rate_limit=cfg.rate_limit,
                retry_max=cfg.retry_max,
                solution_fetch_enabled=cfg.solution_fetch_enabled,
                request_delay_ms=cfg.request_delay_ms,
                capabilities=cfg.capabilities,
            )
        )
    return ApiResponse(data=AllPlatformConfigsDTO(platforms=platform_configs))


@router.put("/{platform}", response_model=ApiResponse[PlatformConfigDTO])
async def update_platform_config(
    platform: str, request: PlatformConfigUpdateRequest
) -> ApiResponse[PlatformConfigDTO]:
    """动态修改平台配置

    只更新请求中包含的字段（部分更新语义）。
    修改后立即生效，无需重启服务。
    """
    settings = get_settings()
    platform_cfg = settings.platforms.get(platform)
    if platform_cfg is None:
        raise HTTPException(
            status_code=404,
            detail=f"平台 '{platform}' 不存在，可用平台：{list(settings.platforms.keys())}",
        )

    # 校验 request_delay_ms 格式
    if request.request_delay_ms is not None:
        if len(request.request_delay_ms) != 2:
            raise HTTPException(
                status_code=400,
                detail="request_delay_ms 必须包含两个元素 [min, max]",
            )
        if request.request_delay_ms[0] > request.request_delay_ms[1]:
            raise HTTPException(
                status_code=400,
                detail="request_delay_ms[0] (min) 不能大于 request_delay_ms[1] (max)",
            )

    # 应用部分更新
    update_data = request.model_dump(exclude_none=True)
    for key, value in update_data.items():
        setattr(platform_cfg, key, value)

    # 返回更新后的配置
    return ApiResponse(
        data=PlatformConfigDTO(
            platform=platform,
            enabled=platform_cfg.enabled,
            base_url=platform_cfg.base_url,
            rate_limit=platform_cfg.rate_limit,
            retry_max=platform_cfg.retry_max,
            solution_fetch_enabled=platform_cfg.solution_fetch_enabled,
            request_delay_ms=platform_cfg.request_delay_ms,
            capabilities=platform_cfg.capabilities,
        )
    )
