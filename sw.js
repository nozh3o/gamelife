/* Service worker: держит приложение работоспособным без интернета. */
const CACHE = 'gamelife-v66';

const CORE = [
  './', './index.html', './style.css', './manifest.json',
  './js/state.js', './js/ui.js', './js/engine.js',
  './js/phrases.js', './js/quick-add.js', './js/views-home.js',
  './js/views-tasks.js', './js/views-goals.js', './js/views-wishes.js',
  './js/views-workouts.js', './js/views-sleep.js',
  './js/food-db.js', './js/views-nutrition.js',
  './js/views-finance.js',
  './js/views-stats.js', './js/views-journal.js',
  './js/views-settings.js', './js/sync.js', './js/reminders.js', './js/main.js',
];
const EXTRA = [
  './icons/icon-192.png', './icons/icon-512.png',
  './icons/icon-maskable-512.png', './icons/apple-touch-icon.png',
];

/* cache.addAll()/add() используют обычный fetch(), а он уважает HTTP-кеш
   (GitHub Pages отдаёт файлы с Cache-Control: max-age=600) — из-за этого
   при установке новой версии в свежий кеш мог утащиться ещё старый файл.
   Поэтому качаем каждый файл вручную, явно обходя HTTP-кеш. */
async function cachePutFresh(cache, url) {
  const res = await fetch(url, { cache: 'no-store' });
  if (res && res.ok) await cache.put(url, res);
  return res;
}

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await Promise.all(CORE.map(url => cachePutFresh(cache, url)));
    // иконки не критичны — если что-то не скачалось, установку не валим
    await Promise.allSettled(EXTRA.map(url => cachePutFresh(cache, url)));
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

/* Клик по напоминанию (js/reminders.js) — фокусируем открытую вкладку
   приложения или открываем новую, если его нигде нет. */
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil((async () => {
    const clientsList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of clientsList) if ('focus' in c) return c.focus();
    if (self.clients.openWindow) return self.clients.openWindow('./');
  })());
});
