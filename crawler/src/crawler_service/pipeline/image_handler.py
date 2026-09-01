"""
图片下载与 URL 替换处理器

处理 Markdown 中的外部图片：
- 下载外部图片到 MinIO（使用 run_in_executor 包装同步 minio-py）
- 替换为内部 URL
- 下载成功后调用 algorithm-ai 多模态接口生成图片 alt 文本描述
- 下载失败时保留原始 URL 标记为"外部引用"
- GIF 保持原格式存储
"""

import asyncio
import re
from typing import Optional

import httpx
import structlog

from crawler_service.storage.minio_client import MinioStorage

logger = structlog.get_logger()

# Markdown 图片语法正则：![alt](url)
_IMG_PATTERN = re.compile(r'!\[([^\]]*)\]\((https?://[^)]+)\)')

# 响应 Content-Type 到 MIME 类型的标准化映射
_CONTENT_TYPE_NORMALIZE: dict[str, str] = {
    "image/png": "image/png",
    "image/jpeg": "image/jpeg",
    "image/jpg": "image/jpeg",
    "image/gif": "image/gif",
    "image/webp": "image/webp",
    "image/svg+xml": "image/svg+xml",
}

# 从 URL 后缀推断 content_type 的备选映射
_EXT_TO_CONTENT_TYPE: dict[str, str] = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".svg": "image/svg+xml",
}


class ImageHandler:
    """
    图片下载、URL 替换、AI 描述生成

    职责：
    1. 扫描 Markdown 中的外部图片链接
    2. 下载图片并上传到 MinIO
    3. 替换为内部 URL
    4. 可选：调用 algorithm-ai 多模态接口生成 alt 文本
    """

    def __init__(self, minio: MinioStorage, ai_client: Optional[httpx.AsyncClient] = None):
        """
        :param minio: MinioStorage 实例（同步 SDK，内部通过 run_in_executor 异步化）
        :param ai_client: 可选的 httpx.AsyncClient，用于调用 algorithm-ai 多模态接口
        """
        self._minio = minio
        self._ai_client = ai_client

    async def process(self, markdown: str, platform: str) -> str:
        """
        处理 Markdown 中的外部图片：下载 → 存储 → 替换 URL → AI 描述

        :param markdown: 原始 Markdown 文本
        :param platform: 平台标识（用于日志上下文）
        :returns: 替换后的 Markdown 文本
        """
        if not markdown:
            return markdown

        matches = list(_IMG_PATTERN.finditer(markdown))
        if not matches:
            return markdown

        result = markdown
        for match in matches:
            replacement = await self._process_single_image(match, platform)
            result = result.replace(match.group(0), replacement, 1)

        return result

    async def _process_single_image(self, match: re.Match, platform: str) -> str:
        """
        处理单张图片：下载 → 上传 MinIO → 生成 alt 文本 → 返回替换后的 Markdown 图片标记

        下载失败时保留原始 URL 并标记为"外部引用"。
        """
        alt_text = match.group(1)
        url = match.group(2)

        try:
            image_data, content_type = await self._download_image(url)
            internal_url = await self._upload_to_minio(image_data, content_type)

            # 下载成功后调用 AI 生成 alt 文本描述（R7.3）
            if self._ai_client and not alt_text:
                alt_text = await self._generate_alt_text(image_data, content_type)

            logger.info(
                "图片处理成功",
                platform=platform,
                original_url=url,
                internal_url=internal_url,
            )
            return f"![{alt_text}]({internal_url})"

        except Exception as e:
            # 下载失败：保留原始 URL，标记为"外部引用"（R7.5）
            logger.warning(
                "图片下载失败，保留原始 URL",
                platform=platform,
                url=url,
                error=str(e),
            )
            fallback_alt = alt_text if alt_text else "外部引用"
            return f"![{fallback_alt}]({url})"

    async def _download_image(self, url: str) -> tuple[bytes, str]:
        """
        下载外部图片

        :returns: (图片二进制数据, MIME content_type)
        :raises httpx.HTTPError: 下载失败时
        """
        async with httpx.AsyncClient(follow_redirects=True) as client:
            resp = await client.get(url, timeout=30.0)
            resp.raise_for_status()

        content_type = self._resolve_content_type(resp, url)
        return resp.content, content_type

    def _resolve_content_type(self, resp: httpx.Response, url: str) -> str:
        """
        从响应头或 URL 后缀推断图片 MIME 类型

        优先使用响应头 Content-Type，若无法识别则尝试 URL 后缀推断，
        最终兜底为 image/png。
        """
        raw_type = resp.headers.get("content-type", "").split(";")[0].strip().lower()
        normalized = _CONTENT_TYPE_NORMALIZE.get(raw_type)
        if normalized:
            return normalized

        # 尝试从 URL 后缀推断
        for ext, ct in _EXT_TO_CONTENT_TYPE.items():
            if url.lower().split("?")[0].endswith(ext):
                return ct

        return "image/png"

    async def _upload_to_minio(self, data: bytes, content_type: str) -> str:
        """
        将图片上传到 MinIO（通过 run_in_executor 包装同步 SDK 调用）

        GIF 格式保持原样存储，不做格式转换（R7.6）。

        :returns: MinIO 内部 URL 路径
        """
        loop = asyncio.get_running_loop()
        internal_url = await loop.run_in_executor(
            None, self._minio.upload_image, data, content_type
        )
        return internal_url

    async def _generate_alt_text(self, image_data: bytes, content_type: str) -> str:
        """
        调用 algorithm-ai 多模态接口生成图片文本描述（R7.3）

        失败时静默返回空字符串，不阻塞整体流程。
        """
        if not self._ai_client:
            return ""

        try:
            response = await self._ai_client.post(
                "/api/v1/ai/describe-image",
                files={"image": ("image", image_data, content_type)},
                timeout=30.0,
            )
            if response.status_code == 200:
                result = response.json()
                return result.get("data", {}).get("description", "")
        except Exception as e:
            logger.debug("AI 图片描述生成失败，跳过", error=str(e))

        return ""
