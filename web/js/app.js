/* ============================================================
 * 型格 LOOKBOOK · Web / PWA 端应用逻辑
 *
 * 数据来源（只读）：../content/*.json
 *   taxonomy.json   分类字典   looks.json  搭配   editorials.json  编辑卡
 * 图片：../content/images/looks/{image.src}
 *
 * 本地存储（可替换层）：localStorage 键 xingge.v1 → { favs: [], seen: [] }
 * 后续接云账号时，只需替换 storage 的实现，UI 层不用动。
 * ============================================================ */

const CONTENT_BASE = '../content';
const IMAGE_BASE = '../content/images/looks/';
const DRAFT_KEY = 'xingge.incoming.v1';
const COLUMN_COUNT = 2;
const GAP = 10;

/** 素材库收录的草稿图放在 content/xhs/ 下，路径前缀要区分 */
function imageSrc(look) {
  const src = (look.image && look.image.src) || '';
  return src.startsWith('xhs/') ? `${CONTENT_BASE}/${src}` : `${IMAGE_BASE}${src}`;
}

function readDrafts() {
  try {
    const arr = JSON.parse(localStorage.getItem(DRAFT_KEY) || '[]');
    return Array.isArray(arr) ? arr.filter((d) => d && d.id) : [];
  } catch (e) { return []; }
}

function writeDrafts(arr) {
  try { localStorage.setItem(DRAFT_KEY, JSON.stringify(arr)); return true; }
  catch (e) { toast('保存失败，请检查存储空间'); return false; }
}

/* ---------- 存储层 ---------- */
const storage = {
  key: 'xingge.v1',
  data: { favs: [], seen: [], profile: { height: '' } },
  load() {
    try {
      const raw = localStorage.getItem(this.key);
      if (raw) {
        const saved = JSON.parse(raw);
        this.data = Object.assign(this.data, saved);
        this.data.profile = Object.assign({ height: '' }, saved.profile || {});
      }
    } catch (e) { /* 数据损坏则重置 */ }
  },
  save() {
    try { localStorage.setItem(this.key, JSON.stringify(this.data)); }
    catch (e) { toast('保存失败，请检查存储空间'); }
  },
  isFav(id) { return this.data.favs.includes(id); },
  toggleFav(id) {
    const i = this.data.favs.indexOf(id);
    if (i >= 0) this.data.favs.splice(i, 1); else this.data.favs.unshift(id);
    this.save();
    return i < 0;
  },
  markSeen(id) {
    if (!this.data.seen.includes(id)) { this.data.seen.push(id); this.save(); }
  },
  clearFavs() { this.data.favs = []; this.save(); },
  setHeight(bandKey) {
    this.data.profile.height = bandKey || '';
    this.save();
  },
};

/* ---------- 工具 ---------- */
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[c]));

const heartSvg = (filled) => `<svg viewBox="0 0 24 24" fill="${filled ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20s-7-4.6-9-9c-1.3-3 .7-6.5 4-6.5 2.2 0 3.8 1.3 5 3 1.2-1.7 2.8-3 5-3 3.3 0 5.3 3.5 4 6.5-2 4.4-9 9-9 9z"/></svg>`;

let toastTimer = null;
function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 1800);
}

/* ---------- 内容状态 ---------- */
const content = {
  styles: [], scenes: [], seasons: [], cats: [], heights: [],
  looks: [], editorials: [], drafts: [],
  palettes: [], palKinds: [], customPalettes: [],
  styleLabel: {}, sceneLabel: {}, seasonLabel: {}, catLabel: {}, palKindLabel: {},
};

const state = { tab: 'home', style: 'all', scene: 'all', height: 'all', favStyle: 'all',
  palKind: 'all', palScene: 'all', palMine: false, heroId: '', deferredInstall: null };
let sheetOpen = false;
let palOpen = false;
let searchOpen = false;
const lookById = {};

/* ---------- 瀑布流排版 ---------- */
function layoutMasonry(container) {
  const cards = Array.from(container.children);
  if (!cards.length) { container.style.height = '0px'; return; }
  const total = container.clientWidth;
  if (!total) return; // 容器不可见时跳过，等切到该页再排

  const colW = (total - GAP * (COLUMN_COUNT - 1)) / COLUMN_COUNT;
  const heights = new Array(COLUMN_COUNT).fill(0);

  cards.forEach((card) => {
    card.style.width = colW + 'px';
    const h = card.offsetHeight;
    let col = 0;
    for (let i = 1; i < COLUMN_COUNT; i += 1) {
      if (heights[i] < heights[col] - 0.5) col = i;
    }
    card.style.transform = `translate3d(${col * (colW + GAP)}px, ${heights[col]}px, 0)`;
    heights[col] += h + GAP;
  });

  container.style.height = `${Math.max(...heights) - GAP}px`;
}

let relayoutTimer = null;
function relayoutVisible() {
  clearTimeout(relayoutTimer);
  relayoutTimer = setTimeout(() => {
    layoutMasonry($('#masonry'));
    if (!$('#view-favs').hidden) layoutMasonry($('#fav-masonry'));
    const sr = $('#search-results .masonry');
    if (sr) layoutMasonry(sr);
  }, 100);
}

/* ---------- 骨架屏 ---------- */
function renderSkeleton() {
  const box = $('#masonry');
  const ratios = [0.66, 0.71, 0.63, 0.68, 0.73, 0.65];
  box.innerHTML = ratios.map((r) => `
    <div class="sk-card">
      <div class="sk-img" style="aspect-ratio:${r}"></div>
      <div class="sk-body">
        <i style="width:82%"></i>
        <i style="width:56%"></i>
        <span class="sk-foot"><i class="sk-dot"></i><i style="width:38px;height:8px"></i></span>
      </div>
    </div>`).join('');
  layoutMasonry(box);
}

/* ---------- 卡片模板 ---------- */
function lookCard(look, idx) {
  const faved = storage.isFav(look.id);
  const styleName = content.styleLabel[look.styles[0]] || '';
  return `
    <article class="card" data-look="${look.id}" style="animation-delay:${Math.min(idx * 45, 360)}ms">
      <div class="card-cover">
        <img src="${imageSrc(look)}" alt="${esc(look.image.alt || look.title)}"
             style="--r:${look.image.ratio}" loading="lazy" decoding="async" />
        ${styleName ? `<span class="card-badge">${esc(styleName)}</span>` : ''}
        ${look.heightFit ? `<span class="card-badge is-fit">${esc(heightText(look))}</span>` : ''}
        ${look.isDraft ? '<span class="card-badge is-draft">草稿</span>' : ''}
      </div>
      <div class="card-body">
        <h3 class="card-title">${esc(look.title)}</h3>
        ${look.summary ? `<p class="card-summary">${esc(look.summary)}</p>` : ''}
        <div class="card-foot">
          <span class="avatar">${esc((look.author || '型')[0])}</span>
          <span class="author">${esc(look.author || '编辑部')}</span>
          <button class="like ${faved ? 'faved' : ''}" data-fav="${look.id}" aria-label="收藏">
            ${heartSvg(faved)}
          </button>
        </div>
      </div>
    </article>`;
}

function editorialCard(ed, idx) {
  let inner = '';
  if (ed.type === 'palette' && Array.isArray(ed.swatches)) {
    inner = `<div class="ed-swatches">${ed.swatches.map((c) => `<i style="background:${esc(c)}"></i>`).join('')}</div>`;
  } else if (ed.type === 'list' && Array.isArray(ed.list)) {
    inner = `<ul class="ed-list">${ed.list.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>`;
  }
  return `
    <article class="ed-card ${esc(ed.type)}" style="animation-delay:${Math.min(idx * 45, 360)}ms">
      <p class="ed-kicker">${esc(ed.kicker)}</p>
      <h3 class="ed-title">${esc(ed.title)}</h3>
      <p class="ed-body">${esc(ed.body)}</p>
      ${inner}
    </article>`;
}

/* ---------- 信息流 ---------- */
function publishedLooks() {
  return content.looks.filter((l) => l.status === 'published');
}

/** 身高段字典（去掉 unknown） */
function bandByKey(key) {
  return content.heights.find((h) => h.key === key) || null;
}

/** 一套 look 是否覆盖某个身高段：区间重叠即算 */
function fitsBand(look, band) {
  const fit = look.heightFit;
  if (!fit || typeof fit.min !== 'number') return true; // 没标注的不做排除
  return fit.min < band.max && fit.max > band.min;
}

function heightText(look) {
  const fit = look.heightFit;
  if (!fit) return '';
  return `${fit.min}–${fit.max}cm`;
}

