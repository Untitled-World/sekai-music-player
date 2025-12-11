/**
 * プレイヤー機能 (Player)
 */
import { state } from '../state.js';
import { CONFIG } from '../config.js';
import { elements } from '../elements.js';
import { getAudioUrl, getJacketUrl, formatTime } from '../utils.js';
import { updateFavoriteBtnState } from './favorites.js';
import { playMusic as playMusicFn } from './player.js'; // 自分自身を再帰呼び出しするために必要？ いや、関数名を変えれば... 
// 修正: exportする関数名と内部関数名が同じなので、再帰呼び出しは自分自身を呼ぶ。
import { openVocalModal } from './modals.js'; // Card listeners are in UI but playMusic calls UI
import { recordPlay } from './stats.js';
import { applyUnitTheme } from './theme.js';

// Circular dependency: UI updates need to be imported
import { updateNowPlayingUI, updatePlayingCard, updateDynamicBackground, updatePlayPauseButton, updateProgress, updateVolumeIcon, setLoadingState } from './ui.js';

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
        // これにより2重再生を防止
        if (!previousPlayer.paused) {
            previousPlayer.pause();
        }
    }

    // 状態更新
    state.currentTrack = music;
    state.currentVocal = vocal;
    state.playlist = state.filteredData;
    state.currentIndex = state.playlist.findIndex(m => m.id === music.id);

    // 新しいプレイヤーの準備
    const currentPlayer = getActivePlayer();
    const audioUrl = getAudioUrl(vocal.assetbundleName);

    const playNewTrack = () => {
        return new Promise((resolve) => {
            // ローディング状態を表示
            setLoadingState(true);

            currentPlayer.src = audioUrl;
            currentPlayer.volume = doCrossfade ? 0 : state.volume; // クロスフェード開始時は音量0

            // モバイル対策：load()を明示的に呼び出す
            currentPlayer.load();

            // モバイルブラウザでの自動再生制限回避のため、イベントリスナーを待たずに再生を試みる
            currentPlayer.currentTime = CONFIG.INTRO_SKIP_SECONDS;

            currentPlayer.play().then(() => {
                // ローディング完了
                setLoadingState(false);

                // 再生成功後、念のためcurrentTimeを確認
                if (currentPlayer.currentTime < CONFIG.INTRO_SKIP_SECONDS) {
                    currentPlayer.currentTime = CONFIG.INTRO_SKIP_SECONDS;
                }
                resolve();
            }).catch(err => {
                console.warn('Playback failed (Crossfade or Autoplay restricted):', err);

                // ローディング完了
                setLoadingState(false);

                // 再生に失敗した場合のリカバリー処理
                if (doCrossfade) {
                    // クロスフェード状態をリセット
                    state.isCrossfading = false;
                    // 前のプレイヤーを止める
                    previousPlayer.pause();
                    previousPlayer.currentTime = 0;
                    previousPlayer.volume = state.volume;

                    // 現在のプレイヤーの音量を戻す
                    currentPlayer.volume = state.volume;
                }

                // 再生失敗時は isPlaying を false にする
                state.isPlaying = false;
                updatePlayPauseButton();

                resolve();
            });
        });
    };

    await playNewTrack();

    updateNowPlayingUI();
    updatePlayingCard();
    elements.nowPlayingBar.classList.add('visible');
    updateDynamicBackground(music.assetbundleName);
    updateMediaSession(music, vocal);

    // ユニット別ダイナミックテーマを適用
    applyUnitTheme(music.unit);

    // 再生開始記録（クロスフェードを含むすべての再生で記録）
    recordPlay(music.id);

    if (doCrossfade) {
        performCrossfade(previousPlayer, currentPlayer);
    } else {
        previousPlayer.currentTime = 0;
        state.isPlaying = true;
        updatePlayPauseButton();
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
            fadeOutPlayer.volume = state.volume; // 音量を戻しておく
            fadeInPlayer.volume = state.volume;
            state.isCrossfading = false;
        }
    }, intervalTime);
}

export function togglePlayPause() {
    const player = getActivePlayer();
    if (player.paused) {
        if (player.currentTime < CONFIG.INTRO_SKIP_SECONDS) {
            player.currentTime = CONFIG.INTRO_SKIP_SECONDS;
        }
        player.play().catch(err => console.warn('Playback failed:', err));
    } else {
        player.pause();
    }
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
    if (isNaN(duration)) return { percent: 0, seekTime: 0 };

    const adjustedDuration = Math.max(0, duration - CONFIG.INTRO_SKIP_SECONDS);
    const seekTimeAdjusted = percent * adjustedDuration; // 0ベースの時間
    const actualSeekTime = seekTimeAdjusted + CONFIG.INTRO_SKIP_SECONDS; // 実際のcurrentTime
    const finalSeekTime = Math.max(CONFIG.INTRO_SKIP_SECONDS, actualSeekTime);

    return { percent: percent * 100, seekTime: seekTimeAdjusted, actualSeekTime: finalSeekTime };
}

export function seekTo(e) {
    // クリック等の単発シーク用
    const clientX = e.clientX;
    const { actualSeekTime } = calculateSeekValues(clientX);
    elements.audioPlayer.currentTime = actualSeekTime;
}

export function handleSeekStart() {
    state.isDragging = true;
}

export function handleSeekMove(e) {
    if (!state.isDragging) return;

    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const { percent, seekTime } = calculateSeekValues(clientX);

    // UIのみ更新
    renderProgress(percent, seekTime);
}

export function handleSeekEnd(e) {
    if (!state.isDragging && e.type !== 'click') return;
    state.isDragging = false;

    const clientX = e.changedTouches ? e.changedTouches[0].clientX : e.clientX;
    const { actualSeekTime } = calculateSeekValues(clientX);

    // 最終位置へシーク
    const player = getActivePlayer();
    player.currentTime = actualSeekTime;
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

        navigator.mediaSession.setActionHandler('play', () => togglePlayPause());
        navigator.mediaSession.setActionHandler('pause', () => togglePlayPause());
        navigator.mediaSession.setActionHandler('previoustrack', () => playPrev());
        navigator.mediaSession.setActionHandler('nexttrack', () => playNext());
        navigator.mediaSession.setActionHandler('seekto', (details) => {
            if (details.seekTime) {
                elements.audioPlayer.currentTime = Math.max(CONFIG.INTRO_SKIP_SECONDS, details.seekTime);
            }
        });
    }
}
