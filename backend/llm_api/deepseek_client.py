import os
import re
from typing import Any, Dict, List, Optional

import requests

PLAIN_TEXT_HINT = "请用自然口语化的纯文本回复，不要使用 Markdown、星号加粗、井号标题或代码块。"

DEFAULT_SYSTEM_PROMPT = (
    "你是 EcoVision AI 平台的垃圾分类小助手。"
    "请用简洁、准确的中文回答，重点围绕：可回收物、有害垃圾、厨余垃圾、其他垃圾四类，"
    "以及常见物品的投放建议。不确定时请说明并建议用户以当地规定为准。"
    f"{PLAIN_TEXT_HINT}"
)


def plainize_llm_reply(text: str) -> str:
    """去掉常见 Markdown 标记，保证前端显示为普通文本。"""
    if not text:
        return text
    cleaned = text
    cleaned = re.sub(r"\*\*([^*]+)\*\*", r"\1", cleaned)
    cleaned = re.sub(r"__([^_]+)__", r"\1", cleaned)
    cleaned = re.sub(r"(?<!\*)\*([^*\n]+)\*(?!\*)", r"\1", cleaned)
    cleaned = re.sub(r"^#{1,6}\s+", "", cleaned, flags=re.MULTILINE)
    cleaned = re.sub(r"`([^`]+)`", r"\1", cleaned)
    return cleaned.strip()


class DeepSeekClient:
    """DeepSeek Chat Completions 轻量封装（OpenAI 兼容）。"""

    def __init__(self) -> None:
        self.api_key = (os.environ.get("DEEPSEEK_API_KEY") or "").strip()
        self.base_url = (os.environ.get("DEEPSEEK_BASE_URL") or "https://api.deepseek.com").rstrip("/")
        self.model = (os.environ.get("DEEPSEEK_MODEL") or "deepseek-chat").strip()
        self.max_tokens = int(os.environ.get("DEEPSEEK_MAX_TOKENS") or "512")
        self.timeout = int(os.environ.get("DEEPSEEK_TIMEOUT") or "60")

    @property
    def configured(self) -> bool:
        return bool(self.api_key)

    def chat(
        self,
        messages: List[Dict[str, str]],
        *,
        max_tokens: Optional[int] = None,
        temperature: float = 0.7,
    ) -> str:
        if not self.configured:
            raise RuntimeError("DeepSeek API 未配置，请在项目根目录 .env 中设置 DEEPSEEK_API_KEY")

        url = f"{self.base_url}/v1/chat/completions"
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "model": self.model,
            "messages": messages,
            "max_tokens": max_tokens if max_tokens is not None else self.max_tokens,
            "temperature": temperature,
            "stream": False,
        }

        resp = requests.post(url, json=payload, headers=headers, timeout=self.timeout)
        if resp.status_code >= 400:
            detail = resp.text[:500]
            raise RuntimeError(f"DeepSeek 请求失败 ({resp.status_code}): {detail}")

        data = resp.json()
        choices = data.get("choices") or []
        if not choices:
            raise RuntimeError("DeepSeek 返回为空")
        message = choices[0].get("message") or {}
        content = (message.get("content") or "").strip()
        if not content:
            raise RuntimeError("DeepSeek 未返回有效文本")
        return plainize_llm_reply(content)
