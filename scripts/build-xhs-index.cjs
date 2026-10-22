/**
 * 从 content/xhs/_state.json 生成 content/xhs/index.json（素材库索引）
 * 用法: node scripts/build-xhs-index.cjs
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const state = JSON.parse(fs.readFileSync(path.join(ROOT, 'content/xhs/_state.json'), 'utf8'));

const clean = (s) => (s || '').replace(/\[话题\]#/g, '').replace(/#\S+?#(?=\s|$)/g, '').trim();

const notes = state.order
  .map(id => state.notes[id])
  .filter(n => n && n.done)
  .map(n => {
    const d = n.detail || {};
    return {
      id: n.id,
      type: n.type || 'video',
      title: (d.title || n.title || '').trim(),
      desc: clean(d.desc),
      tags: d.tags || [],
      time: d.time || '',
      liked: n.liked || '',
      url: `https://www.xiaohongshu.com/explore/${n.id}`,
      cover: d.images && d.images[0] ? d.images[0] : '',
      images: d.images || [],
    };
  });

const index = {
  source: 'xiaohongshu',
  author: state.author && state.author.nickname ? state.author : { id: '5ae8a230e8ac2b0f639663ac', nickname: '王ze霖' },
  collectedAt: new Date().toISOString(),
  count: notes.length,
  notes,
};

fs.writeFileSync(path.join(ROOT, 'content/xhs/index.json'), JSON.stringify(index, null, 2), 'utf8');
console.log(`index.json 写入完成：${notes.length} 条素材`);
