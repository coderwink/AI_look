"""
压缩素材库图片：content/xhs/<noteId>/*.jpg|webp
- 最长边压到 720px（详情页看足够，封面更清晰）
- JPEG quality 78，转 webp 保留原格式
- 原地覆盖，保留原图备份？不留（体积翻倍），原图可从 state 里的 URL 重新下载

用法: python scripts/compress-xhs.py [--dry]
"""
import glob
import io
import os
import sys

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DRY = '--dry' in sys.argv
MAX_SIDE = 720
QUALITY = 78

files = sorted(glob.glob(os.path.join(ROOT, 'content/xhs/*/*.jpg')) + glob.glob(os.path.join(ROOT, 'content/xhs/*/*.webp')))
before = sum(os.path.getsize(f) for f in files)
saved = 0
processed = 0

for f in files:
    size = os.path.getsize(f)
    try:
        im = Image.open(f)
        im = im.convert('RGB') if im.mode not in ('RGB', 'L') else im
        w, h = im.size
        scale = min(1.0, MAX_SIDE / max(w, h))
        if scale < 1.0:
            im = im.resize((max(1, int(w * scale)), max(1, int(h * scale))), Image.LANCZOS)
        buf = io.BytesIO()
        im.save(buf, 'JPEG', quality=QUALITY, optimize=True, progressive=True)
        data = buf.getvalue()
        if len(data) < size * 0.9:          # 只在明显变小时才替换
            if not DRY:
                with open(f, 'wb') as fp:
                    fp.write(data)
            saved += size - len(data)
            processed += 1
    except Exception as e:
        print(f'跳过 {os.path.relpath(f, ROOT)}: {e}')

print(f'处理 {processed}/{len(files)} 张')
print(f'体积 {before/1048576:.1f} MB → {(before-saved)/1048576:.1f} MB（省 {saved/1048576:.1f} MB）')
