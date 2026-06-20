// ── Service Worker — Escríbeles ──────────────────────────────────────────
// Estrategia: network-first para HTML (siempre intenta traer la versión más
// nueva del servidor); cache-first para assets estáticos (íconos, manifest).
// CACHE_VERSION se incrementa en cada release para forzar limpieza de cachés
// viejos y activación inmediata de la nueva versión en todos los clientes.

const CACHE_VERSION = 'escribeles-v5';
const SCOPE = '/Escribeles/';

const STATIC_ASSETS = [
  SCOPE,
  SCOPE + 'index.html',
  SCOPE + 'manifest.json',
  SCOPE + 'icon-192.png',
  SCOPE + 'icon-192.svg',
  SCOPE + 'icon-512.png',
];

// ── INSTALL: precachear assets y activar de inmediato ──────────────────────
self.addEventListener('install', (event) => {
  self.skipWaiting(); // no esperar a que se cierren las pestañas viejas
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(STATIC_ASSETS))
  );
});

// ── ACTIVATE: borrar cachés de versiones anteriores ─────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_VERSION)
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim()) // tomar control de pestañas abiertas ya
  );
});

// ── FETCH: network-first para HTML, cache-first para el resto ──────────────
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const isHTML = req.mode === 'navigate' || req.headers.get('accept')?.includes('text/html');

  if (isHTML) {
    // Network-first: siempre intenta la red para traer el HTML más nuevo.
    // Si falla (sin conexión), cae al caché como respaldo offline.
    event.respondWith(
      fetch(req)
        .then((res) => {
          const resClone = res.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(req, resClone));
          return res;
        })
        .catch(() => caches.match(req).then((r) => r || caches.match(SCOPE + 'index.html')))
    );
  } else {
    // Cache-first para assets estáticos (íconos, manifest): rápido y liviano.
    event.respondWith(
      caches.match(req).then((cached) => {
        if (cached) return cached;
        return fetch(req).then((res) => {
          const resClone = res.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(req, resClone));
          return res;
        });
      })
    );
  }
});

// ── MESSAGE: permite que la página fuerce skipWaiting si hace falta ────────
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});
