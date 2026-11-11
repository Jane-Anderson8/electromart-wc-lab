// sw.js: the service worker that lets the app install and work offline.
//
// Network first: every request tries the internet first, so each change you
// merge shows up. The copy that comes back is saved in the cache. If you're
// offline, the saved copy is used instead.
//
// All paths are relative, because the site lives at
// https://<username>.github.io/<repository>/, not at the root of a domain.

var CACHE = 'electromart-ccc-v1';

var FILES = [
  './',
  'index.html',
  'styles.css',
  'ccc.js',
  'app.js',
  'manifest.webmanifest',
  'data/electromart.csv',
  'data/assumptions.csv',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/apple-touch-icon.png'
];

// On install, save a copy of every file so the app works offline right away.
self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE)
      .then(function (cache) { return cache.addAll(FILES); })
      .then(function () { return self.skipWaiting(); })
  );
});

// On activate, delete caches from older versions of this file.
self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys()
      .then(function (keys) {
        return Promise.all(keys.filter(function (k) { return k !== CACHE; })
          .map(function (k) { return caches.delete(k); }));
      })
      .then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (event) {
  var request = event.request;
  // Only handle this site's own GET requests.
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;

  event.respondWith(
    fetch(request)
      .then(function (response) {
        if (response.ok) {
          var copy = response.clone();
          caches.open(CACHE).then(function (cache) { cache.put(request, copy); });
        }
        return response;
      })
      .catch(function () {
        return caches.match(request, { ignoreSearch: true })
          .then(function (hit) {
            // An offline visit to any page of the app falls back to the main page.
            return hit || (request.mode === 'navigate' ? caches.match('./') : null);
          })
          .then(function (hit) { return hit || Response.error(); });
      })
  );
});
