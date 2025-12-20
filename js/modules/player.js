/**
 * プレイヤー機能 (Player)
 */
console.info('[Player] Initializing...');
import { state } from '../state.js';
import { CONFIG } from '../config.js';
import { elements } from '../elements.js';
import { getAudioUrl, getJacketUrl, formatTime } from '../utils.js';
import { updateFavoriteBtnState } from './favorites.js';
import { openVocalModal } from './modals.js';
import { recordPlay } from './stats.js';
import { applyUnitTheme } from './theme.js';
import { preloadTracks } from './cache.js';

// Circular dependency: UI updates need to be imported
import { updateNowPlayingUI, updatePlayingCard, updateDynamicBackground, updatePlayPauseButton, updateProgress, updateVolumeIcon, setLoadingState } from './ui.js';

// デバッグ用: LocalStorageにログを保存（リモートデバッグなしで確認可能）
function debugLog(message) {
    const timestamp = new Date().toISOString();
    const entry = `[${timestamp}] ${message}`;
    console.log(entry);

    try {
        const logs = JSON.parse(localStorage.getItem('debug_logs') || '[]');
        logs.push(entry);
        // 最新50件のみ保持
        if (logs.length > 50) logs.shift();
        localStorage.setItem('debug_logs', JSON.stringify(logs));
    } catch (e) {
        // LocalStorage エラーは無視
    }
}

// デバッグログを取得（コンソールから呼び出し可能）
window.getDebugLogs = () => {
    try {
        const logs = JSON.parse(localStorage.getItem('debug_logs') || '[]');
        return logs.join('\n');
    } catch (e) {
        return 'No logs';
    }
};

// デバッグログをクリア
window.clearDebugLogs = () => {
    localStorage.removeItem('debug_logs');
    console.log('Debug logs cleared');
};

export function getActivePlayer() {
    return state.activePlayerId === 'primary' ? elements.audioPlayer : elements.audioPlayerAlt;
}

export function getInactivePlayer() {
    return state.activePlayerId === 'primary' ? elements.audioPlayerAlt : elements.audioPlayer;
}

export function switchActivePlayer() {
    state.activePlayerId = state.activePlayerId === 'primary' ? 'secondary' : 'primary';
}

export function getPreferredVocal(music) {
    if (!music.vocals || music.vocals.length === 0) return null;
    if (music.vocals.length === 1) return music.vocals[0];

    const priority = state.settings.vocalPriority;

    if (priority === 'default') {
        return music.vocals[0];
    }

    if (priority === 'sekai') {
        let sekaiVocal = music.vocals.find(v => v.type === 'セカイver.');
        if (!sekaiVocal) {
            sekaiVocal = music.vocals.find(v => v.type !== 'バーチャル・シンガーver.');
        }
        return sekaiVocal || music.vocals[0];
    }

    if (priority === 'virtual_singer') {
        const vsVocal = music.vocals.find(v => v.type === 'バーチャル・シンガーver.');
        return vsVocal || music.vocals[0];
    }

    return music.vocals[0];
}

