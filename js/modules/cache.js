/**
 * キャッシュ管理 (Cache Management)
 * 画像・音声ファイルの事前ダウンロード機能
 */
console.info('[Cache] Initializing...');
import { state } from '../state.js';
import { CONFIG } from '../config.js';
import { getAudioUrl, getJacketUrl } from '../utils.js';

const CACHE_NAME = 'sekai-app-cache-v18';

// キャッシュ状態
let isCaching = false;
let cacheProgress = { current: 0, total: 0, cached: 0, skipped: 0, type: '' };
const activePreloads = new Set(); // 重複ロード防止用

export function getCacheProgress() {
    return { ...cacheProgress };
}

export function isCachingInProgress() {
    return isCaching;
}

// URLがキャッシュ済みかチェック
async function isUrlCached(cache, url) {
    try {
        const response = await cache.match(url);
        return response !== undefined;
    } catch {
        return false;
    }
}

// すべてのジャケット画像をキャッシュ
export async function cacheAllJackets(onProgress) {
    if (!state.musicData || state.musicData.length === 0) {
        throw new Error('楽曲データが読み込まれていません');
    }

    isCaching = true;
    if (!('caches' in window)) {
        throw new Error('オフラインキャッシュ機能はこの環境（HTTPSまたはlocalhost以外）では利用できません');
    }
    const cache = await caches.open(CACHE_NAME);
    const jacketUrls = [...new Set(state.musicData.map(m => getJacketUrl(m.assetbundleName)))];

    cacheProgress = { current: 0, total: jacketUrls.length, cached: 0, skipped: 0, type: 'jacket' };

    for (let i = 0; i < jacketUrls.length; i++) {
        const url = jacketUrls[i];

        // キャッシュ済みならスキップ
        if (await isUrlCached(cache, url)) {
            cacheProgress.skipped++;
        } else {
            try {
                // Service Worker が有効な場合、fetch するだけで SW 側が自動的にキャッシュしてくれる
                // ここで `cache.put` を重ねて呼ぶと、二重書き込みエラー（Unexpected internal error）が発生するため避ける
                const response = await fetch(url);
                if (response.ok) {
                    cacheProgress.cached++;
                }
            } catch (err) {
                console.warn(`Failed to cache jacket: ${url}`, err);
            }
        }

        cacheProgress.current = i + 1;
        if (onProgress) onProgress(cacheProgress);

        // ブラウザへの負荷軽減：5件ごとに短い休憩を入れる
        if (i % 5 === 0) {
            await new Promise(r => setTimeout(r, 50));
        }
    }

    isCaching = false;
    return { total: jacketUrls.length, cached: cacheProgress.cached, skipped: cacheProgress.skipped };
}

// すべての音声ファイルをキャッシュ
export async function cacheAllAudio(onProgress) {
    if (!state.musicData || state.musicData.length === 0) {
        throw new Error('楽曲データが読み込まれていません');
    }

    isCaching = true;
    if (!('caches' in window)) {
        throw new Error('オフラインキャッシュ機能はこの環境（HTTPSまたはlocalhost以外）では利用できません');
    }
    const cache = await caches.open(CACHE_NAME);

    // すべてのボーカルバリエーションのURLを収集
    const audioUrls = [];
    state.musicData.forEach(music => {
        if (music.vocals) {
            music.vocals.forEach(vocal => {
                audioUrls.push(getAudioUrl(vocal.assetbundleName));
            });
        }
    });

    const uniqueUrls = [...new Set(audioUrls)];
    cacheProgress = { current: 0, total: uniqueUrls.length, cached: 0, skipped: 0, type: 'audio' };

    for (let i = 0; i < uniqueUrls.length; i++) {
        const url = uniqueUrls[i];

        // キャッシュ済み、または現在プリロード中ならスキップ
        if (activePreloads.has(url) || await isUrlCached(cache, url)) {
            cacheProgress.skipped++;
        } else {
            try {
                activePreloads.add(url);
                const response = await fetch(url, { mode: 'cors' });
                if (response.status === 200) {
                    await cache.put(url, response);
                    cacheProgress.cached++;
                } else {
                    console.warn(`[Cache] Skipped caching (status ${response.status}): ${url}`);
                }
            } catch (err) {
                console.warn(`Failed to cache audio: ${url}`, err);
            } finally {
                activePreloads.delete(url);
            }
        }

        cacheProgress.current = i + 1;
        if (onProgress) onProgress(cacheProgress);

        // ブラウザへの負荷軽減：5件ごとに短い休憩を入れる
        if (i % 5 === 0) {
            await new Promise(r => setTimeout(r, 50));
        }
    }

    isCaching = false;
    return { total: uniqueUrls.length, cached: cacheProgress.cached, skipped: cacheProgress.skipped };
}

// 特定のURL群をバックグラウンドでプリロード
export async function preloadTracks(urls) {
    if (!('caches' in window) || !urls || urls.length === 0) return;

    console.log(`[Cache] Preloading ${urls.length} tracks...`);

    try {
        const cache = await caches.open(CACHE_NAME);
        for (const url of urls) {
            // すでにキャッシュ済み、または現在ロード中の場合はスキップ
            if (activePreloads.has(url)) continue;

            const isCached = await isUrlCached(cache, url);
            if (isCached) {
                console.log(`[Cache] Already cached, skipping: ${url}`);
                continue;
            }

            activePreloads.add(url);
            console.log(`[Cache] Fetching: ${url}`);

            fetch(url, { mode: 'cors' }).then(async (response) => {
                if (response.status === 200) {
                    await cache.put(url, response);
                    console.log(`[Cache] Successfully cached: ${url}`);
                } else {
                    console.warn(`[Cache] Skipped caching (status ${response.status}): ${url}`);
                }
            }).catch((err) => {
                console.error(`[Cache] Fetch failed for ${url}:`, err);
            }).finally(() => {
                activePreloads.delete(url);
            });
        }
    } catch (err) {
        console.warn('Preload failed:', err);
    }
}

// すべてをキャッシュ
export async function cacheAll(onProgress) {
    if (isCaching) {
        throw new Error('キャッシュ処理が進行中です');
    }

    try {
        // ジャケット画像
        await cacheAllJackets(onProgress);

        // 音声ファイル
        await cacheAllAudio(onProgress);

        return true;
    } finally {
        isCaching = false;
        cacheProgress = { current: 0, total: 0, cached: 0, skipped: 0, type: '' };
    }
}

// キャッシュをクリア
export async function clearCache() {
    if (!('caches' in window)) {
        throw new Error('オフラインキャッシュ機能はこの環境では利用できません');
    }
    await caches.delete(CACHE_NAME);
}

// キャッシュサイズを取得（概算）
export async function getCacheSize() {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
        const estimate = await navigator.storage.estimate();
        return {
            usage: estimate.usage || 0,
            quota: estimate.quota || 0
        };
    }
    return { usage: 0, quota: 0 };
}

// キャッシュ済みファイル数を取得
export async function getCachedCount() {
    try {
        if (!('caches' in window)) return { jackets: 0, audio: 0, total: 0 };
        const cache = await caches.open(CACHE_NAME);
        const keys = await cache.keys();

        let jackets = 0;
        let audio = 0;

        keys.forEach(request => {
            if (request.url.includes('/jacket/')) {
                jackets++;
            } else if (request.url.includes('/long/') && request.url.endsWith('.mp3')) {
                audio++;
            }
        });

        return { jackets, audio, total: keys.length };
    } catch {
        return { jackets: 0, audio: 0, total: 0 };
    }
}
