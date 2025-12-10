const CACHE_NAME = 'sekai-player-v2';
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
    // 新しいService Workerを即座にアクティブにする
    self.skipWaiting();
    e.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
    );
});

self.addEventListener('activate', (e) => {
    // 新しいSWがページをすぐに制御できるようにクライアントを制御下に置く
    e.waitUntil(
        Promise.all([
            self.clients.claim(),
            caches.keys().then((cacheNames) => {
                return Promise.all(
                    cacheNames.map((cache) => {
                        if (cache !== CACHE_NAME) {
                            console.log('Deleting old cache:', cache);
                            return caches.delete(cache);
                        }
                    })
                );
            })
        ])
    );
});

self.addEventListener('fetch', (e) => {
    // 外部アセット（ジャケット、オーディオ）: Stale-While-Revalidate戦略
    // キャッシュがあれば高速に表示しつつ、バックグラウンドで次回用に更新する
    if (e.request.url.includes('storage.sekai.best')) {
        e.respondWith(
            caches.match(e.request).then((cachedResponse) => {
                const networkFetch = fetch(e.request).then((networkResponse) => {
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(e.request, networkResponse.clone());
                    });
                    return networkResponse;
                });
                return cachedResponse || networkFetch;
            })
        );
    } else {
        // ローカルアセット: Network First戦略（開発中・頻繁な更新用）
        // オフライン時はキャッシュを使用。オンライン時は常に最新版を取得する。
        e.respondWith(
            fetch(e.request)
                .then((response) => {
                    // レスポンスは一度しか使用できないためクローンを作成する
                    const responseClone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(e.request, responseClone);
                    });
                    return response;
                })
                .catch(() => caches.match(e.request))
        );
    }
});
