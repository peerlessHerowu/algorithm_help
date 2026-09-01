"""ImageHandler 单元测试"""

import asyncio
from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest

from crawler_service.pipeline.image_handler import ImageHandler


@pytest.fixture
def mock_minio():
    """模拟 MinioStorage，upload_image 返回内部 URL"""
    minio = MagicMock()
    minio.upload_image.return_value = "/crawler-assets/2024/01/15/abc123.png"
    return minio


@pytest.fixture
def mock_ai_client():
    """模拟 algorithm-ai 异步客户端"""
    client = AsyncMock(spec=httpx.AsyncClient)
    response = MagicMock()
    response.status_code = 200
    response.json.return_value = {"data": {"description": "一张算法流程图"}}
    client.post.return_value = response
    return client


@pytest.fixture
def handler(mock_minio):
    """无 AI 客户端的 ImageHandler"""
    return ImageHandler(minio=mock_minio, ai_client=None)


@pytest.fixture
def handler_with_ai(mock_minio, mock_ai_client):
    """带 AI 客户端的 ImageHandler"""
    return ImageHandler(minio=mock_minio, ai_client=mock_ai_client)


def _make_httpx_response(content: bytes, content_type: str = "image/png", status_code: int = 200):
    """构造模拟的 httpx.Response（含 request 属性，使 raise_for_status 正常工作）"""
    request = httpx.Request("GET", "https://example.com/image")
    response = httpx.Response(
        status_code=status_code,
        headers={"content-type": content_type},
        content=content,
        request=request,
    )
    return response