function matchFilters(l) {
  const band = state.height === 'all' ? null : bandByKey(state.height);
  return (state.style === 'all' || l.styles.includes(state.style)) &&
    (state.scene === 'all' || (l.scenes || []).includes(state.scene)) &&
    (!band || fitsBand(l, band));
}

function filteredLooks() {
  return publishedLooks().filter(matchFilters);
}

/** 素材库收录的草稿：跟正式内容一起过滤，但排在最后 */
function filteredDrafts() {
  return content.drafts.filter(matchFilters);
}

function renderFeed() {
  const looks = filteredLooks();
  const drafts = filteredDrafts();
  const box = $('#masonry');
  $('#loading').hidden = true;

  if (!looks.length && !drafts.length) {
    box.innerHTML = `<div class="empty"><div class="empty-icon">✦</div>
      <p class="empty-title">这个组合下暂时没有搭配</p>
      <p class="empty-sub">换个风格、场景或身高试试</p></div>`;
    box.style.height = 'auto';
    box.firstElementChild.style.position = 'static';
    $('#feed-end').hidden = true;
    return;
  }
  $('#feed-end').hidden = false;

  // 编辑部卡片按结果数量穿插
  const items = looks.map((l) => ({ kind: 'look', data: l }));
  const eds = content.editorials.slice();
  const slots = looks.length >= 6 ? [1, 4] : looks.length >= 3 ? [1] : [];
  slots.forEach((pos) => {
    if (eds.length) items.splice(pos + 1, 0, { kind: 'ed', data: eds.shift() });
  });
  drafts.forEach((d) => items.push({ kind: 'look', data: d }));

  box.innerHTML = items.map((it, i) =>
    it.kind === 'look' ? lookCard(it.data, i) : editorialCard(it.data, i)
  ).join('');

  layoutMasonry(box);

  // 图片加载完成后若尺寸有偏差再排一次（正常情况有 aspect-ratio，不会跳动）
  const imgs = box.querySelectorAll('img');
  let pending = imgs.length;
  imgs.forEach((img) => {
    if (img.complete) { pending -= 1; return; }
    img.addEventListener('load', () => { if (--pending === 0) layoutMasonry(box); }, { once: true });
  });
}

function renderTabs() {
  const tabs = [{ key: 'all', label: '推荐' }].concat(content.styles);
  $('#style-tabs').innerHTML = tabs.map((s) =>
    `<button class="tab-item ${state.style === s.key ? 'active' : ''}" data-style="${s.key}">${esc(s.label)}</button>`
  ).join('');
  $('#scene-chips').innerHTML = [{ key: 'all', label: '全部场景' }].concat(content.scenes).map((s) =>
    `<button class="chip ${state.scene === s.key ? 'active' : ''}" data-scene="${s.key}">${esc(s.label)}</button>`
  ).join('');
  renderHeightChips();
}

/** 身高筛选行：只在有 look 覆盖的段落出现 */
function renderHeightChips() {
  const looks = publishedLooks();
  const bands = content.heights.filter((h) => looks.some((l) => fitsBand(l, h)));
  const my = storage.data.profile.height;
  const chips = [{ key: 'all', label: '不限身高' }].concat(
    bands.map((b) => ({ key: b.key, label: `${b.label}${b.key === my ? ' · 我' : ''}` }))
  );
  $('#height-chips').innerHTML = chips.map((c) =>
    `<button class="chip fit ${state.height === c.key ? 'active' : ''}" data-height="${c.key}">${esc(c.label)}</button>`
  ).join('');
  $('#height-chips').hidden = bands.length < 2;
}

/* ---------- 历史栈（Android 返回键关闭浮层） ---------- */
function pushClose(tag) { history.pushState({ xinggeClose: tag }, ''); }
function popClose() { if (history.state && history.state.xinggeClose) history.back(); }

window.addEventListener('popstate', () => {
  if (sheetOpen) closeSheet(true);
  else if (palOpen) closePal(true);
  else if (searchOpen) closeSearch(true);
});

/* ---------- 详情层 ---------- */
let sheetCtx = { list: [], idx: -1 };

/** 详情层的上一套 / 下一套，按当前筛选后的信息流顺序 */
function feedOrder() {
  return filteredLooks().concat(filteredDrafts());
}

function renderSheet(look) {
  const list = sheetCtx.list;
  const pos = sheetCtx.idx;
  const sameStyle = publishedLooks().filter((l) => l.id !== look.id && l.styles.some((s) => look.styles.includes(s)));
  const others = publishedLooks().filter((l) => l.id !== look.id && !sameStyle.includes(l));
  const related = sameStyle.concat(others).slice(0, 4);

  const meta = [
    (look.scenes || []).map((s) => content.sceneLabel[s]).filter(Boolean).join(' / '),
    (look.seasons || []).map((s) => content.seasonLabel[s]).filter(Boolean).join(''),
    '适用',
  ].filter(Boolean).join(' · ');

  $('#sheet').innerHTML = `
    <div class="sheet-img">
      <img src="${imageSrc(look)}" alt="${esc(look.image.alt || look.title)}" />
      ${list.length > 1 ? `
        ${pos > 0 ? '<button class="sheet-nav prev" data-sheet-nav="-1" aria-label="上一套">‹</button>' : ''}
        ${pos < list.length - 1 ? '<button class="sheet-nav next" data-sheet-nav="1" aria-label="下一套">›</button>' : ''}
        <span class="sheet-pos">${pos + 1} / ${list.length}</span>` : ''}
      <button class="sheet-close" id="sheet-close" aria-label="关闭">✕</button>
      <button class="sheet-fav ${storage.isFav(look.id) ? 'faved' : ''}" data-fav="${look.id}" aria-label="收藏">
        ${heartSvg(storage.isFav(look.id))}
      </button>
    </div>
    <div class="sheet-body">
      <div class="sheet-kicker">
        <span class="kicker-tag">${esc(look.styles.map((s) => content.styleLabel[s]).filter(Boolean).join(' · '))}</span>
        <span class="kicker-meta">${esc(meta)}</span>
      </div>
      <h2 class="sheet-title">${esc(look.title)}</h2>
      ${look.desc ? `<p class="sheet-desc">${esc(look.desc)}</p>` : ''}

      ${look.heightFit ? `
      <div class="fit-line">
        <b>适穿身高</b>
        <span>${esc(heightText(look))}</span>
        ${look.heightFit.note ? `<em>${esc(look.heightFit.note)}</em>` : ''}
      </div>` : ''}

      ${look.isDraft ? `
      <div class="draft-box">
        <b>草稿</b>
        <p>从素材库收录${look.source?.label ? `（${esc(look.source.label)}）` : ''}，还没拆单品和配色。<a href="${esc(look.source?.url || '#')}" target="_blank" rel="noopener">看原笔记 ↗</a></p>
        <button class="draft-drop" data-drop="${esc(look.id)}">移出草稿箱</button>
      </div>` : ''}

      ${(look.items || []).length ? `
      <p class="sec-title">单品清单</p>
      <div class="item-list">
        ${look.items.map((it) => `
          <div class="item-row">
            <span class="item-cat">${esc(content.catLabel[it.cat] || it.cat)}</span>
            <span class="item-name">${esc(it.name)}</span>
            <span class="item-note">${esc(it.note || '')}</span>
          </div>`).join('')}
      </div>` : ''}

      ${(look.palette || []).length ? `
      <p class="sec-title">配色方案</p>
      <div class="palette-strip">
        ${look.palette.map((c) => `<div class="sw" style="background:${esc(c)}"><span class="${isLight(c) ? 'on-light' : ''}">${esc(c.toUpperCase())}</span></div>`).join('')}
      </div>
      ${matchedPalette(look.palette) ? `<button class="pal-link" data-pal-link="${matchedPalette(look.palette).id}">这组颜色怎么搭 · 去配色手册 →</button>` : ''}` : ''}

      ${look.tip ? `<p class="sec-title">编辑提醒</p>
      <div class="tip-box"><b>TIP</b>${esc(look.tip)}</div>` : ''}

      <p class="sec-title">相关搭配</p>
      <div class="rel-grid">
        ${related.map((l) => `
          <div class="rel-card" data-look="${l.id}">
            <img src="${imageSrc(l)}" alt="${esc(l.title)}" loading="lazy" />
            <p>${esc(l.title)}</p>
          </div>`).join('')}
      </div>
    </div>`;
}

