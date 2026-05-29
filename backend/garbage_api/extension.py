import io
import json
import os
import sys
from datetime import datetime
from functools import wraps
from pathlib import Path

import numpy as np
import torch
import torch.nn as nn
from flask import Blueprint, current_app, jsonify, request, send_file, send_from_directory, session
from flask_sqlalchemy import SQLAlchemy
from PIL import Image as PILImage
from PIL import ImageDraw, ImageFont
from werkzeug.security import check_password_hash, generate_password_hash
from werkzeug.utils import secure_filename

import uuid

PACKAGE_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = PACKAGE_DIR.parent
ROOT = PROJECT_ROOT / "garbage_yolov5"
YOLOV5_ROOT = ROOT / "yolov5-6.0"

if str(YOLOV5_ROOT) not in sys.path:
    sys.path.insert(0, str(YOLOV5_ROOT))

from models.experimental import attempt_load  # noqa: E402
from utils.general import check_img_size, non_max_suppression  # noqa: E402
from utils.torch_utils import select_device  # noqa: E402

gc_bp = Blueprint("garbage_classification", __name__)
db = SQLAlchemy()


class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.Text)
    is_admin = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        # password_hash 为空时 werkzeug 会抛异常，表现为登录接口 500
        if password is None or not self.password_hash:
            return False
        try:
            return check_password_hash(self.password_hash, password)
        except (AttributeError, TypeError, ValueError):
            return False

    def to_dict(self):
        return {
            "id": self.id,
            "username": self.username,
            "email": self.email,
            "is_admin": self.is_admin,
            "created_at": self.created_at.isoformat() if self.created_at else "",
        }


