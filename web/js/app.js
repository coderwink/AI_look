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
  styleLabel: {}, sceneLabel: {}, seasonLabel: {}, catLabel: {},
};

const state = { tab: 'home', style: 'all', scene: 'all', height: 'all', deferredInstall: null };
let sheetOpen = false;
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
        ${look.palette.map((c) => `<div class="sw" style="background:${esc(c)}"><span>${esc(c.toUpperCase())}</span></div>`).join('')}
      </div>` : ''}

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
  const favs = storage.data.favs.map((id) => lookById[id]).filter(Boolean);
  $('#fav-empty').hidden = favs.length > 0;
  $('#fav-count').textContent = `${favs.length} 套搭配`;
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

function renderSearch(q) {
  const box = $('#search-results');
  if (!q.trim()) {
    box.innerHTML = `<p class="search-hint">试试搜「西装」「白色」「约会」…</p>`;
    return;
  }
  const hits = searchLooks(q);
  if (!hits.length) {
    box.innerHTML = `<p class="search-hint">没有找到「${esc(q)}」相关搭配</p>`;
    return;
  }
  box.innerHTML = `<div class="masonry">${hits.map((l, i) => lookCard(l, i)).join('')}</div>`;
  layoutMasonry(box.querySelector('.masonry'));
}

function openSearch() {
  $('#search-layer').hidden = false;
  document.body.style.overflow = 'hidden';
  searchOpen = true;
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
  ['home', 'favs', 'me'].forEach((v) => { $(`#view-${v}`).hidden = v !== tab; });
  // 筛选只在灵感页出现，收藏 / 我的页把顶部空间让出来
  const isHome = tab === 'home';
  $('#style-tabs').hidden = !isHome;
  $('#scene-chips').hidden = !isHome;
  if (!isHome) $('#height-chips').hidden = true;
  else renderHeightChips();
  window.scrollTo({ top: 0 });
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
      storage.clearFavs(); renderFavs(); updateStats(); toast('已清空收藏');
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
  const [tax, looksData, editorialsData] = await Promise.all([
    get('taxonomy.json'), get('looks.json'), get('editorials.json'),
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
  loadDrafts();
}

/** 本地草稿（素材库收录）→ 可渲染的 look 对象 */
function loadDrafts() {
  content.drafts = readDrafts().map((d) => Object.assign({}, d, { isDraft: true }));
  content.drafts.forEach((d) => { lookById[d.id] = d; });
}

async function boot() {
  storage.load();
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
  if (['home', 'favs', 'me'].includes(tabParam)) switchTab(tabParam);
}

boot();