function openSheet(id) {
  const look = lookById[id];
  if (!look) return;

  // 记录当前信息流顺序，详情里可以左右切换
  const list = feedOrder();
  const idx = list.findIndex((l) => l.id === id);
  if (idx >= 0) sheetCtx = { list, idx };
  else if (!sheetCtx.list.some((l) => l.id === id)) sheetCtx = { list: [look], idx: 0 };

  storage.markSeen(id);
  updateStats();
  renderSheet(look);

  const backdrop = $('#sheet-backdrop');
  const sheet = $('#sheet');
  if (sheetOpen) { sheet.scrollTop = 0; return; } // 已在详情层内切换
  backdrop.hidden = false;
  sheet.hidden = false;
  sheet.classList.add('sheet-init');
  requestAnimationFrame(() => requestAnimationFrame(() => {
    backdrop.classList.add('show');
    sheet.classList.remove('sheet-init');
    sheet.classList.add('up');
  }));
  sheetOpen = true;
  document.body.style.overflow = 'hidden';
  pushClose('sheet');
}

function closeSheet(fromPop) {
  if (!sheetOpen) return;
  sheetOpen = false;
  $('#sheet-backdrop').classList.remove('show');
  $('#sheet').classList.remove('up');
  $('#sheet').classList.add('sheet-init');
  document.body.style.overflow = '';
  if (!fromPop) popClose();
  setTimeout(() => {
    $('#sheet-backdrop').hidden = true;
    $('#sheet').hidden = true;
    $('#sheet').innerHTML = '';
  }, 320);
}

/* ---------- 配色手册 ---------- */
const ROLE_WEIGHT = { 外套: 0.34, 上装: 0.28, 下装: 0.24, 内搭: 0.12, 鞋: 0.09, 包: 0.03, 配饰: 0.02 };
const roleWeight = (r) => ROLE_WEIGHT[r] || 0.06;

const CUSTOM_PAL_KEY = 'xingge.palettes.v1';

/** 小红书爆款配色法则（整理自高赞笔记） */
const PAL_RULES = [
  { t: '全身 ≤ 3 色', d: '黑白灰、藏蓝、卡其、驼色随意组合都不乱' },
  { t: '撞色 1 : 3', d: '两个高饱和色别对半分，小面积撞才高级' },
  { t: '提亮一件', d: '全身深色加浅色打底，全身浅色压一件深内搭' },
  { t: '亮色 10%', d: '点睛色放领口到胸口，比大面积更抓眼' },
  { t: '花色留里面', d: '格纹条纹做内搭，外面压一件纯色外套' },
  { t: '同色靠材质', d: '同色系用棉、麻、针织、皮革再分一次层' },
  { t: '鞋收尾', d: '鞋选深色收底或米白提亮，别停在中间调' },
  { t: '深浅要拉开', d: '上下至少差两档明度，一样深就闷成一块' },
];

function palRulesStrip() {
  return `<div class="pal-rules-head"><span>小红书爆款配色法则</span><em>整理自高赞笔记</em></div>
  <div class="pal-rules">${PAL_RULES.map((r, i) => `
    <div class="pal-rule" style="--rule-i:${i}">
      <b>${esc(r.t)}</b>
      <p>${esc(r.d)}</p>
    </div>`).join('')}
  </div>`;
}
const PRESET_COLORS = [
  '#F6F4F0', '#E9E4D8', '#D8CCBA', '#D9C7A7', '#B9A98F', '#A9896B',
  '#B0743C', '#6B4F35', '#A34E3B', '#7A3B3F', '#231F1C', '#17181A',
  '#2A2C2E', '#8C8F92', '#D7DADF', '#2C3A55', '#42658A', '#7C93AD',
  '#4C5B44', '#5A6148', '#D8B9B2', '#C4C8CE',
];

function hexRgb(hex) {
  const m = (hex || '#000000').replace('#', '');
  const n = parseInt(m.length === 3 ? m.split('').map((c) => c + c).join('') : m, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function luminance(hex) {
  const [r, g, b] = hexRgb(hex);
  return (r * 299 + g * 587 + b * 114) / 255000;
}

function isLight(hex) { return luminance(hex) > 0.58; }

function hexHsl(hex) {
  const [r0, g0, b0] = hexRgb(hex).map((v) => v / 255);
  const max = Math.max(r0, g0, b0);
  const min = Math.min(r0, g0, b0);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r0) h = (g0 - b0) / d + (g0 < b0 ? 6 : 0);
    else if (max === g0) h = (b0 - r0) / d + 2;
    else h = (r0 - g0) / d + 4;
    h *= 60;
  }
  return { h: Math.round(h), s: Math.round(s * 100), l: Math.round(l * 100) };
}