class Image(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    filename = db.Column(db.String(255), nullable=False)
    original_path = db.Column(db.String(255), nullable=False)
    result_path = db.Column(db.String(255), nullable=True)
    result_data = db.Column(db.Text, nullable=True)
    user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    user = db.relationship("User", backref=db.backref("images", lazy=True))


class SystemLog(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    log_type = db.Column(db.String(20), nullable=False)
    message = db.Column(db.Text, nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    user = db.relationship("User", backref=db.backref("logs", lazy=True))


class DetectionHistory(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=True)
    image_path = db.Column(db.String(255), nullable=False)
    result = db.Column(db.Text, nullable=False)
    confidence = db.Column(db.Float)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)


def _compat_yolov5_upsample(model):
    for m in model.modules():
        if isinstance(m, nn.Upsample) and not hasattr(m, "recompute_scale_factor"):
            m.recompute_scale_factor = False


def load_model():
    try:
        weights = ROOT / "best.pt"
        if not weights.exists():
            weights = ROOT / "yolov5-6.0" / "runs" / "train" / "garbage_model" / "weights" / "best.pt"
        if not weights.exists():
            weights = ROOT / "yolov5-6.0" / "best.pt"

        device = select_device("")
        m = attempt_load(weights, map_location=device)
        _compat_yolov5_upsample(m)
        stride = int(m.stride.max())
        imgsz = check_img_size(640, s=stride)
        if device.type != "cpu":
            m.half()
        else:
            m.float()
        w = torch.zeros(1, 3, imgsz, imgsz).to(device).type_as(next(m.parameters()))
        m(w)
        print(f"[garbage_api] YOLOv5 模型加载成功: {weights}")
        return m, device, imgsz, stride
    except Exception as e:
        print(f"[garbage_api] 加载 YOLOv5 模型出错: {e}")
        return None, None, None, None


model, device, imgsz, stride = load_model()
class_names = ["可回收", "有害", "厨余", "其他"]


def allowed_file(filename):
    allowed = current_app.config.get("GARBAGE_ALLOWED_EXTENSIONS") or {"png", "jpg", "jpeg"}
    return "." in filename and filename.rsplit(".", 1)[1].lower() in allowed


def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if "user_id" not in session:
            return jsonify({"status": "error", "message": "请先登录"}), 401
        return f(*args, **kwargs)

    return decorated_function


def admin_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if "user_id" not in session:
            return jsonify({"status": "error", "message": "请先登录"}), 401
        user = db.session.get(User, session["user_id"])
        if not user or not user.is_admin:
            return jsonify({"status": "error", "message": "需要管理员权限"}), 403
        return f(*args, **kwargs)

    return decorated_function


def log_action(log_type, message, user_id=None):
    try:
        log = SystemLog(log_type=log_type, message=message, user_id=user_id)
        db.session.add(log)
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        try:
            current_app.logger.warning("log_action failed: %s", e)
        except Exception:
            print(f"[garbage_api] log_action failed: {e}")


def parse_request_json_dict():
    data = request.get_json(silent=True)
    if data is None:
        data = request.get_json(silent=True, force=True)
    if data is None or not isinstance(data, dict):
        return None
    return data


def detect_garbage_image(img_bytes):
    if model is None or device is None:
        try:
            pil = PILImage.open(io.BytesIO(img_bytes)).convert("RGB")
            return [], pil.copy()
        except Exception:
            return [], None

    img = PILImage.open(io.BytesIO(img_bytes)).convert("RGB")
    img_size = imgsz
    img = img.resize((img_size, img_size), PILImage.LANCZOS)
    img_array = np.array(img)
    img_tensor = torch.from_numpy(img_array.transpose(2, 0, 1)).to(device)
    img_tensor = img_tensor.type_as(next(model.parameters())) / 255.0
    if img_tensor.ndimension() == 3:
        img_tensor = img_tensor.unsqueeze(0)

    with torch.no_grad():
        pred = model(img_tensor, augment=False)[0]

    pred = non_max_suppression(pred, 0.1, 0.45, None, False, max_det=1000)
    display_img = PILImage.open(io.BytesIO(img_bytes)).convert("RGB")
    result_img_pil = display_img.copy()
    draw = ImageDraw.Draw(result_img_pil)

    try:
        font_path = "C:/Windows/Fonts/simhei.ttf"
        if not os.path.exists(font_path):
            font_path = "C:/Windows/Fonts/simsun.ttc"
        if not os.path.exists(font_path):
            font_path = "C:/Windows/Fonts/simkai.ttf"
        font = ImageFont.truetype(font_path, 16)
    except Exception:
        font = ImageFont.load_default()

    results = []
    display_array = np.array(display_img)

    for det in pred:
        if len(det):
            det_scaled = det.clone()
            scale_factor = [
                display_array.shape[1] / img_size,
                display_array.shape[0] / img_size,
                display_array.shape[1] / img_size,
                display_array.shape[0] / img_size,
                1,
                1,
            ]
            det_scaled[:, :4] = det_scaled[:, :4] * torch.tensor(scale_factor[:4], device=det.device)
            for *xyxy, conf, cls in reversed(det_scaled):
                c = int(cls)
                x1, y1, x2, y2 = [int(x) for x in xyxy]
                if c == 0:
                    color = (0, 200, 0)
                elif c == 1:
                    color = (255, 0, 0)
                elif c == 2:
                    color = (255, 165, 0)
                else:
                    color = (128, 128, 128)
                draw.rectangle([(x1, y1), (x2, y2)], outline=color, width=2)
                label = f"{class_names[c]} {conf:.2f}"
                label_size = draw.textbbox((0, 0), label, font=font)[2:]
                if y1 - label_size[1] - 5 > 0:
                    text_origin = (x1, y1 - label_size[1] - 5)
                else:
                    text_origin = (x1, y1 + 5)
                draw.rectangle(
                    [
                        text_origin[0],
                        text_origin[1],
                        text_origin[0] + label_size[0],
                        text_origin[1] + label_size[1],
                    ],
                    fill=color,
                )
                draw.text(text_origin, label, fill=(255, 255, 255), font=font)
                results.append(
                    {
                        "class": c,
                        "class_name": class_names[c],
                        "confidence": float(conf),
                        "bbox": [float(x) for x in xyxy],
                    }
                )

    return results, result_img_pil


@gc_bp.route("/api/register", methods=["POST"])
def register():
    data = parse_request_json_dict()
    if data is None:
        return (
            jsonify(
                {
                    "status": "error",
                    "message": "请使用 JSON 提交 username、email、password（Content-Type: application/json）",
                }
            ),
            400,
        )
    if not all(field in data for field in ["username", "email", "password"]):
        return jsonify({"status": "error", "message": "缺少必要字段"}), 400
    if User.query.filter_by(username=data["username"]).first():
        return jsonify({"status": "error", "message": "用户名已存在"}), 400
    if User.query.filter_by(email=data["email"]).first():
        return jsonify({"status": "error", "message": "邮箱已被注册"}), 400
    user = User(username=data["username"], email=data["email"])
    user.set_password(data["password"])
    if User.query.count() == 0:
        user.is_admin = True
    db.session.add(user)
    try:
        db.session.commit()
        log_action("user_action", f'用户注册: {data["username"]}')
        return jsonify({"status": "success", "message": "注册成功", "user": user.to_dict()}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({"status": "error", "message": f"注册失败: {str(e)}"}), 500


@gc_bp.route("/api/login", methods=["POST"])
def login():
    data = parse_request_json_dict()
    if data is None:
        return jsonify({"status": "error", "message": "请使用 JSON 提交用户名与密码"}), 400
    if not all(field in data for field in ["username", "password"]):
        return jsonify({"status": "error", "message": "缺少必要字段"}), 400
    user = User.query.filter_by(username=data["username"]).first()
    if user and user.check_password(data["password"]):
        session["user_id"] = user.id
        log_action("user_action", f"用户登录: {user.username}", user.id)
        return jsonify({"status": "success", "message": "登录成功", "user": user.to_dict()}), 200
    return jsonify({"status": "error", "message": "用户名或密码错误"}), 401


@gc_bp.route("/api/logout", methods=["POST"])
def logout():
    user_id = session.get("user_id")
    user = db.session.get(User, user_id) if user_id else None
    if user:
        log_action("user_action", f"用户登出: {user.username}", user_id)
    session.pop("user_id", None)
    return jsonify({"status": "success", "message": "注销成功"}), 200


@gc_bp.route("/api/detect", methods=["POST"])
@login_required
def detect():
    if "file" not in request.files:
        return jsonify({"status": "error", "message": "没有文件"}), 400
    file = request.files["file"]
    if file.filename == "":
        return jsonify({"status": "error", "message": "没有选择文件"}), 400
    if not allowed_file(file.filename):
        exts = ", ".join(current_app.config.get("GARBAGE_ALLOWED_EXTENSIONS") or {"png", "jpg", "jpeg"})
        return jsonify({"status": "error", "message": f"只支持 {exts} 格式图像"}), 400

    upload_root = current_app.config["GARBAGE_UPLOAD_FOLDER"]
    try:
        file_bytes = file.read()
        filename = secure_filename(file.filename)
        unique_id = uuid.uuid4().hex
        unique_filename = f"{unique_id}_{filename}"
        file_path = os.path.join(upload_root, unique_filename)
        with open(file_path, "wb") as f:
            f.write(file_bytes)

        results, result_img = detect_garbage_image(file_bytes)
        if result_img is None:
            result_img = PILImage.open(io.BytesIO(file_bytes)).convert("RGB")

        result_path = os.path.join(upload_root, "results", f"{unique_id}_result.jpg")
        result_img.save(result_path)

        result_json = json.dumps(results) if results else "[]"
        image_row = Image(
            filename=unique_filename,
            original_path=file_path,
            result_path=result_path,
            result_data=result_json,
            user_id=session["user_id"],
        )
        db.session.add(image_row)
        confidence = max([item.get("confidence", 0) for item in results]) if results else 0
        history = DetectionHistory(
            user_id=session["user_id"],
            image_path=file_path,
            result=result_json,
            confidence=confidence,
        )
        db.session.add(history)
        db.session.commit()

        log_action("user_action", f"垃圾识别: {len(results)} 个物品", session["user_id"])

        return (
            jsonify(
                {
                    "status": "success",
                    "image_id": image_row.id,
                    "results": results,
                    "original_url": f"/api/images/{image_row.id}/original",
                    "result_url": f"/api/images/{image_row.id}/result",
                    "history_id": history.id,
                    "message": (
                        "模型未加载，已保存原图（请检查服务端日志与 garbage_yolov5 下 best.pt 路径）"
                        if model is None or device is None
                        else ("识别完成" if results else "未检测到垃圾物品")
                    ),
                }
            ),
            200,
        )
    except Exception as e:
        log_action("error", f"识别错误: {str(e)}", session.get("user_id"))
        return jsonify({"status": "error", "message": f"处理图像时出错: {str(e)}"}), 500


@gc_bp.route("/api/images/<int:image_id>/original")
@login_required
def get_original_image(image_id):
    image_row = Image.query.get_or_404(image_id)
    viewer = db.session.get(User, session["user_id"])
    if image_row.user_id != session["user_id"] and not (viewer and viewer.is_admin):
        return jsonify({"status": "error", "message": "无权访问此图像"}), 403
    return send_file(image_row.original_path)


@gc_bp.route("/api/images/<int:image_id>/result")
@login_required
def get_result_image(image_id):
    image_row = Image.query.get_or_404(image_id)
    viewer = db.session.get(User, session["user_id"])
    if image_row.user_id != session["user_id"] and not (viewer and viewer.is_admin):
        return jsonify({"status": "error", "message": "无权访问此图像"}), 403
    return send_file(image_row.result_path)


@gc_bp.route("/api/admin/users")
@admin_required
def list_users():
    users = User.query.all()
    return jsonify({"status": "success", "users": [u.to_dict() for u in users]}), 200


@gc_bp.route("/api/admin/logs")
@admin_required
def list_logs():
    page = request.args.get("page", 1, type=int)
    per_page = request.args.get("per_page", 20, type=int)
    logs_query = SystemLog.query.order_by(SystemLog.created_at.desc())
    pagination = logs_query.paginate(page=page, per_page=per_page, error_out=False)
    logs = []
    for log in pagination.items:
        log_dict = {
            "id": log.id,
            "log_type": log.log_type,
            "message": log.message,
            "user_id": log.user_id,
            "created_at": log.created_at.isoformat(),
        }
        if log.user_id:
            u = db.session.get(User, log.user_id)
            if u:
                log_dict["username"] = u.username
        logs.append(log_dict)
    return jsonify(
        {
            "status": "success",
            "logs": logs,
            "total": pagination.total,
            "pages": pagination.pages,
            "current_page": page,
        }
    ), 200


@gc_bp.route("/api/admin/stats")
@admin_required
def get_stats():
    total_users = User.query.count()
    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    new_users_today = User.query.filter(User.created_at >= today_start).count()
    total_images = Image.query.count()
    images_today = Image.query.filter(Image.created_at >= today_start).count()
    class_counts = {name: 0 for name in class_names}
    for image_row in Image.query.all():
        if image_row.result_data:
            try:
                parsed = json.loads(image_row.result_data)
                for result in parsed:
                    cn = result.get("class_name")
                    if cn in class_counts:
                        class_counts[cn] += 1
            except Exception:
                pass
    return jsonify(
        {
            "status": "success",
            "users": {"total": total_users, "new_today": new_users_today},
            "images": {"total": total_images, "new_today": images_today},
            "classes": class_counts,
        }
    )


@gc_bp.route("/api/user/profile")
@login_required
def get_user_profile():
    user = db.session.get(User, session["user_id"])
    if not user:
        return jsonify({"status": "error", "message": "用户不存在"}), 404
    return jsonify({"status": "success", "user": user.to_dict()}), 200


@gc_bp.route("/api/user/change-password", methods=["POST"])
@login_required
def change_password():
    data = parse_request_json_dict()
    if data is None:
        return jsonify({"status": "error", "message": "请使用 JSON 提交 old_password、new_password"}), 400
    if not all(field in data for field in ["old_password", "new_password"]):
        return jsonify({"status": "error", "message": "缺少必要字段"}), 400
    user = db.session.get(User, session["user_id"])
    if not user.check_password(data["old_password"]):
        return jsonify({"status": "error", "message": "旧密码不正确"}), 401
    user.set_password(data["new_password"])
    db.session.commit()
    log_action("user_action", "用户修改密码", user.id)
    return jsonify({"status": "success", "message": "密码已更新"}), 200


@gc_bp.route("/api/user/history")
@login_required
def get_user_history():
    page = request.args.get("page", 1, type=int)
    per_page = request.args.get("per_page", 10, type=int)
    history_query = Image.query.filter_by(user_id=session["user_id"]).order_by(Image.created_at.desc())
    pagination = history_query.paginate(page=page, per_page=per_page, error_out=False)
    history_list = []
    for image_row in pagination.items:
        try:
            results = json.loads(image_row.result_data) if image_row.result_data else []
            history_list.append(
                {
                    "id": image_row.id,
                    "filename": image_row.filename,
                    "results": results,
                    "created_at": image_row.created_at.isoformat(),
                    "original_url": f"/api/images/{image_row.id}/original",
                    "result_url": f"/api/images/{image_row.id}/result",
                }
            )
        except Exception:
            pass
    return jsonify(
        {
            "status": "success",
            "history": history_list,
            "total": pagination.total,
            "pages": pagination.pages,
            "current_page": page,
        }
    ), 200


@gc_bp.route("/api/user", methods=["GET"])
def get_user():
    user_id = session.get("user_id")
    if not user_id:
        return jsonify({"status": "error", "message": "未登录"}), 401
    user = db.session.get(User, user_id)
    if not user:
        session.pop("user_id", None)
        return jsonify({"status": "error", "message": "用户不存在"}), 404
    return jsonify({"status": "success", "user": user.to_dict()}), 200


@gc_bp.route("/gc-uploads/<path:filename>")
def uploaded_file(filename):
    root = current_app.config["GARBAGE_UPLOAD_FOLDER"]
    return send_from_directory(root, filename)


def init_garbage_api(app):
    instance_dir = PROJECT_ROOT / "instance"
    instance_dir.mkdir(parents=True, exist_ok=True)
    db_file = instance_dir / "garbage_classification.db"
    app.config.setdefault(
        "SQLALCHEMY_DATABASE_URI",
        os.environ.get("DATABASE_URL") or ("sqlite:///" + db_file.resolve().as_posix()),
    )
    app.config.setdefault("SQLALCHEMY_TRACK_MODIFICATIONS", False)
    upload = str(PROJECT_ROOT / "uploads" / "garbage")
    app.config.setdefault("GARBAGE_UPLOAD_FOLDER", upload)
    app.config.setdefault("GARBAGE_ALLOWED_EXTENSIONS", {"png", "jpg", "jpeg"})
    app.config.setdefault("SESSION_COOKIE_SAMESITE", "Lax")
    app.config.setdefault("SESSION_COOKIE_HTTPONLY", True)
    app.config.setdefault(
        "SESSION_COOKIE_SECURE", os.environ.get("SESSION_COOKIE_SECURE", "").lower() in ("1", "true", "yes")
    )

    os.makedirs(app.config["GARBAGE_UPLOAD_FOLDER"], exist_ok=True)
    os.makedirs(os.path.join(app.config["GARBAGE_UPLOAD_FOLDER"], "results"), exist_ok=True)

    db.init_app(app)
    app.register_blueprint(gc_bp)

    with app.app_context():
        db.create_all()
        admin = User.query.filter_by(username="admin").first()
        if not admin:
            admin = User(username="admin", email="admin@example.com", is_admin=True)
            admin.set_password("admin123")
            db.session.add(admin)
            db.session.commit()
