# -*- coding: utf-8 -*-
"""
将 archive（Household Trash 30 类 YOLO）映射为 4 类，合并进 datasets/wangy。

用法（仓库根目录）：
  python backend/scripts/merge_archive_to_wangy.py

映射规则（30 -> 4，与 garbage.yaml 一致）：
  0 可回收物：Tin can, Bottle
  1 有害垃圾：Light bulb
  2 厨余垃圾：各类食物/零食/快餐等
  3 其他垃圾：纸巾、塑料袋、牙刷、吸管等
"""
from __future__ import annotations

import random
import shutil
from collections import Counter, defaultdict
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
WANGY = REPO / "datasets" / "wangy"
ARCHIVE = REPO / "archive"
GARBAGE_YAML = REPO / "backend" / "garbage_yolov5" / "garbage.yaml"

ARCHIVE_CLASS_TO_4 = {
    0: 2,
    1: 2,
    2: 2,
    3: 2,
    4: 2,
    5: 2,
    6: 2,
    7: 2,
    8: 2,
    9: 2,
    10: 2,
    11: 2,
    12: 2,
    13: 2,
    14: 0,
    15: 0,
    16: 3,
    17: 3,
    18: 3,
    19: 2,
    20: 2,
    21: 3,
    22: 2,
    23: 1,
    24: 3,
    25: 3,
    26: 3,
    27: 2,
    28: 2,
    29: 2,
}

CLASS_NAMES = ["可回收物", "有害垃圾", "厨余垃圾", "其他垃圾"]


def remap_label_lines(text: str) -> str:
    out = []
    for line in text.splitlines():
        line = line.strip()
        if not line:
            continue
        parts = line.split()
        if len(parts) < 5:
            continue
        old_cls = int(float(parts[0]))
        new_cls = ARCHIVE_CLASS_TO_4.get(old_cls)
        if new_cls is None:
            raise ValueError(f"未映射的 archive 类别 id: {old_cls}")
        parts[0] = str(new_cls)
        out.append(" ".join(parts))
    return "\n".join(out) + ("\n" if out else "")


def ensure_dirs():
    for split in ("train", "val"):
        (WANGY / "images" / split).mkdir(parents=True, exist_ok=True)
        (WANGY / "labels" / split).mkdir(parents=True, exist_ok=True)


def split_wangy_to_val(ratio: float = 0.2, seed: int = 42) -> int:
    """从 wangy train 按文件名前缀分层抽样一部分到 val。"""
    img_dir = WANGY / "images" / "train"
    lbl_dir = WANGY / "labels" / "train"
    val_img = WANGY / "images" / "val"
    val_lbl = WANGY / "labels" / "val"

    groups: dict[str, list[Path]] = defaultdict(list)
    for img in img_dir.iterdir():
        if not img.is_file():
            continue
        prefix = img.stem.split(" ")[0]
        groups[prefix].append(img)

    rng = random.Random(seed)
    moved = 0
    for files in groups.values():
        files = sorted(files, key=lambda p: p.name)
        n_val = max(1, round(len(files) * ratio))
        picks = rng.sample(files, min(n_val, len(files)))
        for img in picks:
            lbl = lbl_dir / f"{img.stem}.txt"
            if not lbl.exists():
                print(f"[warn] 缺少标注，跳过: {img.name}")
                continue
            dest_img = val_img / img.name
            dest_lbl = val_lbl / lbl.name
            if dest_img.exists() or dest_lbl.exists():
                continue
            shutil.move(str(img), str(dest_img))
            shutil.move(str(lbl), str(dest_lbl))
            moved += 1
    return moved


