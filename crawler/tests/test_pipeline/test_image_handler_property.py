"""
图片 URL 替换为内部格式 - Property Test

**Validates: Requirements 4.3, 7.2, 7.5**

使用 hypothesis 生成随机 Markdown 内容和图片 URL，验证：
1. 成功下载的图片 URL 被替换为 MinIO 内部路径格式 (/{bucket}/{yyyy}/{MM}/{dd}/{uuid}.{ext})
2. 下载失败的图片保留原始外部 URL 不变
3. 替换后 Markdown 结构依然有效（图片标记语法完整）
"""

import re
from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest
from hypothesis import given, settings, assume, HealthCheck
from hypothesis import strategies as st

from crawler_service.pipeline.image_handler import ImageHandler


# ============================================================
# 策略定义
# ============================================================

# 内部 URL 的正则匹配模式：/{bucket}/{yyyy}/{MM}/{dd}/{hex-uuid}.{ext}
_INTERNAL_URL_PATTERN = re.compile(
    r"^/[\w-]+/\d{4}/\d{2}/\d{2}/[a-f0-9]+\.\w+$"
)

# Markdown 图片语法正则
_MD_IMAGE_PATTERN = re.compile(r'!\[([^\]]*)\]\(([^)]+)\)')

# 生成合法的图片文件扩展名
_image_extensions = st.sampled_from(["png", "jpg", "jpeg", "gif", "webp", "svg"])

# 生成合法的域名片段
_domain_parts = st.text(
    alphabet=st.characters(whitelist_categories=("Ll",), whitelist_characters=("-",)),
    min_size=3,
    max_size=12,
).filter(lambda s: not s.startswith("-") and not s.endswith("-") and "--" not in s)

# 生成外部图片 URL
_image_url = st.builds(
    lambda domain, path_seg, ext: f"https://{domain}.com/{path_seg}/image.{ext}",
    domain=_domain_parts,
    path_seg=st.text(
        alphabet=st.characters(whitelist_categories=("Ll", "Nd"), whitelist_characters=("-", "_")),
        min_size=2,
        max_size=15,
    ).filter(lambda s: len(s) >= 2),
    ext=_image_extensions,
)

# 生成 alt 文本（可以为空，也可以有内容）
_alt_text = st.text(
    alphabet=st.characters(
        whitelist_categories=("L", "N", "Zs"),
        whitelist_characters=(" ",),
    ),
    min_size=0,
    max_size=30,
).map(str.strip)

# 生成平台标识
_platform = st.sampled_from([
    "leetcode_global", "leetcode_cn", "codeforces", "nowcoder", "atcoder",
])

# 生成不包含图片标记的普通 Markdown 文本行
_plain_text_line = st.text(
    alphabet=st.characters(
        whitelist_categories=("L", "N", "Zs", "P"),
        blacklist_characters="![]()",
    ),
    min_size=5,
    max_size=60,
).map(str.strip).filter(lambda t: len(t) >= 5)


# MIME type 与扩展名映射
_EXT_TO_MIME = {
    "png": "image/png",
    "jpg": "image/jpeg",
    "jpeg": "image/jpeg",
    "gif": "image/gif",
    "webp": "image/webp",
    "svg": "image/svg+xml",
}


def _make_httpx_response(content: bytes, content_type: str, status_code: int = 200):
    """构造模拟的 httpx.Response"""
    request = httpx.Request("GET", "https://example.com/image")
    return httpx.Response(
        status_code=status_code,
        headers={"content-type": content_type},
        content=content,
        request=request,
    )


def _build_markdown_with_images(texts: list[str], images: list[tuple[str, str]]) -> str:
    """
    组合纯文本行和图片标记为完整 Markdown。

    :param texts: 纯文本行列表
    :param images: (alt_text, url) 列表
    :returns: 包含图片的 Markdown 文本
    """
    lines = []
    img_idx = 0
    for i, text in enumerate(texts):
        lines.append(text)
        if img_idx < len(images):
            alt, url = images[img_idx]
            lines.append(f"![{alt}]({url})")
            img_idx += 1
    # 追加剩余图片
    while img_idx < len(images):
        alt, url = images[img_idx]
        lines.append(f"![{alt}]({url})")
        img_idx += 1
    return "\n".join(lines)


