/* SHADY SPILT service worker: بيخلي التطبيق يشتغل بدون نت */
var VERSION = 'shady-spilt-v5';
var CORE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './bot/foods-eg.js',
  './bot/engine.js',
  './bot/bot.js',
  './bot/brain.js',
  './Icons/icon-192.png',
  './Icons/icon-512.png',
  './Icons/maskable-192.png',
  './Icons/maskable-512.png',
  './Icons/apple-touch-icon.png',
  './Icons/favicon.png'
];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(VERSION).then(function (c) { return c.addAll(CORE); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== VERSION; }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);

  /* الخطوط: خزّنها أول مرة واستخدمها بعد كده حتى بدون نت */
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(
      caches.open(VERSION).then(function (c) {
        return c.match(req).then(function (hit) {
          var net = fetch(req).then(function (res) { if (res && (res.ok || res.type === 'opaque')) c.put(req, res.clone()); return res; }).catch(function () { return hit; });
          return hit || net;
        });
      })
    );
    return;
  }

  if (url.origin !== location.origin) return;

  /* الصفحة: جرّب النت الأول عشان التحديثات توصل، ولو مفيش نت هات النسخة المخزنة */
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).then(function (res) {
        var copy = res.clone();
        caches.open(VERSION).then(function (c) { c.put('./index.html', copy); });
        return res;
      }).catch(function () { return caches.match('./index.html'); })
    );
    return;
  }

  /* باقي الملفات: من الكاش أولًا */
  e.respondWith(
    caches.match(req).then(function (hit) {
      return hit || fetch(req).then(function (res) {
        if (res && res.ok) { var copy = res.clone(); caches.open(VERSION).then(function (c) { c.put(req, copy); }); }
        return res;
      });
    })
  );
});
