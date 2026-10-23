"""把 raw/ 下的原始生成图裁切 / 压缩成内容层图片。

输出：content/images/looks/look-{n}.jpg（宽度固定 720，画幅按 LOOK_RATIOS 变化）
说明：只从左右裁切来控制画幅比例，避免裁掉鞋子等搭配细节。
"""
import os
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(ROOT, "raw")
OUT = os.path.join(ROOT, "content", "images", "looks")
ICONS = os.path.join(ROOT, "assets", "icons")
os.makedirs(OUT, exist_ok=True)
os.makedirs(ICONS, exist_ok=True)

# 源文件 -> (输出编号, 目标画幅 = 宽/高)
LOOK_MAP = {
    "Editorial_full_body_fashion_ph_2026-10-22T01-39-43.png": ("look-1", 0.63),
    "Editorial_full_body_fashion_ph_2026-10-22T01-39-44.png": ("look-2", 0.70),
    "Editorial_full_body_fashion_ph_2026-10-22T01-39-41.png": ("look-3", 0.73),
    "Editorial_full_body_fashion_ph_2026-10-22T01-40-11.png": ("look-4", 0.66),
    "Editorial_full_body_fashion_ph_2026-10-22T01-40-10.png": ("look-5", 0.72),
    "Editorial_full_body_fashion_ph_2026-10-22T01-40-12.png": ("look-6", 0.73),
    "Editorial_full_body_fashion_ph_2026-10-22T01-40-32.png": ("look-7", 0.65),
    "Editorial_full_body_fashion_ph_2026-10-22T01-40-33.png": ("look-8", 0.71),
    "Editorial_full_body_fashion_ph_2026-10-22T01-40-52.png": ("look-9", 0.68),
    "Editorial_full_body_fashion_ph_2026-10-23T09-01-58.png": ("look-10", 0.70),
    "Editorial_full_body_fashion_ph_2026-10-23T09-02-11.png": ("look-11", 0.72),
    "Editorial_full_body_fashion_ph_2026-10-23T09-02-21.png": ("look-12", 0.65),
    "Editorial_full_body_fashion_ph_2026-10-23T09-03-17.png": ("look-13", 0.68),
    "Editorial_full_body_fashion_ph_2026-10-23T09-03-28.png": ("look-14", 0.63),
    "Editorial_full_body_fashion_ph_2026-10-23T09-03-43.png": ("look-15", 0.66),
}
WATERMARK_RATIO = 0.085  # 底部水印条


def strip_bottom(img, ratio=WATERMARK_RATIO):
    w, h = img.size
    return img.crop((0, 0, w, int(h * (1 - ratio))))


def fit_ratio(img, target):
    """宽度优先：目标更窄时裁左右，更宽时裁底部。"""
    w, h = img.size
    current = w / h
    if abs(current - target) < 0.005:
        return img
    if target < current:                      # 需要更瘦 -> 裁左右
        new_w = int(h * target)
        left = (w - new_w) // 2
        return img.crop((left, 0, left + new_w, h))
    new_h = int(w / target)                   # 需要更矮 -> 裁底部
    return img.crop((0, 0, w, new_h))


for fname, (look_id, ratio) in LOOK_MAP.items():
    img = Image.open(os.path.join(RAW, fname)).convert("RGB")
    img = strip_bottom(img)
    img = fit_ratio(img, ratio)

    w, h = img.size
    target_w = 720
    img = img.resize((target_w, int(h * target_w / w)), Image.LANCZOS)

    out = os.path.join(OUT, look_id + ".jpg")
    img.save(out, "JPEG", quality=82, optimize=True, progressive=True)
    print(f"{look_id}: {img.size[0]}x{img.size[1]} ratio={img.size[0]/img.size[1]:.3f} "
          f"{os.path.getsize(out) // 1024}KB")

# App 图标
icon_src = os.path.join(RAW, "Minimalist_mobile_app_icon_des_2026-10-22T01-40-51.png")
img = strip_bottom(Image.open(icon_src).convert("RGB"), 0.07)
w, h = img.size
side = min(w, h)
left, top = (w - side) // 2, (h - side) // 2
img = img.crop((left, top, left + side, top + side))
for size, name in ((512, "icon-512.png"), (192, "icon-192.png")):
    path = os.path.join(ICONS, name)
    img.resize((size, size), Image.LANCZOS).save(path, "PNG", optimize=True)
    print(f"{name}: {os.path.getsize(path) // 1024}KB")
print("done")
