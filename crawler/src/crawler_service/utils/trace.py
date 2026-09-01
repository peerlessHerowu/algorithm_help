"""
trace_id 工具模块

提供 trace_id 的生成、存储与获取，以及 FastAPI 中间件。
基于 contextvars 实现协程安全的 trace_id 传递。
"""

import uuid
from contextvars import ContextVar

from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import Response

# 协程级别的 trace_id 上下文变量
_trace_id_var: ContextVar[str] = ContextVar("trace_id", default="")

TRACE_ID_HEADER = "X-Trace-Id"


def generate_trace_id() -> str:
    """生成新的 trace_id（UUID4 去横杠）"""
    return uuid.uuid4().hex


def get_current_trace_id() -> str:
    """
    获取当前协程的 trace_id。
    如果未设置则生成一个新的并存入上下文。
    """
    trace_id = _trace_id_var.get()
    if not trace_id:
        trace_id = generate_trace_id()
        _trace_id_var.set(trace_id)
    return trace_id


def set_trace_id(trace_id: str) -> None:
    """设置当前协程的 trace_id（通常由中间件调用）"""
    _trace_id_var.set(trace_id)


class TraceMiddleware(BaseHTTPMiddleware):
    """
    FastAPI 中间件：读取或生成 X-Trace-Id 请求头。

    - 如果请求携带 X-Trace-Id 头，使用该值作为当前 trace_id
    - 如果未携带，自动生成一个新的 trace_id
    - 响应头中始终携带 X-Trace-Id
    """

    async def dispatch(
        self, request: Request, call_next: RequestResponseEndpoint
    ) -> Response:
        # 读取请求头中的 trace_id，没有则生成新的
        trace_id = request.headers.get(TRACE_ID_HEADER, "")
        if not trace_id:
            trace_id = generate_trace_id()
        set_trace_id(trace_id)

        response = await call_next(request)

        # 在响应头中添加 trace_id
        response.headers[TRACE_ID_HEADER] = trace_id
        return response
