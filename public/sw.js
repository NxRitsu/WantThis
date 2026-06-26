// Service worker minimal : met en cache l'app shell pour permettre
// l'installation PWA et un démarrage hors-ligne basique.
// NB : les données (Supabase) ne sont volontairement PAS mises en cache —
// on veut toujours des réservations à jour.

const CACHE = 'wantthis-v1'
const APP_SHELL = ['/WantThis/', '/WantThis/index.html']

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(APP_SHELL)))
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  // On ne touche qu'aux GET de même origine (jamais les appels API Supabase).
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) {
    return
  }
  // Stratégie "network-first" avec repli sur le cache (utile hors-ligne).
  event.respondWith(
    fetch(req)
      .then((res) => {
        const copy = res.clone()
        caches.open(CACHE).then((c) => c.put(req, copy))
        return res
      })
      .catch(() => caches.match(req).then((r) => r || caches.match('/WantThis/index.html')))
  )
})
