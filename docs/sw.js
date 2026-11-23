const CACHE = 'focalab-shell-subject-ranges-v3';
const root = new URL('./', self.registration.scope);
const paths = ['', 'index.html', 'style.css', 'app.js', 'icons.js', 'optics.js', 'renderer.js', 'motion-mask.js', 'motion-editor.js', 'learning.js', 'steady.js', 'exif.js',
  'manifest.webmanifest', 'assets/mark.svg', 'assets/icon.svg', 'assets/icon-192.png', 'assets/icon-512.png', 'assets/mask-512.png',
  'assets/taipei.webp', 'assets/tea.webp', 'assets/tc-regular.woff2', 'assets/tc-bold.woff2'
];
// Versioned module URLs also work on the first visit from the previous offline shell.
const assetURL = path => new URL(/\.(js|css|woff2)$/.test(path) ? path + '?v=mask3' : path, root).href;
const known = new Set(paths.map(assetURL));
self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll([...known].map(url => new Request(url, {
      cache: 'reload',
      credentials: 'same-origin'
    })));
    await self.skipWaiting();
  })());
});
self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const name of await caches.keys())
      if (name.startsWith('focalab-shell-') && name !== CACHE) await caches.delete(name);
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== root.origin || !url.pathname.startsWith(root.pathname)) return;
  if (e.request.mode === 'navigate') {
    e.respondWith((async () => {
      const cache = await caches.open(CACHE);
      try {
        return await fetch(e.request);
      } catch {
        const fallback = await cache.match(new URL('index.html', root).href);
        return fallback || Response.error();
      }
    })());
    return;
  }
  if (!known.has(url.href)) return;
  e.respondWith((async () => {
    const cache = await caches.open(CACHE),
      hit = await cache.match(e.request);
    return hit || await fetch(e.request);
  })());
});
