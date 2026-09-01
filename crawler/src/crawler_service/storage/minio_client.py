"""
MinIO 文件存储封装

提供 MinioStorage 类，实现图片上传（类型校验 + 大小校验 + 日期分区路径）和 bucket 自动创建。
使用 minio-py 同步 SDK，在异步上下文中需通过 run_in_executor 包装调用。
"""

import io
import uuid
from datetime import datetime, timezone
from typing import Optional

import structlog
from minio import Minio

from crawler_service.config import get_settings

logger = structlog.get_logger()

# 允许的图片 MIME 类型
ALLOWED_CONTENT_TYPES: set[str] = {
    "image/png",
    "image/jpeg",
    "image/gif",
    "image/webp",
    "image/svg+xml",
}

# 单文件大小上限：10MB
MAX_FILE_SIZE: int = 10 * 1024 * 1024

# content_type → 文件扩展名映射
_EXTENSION_MAP: dict[str, str] = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/gif": "gif",
    "image/webp": "webp",
    "image/svg+xml": "svg",
}


class MinioStorage:
    """
    MinIO 文件存储封装

    - upload_image: 上传图片（类型校验 + 大小校验 + 日期分区路径）
    - ensure_buckets: 确保所需 bucket 存在
    """

    def __init__(self, client: Optional[Minio] = None):
        """
        初始化 MinioStorage。

        :param client: 可选的 Minio 客户端实例（用于测试注入），
                       不传时从 get_settings() 自动创建。
        """
        if client is not None:
            self._client = client
        else:
            settings = get_settings()
            cfg = settings.minio
            self._client = Minio(
                endpoint=cfg.endpoint,
                access_key=cfg.access_key,
                secret_key=cfg.secret_key,
                secure=cfg.secure,
            )

    @property
    def client(self) -> Minio:
        """获取底层 Minio 客户端"""
        return self._client

    def upload_image(self, data: bytes, content_type: str) -> str:
        """
        上传图片到 MinIO。

        :param data: 图片二进制数据
        :param content_type: MIME 类型（必须在 ALLOWED_CONTENT_TYPES 中）
        :returns: 内部 URL，格式为 /{bucket}/{yyyy}/{MM}/{dd}/{uuid}.{ext}
        :raises ValueError: 类型不合法或文件大小超限
        """
        self._validate(data, content_type)

        settings = get_settings()
        bucket = settings.minio.bucket_crawler_assets
        ext = _EXTENSION_MAP[content_type]
        object_path = self._generate_path(ext)

        self._client.put_object(
            bucket_name=bucket,
            object_name=object_path,
            data=io.BytesIO(data),
            length=len(data),
            content_type=content_type,
        )

        internal_url = f"/{bucket}/{object_path}"
        logger.info(
            "图片上传成功",
            bucket=bucket,
            path=object_path,
            size=len(data),
            content_type=content_type,
        )
        return internal_url

    def ensure_buckets(self) -> None:
        """
        确保配置中所需的 bucket 存在，不存在则创建。

        检查 bucket_crawler_assets 和 bucket_user_uploads。
        """
        settings = get_settings()
        buckets = [
            settings.minio.bucket_crawler_assets,
            settings.minio.bucket_user_uploads,
        ]
        for bucket in buckets:
            if not self._client.bucket_exists(bucket):
                self._client.make_bucket(bucket)
                logger.info("创建 MinIO bucket", bucket=bucket)
            else:
                logger.debug("MinIO bucket 已存在", bucket=bucket)

    @staticmethod
    def _validate(data: bytes, content_type: str) -> None:
        """校验文件类型和大小"""
        if content_type not in ALLOWED_CONTENT_TYPES:
            raise ValueError(
                f"不支持的文件类型: {content_type}，"
                f"允许的类型: {sorted(ALLOWED_CONTENT_TYPES)}"
            )
        if len(data) > MAX_FILE_SIZE:
            raise ValueError(
                f"文件大小超限: {len(data)} bytes，上限为 {MAX_FILE_SIZE} bytes (10MB)"
            )

    @staticmethod
    def _generate_path(ext: str) -> str:
        """生成日期分区路径：{yyyy}/{MM}/{dd}/{uuid}.{ext}"""
        now = datetime.now(timezone.utc)
        date_part = now.strftime("%Y/%m/%d")
        filename = f"{uuid.uuid4().hex}.{ext}"
        return f"{date_part}/{filename}"
