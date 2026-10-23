/**
 * 小红书素材采集器
 *
 * 用法:
 *   node xhs-collect.cjs list   <博主主页URL> [--state 名称]
 *   node xhs-collect.cjs search <搜索页URL>   [--state 名称] [--max 条数]
 *   node xhs-collect.cjs detail <URL>         [--state 名称]
 *
 * 说明:
 *   - list   : 滚动博主主页，收集全部笔记索引
 *   - search : 滚动搜索结果页，收集笔记索引（需登录；建议配合 --max 控制批量）
 *   - detail : 逐条打开笔记详情，下载图片（封面/图集），可断点续跑
 *
 *   --state 名称  指定状态文件 content/xhs/_state.<名称>.json（默认 _state.json）
 *   --max 条数    本次最多收集多少条（search / list 阶段有效）
 *
 * 图片目录统一为 content/xhs/<noteId>/，不同来源的笔记 id 不会冲突。
 */
const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const ROOT = path.join(__dirname, '..', 'content', 'xhs');
const HOME = 'C:/Users/10677/.workbuddy';

/* ---------- 参数解析 ---------- */
const argv = process.argv.slice(2);
const phase = argv[0];
function flag(name, def) {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : def;
}
const STATE_NAME = flag('state', '');
const MAX_ITEMS = parseInt(flag('max', '0'), 10) || 0;
const TARGET_URL = argv.slice(1).find(a => /^https?:/.test(a));

const STATE_FILE = path.join(ROOT, STATE_NAME ? `_state.${STATE_NAME}.json` : '_state.json');

/* 浏览器配置目录
 * 长期复用同一个 Chrome 配置目录容易被残留锁/缓存搞成「渲染进程卡死」，
 * 所以每次运行：从种子目录复制登录凭证 → 用独立副本跑 → 结束后把 cookie 写回种子。
 * 种子目录优先 env XHS_PROFILE_DIR，其次 ~/.workbuddy/xhs-lean。
 */
function pickSeed() {
  if (process.env.XHS_PROFILE_DIR) return process.env.XHS_PROFILE_DIR;
  for (const d of ['xhs-lean', 'xhs-session']) {
    const p = path.join(HOME, d);
    if (fs.existsSync(path.join(p, 'Local State'))) return p;
  }
  return path.join(HOME, 'xhs-lean');
}
const SEED_DIR = pickSeed();
const RUN_DIR = path.join(__dirname, '..', '.tmp', `profile-${Date.now()}`);
const PROFILE_FILES = ['Local State', 'Default/Preferences', 'Default/Network/Cookies'];

function bootstrapProfile() {
  fs.rmSync(RUN_DIR, { recursive: true, force: true });
  for (const rel of PROFILE_FILES) {
    const src = path.join(SEED_DIR, rel);
    if (!fs.existsSync(src)) continue;
    const dst = path.join(RUN_DIR, rel);
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.copyFileSync(src, dst);
  }
}

/** 把本次运行产生的登录态写回种子目录，下次运行直接复用 */
function persistProfile() {
  try {
    for (const rel of ['Default/Network/Cookies', 'Local State']) {
      const src = path.join(RUN_DIR, rel);
      if (!fs.existsSync(src)) continue;
      const dst = path.join(SEED_DIR, rel);
      fs.mkdirSync(path.dirname(dst), { recursive: true });
      fs.copyFileSync(src, dst);
    }
  } catch (e) { console.log('[PROFILE] 登录态回写失败:', e.message); }
  try { fs.rmSync(RUN_DIR, { recursive: true, force: true }); } catch (e) {}
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const jitter = (a, b) => a + Math.random() * (b - a);

function loadState() {
  fs.mkdirSync(ROOT, { recursive: true });
  if (fs.existsSync(STATE_FILE)) return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  return { meta: {}, notes: {}, order: [], listDone: false, author: {} };
}
function saveState(s) { fs.writeFileSync(STATE_FILE, JSON.stringify(s, null, 2)); }

async function launch() {
  bootstrapProfile();
  return puppeteer.launch({
    executablePath: CHROME,
    headless: false,                 // 有头：需要登录态 / 可能需要扫码
    defaultViewport: { width: 1440, height: 900 },
    userDataDir: RUN_DIR,
    args: ['--disable-gpu', '--no-first-run', '--no-default-browser-check', '--window-size=1440,960'],
  });
}

/** 打开页面并等待内容渲染（小红书长连接，networkidle2 永不触发，故用轮询） */
async function openUrl(page, url, marker = 'section.note-item, .note-item') {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 25000 })
    .catch(e => console.log('[NAV] 导航未完成，继续轮询:', e.message.slice(0, 50)));

  for (let i = 0; i < 25; i++) {
    await sleep(1000);
    const r = await page.evaluate((sel) => {
      const cards = document.querySelectorAll(sel).length;
      const body = document.body.innerText || '';
      return {
        cards,
        loginWall: /登录后查看搜索结果|登录即可查看|扫码登录|登录后查看/.test(body),
        risk: /安全限制|300012|IP 存在风险|操作过于频繁|访问频繁/.test(body),
      };
    }, marker).catch(() => ({ cards: 0, loginWall: false, risk: false }));

    if (r.risk) throw new Error('触发风控（安全限制/IP 风险），请等待一段时间后再试');
    if (r.loginWall) return { needLogin: true, cards: 0 };
    if (r.cards > 0) return { needLogin: false, cards: r.cards };
  }
  return { needLogin: false, cards: 0 };
}