function colorDist(a, b) {
  const [r1, g1, b1] = hexRgb(a);
  const [r2, g2, b2] = hexRgb(b);
  return Math.sqrt((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2);
}

/** 色相数量（忽略接近无彩的色，允许 22° 误差） */
function distinctHues(swatches) {
  const hues = [];
  swatches.map((s) => hexHsl(s.hex)).forEach((c) => {
    if (c.s < 12) return;
    if (!hues.some((h) => Math.min(Math.abs(h - c.h), 360 - Math.abs(h - c.h)) <= 22)) hues.push(c.h);
  });
  return hues;
}

/** 简笔人形配色示意：颜色按角色落在身上 */
function figureSvg(p) {
  const pick = (role) => (p.swatches.find((s) => s.role === role) || {}).hex;
  const top = pick('上装') || pick('内搭') || '#cfc7ba';
  const inner = pick('内搭') || top;
  const outer = pick('外套');
  const bottom = pick('下装') || '#3a3a38';
  const shoes = pick('鞋') || '#1b1b1b';
  const bag = pick('包');
  const acc = pick('配饰');
  const sleeve = outer || top;
  return `
  <svg class="pal-fig" viewBox="0 0 120 200" aria-hidden="true">
    <ellipse cx="60" cy="190" rx="33" ry="4.5" fill="rgba(0,0,0,.10)" />
    <rect x="55" y="40" width="10" height="12" fill="#E4C4A6" />
    <circle cx="60" cy="28" r="12.5" fill="#E9CBB0" />
    <path d="M47 25a13 13 0 0 1 26 0c0-10-5-15-13-15s-13 5-13 15z" fill="#2B2926" />
    <path d="M44 50h32l3 54H41z" fill="${top}" />
    ${outer ? `
    <path d="M44 50h13l-2 54H41z" fill="${outer}" />
    <path d="M63 50h13l3 54H65z" fill="${outer}" />
    <path d="M56 50l4 14 4-14z" fill="${inner}" />` : ''}
    <rect x="31" y="52" width="12" height="52" rx="6" fill="${sleeve}" />
    <rect x="77" y="52" width="12" height="52" rx="6" fill="${sleeve}" />
    <rect x="44" y="104" width="15" height="52" fill="${bottom}" />
    <rect x="61" y="104" width="15" height="52" fill="${bottom}" />
    <rect x="41" y="156" width="19" height="12" rx="4" fill="${shoes}" />
    <rect x="60" y="156" width="19" height="12" rx="4" fill="${shoes}" />
    ${acc ? `<rect x="49" y="45" width="22" height="6" rx="3" fill="${acc}" />` : ''}
    ${bag ? `<rect x="90" y="90" width="15" height="21" rx="3" fill="${bag}" /><path d="M93 90v-4a5 5 0 0 1 9 0v4" fill="none" stroke="${bag}" stroke-width="2" />` : ''}
  </svg>`;
}

/** 面积条：宽度按角色权重，一眼看出主次 */
function weightBar(p) {
  const total = p.swatches.reduce((n, s) => n + roleWeight(s.role), 0);
  return `<div class="pal-weight">${p.swatches.map((s) => {
    const w = (roleWeight(s.role) / total) * 100;
    return `<i style="flex:0 0 ${w.toFixed(1)}%;background:${s.hex}" title="${esc(s.role)} ${esc(s.name || '')}"></i>`;
  }).join('')}</div>`;
}

/** 可穿性评分：明度差 / 饱和度 / 色相数 / 面积比 */
function paletteScore(p) {
  const lums = p.swatches.map((s) => luminance(s.hex));
  const spread = Math.round((Math.max(...lums) - Math.min(...lums)) * 100);
  const hsls = p.swatches.map((s) => hexHsl(s.hex));
  const sat = Math.round(hsls.reduce((n, c) => n + c.s, 0) / hsls.length);
  const hues = distinctHues(p.swatches);
  const small = p.swatches.filter((s) => roleWeight(s.role) <= 0.06);
  let score = 3;
  const notes = [];

  if (spread >= 30) { score += 1; notes.push(`明度拉开 ${spread} 档，层次清楚`); }
  else if (spread >= 18) notes.push(`明度差 ${spread}，够用`);
  else { score -= 1; notes.push(`明度只差 ${spread}，容易糊成一块`); }

  if (sat > 62) { score -= 1; notes.push(`平均饱和度 ${sat}，彩色面积要收着`); }
  else if (sat < 45) notes.push(`低饱和（${sat}），稳`);

  if (p.kind === 'contrast') {
    if (hues.length >= 2) notes.push(`撞色跨度 ${hueSpan(hues)}°`);
    else { score -= 1; notes.push('看不出撞色，色相太接近'); }
  }
  if (p.kind === 'analog') {
    if (hues.length <= 2) notes.push(`同色系跨度 ${hueSpan(hues)}°，安全`);
    else { score -= 1; notes.push(`${hues.length} 个色相，不够「同色系」`); }
  }
  if (p.kind === 'neutral' && sat > 26) { score -= 1; notes.push(`有彩色混进来（饱和度 ${sat}）`); }
  if (p.kind === 'accent') {
    if (small.length) notes.push('点睛色只占小面积，正确');
    else { score -= 1; notes.push('亮点色面积太大，会抢主色'); }
  }

  return { score: Math.max(1, Math.min(5, score)), spread, sat, hueCount: hues.length, notes };
}

function hueSpan(hues) {
  if (hues.length < 2) return 0;
  let min = Infinity;
  for (let i = 0; i < hues.length; i += 1) {
    for (let j = i + 1; j < hues.length; j += 1) {
      min = Math.min(min, Math.min(Math.abs(hues[i] - hues[j]), 360 - Math.abs(hues[i] - hues[j])));
    }
  }
  return Math.round(min);
}

/** 色相环：把有彩色的位置标出来 */
function hueRing(p) {
  const dots = p.swatches.map((s) => {
    const c = hexHsl(s.hex);
    if (c.s < 10) return '';
    const rad = ((c.h - 90) * Math.PI) / 180;
    const x = 50 + 37 * Math.cos(rad);
    const y = 50 + 37 * Math.sin(rad);
    return `<i class="hue-dot" style="left:${x.toFixed(1)}%;top:${y.toFixed(1)}%;background:${s.hex}" title="${esc(s.name || s.hex)}"></i>`;
  }).join('');
  const grey = p.swatches.filter((s) => hexHsl(s.hex).s < 10).length;
  return `<div class="hue-ring">
    <i class="hue-ring-arc"></i>
    <span class="hue-ring-center">${grey === p.swatches.length ? '全无彩' : '色相'}</span>
    ${dots}
  </div>`;
}

/** 明度阶梯 */
function lumLadder(p) {
  const sorted = p.swatches.slice().sort((a, b) => luminance(b.hex) - luminance(a.hex));
  return sorted.map((s) => {
    const l = Math.round(luminance(s.hex) * 100);
    return `<div class="lum-row">
      <span class="lum-role">${esc(s.role)}</span>
      <span class="lum-track"><i style="width:${Math.max(8, l)}%;background:${s.hex}"></i></span>
      <b>${l}%</b>
    </div>`;
  }).join('');
}

/** 这组配色能用在哪些既有搭配上 */
function looksForPalette(p) {
  const hexes = p.swatches.map((s) => s.hex);
  return publishedLooks()
    .map((l) => {
      const colors = l.palette || [];
      if (!colors.length) return null;
      const score = colors.reduce((sum, c) => sum + Math.min(...hexes.map((h) => colorDist(c, h))), 0) / colors.length;
      return { look: l, score };
    })
    .filter((x) => x && x.score <= 78)
    .sort((a, b) => a.score - b.score)
    .slice(0, 6)
    .map((x) => x.look);
}

/** 把 look 的 hex 数组匹配到最接近的一组配色 */
function matchedPalette(colors) {
  if (!Array.isArray(colors) || !colors.length || !content.palettes.length) return null;
  let best = null;
  let bestScore = Infinity;
  content.palettes.forEach((p) => {
    const hexes = p.swatches.map((s) => s.hex);
    const score = colors.reduce((sum, c) => sum + Math.min(...hexes.map((h) => colorDist(c, h))), 0) / colors.length;
    if (score < bestScore) { bestScore = score; best = p; }
  });
  return bestScore <= 68 ? best : null;
}

/* ---------- 自建配色 ---------- */
function readCustomPalettes() {
  try { return JSON.parse(localStorage.getItem(CUSTOM_PAL_KEY)) || []; } catch (e) { return []; }
}

function writeCustomPalettes(list) {
  localStorage.setItem(CUSTOM_PAL_KEY, JSON.stringify(list));
  content.customPalettes = list;
}

const builder = {
  slots: { 外套: '', 上装: '#F4F1EA', 下装: '#2A2C2E', 鞋: '#17181A' },
  active: '上装',
};

function builderPalette() {
  const swatches = ['外套', '上装', '下装', '鞋']
    .filter((r) => builder.slots[r])
    .map((r) => ({ hex: builder.slots[r], role: r, name: hexName(builder.slots[r]) }));
  return { id: 'draft', kind: 'custom', title: '试色中', swatches };
}

function hexName(hex) {
  const preset = content.palettes.flatMap((p) => p.swatches).find((s) => s.hex.toUpperCase() === hex.toUpperCase());
  return preset ? preset.name || '' : '';
}

/** 猜配色法：无彩 → 中性分层；1 个色相 → 同色系；跨度大 → 撞色 */
function inferKind(swatches) {
  const hues = distinctHues(swatches);
  const sat = swatches.map((s) => hexHsl(s.hex).s).reduce((a, b) => a + b, 0) / swatches.length;
  if (sat < 16 || hues.length === 0) return 'neutral';
  if (hues.length === 1) return 'analog';
  return hueSpan(hues) >= 100 ? 'contrast' : 'analog';
}

function renderBuilder() {
  const draft = builderPalette();
  const sc = paletteScore(draft);
  const roleRow = ['外套', '上装', '下装', '鞋'].map((role) => {
    const hex = builder.slots[role];
    const on = builder.active === role;
    return `<div class="bs-slot ${on ? 'on' : ''}" data-bs-slot="${role}">
      <span class="bs-role">${role}${role === '外套' ? '<em>可选</em>' : ''}</span>
      <i class="bs-chip" style="background:${hex || 'transparent'}" ${hex ? '' : 'data-empty="1"'}></i>
      <b>${hex ? (hexName(hex) || hex.toUpperCase()) : '未选'}</b>
    </div>`;
  }).join('');

  const swatch = PRESET_COLORS.map((c) => `<button class="bs-color ${builder.slots[builder.active] === c ? 'on' : ''}" data-bs-color="${c}" style="background:${c}" aria-label="${c}"></button>`).join('');

  $('#pal-sheet').innerHTML = `
    <div class="pal-sheet-head">
      <span class="pal-sheet-kicker">自建配色 · 点一个角色，再点色块</span>
      <button class="pal-sheet-close" id="pal-close" aria-label="关闭">✕</button>
    </div>
    <div class="bs-body">
      <div class="bs-preview">
        ${figureSvg(draft)}
        <div class="bs-verdict">
          <p class="bs-score"><b>${sc.score}</b><span>/ 5</span><em>${esc(content.palKindLabel[inferKind(draft.swatches)] || '')}</em></p>
          <p class="bs-note">${sc.notes.slice(0, 2).map(esc).join('；')}</p>
        </div>
      </div>
      <div class="bs-slots">${roleRow}</div>
      <div class="bs-picker">
        <div class="bs-picker-head"><span>选颜色</span><button class="bs-clear" id="bs-clear">清空外套</button></div>
        <div class="bs-colors">${swatch}</div>
        <div class="bs-hex">
          <input id="bs-hex" placeholder="#RRGGBB" maxlength="7" inputmode="text" />
          <button class="btn-small" id="bs-apply">填入</button>
        </div>
      </div>
      <div class="bs-actions">
        <button class="btn-small ghost" id="bs-random">随机一组</button>
        <button class="btn-small" id="bs-save">保存到我的配色</button>
      </div>
    </div>`;
}

function openBuilder() {
  builder.active = '上装';
  renderBuilder();
  const backdrop = $('#pal-backdrop');
  const sheet = $('#pal-sheet');
  backdrop.hidden = false;
  sheet.hidden = false;
  sheet.classList.add('sheet-init');
  requestAnimationFrame(() => requestAnimationFrame(() => {
    backdrop.classList.add('show');
    sheet.classList.remove('sheet-init');
    sheet.classList.add('up');
  }));
  palOpen = true;
  document.body.style.overflow = 'hidden';
  pushClose('pal');
}

/* ---------- 列表 ---------- */
function allPalettes() {
  return (content.customPalettes || []).concat(content.palettes);
}

function filteredPalettes() {
  return allPalettes().filter((p) => {
    if (state.palMine) return !!p.custom;
    if (state.palKind !== 'all' && p.kind !== state.palKind) return false;
    if (state.palScene !== 'all' && !(p.scenes || []).includes(state.palScene)) return false;
    return true;
  });
}

function palChips() {
  const kinds = [{ key: 'all', label: '全部' }].concat(content.palKinds);
  $('#pal-chips').innerHTML = kinds.map((k) =>
    `<button class="chip ${state.palKind === k.key && !state.palMine ? 'active' : ''}" data-pal-kind="${k.key}">${esc(k.label)}</button>`
  ).join('');

  const mineBtn = $('#pal-mine-btn');
  if (mineBtn) {
    const n = (content.customPalettes || []).length;
    mineBtn.textContent = n ? `我的配色 ${n}` : '我的配色';
    mineBtn.classList.toggle('is-active', state.palMine);
  }

  const scenes = [{ key: 'all', label: '全部场景' }].concat(content.scenes);
  $('#pal-scenes').innerHTML = scenes.map((s) =>
    `<button class="chip ghost-chip ${state.palScene === s.key ? 'active' : ''}" data-pal-scene="${s.key}">${esc(s.label)}</button>`
  ).join('');
}

function heroPalette() {
  const list = content.palettes;
  if (!list.length) return null;
  if (state.heroId) return list.find((p) => p.id === state.heroId) || list[0];
  const day = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);
  return list[day % list.length];
}

