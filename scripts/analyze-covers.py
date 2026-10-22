# -*- coding: utf-8 -*-
"""
封面图统计分析：色系、明度、饱和度、上/下装明暗关系、背景类型、画幅
输入 content/xhs/index.json（每条取第一张图）
输出 content/xhs/analysis.json + 控制台摘要
"""
import json, os, colorsys, statistics
from collections import Counter, defaultdict
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
XHS = os.path.join(ROOT, 'content', 'xhs')
IDX = json.load(open(os.path.join(XHS, 'index.json'), encoding='utf-8'))
NOTES = IDX['notes']

def rgb_to_hsv(r, g, b):
    h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
    return h * 360, s, v

def color_family(rgb):
    """把颜色归入可读的色系"""
    r, g, b = rgb
    h, s, v = rgb_to_hsv(r, g, b)
    lum = 0.2126 * r + 0.7152 * g + 0.0722 * b
    if lum < 55: return '黑'
    if s < 0.10:
        if lum > 205: return '白'
        return '灰'
    if s < 0.22 and lum > 175: return '白'
    if 15 <= h < 55:
        if s < 0.42 and lum > 120: return '米/卡其'
        if 35 <= h < 55 and s < 0.35: return '米/卡其'
        return '棕/大地'
    if 55 <= h < 75: return '黄/橙'
    if 75 <= h < 170: return '绿'
    if 170 <= h < 260: return '蓝'
    if 260 <= h < 330: return '紫/粉'
    return '红/酒红'

def dom_colors(img, n=6):
    """量化取主色（按占比排序）"""
    small = img.convert('RGB').resize((80, 80), Image.LANCZOS)
    q = small.quantize(colors=n, method=Image.MEDIANCUT)
    pal = q.getpalette()
    counts = sorted(q.getcolors(), reverse=True)
    total = sum(c for c, _ in counts)
    out = []
    for cnt, idx in counts:
        r, g, b = pal[idx * 3: idx * 3 + 3]
        out.append({'hex': '#%02x%02x%02x' % (r, g, b), 'share': round(cnt / total, 3),
                    'family': color_family((r, g, b))})
    return out

def region_dom(img, y0, y1):
    w, h = img.size
    crop = img.crop((int(w * 0.15), int(h * y0), int(w * 0.85), int(h * y1))).convert('RGB')
    small = crop.resize((40, 40), Image.LANCZOS)
    q = small.quantize(colors=3, method=Image.MEDIANCUT)
    pal = q.getpalette()
    cnt, idx = max(q.getcolors(), key=lambda x: x[0])
    r, g, b = pal[idx * 3: idx * 3 + 3]
    return {'hex': '#%02x%02x%02x' % (r, g, b), 'lum': round(0.2126 * r + 0.7152 * g + 0.0722 * b, 1),
            'family': color_family((r, g, b))}

def background_info(img):
    """四角取样判断是否纯色背景"""
    w, h = img.size
    rgb = img.convert('RGB')
    px = []
    for x0, y0 in [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)]:
        box = (max(0, x0 - 25), max(0, y0 - 25), min(w, x0 + 25), min(h, y0 + 25))
        crop = rgb.crop(box).resize((10, 10), Image.LANCZOS)
        px.extend(list(crop.getdata()))
    rs = [p[0] for p in px]; gs = [p[1] for p in px]; bs = [p[2] for p in px]
    spread = statistics.mean([statistics.pstdev(rs), statistics.pstdev(gs), statistics.pstdev(bs)])
    mean = tuple(int(round(v)) for v in (statistics.mean(rs), statistics.mean(gs), statistics.mean(bs)))
    return {'solid': spread < 18, 'spread': round(spread, 1), 'hex': '#%02x%02x%02x' % mean,
            'family': color_family(mean)}

