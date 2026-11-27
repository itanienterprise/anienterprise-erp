// Service Worker to intercept /api/pdf-preview/* requests and serve them with custom filenames and headers
self.addEventListener('install', (event) => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);
    if (url.pathname.startsWith('/api/pdf-preview/')) {
        event.respondWith(
            caches.open('pdf-preview-cache').then((cache) => {
                return cache.match(event.request, { ignoreSearch: true }).then((cachedResponse) => {
                    if (cachedResponse) {
                        return cachedResponse;
                    }
                    return fetch(event.request);
                });
            })
        );
    }
});
