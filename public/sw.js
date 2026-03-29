const CACHE_NAME = 'tft-intel-v2';
const ASSETS = [
  '/',
  '/index.html'
];

// 仅缓存核心 HTML，其他资源动态处理
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS).catch(err => console.warn('SW: Some assets failed to cache', err));
    })
  );
});

self.addEventListener('fetch', (event) => {
  // 简单的网络优先策略，避免开发时缓存旧代码
  event.respondWith(
    fetch(event.request).catch(() => {
      return caches.match(event.request);
    })
  );
});