export async function playMusic(music, vocal, useCrossfade = false) {
    if (!music || !vocal) return;

    // 前の曲情報を保存（クロスフェード用）
    const previousPlayer = getActivePlayer();

    // クロスフェード条件チェック
    const doCrossfade = useCrossfade && state.settings.crossfade && state.isPlaying && !state.isCrossfading;

    if (doCrossfade) {
        state.isCrossfading = true;
        switchActivePlayer();
    } else {
        // クロスフェードでない場合は、前のプレイヤーを即座に停止
        if (!previousPlayer.paused) {
            previousPlayer.pause();
        }
    }

    // 状態更新
    state.isLoading = true;
    state.isPlaying = true;
    state.currentTrack = music;
    state.currentVocal = vocal;
    state.playlist = state.filteredData;
    state.currentIndex = state.playlist.findIndex(m => m.id === music.id);

    // 次の数曲をバックグラウンドでプリロードしておく
    triggerPreload();

    // UI更新
    updateNowPlayingUI();
    updatePlayingCard();
    elements.nowPlayingBar.classList.add('visible');
    updateDynamicBackground(music.assetbundleName);
    updateMediaSession(music, vocal);
    applyUnitTheme(music.unit);

    // UIに対する最終的な状態同期
    setLoadingState(true);

    // 新しいプレイヤーの準備
    const currentPlayer = getActivePlayer();
    const targetTime = CONFIG.INTRO_SKIP_SECONDS;
    const audioUrl = getAudioUrl(vocal.assetbundleName);

    const playNewTrack = () => {
        return new Promise((resolve) => {
            setLoadingState(true);

            const currentSrc = (currentPlayer.src || '').split('#')[0];
            const isSameSource = currentSrc.includes(vocal.assetbundleName);

            if (!isSameSource) {
                // メディアフラグメントを付与してバッファリングを最適化
                currentPlayer.src = `${audioUrl}#t=${targetTime}`;
                currentPlayer.load();
            }

            // メタデータロード後の処理
            const onMetadata = () => {
                if (currentPlayer.currentTime < targetTime - 0.5) {
                    currentPlayer.currentTime = targetTime;
                }

                currentPlayer.play().then(() => {
                    // 再生開始。もしシークがまだならここでも試みる
                    if (currentPlayer.currentTime < targetTime - 0.5) {
                        currentPlayer.currentTime = targetTime;
                    }
                    resolve();
                }).catch(err => {
                    console.warn('Playback failed:', err);
                    state.isPlaying = false;
                    updatePlayPauseButton();
                    resolve();
                });
            };

            if (currentPlayer.readyState >= 1) {
                onMetadata();
            } else {
                currentPlayer.addEventListener('loadedmetadata', onMetadata, { once: true });
            }

            currentPlayer.volume = doCrossfade ? 0 : state.volume;
        });
    };

    await playNewTrack();

    // 再生開始記録
    recordPlay(music.id);

    if (doCrossfade) {
        performCrossfade(previousPlayer, currentPlayer);
    } else {
        // 重要: プレイヤーが切り替わっていない（＝同じ）場合はリセットしてはいけない
        // これが「再生開始直後に冒頭（無音）に戻る」原因だった
        if (previousPlayer !== currentPlayer) {
            previousPlayer.pause();
            previousPlayer.currentTime = 0;
        }
    }
}

function triggerPreload() {
    if (!state.playlist || state.playlist.length === 0) return;

    const nextUrls = [];
    const preloadCount = 10;

    // 現在の曲(i=0)も含めて10曲分をプリロード対象にする
    for (let i = 0; i < preloadCount; i++) {
        const nextIdx = (state.currentIndex + i) % state.playlist.length;

        // 2回目以降で自分に戻ってきたら終了
        if (i > 0 && nextIdx === state.currentIndex) break;

        const nextMusic = state.playlist[nextIdx];
        if (nextMusic) {
            const vocal = getPreferredVocal(nextMusic);
            if (vocal) {
                nextUrls.push(getAudioUrl(vocal.assetbundleName));
            }
        }
    }

    if (nextUrls.length > 0) {
        console.log(`[Player] Triggering preload for ${nextUrls.length} tracks (including current)`);
        preloadTracks(nextUrls);
    }
}

function performCrossfade(fadeOutPlayer, fadeInPlayer) {
    const duration = state.settings.crossfadeDuration * 1000;
    const steps = 20;
    const intervalTime = duration / steps;
    const volumeStep = state.volume / steps;

    let currentStep = 0;

    const fadeInterval = setInterval(() => {
        currentStep++;

        // Fade Out
        const newOutVol = Math.max(0, state.volume - (volumeStep * currentStep));
        if (!fadeOutPlayer.paused) fadeOutPlayer.volume = newOutVol;

        // Fade In
        const newInVol = Math.min(state.volume, volumeStep * currentStep);
        if (!fadeInPlayer.paused) fadeInPlayer.volume = newInVol;

        if (currentStep >= steps) {
            clearInterval(fadeInterval);
            fadeOutPlayer.pause();
            fadeOutPlayer.currentTime = 0;
            fadeOutPlayer.volume = state.volume;
            fadeInPlayer.volume = state.volume;
            state.isCrossfading = false;
        }
    }, intervalTime);
}

