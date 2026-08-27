/* =========================================================
 * 轻练 · Service Worker
 * 预缓存应用外壳，运行时缓存优先，保证大部分功能离线可用
 * ========================================================= */
const CACHE_NAME = 'qinglian-v6';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/style.css',
  './js/calc.js',
  './js/data.js',
  './js/store.js',
  './js/ui.js',
  './js/charts.js',
  './js/app.js',
  './lib/chart.umd.min.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png'
];

// 安装：预缓存应用外壳
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

// 激活：清理旧缓存
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// 请求：缓存优先，网络回退并写入缓存
self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;

  event.respondWith(
    caches.match(req).then(cached => {
      if (cached) return cached;
      return fetch(req).then(res => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(req, copy));
        }
        return res;
      }).catch(() => {
        // 离线且未缓存：导航请求回退到 index.html
        if (req.mode === 'navigate') return caches.match('./index.html');
      });
    })
  );
});



