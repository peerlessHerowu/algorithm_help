"""质量统计 API 端点

GET /api/v1/quality/stats：返回各平台采集成功率、INCOMPLETE 数量、LOW_QUALITY 数量。
"""

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from crawler_service.database.session import get_async_session
from crawler_service.models.entities import RawSource
from crawler_service.models.schemas import ApiResponse

router = APIRouter(prefix="/api/v1/quality", tags=["质量统计"])


class PlatformQualityStat(BaseModel):
    """单平台质量统计"""

    platform: str = Field(description="平台标识")
    total: int = Field(description="总采集记录数")
    completed: int = Field(description="处理成功数")
    success_rate: float = Field(description="采集成功率（0-1）")
    incomplete_count: int = Field(description="INCOMPLETE 数量")
    low_quality_count: int = Field(description="LOW_QUALITY 数量")


class QualityStatsResponse(BaseModel):
    """质量统计响应"""

    stats: list[PlatformQualityStat] = Field(description="各平台质量统计列表")
    total_incomplete: int = Field(description="全局 INCOMPLETE 总数")
    total_low_quality: int = Field(description="全局 LOW_QUALITY 总数")


@router.get("/stats", response_model=ApiResponse[QualityStatsResponse])
async def get_quality_stats(
    session: AsyncSession = Depends(get_async_session),
) -> ApiResponse[QualityStatsResponse]:
    """
    获取数据质量统计

    按平台维度统计 raw_source 表中各 process_status 的数量，
    计算采集成功率（COMPLETED / total）、INCOMPLETE 数量、LOW_QUALITY 数量。
    """
    # 按平台分组统计各状态数量
    query = (
        select(
            RawSource.platform,
            RawSource.process_status,
            func.count().label("cnt"),
        )
        .group_by(RawSource.platform, RawSource.process_status)
    )
    result = await session.execute(query)
    rows = result.all()

    # 聚合为各平台统计
    platform_data: dict[str, dict[str, int]] = {}
    for platform, status, cnt in rows:
        if platform not in platform_data:
            platform_data[platform] = {
                "total": 0,
                "completed": 0,
                "incomplete": 0,
                "low_quality": 0,
            }
        platform_data[platform]["total"] += cnt
        if status == "COMPLETED":
            platform_data[platform]["completed"] += cnt
        elif status == "INCOMPLETE":
            platform_data[platform]["incomplete"] += cnt
        elif status == "LOW_QUALITY":
            platform_data[platform]["low_quality"] += cnt

    # 构建响应
    stats: list[PlatformQualityStat] = []
    total_incomplete = 0
    total_low_quality = 0

    for platform, data in sorted(platform_data.items()):
        total = data["total"]
        success_rate = data["completed"] / total if total > 0 else 0.0
        stats.append(
            PlatformQualityStat(
                platform=platform,
                total=total,
                completed=data["completed"],
                success_rate=round(success_rate, 4),
                incomplete_count=data["incomplete"],
                low_quality_count=data["low_quality"],
            )
        )
        total_incomplete += data["incomplete"]
        total_low_quality += data["low_quality"]

    response_data = QualityStatsResponse(
        stats=stats,
        total_incomplete=total_incomplete,
        total_low_quality=total_low_quality,
    )
    return ApiResponse(data=response_data)
