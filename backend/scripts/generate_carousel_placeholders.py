"""
生成投放演练轮播用占位图（640x480 JPEG），写入 eco_static/garbage/{recyclable,kitchen,harmful,other}/1~3.jpg。
运行：在 backend 目录执行  python scripts/generate_carousel_placeholders.py
"""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / "eco_static" / "garbage"

LABELS = {
    "kitchen": [("厨余演示 1", "#2d5016"), ("厨余演示 2", "#4a7c23"), ("厨余演示 3", "#63a629")],
    "recyclable": [("可回收 1", "#1e5790"), ("可回收 2", "#2078b8"), ("可回收 3", "#298fce")],
    "harmful": [("有害演示 1", "#8b0000"), ("有害演示 2", "#c41e3a"), ("有害演示 3", "#dc143c")],
    "other": [("其它 1", "#444444"), ("其它 2", "#666666"), ("其它 3", "#888888")],
}


def main():
    for folder, items in LABELS.items():
        d = DEST / folder
        d.mkdir(parents=True, exist_ok=True)
        for idx, (text, bg) in enumerate(items, start=1):
            img = Image.new("RGB", (640, 480), bg)
            dr = ImageDraw.Draw(img)
            dr.rectangle([40, 40, 600, 440], outline="#ffffff", width=4)
            try:
                font = ImageFont.truetype("C:/Windows/Fonts/msyh.ttc", 36)
            except OSError:
                try:
                    font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 36)
                except OSError:
                    font = ImageFont.load_default()
            dr.text((80, 210), text, fill="#ffffff", font=font)
            out = d / f"{idx}.jpg"
            img.save(out, quality=88)
            print("wrote", out.relative_to(ROOT))


if __name__ == "__main__":
    main()
