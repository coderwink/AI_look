/**
 * 验证素材库页面：身高筛选、角标、搜索、详情
 */
const puppeteer = require('puppeteer-core');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

(async () => {
  const browser = await puppeteer.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: 'new', args: ['--disable-gpu', '--no-sandbox'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
  const errs = [];
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('pageerror', e => errs.push('PAGEERROR ' + e.message));

  await page.goto('http://127.0.0.1:8765/web/materials.html', { waitUntil: 'networkidle2', timeout: 30000 });
  await sleep(1500);

  const base = await page.evaluate(() => ({
    total: document.getElementById('count').textContent,
    cards: document.querySelectorAll('.mcard').length,
    heightChips: [...document.querySelectorAll('#heightbar .tagchip')].map(b => b.textContent.trim()),
    badges: [...document.querySelectorAll('.mcard .hb')].slice(0, 6).map(b => b.textContent),
  }));
  console.log('初始:', JSON.stringify(base, null, 2));

  // 点「165–170」身高段
  const clicked = await page.evaluate(() => {
    const b = [...document.querySelectorAll('#heightbar .tagchip')].find(x => x.textContent.includes('165–170'));
    if (!b) return false;
    b.click(); return true;
  });
  await sleep(600);
  const after = await page.evaluate(() => ({
    cards: document.querySelectorAll('.mcard').length,
    empty: document.getElementById('empty').hidden,
    firstTitles: [...document.querySelectorAll('.mcard .t')].slice(0, 3).map(e => e.textContent.slice(0, 20)),
  }));
  console.log('筛选 165–170:', clicked, JSON.stringify(after, null, 2));

  // 搜索
  await page.evaluate(() => { document.getElementById('clear').click(); });
  await sleep(300);
  await page.type('#q', '衬衫');
  await sleep(600);
  const searched = await page.evaluate(() => document.querySelectorAll('.mcard').length);
  console.log('搜索「衬衫」:', searched, '条');

  await page.evaluate(() => { document.getElementById('clear').click(); });
  await sleep(500);
  await page.screenshot({ path: 'C:/Users/10677/WorkBuddy/2026-10-22-09-12-51/.tmp/materials-height.png' });

  // 打开第一条详情
  await page.evaluate(() => document.querySelector('.mcard').click());
  await sleep(600);
  const detail = await page.evaluate(() => ({
    open: !document.getElementById('layer').hidden,
    title: document.getElementById('mTitle').textContent.slice(0, 24),
    sub: document.getElementById('mSub').textContent.slice(0, 60),
    imgOk: (() => { const i = document.querySelector('#viewer img'); return i && i.complete && i.naturalWidth > 0; })(),
  }));
  console.log('详情:', JSON.stringify(detail));
  await page.screenshot({ path: 'C:/Users/10677/WorkBuddy/2026-10-22-09-12-51/.tmp/materials-detail.png' });

  console.log('JS 错误:', errs.length ? errs.slice(0, 5) : '无');
  await browser.close();
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
