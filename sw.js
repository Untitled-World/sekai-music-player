const CACHE_NAME = 'sekai-player-v1';
const ASSETS = [
    './',
    './index.html',
    './styles.css',
    './app.js',
    './icon.svg',
    './music.json',
    './song-lyrics.json'
];

self.addEventListener('install', (e) => {
    e.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
    );
});

self.addEventListener('fetch', (e) => {
    // External assets (jackets, audio) should be cached dynamically or network-first
    if (e.request.url.includes('storage.sekai.best')) {
        e.respondWith(
            caches.match(e.request).then((r) => {
                return r || fetch(e.request).then((response) => {
                    return caches.open(CACHE_NAME).then((cache) => {
                        cache.put(e.request, response.clone());
                        return response;
                    });
                });
            })
        );
    } else {
        // Local assets: Cache First
        e.respondWith(
            caches.match(e.request).then((r) => {
                return r || fetch(e.request);
            })
        );
    }
});
