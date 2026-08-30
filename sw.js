// Metanoia service worker: network-first with cache fallback.
// The app always prefers fresh code and data; the cached shell keeps the
// ledger opening instantly (and readable) when offline.
// BUMP THIS whenever a shell file below changes. The install handler only runs
// when this file's bytes change, and activate only deletes caches whose key is
// not the current one - so leaving the version alone means an installed PWA
// keeps serving the old shell forever, even though the network has new code.
var CACHE = 'metanoia-v5';
var SHELL = [
  './',
  './index.html',
  './style.css',
  './todos-core.js',
  './app.js',
  './config.js',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (c) { return c.addAll(SHELL); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE; })
        .map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  var url = new URL(e.request.url);
  // Never intercept the API or auth traffic.
  if (url.hostname.endsWith('supabase.co')) return;
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request).then(function (res) {
      if (res.ok && (url.origin === location.origin || url.hostname.includes('fonts.g'))) {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put(e.request, copy); });
      }
      return res;
    }).catch(function () {
      return caches.match(e.request, { ignoreSearch: true }).then(function (hit) {
        return hit || caches.match('./index.html');
      });
    })
  );
});
