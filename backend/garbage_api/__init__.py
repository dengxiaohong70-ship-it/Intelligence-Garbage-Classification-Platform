"""YOLOv5 垃圾分类 API（会话、数据库与 /api/* 路由），挂接到主 Flask 应用。"""

from .extension import init_garbage_api

__all__ = ["init_garbage_api"]