function heroCard(p) {
  const sc = paletteScore(p);
  return `
  <div class="pal-hero" data-pal="${p.id}">
    <div class="pal-hero-head">
      <span class="pal-kind">今日配色 · ${esc(content.palKindLabel[p.kind] || p.kind)}</span>
      <span class="pal-hero-score">${'●'.repeat(sc.score)}${'○'.repeat(5 - sc.score)}</span>
    </div>
    <div class="pal-hero-main">
      ${figureSvg(p)}
      <div class="pal-hero-info">
        <h3>${esc(p.title)}</h3>
        <p>${esc(p.rule)}</p>
        <span class="pal-hero-dots">${p.swatches.map((s) => `<i style="background:${s.hex}"></i>`).join('')}</span>
      </div>
    </div>
  </div>`;
}

function palCard(p, i) {
  const kind = content.palKindLabel[p.kind] || p.kind;
  const compact = i % 4 === 3; // 每四张插一张横条卡，打破节奏
  if (compact) {
    return `
    <div class="pal-card is-compact" data-pal="${p.id}">
      <div class="pal-head"><span class="pal-kind">${esc(kind)}</span></div>
      ${weightBar(p)}
      <b class="pal-title">${esc(p.title)}</b>
      <p class="pal-summary">${esc(p.summary)}</p>
      <div class="pal-roles">${p.swatches.map((s) => `<span>${esc(s.role)}</span>`).join('')}</div>
    </div>`;
  }
  return `
    <div class="pal-card" data-pal="${p.id}">
      <div class="pal-head">
        <span class="pal-kind">${esc(kind)}</span>
        ${p.custom ? '<span class="pal-mine-tag">我的</span>' : ''}
      </div>
      <div class="pal-card-body">
        ${figureSvg(p)}
        <div class="pal-card-dots">${p.swatches.map((s) => `<i style="background:${s.hex}"></i>`).join('')}</div>
      </div>
      <b class="pal-title">${esc(p.title)}</b>
      <p class="pal-summary">${esc(p.summary)}</p>
    </div>`;
}

function renderPalettes() {
  palChips();
  // 自建视图下这两个筛选没有意义，收起来
  $('#pal-chips').hidden = state.palMine;
  $('#pal-scenes').hidden = state.palMine;
  const rulesEl = $('#pal-rules');
  if (rulesEl) rulesEl.innerHTML = rulesEl.dataset.loaded ? rulesEl.innerHTML : palRulesStrip();
  if (rulesEl) rulesEl.dataset.loaded = '1';
  const list = filteredPalettes();
  const hero = state.palMine || state.palKind !== 'all' || state.palScene !== 'all' ? null : heroPalette();
  $('#pal-empty').hidden = list.length > 0;
  if (!list.length) {
    $('#pal-empty').innerHTML = state.palMine
      ? '<div class="empty-icon">◐</div><p class="empty-title">还没有自建配色</p><p class="empty-sub">点上面的「＋ 自建试色」，选 2–4 个颜色试试</p>'
      : '<div class="empty-icon">◐</div><p class="empty-title">这个类别下暂时没有配色</p><p class="empty-sub">换个类别或场景看看</p>';
  }
  $('#pal-grid').innerHTML =
    (hero ? heroCard(hero) : '') +
    list.map((p, i) => palCard(p, i)).join('');
  const sub = $('#view-palettes .page-sub');
  if (sub) sub.textContent = `已收录 ${content.palettes.length} 组${(content.customPalettes || []).length ? ` + 自建 ${content.customPalettes.length} 组` : ''} · 颜色怎么配、能不能穿，点开就知道`;
}

/* ---------- 详情 ---------- */
function renderPalSheet(p) {
  const kind = content.palKindLabel[p.kind] || p.kind;
  const sc = paletteScore(p);
  const looks = looksForPalette(p);
  const total = p.swatches.reduce((n, s) => n + roleWeight(s.role), 0);
  const meta = [
    (p.scenes || []).map((s) => content.sceneLabel[s]).filter(Boolean).join(' / '),
    (p.seasons || []).map((s) => content.seasonLabel[s]).filter(Boolean).join(''),
  ].filter(Boolean).join(' · ');

  $('#pal-sheet').innerHTML = `
    <div class="pal-sheet-head">
      <span class="pal-sheet-kicker">${esc(kind)}${meta ? ' · ' + esc(meta) : ''}</span>
      <button class="pal-sheet-close" id="pal-close" aria-label="关闭">✕</button>
    </div>
    <div class="pal-detail">
      <h3 class="pal-sheet-title">${esc(p.title)}</h3>
      <div class="pal-detail-top">
        ${figureSvg(p)}
        <div class="pal-rows">
          ${p.swatches.map((s) => {
            const w = roleWeight(s.role) / total;
            return `<div class="pal-row" style="flex:${w.toFixed(3)} 1 0;background:${s.hex};color:${isLight(s.hex) ? '#26251f' : '#f6f4f0'}">
              <span>${esc(s.role)}</span><b>${esc(s.name || '')}</b><i data-hex="${s.hex}">${s.hex.toUpperCase()}</i>
            </div>`;
          }).join('')}
        </div>
      </div>

      <div class="pal-score-card">
        <div class="pal-score-num"><b>${sc.score}</b><span>/5</span></div>
        <div class="pal-score-text">
          <b>可穿性</b>
          <p>${sc.notes.slice(0, 3).map(esc).join('；')}</p>
        </div>
      </div>

      <p class="pal-sheet-rule">${esc(p.rule)}</p>

      <p class="sec-title">明度阶梯</p>
      <div class="lum-ladder">${lumLadder(p)}</div>

      <p class="sec-title">色相位置</p>
      <div class="pal-hue-wrap">
        ${hueRing(p)}
        <div class="pal-hue-legend">
          <p>${sc.hueCount ? `${sc.hueCount} 个色相 · 跨度 ${hueSpan(distinctHues(p.swatches))}°` : '全无彩，靠明度分层'}</p>
          <p class="muted">平均饱和度 ${sc.sat} · 明度差 ${sc.spread}</p>
        </div>
      </div>

      ${p.tip ? `<div class="tip-box"><b>照着抄</b><p>${esc(p.tip)}</p></div>` : ''}

      ${p.guide ? `
      <p class="sec-title">穿搭图文建议</p>
      <div class="pal-guide">
        <div class="pg-block">
          <b>搭配公式</b>
          <p>${esc(p.guide.outfit)}</p>
        </div>
        <div class="pg-items">${(p.guide.items || []).map((it) => `<span>${esc(it)}</span>`).join('')}</div>
        <div class="pg-block pg-avoid">
          <b>避雷</b>
          <p>${esc(p.guide.avoid)}</p>
        </div>
        <div class="pg-caption">
          <div class="pg-cap-head"><b>发布文案</b><button class="btn-mini" id="pal-copy-cap">复制文案</button></div>
          <p>${esc(p.guide.caption)}</p>
        </div>
      </div>` : ''}

      ${looks.length ? `
      <p class="sec-title">能这么穿的搭配</p>
      <div class="rel-grid pal-looks">
        ${looks.map((l) => `<div class="rel-card" data-look="${l.id}">
          <img src="${imageSrc(l)}" alt="${esc(l.title)}" loading="lazy" />
          <p>${esc(l.title)}</p>
        </div>`).join('')}
      </div>` : ''}

      <div class="pal-detail-actions">
        <button class="btn-small ghost" id="pal-copy">复制全部色值</button>
        ${p.custom ? `<button class="btn-small ghost danger" id="pal-del" data-del="${p.id}">删除这组</button>` : ''}
      </div>
    </div>`;
}

