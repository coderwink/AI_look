/**
 * 小红书博主素材采集器
 * 用法:
 *   node xhs-collect.mjs list   <主页URL>   — 收集全部笔记索引（需登录）
 *   node xhs-collect.mjs detail <主页URL>   — 逐条抓详情并下载图片（可断点续跑）
 * 状态文件: content/xhs/_state.json   素材目录: content/xhs/<noteId>/
 */
const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
// 优先用「日常 Chrome 登录态」的镜像目录（scripts/sync-chrome-login.cjs 生成），否则退回专用会话目录
const DAILY_PROFILE = 'C:/Users/10677/.workbuddy/chrome-profile';
const SESSION_DIR = process.env.XHS_PROFILE_DIR
  || (fs.existsSync(path.join(DAILY_PROFILE, 'Local State')) ? DAILY_PROFILE : 'C:/Users/10677/.workbuddy/xhs-session');
const ROOT = 'C:/Users/10677/WorkBuddy/2026-10-22-09-12-51/content/xhs';
const STATE_FILE = path.join(ROOT, '_state.json');
const PROFILE_URL = process.argv[3];
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const jitter = (a, b) => a + Math.random() * (b - a);

function loadState() {
  fs.mkdirSync(ROOT, { recursive: true });
  if (fs.existsSync(STATE_FILE)) return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  return { notes: {}, order: [], listDone: false, author: {} };
}
function saveState(s) { fs.writeFileSync(STATE_FILE, JSON.stringify(s, null, 2)); }

async function launch() {
  return puppeteer.launch({
    executablePath: CHROME,
    headless: false,                 // 有头：首次需要扫码登录
    defaultViewport: { width: 1440, height: 900 },
    userDataDir: SESSION_DIR,
    args: ['--disable-gpu', '--no-first-run', '--no-default-browser-check', '--window-size=1440,960'],
  });
}

/** 等待主页数据就绪；未登录则等待用户扫码（最多 5 分钟） */
async function openProfile(page) {
  // 捕获 user_posted 分页接口（必须在 goto 之前挂监听）
  const posted = [];
  page.on('response', async (res) => {
    const u = res.url();
    if (u.includes('/api/sns/web/v1/user_posted')) {
      try {
        const j = await res.json();
        if (j.code === 0 && j.data && Array.isArray(j.data.notes)) {
          posted.push({ cursor: j.data.cursor || '', hasMore: !!j.data.has_more, notes: j.data.notes });
        }
      } catch (e) {}
    }
  });

  // 用页面真实登录状态判断（多信号：state 字段 / 笔记卡片已渲染且无可见登录弹窗）
  const isLoggedIn = async () => {
    try {
      return await page.evaluate(() => {
        const u = window.__INITIAL_STATE__ && window.__INITIAL_STATE__.user;
        if (u && u.loggedIn === true) return true;
        const cards = document.querySelectorAll('section a[href*="/explore/"], section a[href*="/search_result/"], .note-item a[href], a.cover[href]').length;
        const modalVisible = [...document.querySelectorAll('.login-container, .sign-up-flow, .login-mask, [class*="login"]')]
          .some(el => { const s = getComputedStyle(el); return s.display !== 'none' && s.visibility !== 'hidden' && el.offsetWidth > 100 && el.offsetHeight > 100 && /登录|扫码/.test(el.innerText || ''); });
        return cards >= 3 && !modalVisible;
      });
    } catch (e) { return false; }
  };

  await page.goto(PROFILE_URL, { waitUntil: 'networkidle2', timeout: 60000 });
  await sleep(3000);

  // 未登录 → 提示扫码并轮询登录态
  if (!(await isLoggedIn())) {
    await page.bringToFront();
    console.log('[LOGIN] 未登录。请扫码登录（二维码截图已保存到 .tmp/xhs-qr.png）…');
    let okLogin = false;
    for (let k = 0; k < 120; k++) {          // 每 5 秒查一次，最长 10 分钟
      await sleep(5000);
      try { if (await isLoggedIn()) { okLogin = true; break; } } catch (e) {}
      if (k % 2 === 0) {                     // 每 10 秒刷新一次二维码截图
        try {
          await page.bringToFront();
          await page.screenshot({ path: 'C:/Users/10677/WorkBuddy/2026-10-22-09-12-51/.tmp/xhs-qr.png' });
        } catch (e) {}
      }
    }
    if (!okLogin) throw new Error('等待登录超时，未采集到登录态');
    console.log('[LOGIN] 登录成功，重新加载主页…');
    await page.goto(PROFILE_URL, { waitUntil: 'networkidle2', timeout: 60000 });
    await sleep(3000);
  } else {
    console.log('[LOGIN] 已登录，直接采集');
  }
  return posted;
}

