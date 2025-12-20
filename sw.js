console.info('[SW v18.0] Cache Protection - READY');

const CACHE_NAME = 'sekai-app-cache-v18';

self.addEventListener('install', (e) => {
    self.skipWaiting();
});

self.addEventListener('activate', (e) => {
    e.waitUntil(
        Promise.all([
            self.clients.claim(),
            caches.keys().then((names) => {
                return Promise.all(
                    names.map(n => {
                        if (n !== CACHE_NAME) return caches.delete(n);
                    })
                );
            })
        ])
    );
});

self.addEventListener('fetch', (e) => {
    const url = new URL(e.request.url);

    // http/https 以外のスキーム（拡張機能など）は無視
    if (!url.protocol.startsWith('http')) return;

    // ジャケット画像のみ Cache First で保護
    if (url.hostname === 'storage.sekai.best' && url.pathname.includes('/jacket/')) {
        const normalizedUrl = url.origin + url.pathname;

        e.respondWith(
            caches.match(normalizedUrl, { ignoreSearch: true }).then((cached) => {
                if (cached) return cached;

                return fetch(e.request).then((response) => {
                    if (response.status === 200 || response.status === 0) {
                        const clone = response.clone();
                        caches.open(CACHE_NAME).then(cache => {
                            cache.put(normalizedUrl, clone).catch(err => {
                                console.warn(`[SW] Cache.put error for ${normalizedUrl}`, err);
                            });
                        });
                    }
                    return response;
                }).catch(err => {
                    console.error(`[SW] Fetch failed for ${normalizedUrl}`, err);
                    return new Response('Network error', { status: 408 });
                });
            })
        );
        return;
    }

    // 音声ファイルのキャッシュ対応 (Cache-First)
    if (url.hostname === 'storage.sekai.best' && url.pathname.endsWith('.mp3')) {
        const cleanUrl = url.origin + url.pathname;
        e.respondWith((async () => {
            const cache = await caches.open(CACHE_NAME);
            const cached = await cache.match(cleanUrl, { ignoreSearch: true });

            if (cached) {
                return cached;
            }

            // キャッシュがない場合：
            // fetch(e.request) を直接返すことで、ブラウザのネイティブな Range リクエスト処理に任せる
            // これにより SW 内での fetch 失敗 (ERR_FAILED) と二重リクエストを防止する
            return fetch(e.request);
        })());
        return;
    }

    // ローカルアセット (Network First)
    e.respondWith(
        fetch(e.request).catch(() => caches.match(e.request))
    );
});

// ページ側からの強制支配命令を受け取る
self.addEventListener('message', (event) => {
    if (event.data && event.data.action === 'claim') {
        self.skipWaiting();
        self.clients.claim().then(() => {
            event.source.postMessage({ action: 'claimed' });
        });
    }
});