function openPalSheet(id) {
  const p = allPalettes().find((x) => x.id === id);
  if (!p) return;
  renderPalSheet(p);
  const backdrop = $('#pal-backdrop');
  const sheet = $('#pal-sheet');
  backdrop.hidden = false;
  sheet.hidden = false;
  sheet.classList.add('sheet-init');
  requestAnimationFrame(() => requestAnimationFrame(() => {
    backdrop.classList.add('show');
    sheet.classList.remove('sheet-init');
    sheet.classList.add('up');
  }));
  palOpen = true;
  document.body.style.overflow = 'hidden';
  pushClose('pal');
}

function closePal(fromPop) {
  if (!palOpen) return;
  palOpen = false;
  $('#pal-backdrop').classList.remove('show');
  $('#pal-sheet').classList.remove('up');
  $('#pal-sheet').classList.add('sheet-init');
  document.body.style.overflow = '';
  if (!fromPop) popClose();
  setTimeout(() => {
    $('#pal-backdrop').hidden = true;
    $('#pal-sheet').hidden = true;
    $('#pal-sheet').innerHTML = '';
  }, 320);
}

/** 从搭配详情跳到配色页并展开对应配色 */
function gotoPalette(id) {
  const p = allPalettes().find((x) => x.id === id);
  if (!p) return;
  closeSheet(true);
  history.replaceState({}, '');
  state.palKind = 'all';
  state.palScene = 'all';
  state.palMine = false;
  switchTab('palettes');
  setTimeout(() => openPalSheet(id), 330);
}

/* ---------- 收藏 ---------- */
function onFavToggle(btn) {
  const id = btn.dataset.fav;
  const added = storage.toggleFav(id);
  document.querySelectorAll(`[data-fav="${id}"]`).forEach((el) => {
    el.classList.toggle('faved', added);
    const svg = el.querySelector('svg');
    if (svg) svg.setAttribute('fill', added ? 'currentColor' : 'none');
  });
  toast(added ? '已加入收藏 ♡' : '已取消收藏');
  renderFavs();
  updateStats();
}

function renderFavs() {
  const all = storage.data.favs.map((id) => lookById[id]).filter(Boolean);
  const bar = $('#fav-filters');
  const styleKeys = [];
  all.forEach((l) => (l.styles || []).forEach((s) => { if (!styleKeys.includes(s)) styleKeys.push(s); }));

  // 收藏少于 3 套或只有一个风格时，不需要分组
  const showBar = all.length >= 3 && styleKeys.length > 1;
  bar.hidden = !showBar;
  if (showBar) {
    bar.innerHTML = [{ key: 'all', label: `全部 ${all.length}` }]
      .concat(styleKeys.map((s) => ({ key: s, label: `${content.styleLabel[s] || s} ${all.filter((l) => l.styles.includes(s)).length}` })))
      .map((c) => `<button class="chip ${state.favStyle === c.key ? 'active' : ''}" data-fav-style="${c.key}">${esc(c.label)}</button>`)
      .join('');
  }

  let favs = state.favStyle === 'all' ? all : all.filter((l) => (l.styles || []).includes(state.favStyle));
  // 取消收藏后当前分组可能空了：自动退回「全部」
  if (all.length && !favs.length && state.favStyle !== 'all') { state.favStyle = 'all'; return renderFavs(); }
  $('#fav-empty').hidden = favs.length > 0;
  $('#fav-count').textContent = state.favStyle === 'all'
    ? `${all.length} 套搭配`
    : `${content.styleLabel[state.favStyle] || state.favStyle} · ${favs.length} / ${all.length} 套`;
  $('#fav-masonry').innerHTML = favs.map((l, i) => lookCard(l, i)).join('');
  if (!$('#view-favs').hidden) layoutMasonry($('#fav-masonry'));
}

function updateStats() {
  $('#stat-fav').textContent = storage.data.favs.length;
  $('#stat-seen').textContent = storage.data.seen.length;
  $('#stat-styles').textContent = content.styles.length;
}

/* ---------- 草稿箱（素材库收录） ---------- */
function renderDrafts() {
  const strip = $('#draft-strip');
  const count = $('#draft-count');
  if (!strip || !count) return;
  const arr = content.drafts;
  count.textContent = arr.length ? `${arr.length} 条` : '暂无';
  strip.hidden = !arr.length;
  strip.innerHTML = arr.map((d) => `
    <div class="draft-chip" data-look="${esc(d.id)}">
      <img src="${imageSrc(d)}" alt="${esc(d.title)}" loading="lazy" />
      <p>${esc(d.title)}</p>
    </div>`).join('');
}

function dropDraft(id) {
  if (!confirm('把这套草稿移出草稿箱？')) return;
  writeDrafts(readDrafts().filter((d) => d.id !== id));
  delete lookById[id];
  closeSheet();
  loadDrafts();
  renderDrafts();
  renderTabs();
  renderFeed();
  toast('已移出草稿箱');
}