def merge_archive_split(split: str, stats: Counter) -> tuple[int, int]:
    src_img = ARCHIVE / "images" / split
    src_lbl = ARCHIVE / "labels" / split
    dst_img = WANGY / "images" / split
    dst_lbl = WANGY / "labels" / split

    copied = 0
    skipped = 0
    for lbl_path in src_lbl.glob("*.txt"):
        stem = lbl_path.stem
        img_path = None
        for ext in (".jpg", ".jpeg", ".png", ".webp"):
            cand = src_img / f"{stem}{ext}"
            if cand.exists():
                img_path = cand
                break
        if img_path is None:
            skipped += 1
            continue

        out_img = dst_img / img_path.name
        out_lbl = dst_lbl / lbl_path.name
        if out_img.exists():
            skipped += 1
            continue

        remapped = remap_label_lines(lbl_path.read_text(encoding="utf-8", errors="ignore"))
        if not remapped.strip():
            skipped += 1
            continue

        shutil.copy2(img_path, out_img)
        out_lbl.write_text(remapped, encoding="utf-8")
        copied += 1
        for line in remapped.splitlines():
            cls = int(line.split()[0])
            stats[cls] += 1

    return copied, skipped


def count_split(split: str) -> tuple[int, int, Counter]:
    imgs = len(list((WANGY / "images" / split).glob("*")))
    lbls = len(list((WANGY / "labels" / split).glob("*.txt")))
    cnt = Counter()
    for f in (WANGY / "labels" / split).glob("*.txt"):
        for line in f.read_text(encoding="utf-8", errors="ignore").splitlines():
            line = line.strip()
            if line:
                cnt[int(float(line.split()[0]))] += 1
    return imgs, lbls, cnt


def write_garbage_yaml():
    content = f"""# 垃圾分类数据集（wangy + archive 合并，4 类 YOLO 格式）
# 由 backend/scripts/merge_archive_to_wangy.py 生成/更新
path: ../../../datasets/wangy
train: images/train
val: images/val

nc: 4

names:
  0: {CLASS_NAMES[0]}
  1: {CLASS_NAMES[1]}
  2: {CLASS_NAMES[2]}
  3: {CLASS_NAMES[3]}
"""
    GARBAGE_YAML.write_text(content, encoding="utf-8")


def main():
    if not ARCHIVE.exists():
        raise SystemExit(f"未找到 archive 目录: {ARCHIVE}")
    if not (WANGY / "images" / "train").exists():
        raise SystemExit(f"未找到 wangy 训练集: {WANGY}")

    ensure_dirs()

    print("1/3 从 wangy 划分 val（约 20%）…")
    moved = split_wangy_to_val()
    print(f"    已移动 {moved} 对 wangy 样本到 val")

    print("2/3 合并 archive（30 类 -> 4 类）…")
    train_stats: Counter = Counter()
    val_stats: Counter = Counter()
    tr_copied, tr_skip = merge_archive_split("train", train_stats)
    va_copied, va_skip = merge_archive_split("val", val_stats)
    print(f"    train: 新增 {tr_copied}，跳过 {tr_skip}")
    print(f"    val:   新增 {va_copied}，跳过 {va_skip}")

    print("3/3 更新 garbage.yaml …")
    write_garbage_yaml()

    report_lines = [
        "datasets/wangy 合并报告",
        "=" * 40,
        f"archive 映射: 30 类 -> 4 类 ({', '.join(CLASS_NAMES)})",
        f"wangy -> val 移动: {moved} 对",
        f"archive train 复制: {tr_copied}（跳过 {tr_skip}）",
        f"archive val 复制: {va_copied}（跳过 {va_skip}）",
        "",
    ]
    for split in ("train", "val"):
        imgs, lbls, cnt = count_split(split)
        report_lines.append(f"[{split}] images={imgs}, labels={lbls}")
        for i in range(4):
            report_lines.append(f"  class {i} {CLASS_NAMES[i]}: {cnt.get(i, 0)} boxes")
        report_lines.append("")

    report_path = WANGY / "merge_report.txt"
    report_path.write_text("\n".join(report_lines), encoding="utf-8")
    print("\n".join(report_lines))
    print(f"报告已写入: {report_path}")
    print("完成。请使用更新后的 backend/garbage_yolov5/garbage.yaml 重新训练模型。")


if __name__ == "__main__":
    main()
