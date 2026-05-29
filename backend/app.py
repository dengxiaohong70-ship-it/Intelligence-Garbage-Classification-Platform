import math
import os
import traceback
from pathlib import Path

import cv2
import numpy as np
from dotenv import load_dotenv
from flask import Flask, Response, abort, jsonify, render_template, request, send_from_directory, url_for
from flask_cors import CORS
from werkzeug.utils import secure_filename

from garbage_api import init_garbage_api
from llm_api import init_llm_api
from waste_classifier import EnhancedWasteClassifier

PROJECT_ROOT = Path(__file__).resolve().parent
REPO_ROOT = PROJECT_ROOT.parent
load_dotenv(REPO_ROOT / ".env")
FRONTEND_BUILD = REPO_ROOT / "frontend" / "build"

app = Flask(
    __name__,
    static_folder=str(PROJECT_ROOT / "eco_static"),
    static_url_path="/eco_static",
)
app.config["UPLOAD_FOLDER"] = str(PROJECT_ROOT / "uploads")
app.config["SECRET_KEY"] = os.environ.get("SECRET_KEY") or "dev-ecovision-secret-change-me"
app.config["MAX_CONTENT_LENGTH"] = 16 * 1024 * 1024

_default_origins = (
    "http://127.0.0.1:3000,http://localhost:3000,"
    "http://127.0.0.1:4173,http://localhost:4173,"
    "http://127.0.0.1:5173,http://localhost:5173"
)
FRONTEND_ORIGINS = [x.strip() for x in os.environ.get("FRONTEND_ORIGINS", _default_origins).split(",") if x.strip()]
CORS(
    app,
    origins=FRONTEND_ORIGINS,
    supports_credentials=True,
    allow_headers=["Content-Type", "Authorization", "X-Requested-With"],
    methods=["GET", "HEAD", "POST", "OPTIONS", "PUT", "PATCH", "DELETE"],
)

os.makedirs(app.config["UPLOAD_FOLDER"], exist_ok=True)
os.makedirs(PROJECT_ROOT / "eco_static", exist_ok=True)

model_path = PROJECT_ROOT / "model" / "best.pt"
classifier = EnhancedWasteClassifier(str(model_path) if model_path.exists() else None)

init_garbage_api(app)
init_llm_api(app)


@app.route("/legacy/")
def legacy_home():
    return render_template("index.html")


@app.route("/legacy/upload", methods=["GET", "POST"])
def legacy_upload():
    if request.method == "POST":
        file = request.files.get("file")
        if file:
            filename = secure_filename(file.filename)
            filepath = os.path.join(app.config["UPLOAD_FOLDER"], filename)
            file.save(filepath)
            img = _cv_imread_unicode(filepath)
            if img is None:
                abort(400)
            detections = classifier.detect_and_classify_from_frame(img)
            img = classifier.draw_detections(img, detections)
            overall = classifier.get_overall_classification(detections)
            processed_filename = "processed_" + filename
            processed_path = PROJECT_ROOT / "eco_static" / processed_filename
            _cv_imwrite_unicode(str(processed_path), img)
            return render_template(
                "result.html",
                image_url=url_for("static", filename=processed_filename),
                detections=detections,
                overall=overall,
            )
    return render_template("upload.html")


@app.route("/legacy/video")
def legacy_video():
    return render_template("video.html")


def _cv_imread_unicode(path):
    """Windows 下 cv2.imread 对含中文路径常返回 None，改用 np.fromfile + imdecode。"""
    try:
        data = np.fromfile(path, dtype=np.uint8)
        if data.size == 0:
            return None
        return cv2.imdecode(data, cv2.IMREAD_COLOR)
    except OSError:
        return None


def _cv_imwrite_unicode(path, img):
    """Windows 下 cv2.imwrite 对含中文路径易失败，使用 imencode + tofile。"""
    if img is None:
        return False
    p = Path(path)
    p.parent.mkdir(parents=True, exist_ok=True)
    ext = p.suffix.lower() or ".jpg"
    ok, buf = cv2.imencode(ext, img)
    if not ok:
        return False
    try:
        buf.tofile(str(p))
        return True
    except OSError:
        return False