class TestImageHandlerProcess:
    """测试 ImageHandler.process 方法"""

    @pytest.mark.asyncio
    async def test_empty_markdown_returns_unchanged(self, handler):
        """空 Markdown 返回原值"""
        assert await handler.process("", "leetcode") == ""
        assert await handler.process(None, "leetcode") is None

    @pytest.mark.asyncio
    async def test_no_images_returns_unchanged(self, handler):
        """无图片的 Markdown 返回原值"""
        md = "# Title\n\nSome text without images.\n"
        result = await handler.process(md, "leetcode")
        assert result == md

    @pytest.mark.asyncio
    async def test_successful_download_replaces_url(self, handler, mock_minio):
        """成功下载图片后替换为内部 URL"""
        md = "Text before ![diagram](https://example.com/img.png) text after"
        fake_image = b"\x89PNG\r\n\x1a\n" + b"\x00" * 100

        with patch("crawler_service.pipeline.image_handler.httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client.get.return_value = _make_httpx_response(fake_image, "image/png")
            mock_client_cls.return_value = mock_client

            result = await handler.process(md, "leetcode")

        assert "/crawler-assets/" in result
        assert "https://example.com/img.png" not in result
        assert "![diagram]" in result
        mock_minio.upload_image.assert_called_once_with(fake_image, "image/png")

    @pytest.mark.asyncio
    async def test_download_failure_preserves_original_url(self, handler):
        """下载失败时保留原始 URL，alt 标记为"外部引用"（无原 alt 时）"""
        md = "![](https://broken.example.com/img.png)"

        with patch("crawler_service.pipeline.image_handler.httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client.get.side_effect = httpx.ConnectError("connection failed")
            mock_client_cls.return_value = mock_client

            result = await handler.process(md, "leetcode")

        assert "https://broken.example.com/img.png" in result
        assert "外部引用" in result

    @pytest.mark.asyncio
    async def test_download_failure_preserves_existing_alt(self, handler):
        """下载失败时保留原有的 alt 文本"""
        md = "![my diagram](https://broken.example.com/img.png)"

        with patch("crawler_service.pipeline.image_handler.httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client.get.side_effect = httpx.TimeoutException("timeout")
            mock_client_cls.return_value = mock_client

            result = await handler.process(md, "codeforces")

        assert "![my diagram](https://broken.example.com/img.png)" in result

    @pytest.mark.asyncio
    async def test_gif_preserved_as_is(self, handler, mock_minio):
        """GIF 图片保持原格式存储，不做转换"""
        md = "![anim](https://example.com/animation.gif)"
        fake_gif = b"GIF89a" + b"\x00" * 50

        with patch("crawler_service.pipeline.image_handler.httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client.get.return_value = _make_httpx_response(fake_gif, "image/gif")
            mock_client_cls.return_value = mock_client

            await handler.process(md, "leetcode")

        # 验证上传时 content_type 保持为 gif
        mock_minio.upload_image.assert_called_once_with(fake_gif, "image/gif")

    @pytest.mark.asyncio
    async def test_multiple_images_all_processed(self, handler, mock_minio):
        """多张图片全部处理"""
        md = (
            "![a](https://example.com/1.png)\n"
            "Text\n"
            "![b](https://example.com/2.jpg)\n"
        )
        fake_image = b"\x89PNG" + b"\x00" * 50

        with patch("crawler_service.pipeline.image_handler.httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client.get.return_value = _make_httpx_response(fake_image, "image/png")
            mock_client_cls.return_value = mock_client

            result = await handler.process(md, "leetcode")

        assert mock_minio.upload_image.call_count == 2
        assert "https://example.com" not in result

    @pytest.mark.asyncio
    async def test_local_urls_not_matched(self, handler):
        """本地路径图片不被匹配（只处理 http/https）"""
        md = "![local](/images/local.png)\n![relative](./img.png)"
        result = await handler.process(md, "leetcode")
        assert result == md


class TestImageHandlerAiAltText:
    """测试 AI alt 文本生成"""

    @pytest.mark.asyncio
    async def test_ai_generates_alt_when_empty(self, handler_with_ai, mock_minio, mock_ai_client):
        """当 alt 为空时调用 AI 生成描述"""
        md = "![](https://example.com/chart.png)"
        fake_image = b"\x89PNG" + b"\x00" * 50

        with patch("crawler_service.pipeline.image_handler.httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client.get.return_value = _make_httpx_response(fake_image, "image/png")
            mock_client_cls.return_value = mock_client

            result = await handler_with_ai.process(md, "leetcode")

        assert "一张算法流程图" in result
        mock_ai_client.post.assert_called_once()

    @pytest.mark.asyncio
    async def test_ai_not_called_when_alt_exists(self, handler_with_ai, mock_minio, mock_ai_client):
        """当 alt 已有内容时不调用 AI"""
        md = "![existing alt](https://example.com/chart.png)"
        fake_image = b"\x89PNG" + b"\x00" * 50

        with patch("crawler_service.pipeline.image_handler.httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client.get.return_value = _make_httpx_response(fake_image, "image/png")
            mock_client_cls.return_value = mock_client

            result = await handler_with_ai.process(md, "leetcode")

        assert "![existing alt]" in result
        mock_ai_client.post.assert_not_called()

    @pytest.mark.asyncio
    async def test_ai_failure_returns_empty_alt(self, mock_minio):
        """AI 调用失败时静默返回空 alt，不阻塞流程"""
        ai_client = AsyncMock(spec=httpx.AsyncClient)
        ai_client.post.side_effect = Exception("AI service down")
        handler = ImageHandler(minio=mock_minio, ai_client=ai_client)

        md = "![](https://example.com/img.png)"
        fake_image = b"\x89PNG" + b"\x00" * 50

        with patch("crawler_service.pipeline.image_handler.httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client.get.return_value = _make_httpx_response(fake_image, "image/png")
            mock_client_cls.return_value = mock_client

            result = await handler.process(md, "leetcode")

        # 即使 AI 失败，图片仍然被成功替换
        assert "/crawler-assets/" in result


class TestImageHandlerContentType:
    """测试 Content-Type 推断逻辑"""

    @pytest.mark.asyncio
    async def test_content_type_from_header(self, handler, mock_minio):
        """从响应头正确解析 content_type"""
        md = "![](https://example.com/image)"
        fake_image = b"\x00" * 50

        with patch("crawler_service.pipeline.image_handler.httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client.get.return_value = _make_httpx_response(
                fake_image, "image/webp; charset=utf-8"
            )
            mock_client_cls.return_value = mock_client

            await handler.process(md, "leetcode")

        mock_minio.upload_image.assert_called_once_with(fake_image, "image/webp")

    @pytest.mark.asyncio
    async def test_content_type_fallback_to_url_extension(self, handler, mock_minio):
        """响应头无法识别时从 URL 后缀推断"""
        md = "![](https://cdn.example.com/pics/photo.jpeg)"
        fake_image = b"\x00" * 50

        with patch("crawler_service.pipeline.image_handler.httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            # 响应头为 application/octet-stream（无法识别）
            mock_client.get.return_value = _make_httpx_response(
                fake_image, "application/octet-stream"
            )
            mock_client_cls.return_value = mock_client

            await handler.process(md, "leetcode")

        mock_minio.upload_image.assert_called_once_with(fake_image, "image/jpeg")

    @pytest.mark.asyncio
    async def test_content_type_fallback_to_png(self, handler, mock_minio):
        """响应头和 URL 都无法识别时兜底为 image/png"""
        md = "![](https://example.com/unknown-resource)"
        fake_image = b"\x00" * 50

        with patch("crawler_service.pipeline.image_handler.httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client.get.return_value = _make_httpx_response(
                fake_image, "application/octet-stream"
            )
            mock_client_cls.return_value = mock_client

            await handler.process(md, "leetcode")

        mock_minio.upload_image.assert_called_once_with(fake_image, "image/png")