class TestImageUrlReplacementProperty:
    """Property 7: 图片 URL 替换为内部格式"""

    @given(
        alt_text=_alt_text,
        url=_image_url,
        platform=_platform,
        surrounding_text=_plain_text_line,
    )
    @settings(max_examples=80, suppress_health_check=[HealthCheck.function_scoped_fixture])
    @pytest.mark.asyncio
    async def test_successful_download_replaces_with_internal_url(
        self,
        alt_text: str,
        url: str,
        platform: str,
        surrounding_text: str,
    ):
        """
        **Validates: Requirements 4.3, 7.2**

        Property: 成功下载的图片 URL 必须被替换为匹配
        /{bucket}/{yyyy}/{MM}/{dd}/{uuid}.{ext} 格式的内部路径。
        """
        markdown = f"{surrounding_text}\n![{alt_text}]({url})\n{surrounding_text}"
        fake_image = b"\x89PNG\r\n\x1a\n" + b"\x00" * 100

        # 从 URL 推断扩展名以确定 content_type
        ext = url.rsplit(".", 1)[-1].lower()
        content_type = _EXT_TO_MIME.get(ext, "image/png")

        # 模拟 MinIO 返回内部 URL
        mock_minio = MagicMock()
        internal_path = f"/crawler-assets/2024/06/15/abcdef1234567890abcdef1234567890.{ext if ext != 'svg' else 'svg'}"
        mock_minio.upload_image.return_value = internal_path

        handler = ImageHandler(minio=mock_minio, ai_client=None)

        with patch("crawler_service.pipeline.image_handler.httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client.get.return_value = _make_httpx_response(fake_image, content_type)
            mock_client_cls.return_value = mock_client

            result = await handler.process(markdown, platform)

        # 验证 1: 原始外部 URL 不再出现
        assert url not in result, (
            f"原始 URL 仍然存在于结果中: {url}"
        )

        # 验证 2: 内部 URL 出现在结果中
        assert internal_path in result, (
            f"内部路径 {internal_path} 未出现在结果中"
        )

        # 验证 3: 内部 URL 匹配预期格式
        assert _INTERNAL_URL_PATTERN.match(internal_path), (
            f"内部 URL 格式不合规: {internal_path}"
        )

        # 验证 4: Markdown 图片语法完整
        img_matches = _MD_IMAGE_PATTERN.findall(result)
        assert len(img_matches) >= 1, "替换后 Markdown 中未找到有效图片标记"
        # 其中一个图片的 URL 应该是内部路径
        urls_in_result = [m[1] for m in img_matches]
        assert internal_path in urls_in_result

    @given(
        alt_text=_alt_text,
        url=_image_url,
        platform=_platform,
        surrounding_text=_plain_text_line,
    )
    @settings(max_examples=80, suppress_health_check=[HealthCheck.function_scoped_fixture])
    @pytest.mark.asyncio
    async def test_failed_download_preserves_original_url(
        self,
        alt_text: str,
        url: str,
        platform: str,
        surrounding_text: str,
    ):
        """
        **Validates: Requirements 7.5**

        Property: 下载失败的图片必须保留原始外部 URL 不变。
        """
        markdown = f"{surrounding_text}\n![{alt_text}]({url})\n{surrounding_text}"

        mock_minio = MagicMock()
        handler = ImageHandler(minio=mock_minio, ai_client=None)

        with patch("crawler_service.pipeline.image_handler.httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            # 模拟下载失败
            mock_client.get.side_effect = httpx.ConnectError("connection refused")
            mock_client_cls.return_value = mock_client

            result = await handler.process(markdown, platform)

        # 验证 1: 原始 URL 仍然保留
        assert url in result, (
            f"下载失败后原始 URL 被丢失: {url}"
        )

        # 验证 2: MinIO 未被调用
        mock_minio.upload_image.assert_not_called()

        # 验证 3: Markdown 图片语法仍然完整
        img_matches = _MD_IMAGE_PATTERN.findall(result)
        assert len(img_matches) >= 1, "失败后 Markdown 中图片标记丢失"
        urls_in_result = [m[1] for m in img_matches]
        assert url in urls_in_result, (
            f"原始 URL {url} 未出现在图片标记中"
        )

    @given(
        texts=st.lists(_plain_text_line, min_size=1, max_size=4),
        images=st.lists(
            st.tuples(_alt_text, _image_url),
            min_size=1,
            max_size=3,
        ),
        platform=_platform,
    )
    @settings(max_examples=60, suppress_health_check=[HealthCheck.function_scoped_fixture])
    @pytest.mark.asyncio
    async def test_markdown_structure_valid_after_replacement(
        self,
        texts: list[str],
        images: list[tuple[str, str]],
        platform: str,
    ):
        """
        **Validates: Requirements 4.3, 7.2**

        Property: 无论成功或失败，替换后的 Markdown 中所有图片标记
        语法仍然有效（![alt](url) 格式完整）。
        """
        markdown = _build_markdown_with_images(texts, images)
        original_image_count = len(_MD_IMAGE_PATTERN.findall(markdown))
        assume(original_image_count > 0)

        fake_image = b"\x89PNG\r\n\x1a\n" + b"\x00" * 50

        mock_minio = MagicMock()
        mock_minio.upload_image.return_value = "/crawler-assets/2024/03/20/deadbeef12345678.png"

        handler = ImageHandler(minio=mock_minio, ai_client=None)

        with patch("crawler_service.pipeline.image_handler.httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client.get.return_value = _make_httpx_response(fake_image, "image/png")
            mock_client_cls.return_value = mock_client

            result = await handler.process(markdown, platform)

        # 验证: 替换后图片标记数量不变
        result_image_count = len(_MD_IMAGE_PATTERN.findall(result))
        assert result_image_count == original_image_count, (
            f"图片标记数量变化: 原始 {original_image_count}, 替换后 {result_image_count}"
        )

        # 验证: 所有图片标记语法完整（已匹配的就说明语法完整）
        for alt, url in _MD_IMAGE_PATTERN.findall(result):
            assert url, f"图片 URL 为空: ![{alt}]()"

        # 验证: 非图片文本内容保持不变
        for text in texts:
            assert text in result, (
                f"非图片文本内容被修改或丢失: '{text}'"
            )