/**
 * UI操作用（ユーザーのタップイベントから直接呼ばれることを想定）
 */
export function togglePlayPause() {
    const player = getActivePlayer();
    if (player.paused) {
        // フォアグラウンド操作時はシンプルに再生
        // iOSのUser Activation制約を回避するため、console.log等も最小限にする
        if (player.currentTime < CONFIG.INTRO_SKIP_SECONDS) {
            player.currentTime = CONFIG.INTRO_SKIP_SECONDS;
        }
        player.play().catch(err => {
            console.error('UI Playback failed:', err);
        });
    } else {
        player.pause();
    }
}

/**
 * 再生を再開する（Media Session からの明示的なplayアクション用）
 * バックグラウンド再生対策を含む
 */
export function resumePlayback() {
    const player = getActivePlayer();

    // iOSハック: currentTimeを再設定することでオーディオパイプラインを強制的にリフレッシュさせる
    // これにより、バックグラウンド復帰時に音声が出ない問題を回避できる場合がある
    try {
        const current = player.currentTime;
        if (current < CONFIG.INTRO_SKIP_SECONDS) {
            player.currentTime = CONFIG.INTRO_SKIP_SECONDS;
        } else {
            player.currentTime = current;
        }
    } catch (e) {
        // 無視
    }

    // ログ記録より先に play() を開始する (User Activation の有効期限を最大限活用)
    const playPromise = player.play();

    debugLog(`resumePlayback called, paused: ${player.paused}, currentTime: ${player.currentTime}`);

    // 状態更新
    state.isPlaying = true;
    updatePlayPauseButton();

    if (playPromise) {
        playPromise.then(() => {
            debugLog('play() succeeded');

            // iOSバックグラウンド再生対策: 音量再設定ハック
            if (player.volume !== state.volume) player.volume = state.volume;
            player.muted = false;

            state.isPlaying = true;
            updatePlayPauseButton();
        }).catch(err => {
            debugLog(`play() failed: ${err.message || err}`);
            console.warn('Playback failed:', err);

            // 失敗時は状態を戻す
            state.isPlaying = false;
            updatePlayPauseButton();
        });
    }
}

/**
 * 再生を停止する（Media Session からの明示的なpauseアクション用）
 * バックグラウンド再生対策を含む
 */
export function pausePlayback() {
    const player = getActivePlayer();
    debugLog(`pausePlayback called, paused: ${player.paused}`);

    // iOSではバックグラウンドでpausedが正しく取得できない場合があるため、
    // 条件チェックせずに常にpause()を試みる
    player.pause();
    state.isPlaying = false;
    updatePlayPauseButton();
}

export function playNext(useCrossfade = false) {
    if (state.playlist.length === 0) return;

    let nextIndex;
    if (state.isShuffle) {
        nextIndex = Math.floor(Math.random() * state.playlist.length);
    } else {
        nextIndex = (state.currentIndex + 1) % state.playlist.length;
    }

    const nextMusic = state.playlist[nextIndex];
    if (nextMusic) {
        const vocal = getPreferredVocal(nextMusic);
        playMusic(nextMusic, vocal, useCrossfade);
    }
}

export function playPrev() {
    if (state.playlist.length === 0) return;

    const player = getActivePlayer();

    if (player.currentTime > CONFIG.INTRO_SKIP_SECONDS + 3) {
        player.currentTime = CONFIG.INTRO_SKIP_SECONDS;
        return;
    }

    let prevIndex;
    if (state.isShuffle) {
        prevIndex = Math.floor(Math.random() * state.playlist.length);
    } else {
        prevIndex = (state.currentIndex - 1 + state.playlist.length) % state.playlist.length;
    }

    const prevMusic = state.playlist[prevIndex];
    if (prevMusic) {
        const vocal = getPreferredVocal(prevMusic);
        playMusic(prevMusic, vocal, false);
    }
}

export function toggleRepeat() {
    state.isRepeat = !state.isRepeat;
    elements.repeatBtn.classList.toggle('active', state.isRepeat);
}

export function toggleShuffle() {
    state.isShuffle = !state.isShuffle;
    elements.shuffleBtn.classList.toggle('active', state.isShuffle);
}