function exportDrafts() {
  if (!content.drafts.length) return toast('草稿箱还是空的');
  const clean = content.drafts.map((d) => {
    const copy = Object.assign({}, d);
    delete copy.isDraft;
    return copy;
  });
  const blob = new Blob([JSON.stringify(clean, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `looks-drafts-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 3000);
  toast('已导出，粘贴进 content/looks.json 的 looks 数组即可发布');
}

/** 我的页：身高段选择 */function renderHeightPicks() {
  const my = storage.data.profile.height;
  const box = $('#height-picks');
  if (!box) return;
  box.innerHTML = content.heights.map((h) =>
    `<button class="hpick ${my === h.key ? 'on' : ''}" data-myheight="${h.key}">${esc(h.label)}</button>`
  ).join('');
  const hint = $('#height-hint');
  if (hint) {
    hint.textContent = my
      ? `当前 ${bandByKey(my)?.label ?? ''}cm：灵感页默认只看这个身高段，再点一次取消。`
      : '设一次，之后默认先看你这个身高段穿得上的搭配。';
  }
}

/* ---------- 搜索 ---------- */
const SEARCH_HISTORY_KEY = 'xingge.search.history';

function readHistory() {
  try {
    const arr = JSON.parse(localStorage.getItem(SEARCH_HISTORY_KEY) || '[]');
    return Array.isArray(arr) ? arr.filter((x) => typeof x === 'string').slice(0, 8) : [];
  } catch (e) { return []; }
}

function pushHistory(q) {
  const kw = q.trim();
  if (!kw) return;
  const arr = readHistory().filter((x) => x !== kw);
  arr.unshift(kw);
  try { localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(arr.slice(0, 8))); } catch (e) {}
}

/** 热门标签：取出现频次最高的标签词，凑 8 个 */
function hotTags() {
  const freq = {};
  publishedLooks().forEach((l) => {
    (l.tags || []).forEach((t) => { freq[t] = (freq[t] || 0) + 1; });
    (l.styles || []).forEach((s) => {
      const lb = content.styleLabel[s];
      if (lb) freq[lb] = (freq[lb] || 0) + 1;
    });
  });
  return Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([t]) => t);
}

function renderSearchHome() {
  const box = $('#search-results');
  const hist = readHistory();
  const hot = hotTags();
  box.innerHTML = `
    ${hist.length ? `
      <div class="search-block">
        <div class="search-block-head"><span>最近搜索</span><button class="search-clear" id="clear-history">清空</button></div>
        <div class="search-chips">${hist.map((h) => `<button class="schip" data-q="${esc(h)}">${esc(h)}</button>`).join('')}</div>
      </div>` : ''}
    <div class="search-block">
      <div class="search-block-head"><span>热门标签</span></div>
      <div class="search-chips">${hot.map((h) => `<button class="schip hot" data-q="${esc(h)}">${esc(h)}</button>`).join('')}</div>
    </div>
    <p class="search-hint">也可以试试「西装」「白色」「约会」…</p>`;
}

function searchLooks(q) {
  const kw = q.trim().toLowerCase();
  if (!kw) return [];
  return publishedLooks().filter((l) => {
    const hay = [
      l.title, l.summary, l.desc, l.tip,
      ...(l.styles || []).map((s) => content.styleLabel[s] || ''),
      ...(l.scenes || []).map((s) => content.sceneLabel[s] || ''),
      ...(l.seasons || []).map((s) => content.seasonLabel[s] || ''),
      ...(l.tags || []),
      ...(l.items || []).flatMap((it) => [content.catLabel[it.cat] || '', it.name, it.note || '']),
    ].join(' ').toLowerCase();
    return hay.includes(kw);
  });
}

function searchPalette(q) {
  const kw = q.trim().toLowerCase();
  if (!kw) return [];
  return content.palettes.filter((p) => {
    const hay = [
      p.title, p.summary, p.rule, p.tip,
      content.palKindLabel[p.kind] || '',
      ...(p.swatches || []).flatMap((s) => [s.name, s.role, s.hex]),
      ...(p.scenes || []).map((s) => content.sceneLabel[s] || ''),
      ...(p.seasons || []).map((s) => content.seasonLabel[s] || ''),
    ].join(' ').toLowerCase();
    return hay.includes(kw);
  });
}

function renderSearch(q) {
  const box = $('#search-results');
  if (!q.trim()) {
    renderSearchHome();
    return;
  }
  const hits = searchLooks(q);
  const pals = searchPalette(q);
  if (!hits.length && !pals.length) {
    box.innerHTML = `<p class="search-hint">没有找到「${esc(q)}」相关搭配</p>`;
    return;
  }
  box.innerHTML = `
    ${pals.length ? `
      <p class="search-sec">配色 · ${pals.length} 组</p>
      <div class="pal-grid search-pal">${pals.map(palCard).join('')}</div>` : ''}
    ${hits.length ? `
      ${pals.length ? `<p class="search-sec">搭配 · ${hits.length} 套</p>` : ''}
      <div class="masonry">${hits.map((l, i) => lookCard(l, i)).join('')}</div>` : ''}`;
  const m = box.querySelector('.masonry');
  if (m) layoutMasonry(m);
}

function openSearch() {
  $('#search-layer').hidden = false;
  document.body.style.overflow = 'hidden';
  searchOpen = true;
  renderSearchHome();
  pushClose('search');
  setTimeout(() => $('#search-input').focus(), 60);
}

function closeSearch(fromPop) {
  if (!searchOpen) return;
  searchOpen = false;
  $('#search-layer').hidden = true;
  $('#search-input').value = '';
  document.body.style.overflow = '';
  if (!fromPop) popClose();
}

/* ---------- 标签页 ---------- */
function switchTab(tab) {
  state.tab = tab;
  document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === tab));
  ['home', 'palettes', 'favs', 'me'].forEach((v) => { $(`#view-${v}`).hidden = v !== tab; });
  // 筛选只在灵感页出现，其他页把顶部空间让出来
  const isHome = tab === 'home';
  $('#style-tabs').hidden = !isHome;
  $('#scene-chips').hidden = !isHome;
  if (!isHome) $('#height-chips').hidden = true;
  else renderHeightChips();
  window.scrollTo({ top: 0 });
  if (tab === 'palettes') renderPalettes();
  if (tab === 'favs') { renderFavs(); layoutMasonry($('#fav-masonry')); }
  if (tab === 'me') { updateStats(); renderHeightPicks(); renderDrafts(); }
}

/* ---------- 分享 ---------- */
async function shareApp() {
  const data = {
    title: '型格 LOOKBOOK · 男士穿搭图鉴',
    text: '发现一个很棒的男士穿搭 App，快来一起学穿搭！',
    url: location.href.split('?')[0],
  };
  try {
    if (navigator.share) await navigator.share(data);
    else { await navigator.clipboard.writeText(data.url); toast('链接已复制，去粘贴给朋友吧'); }
  } catch (e) { /* 用户取消 */ }
}

/* ---------- 事件 ---------- */
function bindEvents() {
  $('#style-tabs').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-style]');
    if (!btn) return;
    state.style = btn.dataset.style;
    renderTabs();
    renderFeed();
    if (btn.scrollIntoView) btn.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
  });

  $('#scene-chips').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-scene]');
    if (!btn) return;
    state.scene = btn.dataset.scene;
    renderTabs();
    renderFeed();
  });

  $('#height-chips').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-height]');
    if (!btn) return;
    state.height = btn.dataset.height;
    renderTabs();
    renderFeed();
    if (btn.scrollIntoView) btn.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
  });

  $('#fav-filters').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-fav-style]');
    if (!btn) return;
    state.favStyle = btn.dataset.favStyle;
    renderFavs();
    layoutMasonry($('#fav-masonry'));
  });

  // 配色页：分类 / 场景 / 我的 筛选
  $('#pal-mine-btn').addEventListener('click', () => {
    state.palMine = !state.palMine;
    if (state.palMine) { state.palKind = 'all'; state.palScene = 'all'; }
    renderPalettes();
  });
  $('#pal-chips').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-pal-kind]');
    if (!btn) return;
    state.palKind = btn.dataset.palKind;
    state.palMine = false;
    renderPalettes();
  });
  $('#pal-scenes').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-pal-scene]');
    if (!btn) return;
    state.palScene = btn.dataset.palScene;
    state.palMine = false;
    renderPalettes();
  });
  $('#pal-shuffle').addEventListener('click', () => {
    const list = content.palettes;
    if (list.length < 2) return;
    let next = heroPalette();
    while (next && next.id === (state.heroId || (heroPalette() || {}).id)) next = list[Math.floor(Math.random() * list.length)];
    state.heroId = next.id;
    state.palKind = 'all';
    state.palScene = 'all';
    state.palMine = false;
    renderPalettes();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
  $('#pal-build').addEventListener('click', openBuilder);

  $('#pal-backdrop').addEventListener('click', () => closePal());
  $('#pal-sheet').addEventListener('click', (e) => {
    if (e.target.closest('#pal-close')) { closePal(); return; }

    // 详情里点某套搭配 → 关掉配色层再开搭配详情
    const lookCard = e.target.closest('[data-look]');
    if (lookCard) {
      e.stopPropagation();
      const id = lookCard.dataset.look;
      closePal(true);
      history.replaceState({}, '');
      setTimeout(() => openSheet(id), 330);
      return;
    }

    // 试色器交互
    const slot = e.target.closest('[data-bs-slot]');
    if (slot) { builder.active = slot.dataset.bsSlot; renderBuilder(); return; }
    const color = e.target.closest('[data-bs-color]');
    if (color) {
      builder.slots[builder.active] = color.dataset.bsColor;
      const order = ['外套', '上装', '下装', '鞋'];
      const nextEmpty = order.find((r) => !builder.slots[r] && r !== builder.active);
      builder.active = nextEmpty || builder.active;
      renderBuilder();
      return;
    }
    if (e.target.closest('#bs-clear')) { builder.slots.外套 = ''; renderBuilder(); return; }
    if (e.target.closest('#bs-random')) {
      const pickRandom = (pool) => pool[Math.floor(Math.random() * pool.length)];
      builder.slots = { 外套: pickRandom(PRESET_COLORS), 上装: pickRandom(PRESET_COLORS), 下装: pickRandom(PRESET_COLORS), 鞋: pickRandom(PRESET_COLORS) };
      renderBuilder();
      return;
    }
    if (e.target.closest('#bs-apply')) {
      const input = $('#bs-hex');
      const v = (input.value || '').trim();
      const hex = v.startsWith('#') ? v : '#' + v;
      if (!/^#[0-9a-fA-F]{6}$/.test(hex)) { toast('请输入 #RRGGBB 格式的色值'); return; }
      builder.slots[builder.active] = hex.toUpperCase();
      input.value = '';
      renderBuilder();
      return;
    }
    if (e.target.closest('#bs-save')) {
      const draft = builderPalette();
      if (draft.swatches.length < 2) { toast('至少选两个颜色'); return; }
      const list = readCustomPalettes();
      const kind = inferKind(draft.swatches);
      list.unshift({
        id: 'pal-custom-' + Date.now(),
        kind,
        custom: true,
        title: draft.swatches.map((s) => s.name || s.hex.toUpperCase()).slice(0, 2).join(' × ') || '我的配色',
        summary: `${draft.swatches.length} 色 · 自建`,
        swatches: draft.swatches,
        rule: '这是你自己配的一组颜色。判断只看三件事：主色占大面积、深色压住下半身、亮色只做小面积点缀。',
        tip: '拿不准时把手机调到黑白屏看一眼——还能分出上下的层次，就说明明度够。',
        scenes: [], seasons: [],
        status: 'published',
      });
      writeCustomPalettes(list);
      toast('已存入「我的配色」');
      state.palMine = true;
      state.palKind = 'all';
      state.palScene = 'all';
      renderPalettes();
      closePal();
      return;
    }

    // 删除自建配色
    const del = e.target.closest('[data-del]');
    if (del) {
      const id = del.dataset.del;
      writeCustomPalettes(readCustomPalettes().filter((x) => x.id !== id));
      renderPalettes();
      toast('已删除');
      closePal();
      return;
    }

    const copyAll = e.target.closest('#pal-copy');
    if (copyAll) {
      const hexes = Array.from(document.querySelectorAll('#pal-sheet [data-hex]')).map((x) => x.dataset.hex);
      if (navigator.clipboard) navigator.clipboard.writeText(hexes.join(' ')).then(() => toast('色值已复制'));
      return;
    }
    const copyCap = e.target.closest('#pal-copy-cap');
    if (copyCap) {
      const cap = copyCap.closest('.pg-caption').querySelector('p');
      if (cap && navigator.clipboard) navigator.clipboard.writeText(cap.textContent).then(() => toast('文案已复制，去发笔记吧'));
      return;
    }
    const hexEl = e.target.closest('[data-hex]');
    if (hexEl && navigator.clipboard) {
      navigator.clipboard.writeText(hexEl.dataset.hex).then(() => toast(`已复制 ${hexEl.dataset.hex}`));
    }
  });

  $('#height-picks').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-myheight]');
    if (!btn) return;
    const key = btn.dataset.myheight;
    const same = storage.data.profile.height === key;
    storage.setHeight(same ? '' : key);
    if (same) {
      toast('已清除身高设置');
    } else {
      state.height = key;
      toast(`已设为 ${bandByKey(key)?.label || ''}cm，灵感页只显示穿得上的搭配`);
    }
    renderHeightPicks();
    renderTabs();
    renderFeed();
  });

  document.addEventListener('click', (e) => {
    const favBtn = e.target.closest('[data-fav]');
    if (favBtn) { e.stopPropagation(); onFavToggle(favBtn); return; }
    const nav = e.target.closest('[data-sheet-nav]');
    if (nav) { e.stopPropagation(); const next = sheetCtx.list[sheetCtx.idx + Number(nav.dataset.sheetNav)]; if (next) openSheet(next.id); return; }
    const drop = e.target.closest('[data-drop]');
    if (drop) { e.stopPropagation(); dropDraft(drop.dataset.drop); return; }
    const palLink = e.target.closest('[data-pal-link]');
    if (palLink) { e.stopPropagation(); gotoPalette(palLink.dataset.palLink); return; }
    // 配色卡（配色页 / 搜索结果共用同一套委托）
    const palCardEl = e.target.closest('[data-pal]');
    if (palCardEl) {
      if (searchOpen) { closeSearch(true); history.replaceState({}, ''); }
      openPalSheet(palCardEl.dataset.pal);
      return;
    }
    const card = e.target.closest('[data-look]');
    if (card) { openSheet(card.dataset.look); return; }
    const goto = e.target.closest('[data-goto]');
    if (goto) switchTab(goto.dataset.goto);
  });

  // 详情层左右滑动切换上一套 / 下一套
  let swipeX = null, swipeY = null;
  $('#sheet').addEventListener('touchstart', (e) => {
    const t = e.touches[0]; swipeX = t.clientX; swipeY = t.clientY;
  }, { passive: true });
  $('#sheet').addEventListener('touchend', (e) => {
    if (swipeX == null || !sheetOpen) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - swipeX, dy = t.clientY - swipeY;
    swipeX = swipeY = null;
    if (Math.abs(dx) < 60 || Math.abs(dy) > 50) return;
    const next = sheetCtx.list[sheetCtx.idx + (dx < 0 ? 1 : -1)];
    if (next) openSheet(next.id);
  }, { passive: true });

  $('#sheet-backdrop').addEventListener('click', () => closeSheet());
  $('#sheet').addEventListener('click', (e) => { if (e.target.closest('#sheet-close')) closeSheet(); });

  document.querySelectorAll('.tab').forEach((t) => t.addEventListener('click', () => switchTab(t.dataset.tab)));

  $('#btn-search').addEventListener('click', openSearch);
  $('#btn-cancel-search').addEventListener('click', () => closeSearch());
  $('#search-input').addEventListener('input', (e) => renderSearch(e.target.value));
  $('#search-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { pushHistory(e.target.value); e.target.blur(); renderSearch(e.target.value); }
  });
  $('#search-results').addEventListener('click', (e) => {
    const chip = e.target.closest('[data-q]');
    if (chip) {
      const q = chip.dataset.q;
      $('#search-input').value = q;
      pushHistory(q);
      renderSearch(q);
      return;
    }
    if (e.target.closest('#clear-history')) {
      try { localStorage.removeItem(SEARCH_HISTORY_KEY); } catch (err) {}
      renderSearchHome();
      return;
    }
    if (e.target.closest('[data-look]')) pushHistory($('#search-input').value);
  });

  $('#btn-share-top').addEventListener('click', shareApp);
  $('#btn-share-app').addEventListener('click', shareApp);
  $('#btn-export-drafts').addEventListener('click', exportDrafts);
  $('#btn-goto-materials').addEventListener('click', () => { location.href = 'materials.html'; });
  $('#btn-clear-drafts').addEventListener('click', () => {
    if (!content.drafts.length) return toast('草稿箱已经是空的');
    if (!confirm('清空全部草稿？导出过 JSON 的记得先保存。')) return;
    writeDrafts([]);
    content.drafts.forEach((d) => delete lookById[d.id]);
    loadDrafts();
    renderDrafts();
    renderTabs();
    renderFeed();
    toast('草稿箱已清空');
  });
  $('#btn-clear-favs').addEventListener('click', () => {
    if (!storage.data.favs.length) return toast('收藏已经是空的啦');
    if (confirm('确定清空全部收藏吗？此操作不可恢复。')) {
      storage.clearFavs(); state.favStyle = 'all'; renderFavs(); updateStats(); toast('已清空收藏');
    }
  });

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    state.deferredInstall = e;
    $('#install-card').hidden = false;
  });
  $('#btn-install').addEventListener('click', async () => {
    if (!state.deferredInstall) return;
    state.deferredInstall.prompt();
    const { outcome } = await state.deferredInstall.userChoice;
    if (outcome === 'accepted') { $('#install-card').hidden = true; toast('已添加到桌面'); }
    state.deferredInstall = null;
  });
  window.addEventListener('appinstalled', () => {
    $('#install-card').hidden = true;
    toast('安装成功');
  });

  window.addEventListener('resize', relayoutVisible);
  window.addEventListener('orientationchange', relayoutVisible);
}

