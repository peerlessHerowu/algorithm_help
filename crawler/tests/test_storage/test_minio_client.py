"""
MinioStorage 单元测试

验证 upload_image 的类型校验、大小校验、日期分区路径生成，以及 ensure_buckets 方法。
"""

import re
from unittest.mock import MagicMock, patch

import pytest

from crawler_service.storage.minio_client import (
    ALLOWED_CONTENT_TYPES,
    MAX_FILE_SIZE,
    MinioStorage,
    _EXTENSION_MAP,
)


@pytest.fixture
def mock_minio_client():
    """创建一个 mock 的 Minio 客户端"""
    client = MagicMock()
    client.put_object = MagicMock()
    client.bucket_exists = MagicMock(return_value=False)
    client.make_bucket = MagicMock()
    return client


@pytest.fixture
def storage(mock_minio_client):
    """创建注入 mock 客户端的 MinioStorage 实例"""
    return MinioStorage(client=mock_minio_client)


class TestUploadImageValidation:
    """上传图片校验逻辑测试"""

    def test_reject_invalid_content_type(self, storage):
        """不允许的 MIME 类型应该抛出 ValueError"""
        with pytest.raises(ValueError, match="不支持的文件类型"):
            storage.upload_image(b"fake data", "application/pdf")

    def test_reject_text_plain(self, storage):
        """text/plain 不在允许列表中"""
        with pytest.raises(ValueError, match="不支持的文件类型"):
            storage.upload_image(b"hello", "text/plain")

    def test_reject_oversized_file(self, storage):
        """超过 10MB 的文件应该抛出 ValueError"""
        data = b"x" * (MAX_FILE_SIZE + 1)
        with pytest.raises(ValueError, match="文件大小超限"):
            storage.upload_image(data, "image/png")

    def test_accept_exact_max_size(self, storage):
        """恰好 10MB 的文件应该允许通过"""
        data = b"x" * MAX_FILE_SIZE
        url = storage.upload_image(data, "image/png")
        assert url.startswith("/")

    def test_accept_all_allowed_types(self, storage):
        """所有允许的 MIME 类型都能成功上传"""
        data = b"minimal image data"
        for content_type in ALLOWED_CONTENT_TYPES:
            url = storage.upload_image(data, content_type)
            assert url.startswith("/")


class TestUploadImagePath:
    """上传图片路径生成测试"""

    def test_url_format_contains_bucket(self, storage):
        """返回的 URL 应包含 bucket 名称"""
        data = b"image bytes"
        url = storage.upload_image(data, "image/png")
        # URL 格式: /{bucket}/{yyyy}/{MM}/{dd}/{uuid}.{ext}
        assert "/crawler-assets/" in url

    def test_url_has_date_partition(self, storage):
        """返回的 URL 应包含日期分区（yyyy/MM/dd 格式）"""
        data = b"image bytes"
        url = storage.upload_image(data, "image/jpeg")
        # 匹配日期模式: /2024/01/15/ 类似格式
        pattern = r"/\d{4}/\d{2}/\d{2}/"
        assert re.search(pattern, url)

    def test_url_has_correct_extension(self, storage):
        """返回的 URL 应包含正确的文件扩展名"""
        data = b"image bytes"
        for content_type, ext in _EXTENSION_MAP.items():
            url = storage.upload_image(data, content_type)
            assert url.endswith(f".{ext}")

    def test_url_has_uuid_filename(self, storage):
        """返回的 URL 应包含 UUID 格式的文件名（32 位十六进制）"""
        data = b"image bytes"
        url = storage.upload_image(data, "image/png")
        # 提取文件名部分（最后的 xxx.ext）
        filename = url.rsplit("/", 1)[-1]
        name_part = filename.rsplit(".", 1)[0]
        # UUID hex 为 32 位
        assert len(name_part) == 32
        assert all(c in "0123456789abcdef" for c in name_part)


class TestUploadImageMinioCall:
    """验证上传时正确调用 Minio SDK"""

    def test_put_object_called_with_correct_params(self, storage, mock_minio_client):
        """应以正确参数调用 put_object"""
        data = b"png image data"
        storage.upload_image(data, "image/png")

        mock_minio_client.put_object.assert_called_once()
        call_kwargs = mock_minio_client.put_object.call_args
        assert call_kwargs.kwargs["bucket_name"] == "crawler-assets"
        assert call_kwargs.kwargs["length"] == len(data)
        assert call_kwargs.kwargs["content_type"] == "image/png"


class TestEnsureBuckets:
    """ensure_buckets 方法测试"""

    def test_creates_buckets_when_not_exist(self, storage, mock_minio_client):
        """当 bucket 不存在时应创建"""
        mock_minio_client.bucket_exists.return_value = False
        storage.ensure_buckets()

        assert mock_minio_client.make_bucket.call_count == 2
        bucket_names = [
            call.args[0] for call in mock_minio_client.make_bucket.call_args_list
        ]
        assert "crawler-assets" in bucket_names
        assert "user-uploads" in bucket_names

    def test_skips_existing_buckets(self, storage, mock_minio_client):
        """当 bucket 已存在时不应重复创建"""
        mock_minio_client.bucket_exists.return_value = True
        storage.ensure_buckets()

        mock_minio_client.make_bucket.assert_not_called()