def _safe_json_float(val, default=0.0):
    try:
        x = float(val)
        if not math.isfinite(x):
            return default
        return x
    except (TypeError, ValueError):
        return default


def _eco_serializable_detections(detections):
    out = []
    for d in detections or []:
        cn = d.get("class_name")
        out.append(
            {
                "class_name": str(cn) if cn is not None else "",
                "category": str(d.get("category") or ""),
                "confidence": _safe_json_float(d.get("confidence"), 0.0),
                "bbox": [_safe_json_float(x, 0.0) for x in (d.get("bbox") or [])],
            }
        )
    return out


@app.route("/api/eco/upload", methods=["POST"])
def eco_upload_api():
    """EcoVision（YOLOv8）：上传静态图像并返回检测结果 JSON，供统一前端展示。"""
    try:
        file = request.files.get("file")
        if not file or file.filename == "":
            return jsonify({"success": False, "message": "没有选择文件"}), 400
        filename = secure_filename(file.filename or "")
        if not filename:
            filename = "upload.jpg"
        filepath = os.path.join(app.config["UPLOAD_FOLDER"], filename)
        file.save(filepath)
        img = _cv_imread_unicode(filepath)
        if img is None:
            return jsonify({"success": False, "message": "无法解码图像（路径或文件可能损坏）"}), 400
        # 项目在含中文的路径下时，勿把磁盘路径传给 YOLO（Windows 下易 500）；在内存 ndarray 上推理
        detections = classifier.detect_and_classify_from_frame(img)
        img = classifier.draw_detections(img, detections)
        overall = classifier.get_overall_classification(detections)
        processed_filename = "processed_" + filename
        processed_path = PROJECT_ROOT / "eco_static" / processed_filename
        if not _cv_imwrite_unicode(str(processed_path), img):
            return jsonify({"success": False, "message": "无法保存标注结果图"}), 500
        image_url = url_for("static", filename=processed_filename)
        payload = {
            "success": True,
            "detections": _eco_serializable_detections(detections),
            "overall": str(overall) if overall is not None else "",
            "image_url": image_url,
        }
        return jsonify(payload)
    except Exception as e:
        app.logger.exception("api/eco/upload")
        tb = traceback.format_exc()
        return jsonify(
            {"success": False, "message": str(e) or "服务器处理图像失败", "traceback": tb if app.debug else None}
        ), 500


def gen():
    cap = cv2.VideoCapture(0)
    while True:
        ret, frame = cap.read()
        if not ret:
            break
        detections = classifier.detect_and_classify_from_frame(frame)
        frame = classifier.draw_detections(frame, detections)
        ok, buffer = cv2.imencode(".jpg", frame)
        if not ok:
            continue
        frame_bytes = buffer.tobytes()
        yield (b"--frame\r\n" b"Content-Type: image/jpeg\r\n\r\n" + frame_bytes + b"\r\n")


@app.route("/video_feed")
def video_feed():
    return Response(gen(), mimetype="multipart/x-mixed-replace; boundary=frame")


@app.route("/static/<path:filename>")
def spa_static(filename):
    """React build 资源位于 frontend/build/static，避免与 EcoVision 标注目录冲突。"""
    folder = FRONTEND_BUILD / "static"
    if not folder.is_dir():
        abort(404)
    return send_from_directory(folder, filename)


@app.route("/", defaults={"path": ""})
@app.route("/<path:path>")
def serve_frontend(path):
    if path.startswith("api/") or path == "video_feed":
        return jsonify({"error": "Not found"}), 404

    if FRONTEND_BUILD.is_dir():
        target = FRONTEND_BUILD / path
        if path and target.is_file():
            return send_from_directory(FRONTEND_BUILD, path)
        index_file = FRONTEND_BUILD / "index.html"
        if index_file.is_file():
            return send_from_directory(FRONTEND_BUILD, "index.html")

    return render_template("index.html")


if __name__ == "__main__":
    # Windows + YOLO/torch 在 debug 子进程重载时易二次加载失败，关闭 reloader 更稳
    app.run(debug=True, use_reloader=False)
