/**
 * 生成素材库索引 content/xhs/index.json
 *
 * 用法: node scripts/build-xhs-index.cjs
 *
 * 会自动合并 content/xhs/_state*.json 里的所有来源：
 *   _state.json            → 博主主页采集
 *   _state.<名称>.json     → 搜索页等其他来源（名称里带关键词）
 *
 * 每条素材都带上 source（来源）与 height（身高，来自 extract-height.cjs）。
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const XHS = path.join(ROOT, 'content/xhs');
const TAXONOMY = JSON.parse(fs.readFileSync(path.join(ROOT, 'content/taxonomy.json'), 'utf8'));

const clean = (s) => (s || '').replace(/\[话题\]#/g, '').replace(/#\S+?#(?=\s|$)/g, '').trim();

/** 点赞数统一成数字（"2.8万" → 28000） */
function parseLiked(v) {
  if (v == null) return 0;
  const s = String(v).trim();
  const m = s.match(/^([\d.]+)\s*(万|w)?$/i);
  if (!m) return 0;
  const n = parseFloat(m[1]);
  return Math.round(m[2] ? n * 10000 : n);
}

const stateFiles = fs.readdirSync(XHS).filter(f => /^_state.*\.json$/.test(f));
if (!stateFiles.length) throw new Error('没有找到任何 _state*.json，请先跑采集');

const notes = [];
const sources = [];

for (const f of stateFiles) {
  const st = JSON.parse(fs.readFileSync(path.join(XHS, f), 'utf8'));
  const meta = st.meta || {};
  const isProfile = meta.kind === 'profile' || f === '_state.json';
  const list = (st.order || []).map(id => st.notes[id]).filter(n => n && n.done);

  // 作者名：state 里没存就用「出现最多的人名型标签」推断（排除穿搭/搭配这类通用话题）
  let nickname = (st.author && st.author.nickname) || meta.author || '';
  if (!nickname && isProfile) {
    const freq = {};
    const NOT_NAME = /穿搭|搭配|风格|技巧|分享|男生|小个子|合集|公式|思路|OOTD|ootd/;
    for (const n of list) {
      for (const t of ((n.detail || {}).tags || [])) {
        if (NOT_NAME.test(t) || t.length > 10) continue;
        freq[t] = (freq[t] || 0) + 1;
      }
    }
    const top = Object.entries(freq).sort((a, b) => b[1] - a[1])[0];
    if (top && top[1] >= Math.max(3, list.length * 0.15)) nickname = top[0];
  }

  const sourceTag = isProfile
    ? `博主 · ${nickname || '未命名'}`
    : `搜索 · ${meta.keyword || f.replace(/_state\.|\.json/g, '')}`;

  sources.push({
    file: f,
    kind: isProfile ? 'profile' : 'search',
    label: sourceTag,
    keyword: meta.keyword || '',
    author: nickname,
    url: meta.url || '',
    count: list.length,
  });

  for (const n of list) {
    const d = n.detail || {};
    const imgs = d.images || [];
    notes.push({
      id: n.id,
      sourceFile: f,
      sourceLabel: sourceTag,
      sourceKind: isProfile ? 'profile' : 'search',
      keyword: meta.keyword || '',
      type: n.type || 'video',
      title: (d.title || n.title || '').trim(),
      desc: clean(d.desc),
      tags: d.tags || [],
      author: n.author || nickname || '',
      time: d.time || '',
      liked: parseLiked(n.liked),
      likedRaw: n.liked || '',
      url: `https://www.xiaohongshu.com/explore/${n.id}`,
      cover: imgs[0] || '',
      images: imgs,
      height: n.height || { value: null, band: 'unknown', label: '未标注', confidence: 'none', tag: '' },
    });
  }
}

// 身高段统计
const heightStats = {};
for (const n of notes) heightStats[n.height.band] = (heightStats[n.height.band] || 0) + 1;
const heights = TAXONOMY.heights.map(h => ({ ...h, count: heightStats[h.key] || 0 }));

const index = {
  version: 2,
  source: 'xiaohongshu',
  generatedAt: new Date().toISOString(),
  count: notes.length,
  sources,
  heights,
  notes,
};

fs.writeFileSync(path.join(XHS, 'index.json'), JSON.stringify(index, null, 2), 'utf8');

console.log(`index.json 写入完成：${notes.length} 条素材，${sources.length} 个来源`);
sources.forEach(s => console.log(`  · ${s.label} — ${s.count} 条`));
console.log('身高分布：' + heights.filter(h => h.count).map(h => `${h.label} ${h.count}`).join('｜'));
