/* 型格 LOOKBOOK · Service Worker（位于仓库根，scope = 全站）
 * 策略：
 *   HTML 导航 / 内容 JSON → 网络优先（保证改了 content 能看到新内容）
 *   图片 / 样式 / 脚本      → 缓存优先（离线可用，速度快）
 * 改版时把 VERSION 加一，即可让旧缓存自动失效。 */

const VERSION = 'v3';
const CACHE = `xingge-${VERSION}`;

const PRECACHE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './web/index.html',
  './web/css/style.css',
  './web/js/app.js',
  './web/materials.html',
  './content/taxonomy.json',
  './content/looks.json',
  './content/editorials.json',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => Promise.all(PRECACHE.map((url) => cache.add(url).catch(() => null))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

const isContent = (url) => url.pathname.endsWith('.json');

async function networkFirst(req) {
  try {
    const res = await fetch(req);
    if (res && res.ok) {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(req, copy));
    }
    return res;
  } catch (e) {
    const hit = await caches.match(req);
    if (hit) return hit;
    if (req.mode === 'navigate') {
      const shell = await caches.match('./web/index.html');
      if (shell) return shell;
    }
    throw e;
  }
}

async function cacheFirst(req) {
  const hit = await caches.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res && res.ok) {
    const copy = res.clone();
    caches.open(CACHE).then((c) => c.put(req, copy));
  }
  return res;
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== location.origin) return;           // 第三方资源不接管
  if (url.pathname.startsWith('/api/')) return;         // 预留后端接口

  if (req.mode === 'navigate' || isContent(url)) {
    event.respondWith(networkFirst(req));
    return;
  }
  event.respondWith(cacheFirst(req));
});
