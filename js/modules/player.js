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

export function getActivePlayer() {
    return state.activePlayerId === 'primary' ? elements.audioPlayer : elements.audioPlayerAlt;
}

export function switchActivePlayer() {
    state.activePlayerId = state.activePlayerId === 'primary' ? 'secondary' : 'primary';
    return getActivePlayer();
}

/**
 * プレイヤーの初期化
 */
export function initPlayer() {
    // 最初のプレイヤーをアクティブに
    state.activePlayerId = 'primary';

    // イベントリスナーの設定
    setupPlayerEvents(elements.audioPlayer);
    setupPlayerEvents(elements.audioPlayerAlt);

    // 定期的な更新タイマー
    setupProgressTimer();
}

function setupPlayerEvents(player) {
    player.addEventListener('timeupdate', () => {
        // UI更新はタイマーで行うため、ここではstateのみ更新
        // ただし、再生終了判定などはここで行う
    });

    player.addEventListener('ended', () => {
        if (state.isLoop && !state.isRepeat) {
            // プレイリストループの場合
            playNext();
        } else if (state.isRepeat) {
            // 1曲リピートの場合
            player.currentTime = CONFIG.INTRO_SKIP_SECONDS;
            player.play();
        } else {
            // ループなしの場合、次の曲があれば再生
            if (state.currentIndex < state.playlist.length - 1) {
                playNext();
            } else {
                // プレイリスト終了
                state.isPlaying = false;
                updatePlayPauseButton();
            }
        }
    });

    player.addEventListener('error', (e) => {
        console.error('Audio error:', e);
        state.isLoading = false;
        setLoadingState(false);
    });

    player.addEventListener('waiting', () => {
        state.isLoading = true;
        setLoadingState(true);
    });

    player.addEventListener('canplay', () => {
        state.isLoading = false;
        setLoadingState(false);
    });

    player.addEventListener('play', () => {
        state.isPlaying = true;
        updatePlayPauseButton();
    });

    player.addEventListener('pause', () => {
        state.isPlaying = false;
        updatePlayPauseButton();
    });
}

