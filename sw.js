/* Service worker: держит приложение работоспособным без интернета. */
const CACHE = 'gamelife-v4';

const CORE = [
  './', './index.html', './style.css', './manifest.json',
  './js/state.js', './js/ui.js', './js/engine.js',
  './js/views-dashboard.js', './js/views-tasks.js', './js/views-goals.js',
  './js/views-character.js', './js/views-shop.js', './js/views-finance.js',
  './js/views-stats.js', './js/views-journal.js', './js/views-achievements.js',
  './js/views-settings.js', './js/sync.js', './js/main.js',
];
const EXTRA = [
  './icons/icon-192.png', './icons/icon-512.png',
  './icons/icon-maskable-512.png', './icons/apple-touch-icon.png',
];

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(CORE);
    // иконки не критичны — если что-то не скачалось, установку не валим
    await Promise.allSettled(EXTRA.map(url => cache.add(url)));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

/* Отдаём из кеша сразу, а в фоне обновляем — так приложение открывается
   мгновенно и офлайн, но подхватывает новую версию при следующем запуске. */
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || !e.request.url.startsWith(self.location.origin)) return;
  e.respondWith((async () => {
    const cached = await caches.match(e.request);
    const network = fetch(e.request).then(res => {
      if (res && res.ok && res.type === 'basic') {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy));
      }
      return res;
    }).catch(() => cached);
    return cached || network;
  })());
});

self.addEventListener('message', e => {
  if (e.data === 'skipWaiting') self.skipWaiting();
});