/** 从页面预置数据（SSR）里把首屏笔记收进 state */
async function harvestSSR(page, st) {
  const got = await page.evaluate(() => {
    const u = window.__INITIAL_STATE__ && window.__INITIAL_STATE__.user;
    let n = (u && u.notes) || {};
    if (!Array.isArray(n)) n = n.list || n.notes || Object.values(n).find(Array.isArray) || [];
    return n.map(x => ({
      id: x.id || x.note_id || '',
      xsec: x.xsec_token || '',
      title: (x.displayTitle || x.display_title || '').trim(),
      cover: (x.cover && (x.cover.urlDefault || x.cover.url_default || x.cover.url)) || '',
      type: x.type || '',
    })).filter(x => x.id);
  });
  let added = 0;
  for (const n of got) {
    if (!st.notes[n.id]) { st.notes[n.id] = { ...n, liked: '' }; st.order.push(n.id); added++; }
  }
  return added;
}

/** 阶段一：滚动收集全部笔记索引 */
async function collectList() {
  const st = loadState();
  const browser = await launch();
  const page = await browser.newPage();
  const posted = await openProfile(page);

  // 作者信息
  try {
    st.author = await page.evaluate(() => {
      const u = window.__INITIAL_STATE__.user.userPageData || {};
      return { id: u.id || '', nickname: u.nickname || '', desc: u.desc || '' };
    });
  } catch (e) {}

  // 先收 SSR 首屏，再滚动触发分页
  const ssrAdded = await harvestSSR(page, st);
  console.log(`[LIST] SSR 首屏收到 ${ssrAdded} 条`);

  let lastCount = 0, idleRounds = 0;
  for (let round = 0; round < 200; round++) {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await sleep(jitter(1600, 2600));
    for (const chunk of posted.splice(0)) {
      for (const n of chunk.notes) {
        const id = n.note_id || n.id;
        if (id && !st.notes[id]) {
          st.notes[id] = {
            id,
            xsec: n.xsec_token || '',
            title: (n.display_title || n.displayTitle || '').trim(),
            cover: (n.cover && (n.cover.url_default || n.cover.url)) || '',
            liked: (n.interact_info && n.interact_info.liked_count) || '',
            type: n.type || '',
          };
          st.order.push(id);
        }
      }
    }
    const total = st.order.length;
    console.log(`[LIST] 已收集 ${total} 条 (round ${round})`);
    if (total === lastCount) { if (++idleRounds >= 4) break; } else { idleRounds = 0; lastCount = total; }
  }
  if (!st.order.length) throw new Error('没有收集到任何笔记索引，登录可能未生效');
  st.listDone = true;
  saveState(st);
  console.log(`[LIST] 完成，共 ${st.order.length} 条笔记`);
  await browser.close();
}

/** 阶段二：逐条抓详情 + 下载图片（断点续跑） */
async function collectDetail() {
  const st = loadState();
  if (!st.order.length) { console.log('没有索引，请先跑 list'); return; }
  const browser = await launch();
  const page = await browser.newPage();
  const pending = st.order.filter(id => !st.notes[id].done);
  console.log(`[DETAIL] 待处理 ${pending.length}/${st.order.length}`);

  let ok = 0, fail = 0;
  for (const id of pending) {
    const meta = st.notes[id];
    const dir = path.join(ROOT, id);
    try {
      const url = `https://www.xiaohongshu.com/explore/${id}?xsec_token=${encodeURIComponent(meta.xsec)}&xsec_source=pc_user`;
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 45000 });
      await sleep(jitter(1200, 2000));

      const detail = await page.evaluate((nid) => {
        const st = window.__INITIAL_STATE__ && window.__INITIAL_STATE__.note;
        const map = (st && st.noteDetailMap) || {};
        const entry = map[nid] || Object.values(map)[0] || {};
        const note = (entry && entry.note) || {};
        const imgs = (note.imageList || []).map(im => {
          const dft = (im.infoList || []).find(x => x.imageScene === 'WB_DFT');
          return dft ? dft.url : (im.urlDefault || im.url || '');
        }).filter(Boolean);
        return {
          title: note.title || '', desc: note.desc || '',
          tags: (note.tagList || []).map(t => t.name).filter(Boolean),
          time: note.time || '', ip: note.ipLocation || '',
          images: imgs,
          videoCover: note.video && note.video.cover && note.video.cover.url || '',
        };
      }, id);

      fs.mkdirSync(dir, { recursive: true });
      const files = [];
      const dl = detail.images.length ? detail.images : (detail.videoCover ? [detail.videoCover] : []);
      for (let i = 0; i < dl.length; i++) {
        const ext = dl[i].includes('.webp') ? 'webp' : 'jpg';
        const f = path.join(dir, `${String(i + 1).padStart(2, '0')}.${ext}`);
        if (!fs.existsSync(f)) {
          const res = await fetch(dl[i], { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36', Referer: 'https://www.xiaohongshu.com/' } });
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
      if (meta.tries >= 3) meta.done = true;   // 失败 3 次放弃
      console.log(`[DETAIL] ✗ ${id} ${e.message}`);
    }
    saveState(st);
    await sleep(jitter(3000, 6000));           // 限速防风控
  }
  console.log(`[DETAIL] 结束：成功 ${ok}，失败 ${fail}`);
  await browser.close();
}

const phase = process.argv[2];
if (phase === 'list') collectList().catch(e => { console.error('FATAL', e); process.exit(1); });
else if (phase === 'detail') collectDetail().catch(e => { console.error('FATAL', e); process.exit(1); });
else { console.log('用法: node xhs-collect.mjs list|detail <主页URL>'); process.exit(1); }