rows = []
for i, n in enumerate(NOTES):
    if not n.get('images'): continue
    path = os.path.join(XHS, n['id'], n['images'][0])
    if not os.path.exists(path): continue
    img = Image.open(path)
    W, H = img.size
    small = img.convert('RGB').resize((120, 120), Image.LANCZOS)
    px = list(small.getdata())
    lums = [0.2126 * r + 0.7152 * g + 0.0722 * b for r, g, b in px]
    sats = [rgb_to_hsv(r, g, b)[1] for r, g, b in px]
    dcs = dom_colors(img)
    top = dcs[0]
    top3 = [d['family'] for d in dcs[:3]]
    up = region_dom(img, 0.18, 0.45)      # 上半身
    low = region_dom(img, 0.45, 0.75)     # 下装
    bg = background_info(img)
    rows.append({
        'id': n['id'], 'title': n['title'], 'tags': n['tags'][:8], 'type': n['type'],
        'w': W, 'h': H, 'ratio': round(W / H, 3),
        'lum': round(statistics.mean(lums), 1), 'contrast': round(statistics.pstdev(lums), 1),
        'sat': round(statistics.mean(sats) * 100, 1),
        'top_color': {'hex': top['hex'], 'family': top['family'], 'share': top['share']},
        'palette': [d['hex'] for d in dcs[:5]],
        'top3_families': top3,
        'upper': up, 'lower': low,
        'upper_lower': ('上浅下深' if up['lum'] - low['lum'] > 18 else
                        '上深下浅' if low['lum'] - up['lum'] > 18 else '同色系'),
        'bg': bg,
        'text_ratio': round(sum(1 for l in lums if l > 235) / len(lums), 3),
    })

# ---------- 汇总 ----------
fam = Counter(r['top_color']['family'] for r in rows)
fam_any = Counter(f for r in rows for f in set(r['top3_families']))
lum_band = Counter('暗调 <70' if r['lum'] < 70 else '中间调 70-140' if r['lum'] < 140 else '亮调 ≥140' for r in rows)
sat_band = Counter('低饱和 <18' if r['sat'] < 18 else '中饱和 18-32' if r['sat'] < 32 else '高饱和 ≥32' for r in rows)
ul = Counter(r['upper_lower'] for r in rows)
ratio_band = Counter('9:16 竖幅' if r['ratio'] < 0.62 else '3:4 竖幅' if r['ratio'] < 0.80 else '4:5 / 方图' if r['ratio'] < 1.0 else '横图' for r in rows)
bg_solid = sum(1 for r in rows if r['bg']['solid'])

tag_stat = defaultdict(lambda: {'n': 0, 'lum': [], 'families': Counter()})
for r in rows:
    for t in r['tags']:
        s = tag_stat[t]
        s['n'] += 1; s['lum'].append(r['lum']); s['families'][r['top_color']['family']] += 1

tag_top = sorted([t for t in tag_stat.items() if t[1]['n'] >= 5], key=lambda x: -x[1]['n'])[:12]
tags_report = [{'tag': t, 'n': s['n'], 'avg_lum': round(statistics.mean(s['lum']), 1),
                'top_family': s['families'].most_common(1)[0][0]} for t, s in tag_top]

result = {
    'count': len(rows),
    'summary': {
        'top_color_family': fam.most_common(),
        'any_family': fam_any.most_common(),
        'luminance_band': lum_band.most_common(),
        'saturation_band': sat_band.most_common(),
        'upper_lower': ul.most_common(),
        'ratio_band': ratio_band.most_common(),
        'solid_background': {'n': bg_solid, 'pct': round(bg_solid / len(rows) * 100, 1)},
        'avg_lum': round(statistics.mean(r['lum'] for r in rows), 1),
        'avg_sat': round(statistics.mean(r['sat'] for r in rows), 1),
    },
    'tags': tags_report,
    'items': rows,
}
json.dump(result, open(os.path.join(XHS, 'analysis.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=2)

print(f"分析完成：{len(rows)} 张封面")
print('主色系:', ', '.join(f'{k}{v}' for k, v in fam.most_common(6)))
print('明度:', ', '.join(f'{k}{v}' for k, v in lum_band.most_common()))
print('饱和:', ', '.join(f'{k}{v}' for k, v in sat_band.most_common()))
print('上下装:', ', '.join(f'{k}{v}' for k, v in ul.most_common()))
print('画幅:', ', '.join(f'{k}{v}' for k, v in ratio_band.most_common()))
print(f"纯色背景: {bg_solid}/{len(rows)} ({bg_solid/len(rows)*100:.0f}%)")
print('平均亮度 %.1f / 平均饱和 %.1f' % (statistics.mean(r['lum'] for r in rows), statistics.mean(r['sat'] for r in rows)))
print('标签交叉:')
for t in tags_report[:8]: print(f"  {t['tag']}: {t['n']} 条, 均亮度 {t['avg_lum']}, 主色 {t['top_family']}")