export function getPreferredVocal(music) {
    if (!music.vocals || music.vocals.length === 0) return null;
    if (music.vocals.length === 1) return music.vocals[0];

    const priority = state.settings.vocalPriority || 'sekai';

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

/**
 * 楽曲を再生する
 */
export async function playMusic(music, vocal, useCrossfade = false) {
    // 既存のプレイヤー処理
    const previousPlayer = getActivePlayer();

    // クロスフェード設定の確認（ユーザー設定かつ引数がtrue）
    const userCrossfade = document.getElementById('crossfadeToggle')?.checked === false; // OFF=checkedなので反転
    const doCrossfade = useCrossfade && userCrossfade;

    if (doCrossfade) {
        if (!previousPlayer.paused) {
            fadeOut(previousPlayer);
        }
        switchActivePlayer();
    } else {
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

    // プリロード
    triggerPreload();

    // UI更新
    updateNowPlayingUI();
    updatePlayingCard();
    elements.nowPlayingBar.classList.add('visible');
    updateDynamicBackground(music.assetbundleName);

    updateMediaSession(music, vocal);
    applyUnitTheme(music.unit);

    setLoadingState(true);

    const currentPlayer = getActivePlayer();
    const targetTime = CONFIG.INTRO_SKIP_SECONDS;
    const audioUrl = getAudioUrl(vocal.assetbundleName);

    const playNewTrack = () => {
        return new Promise((resolve) => {
            setLoadingState(true);

            const currentSrc = (currentPlayer.src || '').split('#')[0];
            const isSameSource = currentSrc.includes(vocal.assetbundleName);

            if (!isSameSource) {
                currentPlayer.src = `${audioUrl}#t=${targetTime}`;
                currentPlayer.load();

                const onMetadata = () => {
                    currentPlayer.removeEventListener('loadedmetadata', onMetadata);
                    if (currentPlayer.currentTime < targetTime) {
                        currentPlayer.currentTime = targetTime;
                    }
                    currentPlayer.play().then(() => {
                        resolve();
                    }).catch(e => {
                        console.error("Play error:", e);
                        resolve();
                    });
                };
                currentPlayer.addEventListener('loadedmetadata', onMetadata);
            } else {
                currentPlayer.currentTime = targetTime;
                currentPlayer.play().then(() => {
                    resolve();
                }).catch(e => {
                    console.error("Replay error:", e);
                    resolve();
                });
            }
        });
    };

    await playNewTrack();

    if (doCrossfade) {
        fadeIn(currentPlayer);
    } else {
        currentPlayer.volume = state.volume;
    }

    setLoadingState(false);
    recordPlay(music.id);
}

function fadeOut(player) {
    const fadeDuration = parseFloat(document.getElementById('crossfadeSlider')?.value || 3) * 1000;
    const steps = 20;
    const interval = fadeDuration / steps;
    const initialVolume = player.volume;
    let step = 0;

    const fadeTimer = setInterval(() => {
        step++;
        const ratio = 1 - (step / steps);
        player.volume = initialVolume * ratio;

        if (step >= steps) {
            clearInterval(fadeTimer);
            player.pause();
            player.volume = state.volume;
        }
    }, interval);
}

function fadeIn(player) {
    const fadeDuration = parseFloat(document.getElementById('crossfadeSlider')?.value || 3) * 1000;
    const steps = 20;
    const interval = fadeDuration / steps;
    const targetVolume = state.volume;

    player.volume = 0;
    let step = 0;

    const fadeTimer = setInterval(() => {
        step++;
        const ratio = step / steps;
        player.volume = targetVolume * ratio;

        if (step >= steps) {
            clearInterval(fadeTimer);
            player.volume = targetVolume;
        }
    }, interval);
}

function triggerPreload() {
    const preloadCount = 3;
    const tracksToPreload = [];

    for (let i = 1; i <= preloadCount; i++) {
        const idx = (state.currentIndex + i) % state.playlist.length;
        if (state.playlist[idx]) {
            tracksToPreload.push(state.playlist[idx]);
        }
    }
    preloadTracks(tracksToPreload);
}

function setupProgressTimer() {
    const intervalTime = 200;
    setInterval(() => {
        if (state.isPlaying) {
            const player = getActivePlayer();
            if (!player.paused) {
                const currentTime = player.currentTime;
                const duration = player.duration;

                const effectiveCurrentTime = Math.max(0, currentTime - CONFIG.INTRO_SKIP_SECONDS);
                const effectiveDuration = Math.max(0, duration - CONFIG.INTRO_SKIP_SECONDS);

                if (effectiveDuration > 0) {
                    const percent = (effectiveCurrentTime / effectiveDuration) * 100;
                    renderProgress(percent, effectiveCurrentTime);
                }
            }
        }
    }, intervalTime);
}

// UI操作用
export function togglePlayPause() {
    const player = getActivePlayer();
    if (player.paused) {
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
 * 再生を再開する（UI / 他モジュール連携用）
 */
export function resumePlayback() {
    togglePlayPause();
}

/**
 * 再生を停止する（UI / 他モジュール連携用）
 */
export function pausePlayback() {
    togglePlayPause();
}

export function playNext(useCrossfade = false) {
    if (state.playlist.length === 0) return;

    let nextIndex;
    if (state.isShuffle) {
        nextIndex = Math.floor(Math.random() * state.playlist.length);
    } else {
        nextIndex = (state.currentIndex + 1) % state.playlist.length;
        // ループOFFで最後の曲なら停止
        if (!state.isLoop && nextIndex === 0 && state.currentIndex === state.playlist.length - 1) {
            pausePlayback();
            return;
        }
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

    }
}
