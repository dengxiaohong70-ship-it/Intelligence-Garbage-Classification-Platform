import json
from functools import wraps
from typing import Dict, List, Optional

from flask import Blueprint, current_app, jsonify, request, session

from .deepseek_client import DEFAULT_SYSTEM_PROMPT, DeepSeekClient

llm_bp = Blueprint("llm_api", __name__)
_client = None


def _get_client() -> DeepSeekClient:
    global _client
    if _client is None:
        _client = DeepSeekClient()
    return _client


def login_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if "user_id" not in session:
            return jsonify({"status": "error", "message": "请先登录"}), 401
        return f(*args, **kwargs)

    return decorated


def _parse_json_body():
    data = request.get_json(silent=True)
    if data is None or not isinstance(data, dict):
        return None
    return data


def _build_messages(user_messages: list, system_prompt: Optional[str] = None) -> List[Dict[str, str]]:
    messages: List[Dict[str, str]] = [
        {"role": "system", "content": system_prompt or DEFAULT_SYSTEM_PROMPT},
    ]
    for item in user_messages:
        if not isinstance(item, dict):
            continue
        role = (item.get("role") or "user").strip()
        content = (item.get("content") or "").strip()
        if role in ("user", "assistant") and content:
            messages.append({"role": role, "content": content})
    return messages


@llm_bp.route("/api/llm/status", methods=["GET"])
def llm_status():
    client = _get_client()
    return jsonify(
        {
            "status": "success",
            "configured": client.configured,
            "model": client.model if client.configured else None,
        }
    )


@llm_bp.route("/api/llm/chat", methods=["POST"])
@login_required
def llm_chat():
    data = _parse_json_body()
    if data is None:
        return jsonify({"status": "error", "message": "请使用 JSON 提交 messages"}), 400

    raw_messages = data.get("messages")
    if not isinstance(raw_messages, list) or not raw_messages:
        return jsonify({"status": "error", "message": "messages 不能为空"}), 400

    client = _get_client()
    if not client.configured:
        return jsonify({"status": "error", "message": "LLM 未配置，请在后端 .env 设置 DEEPSEEK_API_KEY"}), 503

    try:
        messages = _build_messages(raw_messages, data.get("system_prompt"))
        reply = client.chat(messages)
        return jsonify({"status": "success", "reply": reply, "model": client.model})
    except Exception as exc:
        current_app.logger.exception("DeepSeek chat failed")
        return jsonify({"status": "error", "message": str(exc)}), 502


@llm_bp.route("/api/llm/explain-detection", methods=["POST"])
@login_required
def llm_explain_detection():
    """根据 YOLOv5 检测结果生成简短投放建议（轻量 LLM 场景）。"""
    data = _parse_json_body()
    if data is None:
        return jsonify({"status": "error", "message": "请使用 JSON 提交 results"}), 400

    results = data.get("results")
    if not isinstance(results, list):
        return jsonify({"status": "error", "message": "results 应为数组"}), 400

    client = _get_client()
    if not client.configured:
        return jsonify({"status": "error", "message": "LLM 未配置，请在后端 .env 设置 DEEPSEEK_API_KEY"}), 503

    summary = data.get("message") or ""
    detect_json = json.dumps(results, ensure_ascii=False)
    user_prompt = (
        "以下是生活垃圾图像检测 JSON 结果，请用 3～5 句中文说明："
        "①识别到了什么；②应投入哪类垃圾桶；③一句环保提示。"
        f"\n检测摘要：{summary or '无'}"
        f"\n检测明细：{detect_json}"
    )

    try:
        messages = _build_messages([{"role": "user", "content": user_prompt}])
        reply = client.chat(messages, max_tokens=320, temperature=0.5)
        return jsonify({"status": "success", "reply": reply, "model": client.model})
    except Exception as exc:
        current_app.logger.exception("DeepSeek explain-detection failed")
        return jsonify({"status": "error", "message": str(exc)}), 502


def init_llm_api(app):
    app.register_blueprint(llm_bp)
