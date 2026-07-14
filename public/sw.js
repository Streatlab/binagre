// Service worker mínimo: necesario para que el navegador ofrezca instalar la app.
// No cachea nada (el ERP siempre pide datos frescos).
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()))
self.addEventListener('fetch', (e) => { e.respondWith(fetch(e.request)) })
