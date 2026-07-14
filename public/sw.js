// Service worker mínimo: solo existe para que la app sea instalable (PWA).
// No cachea nada: siempre red, para no servir datos viejos del ERP.
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()))
self.addEventListener('fetch', (e) => { e.respondWith(fetch(e.request).catch(() => new Response('Sin conexión', { status: 503 }))) })
