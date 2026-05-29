# EcoVision AI · 一体化垃圾感知平台

将 **EcoVision（YOLOv8 实时视频 / 静态图像）** 与 **YOLOv5 四类生活垃圾分类（登录、历史、管理后台）** 合并到同一仓库：**单一 Flask 后端**（`app.py`）**+** **单一 React 前端**（`frontend/`），便于课堂上演示两条检测链路。

YOLOv5 侧能力与原「垃圾分类单体项目」对应关系：识别四类垃圾（可回收、有害、厨余、其它）、账号体系、上传检测、历史与管理员功能；实现已迁入 `garbage_api/`、`garbage_yolov5/` 与 `frontend/`，不再依赖旧目录内的独立 Flask/React 路径。

---

## 目录结构（前端 / 后端分离）

```
ecovision-ai-main/
├── backend/                    # —— 后端（Python / Flask）——
│   ├── app.py                  # 统一后端入口：EcoVision 视频流 + 路由 + SPA 托管
│   ├── waste_classifier.py     # 视频检测：YOLOv8 + 干湿有害映射
│   ├── garbage_api/            # 照片检测：YOLOv5 四类 + 会话/数据库/REST
│   ├── llm_api/                # DeepSeek 轻量 LLM（/api/llm/*）
│   ├── garbage_yolov5/         # YOLOv5 源码（yolov5-6.0）、garbage.yaml、best.pt
│   ├── model/                  # EcoVision 可选自定义权重 model/best.pt
│   ├── templates/              # 旧版 HTML 页面（/legacy/*）
│   ├── eco_static/             # 服务端标注图 + 投放演练图 garbage/{4类}/1~3.jpg
│   ├── uploads/                # 上传缓存；uploads/garbage/ 为 YOLOv5 上传
│   ├── instance/               # SQLite（garbage_classification.db）
│   ├── training/               # YOLOv8 训练脚本
│   ├── scripts/                # 工具脚本（生成轮播占位图等）
│   ├── train_waste_model.py    # 训练入口包装
│   └── yolov8n.pt              # YOLOv8 预训练权重（视频检测默认）
├── frontend/                   # —— 前端（React）——开发代理 → 5000
├── datasets/                   # 训练数据集（wangy：四类生活垃圾，YOLO 格式）
├── docs/                       # 项目设计说明等文档
├── requirements.txt            # 后端 Python 依赖
├── run_backend.bat             # Windows：进入 backend 启动 Flask
├── run_frontend.bat            # Windows：进入 frontend 启动 React
├── .env / .env.example         # DeepSeek 等密钥配置（.env 不提交）
└── README.md
```

> **两大检测模块都在 `backend/`：** 视频检测 = `waste_classifier.py`（YOLOv8）；照片检测 = `garbage_api/`（YOLOv5）。前端统一在 `frontend/`。

---

## 技术栈（摘要）

| 层级 | 技术 |
|------|------|
| 前端 | React 18、React Router、Bootstrap 5、Axios |
| 后端 | Flask、Flask-SQLAlchemy、Flask-CORS、Werkzeug |
| EcoVision | YOLOv8（Ultralytics）、OpenCV |
| 垃圾分类 | YOLOv5（`garbage_yolov5/`）、PyTorch |

环境要求：**Python 3.8+**（以本机已成功运行版本为准）、**Node.js 14+**；GPU / CUDA 可选。

### DeepSeek 轻量 LLM（可选）

1. 复制 `.env.example` 为 `.env`（放在仓库根目录），填入 `DEEPSEEK_API_KEY`（**勿提交 Git**）。
2. 重启后端（`cd backend && python app.py`）。
3. 前端导航 **「Eco 助手」**（`/assistant`）可问答；识别工作台检测后可点 **「AI 解读投放建议」**。

默认模型 `deepseek-chat`，可在 `.env` 调整 `DEEPSEEK_MODEL`、`DEEPSEEK_MAX_TOKENS`。

---

## 环境与依赖（统一安装）

在项目根目录执行：

```bash
pip install -r requirements.txt
cd frontend
npm install
```

YOLO 相关重型依赖已由根目录 `requirements.txt` 覆盖；无需再按旧子项目文档到多个目录单独 `pip install`（除非你做独立实验）。

---

## 开发与演示（推荐）

需**同时**跑后端与前端的开发模式：

1. **终端 A（后端）**：`cd backend && python app.py` → 默认 **http://127.0.0.1:5000**
2. **终端 B（前端）**：`cd frontend && npm start` → 默认 **http://localhost:3000**，API 通过 `package.json` 里的 **`proxy`** 转发到 **5000**

浏览器打开 **http://localhost:3000** 使用一体化界面。**若控制台出现代理 `ECONNREFUSED`**，多半是 **5000 上未启动后端**，请先 `cd backend && python app.py` 再刷新页面。

也可用 Windows 脚本：`run_backend.bat`、`run_frontend.bat`。

### 投放场景演练（图片轮播）

前端路由 **`/scenario-carousel`**：按方案轮播四类演示图，每张图与「识别工作台」相同，自动调用 **`POST /api/detect`**（YOLOv5 四类生活垃圾模型，需登录会话）；用户点选四色垃圾桶即可判定投放是否正确。语音为浏览器 **Web Speech**：若无声请先点击页内 **「试听语音」** 以通过浏览器交互策略。

演示图目录：**`backend/eco_static/garbage/`**（每类 `1.jpg`～`3.jpg`）。若为空，可执行：

```bash
cd backend
python scripts/generate_carousel_placeholders.py
```

生成占位图后也可自行替换为真实垃圾照片以提升检测效果。

---

## 仅后端 + 打包前端（无外置 Node）

```bash
cd frontend
npm run build
cd ../backend
python app.py
```

浏览器访问 **http://127.0.0.1:5000/** ，由 Flask 托管 `frontend/build`。

---

## 主要路由说明

| 能力 | 说明 |
|------|------|
| `/video_feed` | EcoVision MJPEG 实时流（摄像头） |
| `POST /api/eco/upload` | EcoVision 静态图 JSON 接口 |
| `/api/login`、`POST /api/detect` 等 | YOLOv5 垃圾分类（需登录）；默认管理员见下 |
| `POST /api/llm/chat`、`POST /api/llm/explain-detection` | DeepSeek 轻量 LLM（需登录；密钥见 `.env`） |
| `/legacy/`、`/legacy/upload`、`/legacy/video` | 最早的 HTML + Jinja 演示（兼容备份） |

---

## 默认账户（垃圾分类子系统）

- 用户名：**admin**
- 密码：**admin123**

数据库为 **`backend/instance/garbage_classification.db`**（SQLite）。主要实体：用户、上传图像、系统日志、检测历史（详见 `backend/garbage_api/extension.py` 中模型）。

---

## YOLOv5：独立检测与训练（可选）

权重默认放在 **`backend/garbage_yolov5/best.pt`**（或源码内备选路径）；服务启动时在日志中可查实际加载路径。

**命令行检测示例**：

```bash
cd backend/garbage_yolov5/yolov5-6.0
python detect.py --weights ../best.pt --source <图片路径> --img 640 --conf 0.25
```

**训练示例**（数据集已统一放在仓库根目录 **`datasets/wangy`**，配置见 **`backend/garbage_yolov5/garbage.yaml`**）：

```bash
cd backend/garbage_yolov5/yolov5-6.0
python train.py --img 640 --batch 16 --epochs 100 --data ../garbage.yaml --weights yolov5s.pt
```

---

## 更深入文档

- 架构与设计：**[docs/项目设计说明.md](docs/项目设计说明.md)**

---

## 许可证

MIT（与原项目保持一致）。