/** 等待扫码登录（截图存到 .tmp 便于在对话里查看） */
async function waitLogin(page) {
  await page.bringToFront();
  console.log('[LOGIN] 未登录，请扫码（截图 .tmp/xhs-qr.png，最长等 8 分钟）…');
  for (let k = 0; k < 96; k++) {
    await sleep(5000);
    const ok = await page.evaluate(() => {
      const body = document.body.innerText || '';
      return !/登录后查看搜索结果|登录即可查看|扫码登录/.test(body);
    }).catch(() => false);
    if (ok) { console.log('[LOGIN] 已登录'); return true; }
    if (k % 2 === 0) {
      try { await page.screenshot({ path: path.join(__dirname, '..', '.tmp', 'xhs-qr.png') }); } catch (e) {}
    }
  }
  throw new Error('等待登录超时');
}

/* ---------- 阶段：博主主页 list ---------- */
async function collectList() {
  if (!TARGET_URL) throw new Error('缺少博主主页 URL');
  const st = loadState();
  st.meta = { kind: 'profile', url: TARGET_URL.split('?')[0], collectedAt: st.meta.collectedAt || new Date().toISOString() };
  const browser = await launch();
  const page = await browser.newPage();

  // 监听 user_posted 分页接口（必须在导航前挂上）
  const posted = [];
  page.on('response', async (res) => {
    if (!res.url().includes('/api/sns/web/v1/user_posted')) return;
    try {
      const j = await res.json();
      if (j.code === 0 && j.data && Array.isArray(j.data.notes)) posted.push(j.data.notes);
    } catch (e) {}
  });

  const opened = await openUrl(page, TARGET_URL);
  if (opened.needLogin) {
    await waitLogin(page);
    await openUrl(page, TARGET_URL);
  }

  try {
    st.author = await page.evaluate(() => {
      const u = (window.__INITIAL_STATE__.user || {}).userPageData || {};
      return { id: u.id || '', nickname: u.nickname || '', desc: u.desc || '' };
    });
  } catch (e) {}

  let lastCount = 0, idle = 0;
  for (let round = 0; round < 300; round++) {
    for (const n of posted.splice(0)) pushNote(st, n);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await sleep(jitter(1600, 2600));
    const total = st.order.length;
    console.log(`[LIST] ${total} 条 (round ${round})`);
    if (MAX_ITEMS && total >= MAX_ITEMS) break;
    if (total === lastCount) { if (++idle >= 4) break; } else { idle = 0; lastCount = total; }
  }

  st.listDone = true;
  saveState(st);
  console.log(`[LIST] 完成，共 ${st.order.length} 条 → ${path.basename(STATE_FILE)}`);
  await browser.close();
  persistProfile();
}

