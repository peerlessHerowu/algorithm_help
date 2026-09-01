"""
MinIO 文件存储校验规则 - Property Test

**Validates: Requirements 10.3, 10.4, 10.5**

使用 hypothesis 生成随机 content_type 和 data_size，验证校验逻辑正确性：
1. 合法类型 + 合法大小 → 上传成功，返回以 "/" 开头的 URL
2. 非法类型 → 抛出 ValueError("不支持的文件类型")
3. 超限大小 → 抛出 ValueError("文件大小超限")
"""

from unittest.mock import MagicMock

import pytest
from hypothesis import given, settings, assume
from hypothesis import strategies as st

from crawler_service.storage.minio_client import (
    ALLOWED_CONTENT_TYPES,
    MAX_FILE_SIZE,
    MinioStorage,
)


# --- Strategies ---

# 合法的 content_type
valid_content_types = st.sampled_from(sorted(ALLOWED_CONTENT_TYPES))

# 非法的 content_type：随机文本，排除合法值
invalid_content_types = st.text(
    alphabet=st.characters(whitelist_categories=("L", "N", "P")),
    min_size=1,
    max_size=50,
).filter(lambda ct: ct not in ALLOWED_CONTENT_TYPES)

# 合法大小：1 ~ MAX_FILE_SIZE
valid_data_sizes = st.integers(min_value=1, max_value=MAX_FILE_SIZE)

# 超限大小：MAX_FILE_SIZE + 1 ~ MAX_FILE_SIZE * 2
oversized_data_sizes = st.integers(
    min_value=MAX_FILE_SIZE + 1, max_value=MAX_FILE_SIZE + 1024 * 1024
)


# --- Fixtures ---

@pytest.fixture
def storage():
    """创建注入 mock 客户端的 MinioStorage 实例"""
    client = MagicMock()
    client.put_object = MagicMock()
    return MinioStorage(client=client)


# --- Property Tests ---

class TestStorageValidationProperty:
    """Property 12: 文件存储校验规则"""

    @given(content_type=valid_content_types, size=valid_data_sizes)
    @settings(max_examples=100)
    def test_valid_type_and_size_upload_succeeds(self, content_type, size):
        """
        **Validates: Requirements 10.3, 10.4, 10.5**

        Property: 当 content_type 在 ALLOWED_CONTENT_TYPES 且 size <= MAX_FILE_SIZE 时，
        upload_image 应成功并返回以 "/" 开头的 URL 字符串。
        """
        client = MagicMock()
        client.put_object = MagicMock()
        storage = MinioStorage(client=client)

        data = b"x" * size
        url = storage.upload_image(data, content_type)

        assert isinstance(url, str)
        assert url.startswith("/")

    @given(content_type=invalid_content_types)
    @settings(max_examples=100)
    def test_invalid_type_raises_valueerror(self, content_type):
        """
        **Validates: Requirements 10.4**

        Property: 当 content_type 不在 ALLOWED_CONTENT_TYPES 时，
        upload_image 应抛出 ValueError 且消息包含"不支持的文件类型"。
        """
        client = MagicMock()
        client.put_object = MagicMock()
        storage = MinioStorage(client=client)

        data = b"some data"
        with pytest.raises(ValueError, match="不支持的文件类型"):
            storage.upload_image(data, content_type)

    @given(size=oversized_data_sizes, content_type=valid_content_types)
    @settings(max_examples=50)
    def test_oversized_file_raises_valueerror(self, size, content_type):
        """
        **Validates: Requirements 10.5**

        Property: 当 size > MAX_FILE_SIZE 时，
        upload_image 应抛出 ValueError 且消息包含"文件大小超限"。
        """
        client = MagicMock()
        client.put_object = MagicMock()
        storage = MinioStorage(client=client)

        data = b"x" * size
        with pytest.raises(ValueError, match="文件大小超限"):
            storage.upload_image(data, content_type)