export function setVolume(value) {
    state.volume = value / 100;
    elements.audioPlayer.volume = state.volume;
    elements.audioPlayerAlt.volume = state.volume;

    elements.volumeSlider.value = value;
    if (elements.settingVolumeSlider) {
        elements.settingVolumeSlider.value = value;
    }

    updateVolumeIcon();
}

export function toggleMute() {
    const player = getActivePlayer();
    player.muted = !player.muted;
    elements.audioPlayer.muted = player.muted;
    elements.audioPlayerAlt.muted = player.muted;
    updateVolumeIcon();
}

import { renderProgress } from './ui.js';

function calculateSeekValues(clientX) {
    const rect = elements.progressBar.getBoundingClientRect();
    const percent = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));

    const player = getActivePlayer();
    const { duration } = player;
    if (isNaN(duration) || duration === 0) return null;

    const adjustedDuration = Math.max(0, duration - CONFIG.INTRO_SKIP_SECONDS);
    const seekTimeAdjusted = percent * adjustedDuration; // 0ベースの時間
    const actualSeekTime = seekTimeAdjusted + CONFIG.INTRO_SKIP_SECONDS; // 実際のcurrentTime
    const finalSeekTime = Math.max(CONFIG.INTRO_SKIP_SECONDS, actualSeekTime);

    return { percent: percent * 100, seekTime: seekTimeAdjusted, actualSeekTime: finalSeekTime };
}

export function seekTo(e) {
    const clientX = e.clientX;
    const values = calculateSeekValues(clientX);
    if (!values) return;

    const player = getActivePlayer();
    player.currentTime = values.actualSeekTime;
}

export function handleSeekStart() {
    state.isDragging = true;
}

export function handleSeekMove(e) {
    if (!state.isDragging) return;

    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const values = calculateSeekValues(clientX);
    if (!values) return;

    renderProgress(values.percent, values.seekTime);
}

export function handleSeekEnd(e) {
    if (!state.isDragging && e.type !== 'click') return;
    state.isDragging = false;

    const clientX = e.changedTouches ? e.changedTouches[0].clientX : e.clientX;
    const values = calculateSeekValues(clientX);
    if (!values) return;

    const player = getActivePlayer();
    player.currentTime = values.actualSeekTime;
}

export function updateBuffered() {
    const player = getActivePlayer();
    const buffered = player.buffered;
    if (buffered.length > 0) {
        const bufferedEnd = buffered.end(buffered.length - 1);
        const duration = player.duration;

        if (duration > 0) {
            const adjustedDuration = Math.max(0, duration - CONFIG.INTRO_SKIP_SECONDS);
            const adjustedBuffered = Math.max(0, bufferedEnd - CONFIG.INTRO_SKIP_SECONDS);

            const percent = adjustedDuration > 0 ? (adjustedBuffered / adjustedDuration) * 100 : 0;
            const clampedPercent = Math.min(100, Math.max(0, percent));

            elements.progressBuffered.style.width = `${clampedPercent}%`;
        }
    }
}

export function updateMediaSession(music, vocal) {
    if ('mediaSession' in navigator) {
        navigator.mediaSession.metadata = new MediaMetadata({
            title: music.title,
            artist: vocal?.vo || music.composer || 'Unknown',
            album: 'Project SEKAI',
            artwork: [
                { src: getJacketUrl(music.assetbundleName), sizes: '512x512', type: 'image/png' }
            ]
        });

        navigator.mediaSession.setActionHandler('play', () => {
            debugLog('MediaSession play action triggered');
            resumePlayback();
        });
        navigator.mediaSession.setActionHandler('pause', () => {
            debugLog('MediaSession pause action triggered');
            pausePlayback();
        });
        navigator.mediaSession.setActionHandler('previoustrack', () => playPrev());
        navigator.mediaSession.setActionHandler('nexttrack', () => playNext());
        navigator.mediaSession.setActionHandler('seekto', (details) => {
            if (details.seekTime) {
                const player = getActivePlayer();
                player.currentTime = Math.max(CONFIG.INTRO_SKIP_SECONDS, details.seekTime);
            }
        });
    }
}