/* ---------- 阶段：搜索结果 search ---------- */
async function collectSearch() {
  if (!TARGET_URL) throw new Error('缺少搜索页 URL');
  const st = loadState();
  const keyword = decodeURIComponent((TARGET_URL.match(/keyword=([^&]+)/) || [, ''])[1]);
  st.meta = {
    kind: 'search',
    keyword,
    url: TARGET_URL.split('&source=')[0],
    collectedAt: st.meta.collectedAt || new Date().toISOString(),
  };

  const browser = await launch();
  const page = await browser.newPage();

  // 搜索页的接口是 so.xiaohongshu.com/api/sns/web/v2/search/notes，字段随版本变化，
  // 因此以 DOM 抓取为主（卡片自带 data-note-id、xsec_token、封面图），接口仅作补充。
  const opened = await openUrl(page, TARGET_URL);
  if (opened.needLogin) {
    await waitLogin(page);
    await openUrl(page, TARGET_URL);
  }
  console.log(`[SEARCH] 关键词「${keyword}」首屏 ${opened.cards} 张卡`);

  let lastCount = 0, idle = 0;
  for (let round = 0; round < 120; round++) {
    const cards = await harvestSearchCards(page);
    let added = 0;
    for (const c of cards) if (pushNote(st, c)) added++;

    const total = st.order.length;
    if (added) console.log(`[SEARCH] 新增 ${added}，累计 ${total} 条 (round ${round})`);
    if (MAX_ITEMS && total >= MAX_ITEMS) { console.log(`[SEARCH] 达到上限 ${MAX_ITEMS}`); break; }
    if (total === lastCount) { if (++idle >= 5) { console.log('[SEARCH] 连续无新增，停止'); break; } }
    else { idle = 0; lastCount = total; }

    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await sleep(jitter(1800, 2800));
  }

  if (!st.order.length) throw new Error('没有收集到任何结果，登录态可能失效');
  st.listDone = true;
  saveState(st);
  console.log(`[SEARCH] 完成，共 ${st.order.length} 条 → ${path.basename(STATE_FILE)}`);
  await browser.close();
  persistProfile();
}

/** 从搜索结果页的卡片 DOM 里提取笔记信息
 *  卡片结构（2026-10 实测）：
 *    section.note-item[data-note-id]
 *      .cover img
 *      .footer a.title[href="/search_result/<id>?xsec_token=..."] > span
 *      .footer a.author > .name
 *      .footer .like-wrapper
 */
async function harvestSearchCards(page) {
  return page.evaluate(() => {
    const out = [];
    for (const card of document.querySelectorAll('section.note-item, .note-item')) {
      const titleA = card.querySelector('.footer a.title, a.title');
      const href = (titleA && titleA.getAttribute('href')) || '';
      const id = card.getAttribute('data-note-id')
        || (href.match(/\/(?:explore|search_result)\/([0-9a-f]{24})/) || [])[1];
      const title = titleA ? titleA.innerText.trim() : '';
      // 无标题锚点的卡片是「大家都在搜」之类的推荐位，不是笔记
      if (!id || !title) continue;

      const m = href.match(/xsec_token=([^&]+)/);
      const coverImg = card.querySelector('.cover img') || card.querySelector('img[src*="xhscdn"]');
      const likeEl = card.querySelector('.like-wrapper');
      const nameEl = card.querySelector('.author .name');

      out.push({
        note_id: id,
        xsec_token: m ? decodeURIComponent(m[1]) : '',
        display_title: title,
        cover: (coverImg && (coverImg.getAttribute('src') || '')) || '',
        type: card.querySelector('.play-icon, [class*="video-icon"], .cover svg') ? 'video' : '',
        interact_info: { liked_count: likeEl ? likeEl.innerText.replace(/\s/g, '') : '' },
        user: { nickname: nameEl ? nameEl.innerText.trim() : '' },
      });
    }
    return out;
  }).catch(() => []);
}

/** 把接口/SSR 返回的笔记塞进 state（兼容多种字段写法） */
function pushNote(st, n) {
  const id = n.note_id || n.id;
  if (!id || st.notes[id]) return false;
  const cover = typeof n.cover === 'string'
    ? n.cover
    : (n.cover && (n.cover.url_default || n.cover.urlDefault || n.cover.url_white || n.cover.url)) || '';
  st.notes[id] = {
    id,
    xsec: n.xsec_token || '',
    title: (n.display_title || n.displayTitle || '').trim(),
    cover,
    liked: (n.interact_info && n.interact_info.liked_count) || '',
    type: n.type || '',
    author: (n.user && (n.user.nickname || n.user.nick_name)) || '',
  };
  st.order.push(id);
  return true;
}