/* ---------- 启动 ---------- */
async function loadContent() {
  const get = (file) => fetch(`${CONTENT_BASE}/${file}`).then((r) => {
    if (!r.ok) throw new Error(`${file} ${r.status}`);
    return r.json();
  });
  const [tax, looksData, editorialsData, palettesData] = await Promise.all([
    get('taxonomy.json'), get('looks.json'), get('editorials.json'), get('palettes.json'),
  ]);

  content.styles = tax.styles || [];
  content.scenes = tax.scenes || [];
  content.seasons = tax.seasons || [];
  content.cats = tax.itemCategories || [];
  content.heights = (tax.heights || []).filter((h) => h.key !== 'unknown');
  tax.styles.forEach((s) => { content.styleLabel[s.key] = s.label; });
  tax.scenes.forEach((s) => { content.sceneLabel[s.key] = s.label; });
  tax.seasons.forEach((s) => { content.seasonLabel[s.key] = s.label; });
  tax.itemCategories.forEach((c) => { content.catLabel[c.key] = c.label; });

  content.looks = (looksData.looks || []).filter((l) => l.status === 'published');
  content.looks.forEach((l) => { lookById[l.id] = l; });
  content.editorials = (editorialsData.editorials || []).filter((e) => e.status !== 'draft');
  content.palettes = (palettesData.palettes || []).filter((p) => p.status !== 'draft');
  content.palKinds = palettesData.kinds || [];
  content.palKinds.forEach((k) => { content.palKindLabel[k.key] = k.label; });
  content.customPalettes = readCustomPalettes();
  loadDrafts();
}

/** 本地草稿（素材库收录）→ 可渲染的 look 对象 */
function loadDrafts() {
  content.drafts = readDrafts().map((d) => Object.assign({}, d, { isDraft: true }));
  content.drafts.forEach((d) => { lookById[d.id] = d; });
}

async function boot() {
  storage.load();
  $('#loading').hidden = true;
  renderSkeleton();
  try {
    await loadContent();
  } catch (e) {
    $('#loading').hidden = true;
    $('#load-error').hidden = false;
    $('#load-error-msg').innerHTML =
      `无法读取 <code>content/*.json</code>（${esc(e.message)}）。<br/>请用本地服务器打开，例如在项目根目录执行：<br/><code>python -m http.server 8765</code>`;
    return;
  }
  // 上次设置过身高，就直接按它过滤灵感页
  if (storage.data.profile.height && bandByKey(storage.data.profile.height)) {
    state.height = storage.data.profile.height;
  }
  renderTabs();
  renderFeed();
  renderFavs();
  renderHeightPicks();
  renderDrafts();
  updateStats();
  bindEvents();

  // 支持 PWA 快捷方式：?tab=favs / ?tab=me
  const tabParam = new URLSearchParams(location.search).get('tab');
  if (['home', 'palettes', 'favs', 'me'].includes(tabParam)) switchTab(tabParam);
}

boot();
