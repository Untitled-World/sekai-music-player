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
let abortController = null;
let cacheProgress = { current: 0, total: 0, cached: 0, skipped: 0, type: '' };
const activePreloads = new Set(); // 重複ロード防止用

export function getCacheProgress() {
    return { ...cacheProgress };
}

export function isCachingInProgress() {
    return isCaching;
}

// キャッシュ処理を中止
export function abortCaching() {
    if (abortController) {
        abortController.abort();
        abortController = null;
        isCaching = false;
        console.info('[Cache] Caching aborted by user');
    }
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

// 並列実行用ヘルパー
async function runWithLimit(urls, concurrency, processor) {
    const results = [];
    const executing = new Set();

    for (const url of urls) {
        if (!isCaching) break;

        const p = Promise.resolve().then(() => processor(url));
        results.push(p);
        executing.add(p);

        const cleanUp = () => executing.delete(p);
        p.then(cleanUp).catch(cleanUp);

        if (executing.size >= concurrency) {
            await Promise.race(executing);
        }
    }
    return Promise.all(results);
}

// すべてのジャケット画像をキャッシュ
export async function cacheAllJackets(onProgress) {
    if (!state.musicData || state.musicData.length === 0) {
        throw new Error('楽曲データが読み込まれていません');
    }

    isCaching = true;
    abortController = new AbortController();
    const signal = abortController.signal;

    if (!('caches' in window)) {
        isCaching = false;
        throw new Error('オフラインキャッシュ機能はこの環境（HTTPSまたはlocalhost以外）では利用できません');
    }
    const cache = await caches.open(CACHE_NAME);
    const jacketUrls = [...new Set(state.musicData.map(m => getJacketUrl(m.assetbundleName)))];

    cacheProgress = { current: 0, total: jacketUrls.length, cached: 0, skipped: 0, type: 'jacket' };

    await runWithLimit(jacketUrls, 10, async (url) => {
        if (signal.aborted) return;

        if (await isUrlCached(cache, url)) {
            cacheProgress.skipped++;
        } else {
            try {
                const response = await fetch(url, { signal });
                if (response.ok) {
                    cacheProgress.cached++;
                }
            } catch (err) {
                if (err.name !== 'AbortError') console.warn(`Failed to cache jacket: ${url}`, err);
            }
        }
        cacheProgress.current++;
        if (onProgress) onProgress(cacheProgress);
    });

    isCaching = false;
    const aborted = signal.aborted;
    abortController = null;
    return aborted ? null : { total: jacketUrls.length, cached: cacheProgress.cached, skipped: cacheProgress.skipped };
}

// すべての音声ファイルをキャッシュ
export async function cacheAllAudio(onProgress) {
    if (!state.musicData || state.musicData.length === 0) {
        throw new Error('楽曲データが読み込まれていません');
    }

    isCaching = true;
    abortController = new AbortController();
    const signal = abortController.signal;

    if (!('caches' in window)) {
        isCaching = false;
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

    await runWithLimit(uniqueUrls, 5, async (url) => {
        if (signal.aborted) return;

        if (activePreloads.has(url) || await isUrlCached(cache, url)) {
            cacheProgress.skipped++;
        } else {
            try {
                activePreloads.add(url);
                const response = await fetch(url, { mode: 'cors', signal });
                if (response.status === 200) {
                    await cache.put(url, response);
                    cacheProgress.cached++;
                }
            } catch (err) {
                if (err.name !== 'AbortError') console.warn(`Failed to cache audio: ${url}`, err);
            } finally {
                activePreloads.delete(url);
            }
        }
        cacheProgress.current++;
        if (onProgress) onProgress(cacheProgress);
    });

    isCaching = false;
    const aborted = signal.aborted;
    abortController = null;
    return aborted ? null : { total: uniqueUrls.length, cached: cacheProgress.cached, skipped: cacheProgress.skipped };
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