/* ---------- 阶段：详情 detail ---------- */
async function collectDetail() {
  const st = loadState();
  if (!st.order.length) { console.log('没有索引，请先跑 list 或 search'); return; }
  const browser = await launch();
  const page = await browser.newPage();
  const pending = st.order.filter(id => !st.notes[id].done);
  console.log(`[DETAIL] 待处理 ${pending.length}/${st.order.length}`);

  let ok = 0, fail = 0;
  for (const id of pending) {
    const meta = st.notes[id];
    const dir = path.join(ROOT, id);
    try {
      const url = `https://www.xiaohongshu.com/explore/${id}?xsec_token=${encodeURIComponent(meta.xsec || '')}&xsec_source=pc_search`;
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
      await sleep(jitter(1500, 2400));

      const detail = await page.evaluate((nid) => {
        const s = (window.__INITIAL_STATE__ || {}).note || {};
        const map = s.noteDetailMap || {};
        const entry = map[nid] || Object.values(map)[0] || {};
        const note = entry.note || {};
        const imgs = (note.imageList || []).map(im => {
          const dft = (im.infoList || []).find(x => x.imageScene === 'WB_DFT');
          return dft ? dft.url : (im.urlDefault || im.url || '');
        }).filter(Boolean);
        return {
          title: note.title || '', desc: note.desc || '',
          tags: (note.tagList || []).map(t => t.name).filter(Boolean),
          time: note.time || '', ip: note.ipLocation || '',
          images: imgs,
          videoCover: (note.video && note.video.cover && note.video.cover.url) || '',
        };
      }, id);

      fs.mkdirSync(dir, { recursive: true });
      const files = [];
      const dl = detail.images.length ? detail.images : (detail.videoCover ? [detail.videoCover] : []);
      for (let i = 0; i < dl.length; i++) {
        const ext = dl[i].includes('.webp') ? 'webp' : 'jpg';
        const f = path.join(dir, `${String(i + 1).padStart(2, '0')}.${ext}`);
        if (!fs.existsSync(f)) {
          const res = await fetch(dl[i], { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/155.0.0.0 Safari/537.36', Referer: 'https://www.xiaohongshu.com/' } });
          if (!res.ok) throw new Error(`img ${res.status}`);
          fs.writeFileSync(f, Buffer.from(await res.arrayBuffer()));
          await sleep(jitter(400, 900));
        }
        files.push(path.basename(f));
      }
      meta.done = true;
      meta.title = meta.title || detail.title;
      meta.detail = { title: detail.title, desc: detail.desc, tags: detail.tags, time: detail.time, ip: detail.ip, images: files };
      ok++;
      console.log(`[DETAIL] ✓ ${id} «${(detail.title || detail.desc || '').slice(0, 24)}» ${files.length}图`);
    } catch (e) {
      fail++;
      meta.tries = (meta.tries || 0) + 1;
      if (meta.tries >= 3) meta.done = true;
      console.log(`[DETAIL] ✗ ${id} ${e.message}`);
    }
    saveState(st);
    await sleep(jitter(3000, 6000));           // 限速防风控
  }
  console.log(`[DETAIL] 结束：成功 ${ok}，失败 ${fail}`);
  await browser.close();
  persistProfile();
}

/* ---------- 入口 ---------- */
console.log('[INIT] 种子配置:', SEED_DIR, '| 状态文件:', path.basename(STATE_FILE));
if (phase === 'list') collectList().catch(e => { console.error('FATAL', e.message); process.exit(1); });
else if (phase === 'search') collectSearch().catch(e => { console.error('FATAL', e.message); process.exit(1); });
else if (phase === 'detail') collectDetail().catch(e => { console.error('FATAL', e.message); process.exit(1); });
else {
  console.log('用法:\n  node xhs-collect.cjs list   <博主主页URL> [--state 名称]\n  node xhs-collect.cjs search <搜索页URL>   [--state 名称] [--max 条数]\n  node xhs-collect.cjs detail <URL>         [--state 名称]');
  process.exit(1);
}
