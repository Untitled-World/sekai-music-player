/**
 * SEKAI Music Player - メインエントリポイント (Main Entry Point)
 */
import { CONFIG } from './config.js';
import { state } from './state.js';
import { elements } from './elements.js';

// モジュール
import { initTheme, toggleTheme } from './modules/theme.js';
import { loadFavorites, toggleFavorite } from './modules/favorites.js';
import { loadPlaylists, savePlaylists, createPlaylist, exportPlaylistIds, deletePlaylist, parseIdString, switchToPlaylistContext, renderPlaylistsList, openAddToPlaylistModal, closeAddToPlaylistModal, closePlaylistsModal } from './modules/playlist.js';
import { getActivePlayer, playMusic, playNext, playPrev, togglePlayPause, toggleRepeat, toggleShuffle, setVolume, toggleMute, seekTo, handleSeekStart, handleSeekMove, handleSeekEnd, updateBuffered, getPreferredVocal } from './modules/player.js';
import { renderMusicGrid, filterMusic, switchToAllContext, updateStats, updateNowPlayingUI, updatePlayPauseButton, updateProgress } from './modules/ui.js';
import { openLyricsModal, closeLyricsModal, openVocalModal, closeVocalModal, closeConfirmModal, executeConfirmCallback, showAlertModal, showConfirmModal } from './modules/modals.js';
import { loadStats, openStatsModal, closeStatsModal, renderStatsContent } from './modules/stats.js';

// 設定管理 (Settings Management) - ここに残すか、専用モジュールにするか。今回はMainに置く。
function loadSettings() {
    const saved = localStorage.getItem('sekai_settings');
    if (saved) {
        state.settings = { ...state.settings, ...JSON.parse(saved) };
    }
    if (elements.vocalPrioritySelect) {
        elements.vocalPrioritySelect.value = state.settings.vocalPriority;
    }
    if (elements.autoplayToggle) {
        elements.autoplayToggle.checked = state.settings.autoplay;
        updateAutoplayLabel();
    }

    if (elements.crossfadeToggle) {
        elements.crossfadeToggle.checked = state.settings.crossfade;
        updateCrossfadeLabel();
        if (state.settings.crossfade) {
            elements.crossfadeSliderContainer.style.display = 'block';
        }
    }
    if (elements.crossfadeSlider) {
        elements.crossfadeSlider.value = state.settings.crossfadeDuration;
        elements.crossfadeValue.textContent = `${state.settings.crossfadeDuration}秒`;
    }
}

function updateAutoplayLabel() {
    const label = elements.autoplayToggle?.parentElement?.querySelector('.toggle-label');
    if (label) {
        label.textContent = state.settings.autoplay ? 'ON' : 'OFF';
    }
}

function updateCrossfadeLabel() {
    const label = elements.crossfadeToggle?.parentElement?.querySelector('.toggle-label');
    if (label) {
        label.textContent = state.settings.crossfade ? 'ON' : 'OFF';
    }
}

function saveSettings() {
    localStorage.setItem('sekai_settings', JSON.stringify(state.settings));
}

function toggleSortMode() {
    state.sortMode = state.sortMode === 'default' ? 'newly_written' : 'default';

    // UI更新
    const label = elements.sortToggleBtn.querySelector('.sort-label');
    if (state.sortMode === 'newly_written') {
        label.textContent = '書き下ろし順';
        elements.sortToggleBtn.classList.add('active');
    } else {
        label.textContent = 'デフォルト';
        elements.sortToggleBtn.classList.remove('active');
    }

    filterMusic();
}

// データ読み込み (Data Loading)
async function loadMusicData() {
    try {
        const response = await fetch(CONFIG.MUSIC_DATA_URL);
        if (!response.ok) throw new Error('Failed to load music data');
        state.musicData = await response.json();
        state.filteredData = [...state.musicData];
        renderMusicGrid();
        updateStats();
    } catch (error) {
        console.error('Error loading music data:', error);
        elements.musicGrid.innerHTML = `
            <div class="no-results">
                <div class="no-results-icon">❌</div>
                <div class="no-results-text">楽曲データの読み込みに失敗しました</div>
                <div class="no-results-hint">music.json ファイルを確認してください</div>
            </div>
        `;
    }
}

async function loadLyricsData() {
    try {
        const response = await fetch(CONFIG.LYRICS_DATA_URL);
        if (!response.ok) throw new Error('Failed to load lyrics data');
        state.lyricsData = await response.json();
    } catch (error) {
        console.error('Error loading lyrics data:', error);
    }
}

// イベントリスナー登録 (Event Listeners)
function initEventListeners() {
    // 検索
    if (elements.searchInput) {
        elements.searchInput.addEventListener('input', (e) => {
            state.searchQuery = e.target.value;
            elements.searchClear.classList.toggle('visible', state.searchQuery.length > 0);

            if (state.playbackContext === 'playlist') {
                switchToAllContext();
            }
            filterMusic();
        });
    }

    if (elements.searchClear) {
        elements.searchClear.addEventListener('click', () => {
            state.searchQuery = '';
            elements.searchInput.value = '';
            elements.searchClear.classList.remove('visible');
            filterMusic();
        });
    }

    // ソートトリガー
    if (elements.sortToggleBtn) {
        elements.sortToggleBtn.addEventListener('click', toggleSortMode);
    }

    // フィルターチップ
    document.querySelectorAll('.chip').forEach(chip => {
        chip.addEventListener('click', () => {
            if (state.playbackContext === 'playlist') {
                switchToAllContext();
            }

            document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            state.currentFilter = chip.dataset.filter;
            filterMusic();
        });
    });

    // テーマ切り替え
    if (elements.themeToggle) {
        elements.themeToggle.addEventListener('click', toggleTheme);
    }

    // 設定モーダル
    if (elements.settingsBtn) {
        elements.settingsBtn.addEventListener('click', () => {
            elements.settingsModal.classList.add('visible');
        });
    }
    if (elements.settingsClose) {
        elements.settingsClose.addEventListener('click', () => {
            elements.settingsModal.classList.remove('visible');
        });
    }
    if (elements.settingsModal) {
        elements.settingsModal.addEventListener('click', (e) => {
            if (e.target === elements.settingsModal) elements.settingsModal.classList.remove('visible');
        });
    }
    if (elements.vocalPrioritySelect) {
        elements.vocalPrioritySelect.addEventListener('change', (e) => {
            state.settings.vocalPriority = e.target.value;
            saveSettings();
        });
    }

    if (elements.crossfadeToggle) {
        elements.crossfadeToggle.addEventListener('change', (e) => {
            state.settings.crossfade = e.target.checked;
            elements.crossfadeSliderContainer.style.display = e.target.checked ? 'block' : 'none';
            updateCrossfadeLabel();
            saveSettings();
        });
    }

    if (elements.crossfadeSlider) {
        elements.crossfadeSlider.addEventListener('input', (e) => {
            state.settings.crossfadeDuration = parseFloat(e.target.value);
            elements.crossfadeValue.textContent = `${state.settings.crossfadeDuration}秒`;
            saveSettings();
        });
    }

    // プレイリストモーダル
    if (elements.playlistMenuBtn) {
        elements.playlistMenuBtn.addEventListener('click', () => {
            renderPlaylistsList();
            elements.playlistsModal.classList.add('visible');
        });
    }
    if (elements.playlistsClose) {
        elements.playlistsClose.addEventListener('click', closePlaylistsModal);
    }
    if (elements.playlistsModal) {
        elements.playlistsModal.addEventListener('click', (e) => {
            if (e.target === elements.playlistsModal) closePlaylistsModal();
        });
    }
    if (elements.createPlaylistBtn) {
        elements.createPlaylistBtn.addEventListener('click', () => {
            let name = elements.newPlaylistName.value.trim();

            if (!name) {
                const defaultNum = state.savedPlaylists.length + 1;
                name = `プレイリスト ${defaultNum}`;
            }

            const idsInput = elements.newPlaylistIds;
            if (idsInput && idsInput.value.trim()) {
                const ids = parseIdString(idsInput.value);
                createPlaylist(name, ids);
            } else {
                createPlaylist(name);
            }
        });
    }

    // Add to Playlist Modal
    if (elements.addToPlaylistClose) {
        elements.addToPlaylistClose.addEventListener('click', closeAddToPlaylistModal);
    }
    if (elements.addToPlaylistModal) {
        elements.addToPlaylistModal.addEventListener('click', (e) => {
            if (e.target === elements.addToPlaylistModal) closeAddToPlaylistModal();
        });
    }

    // Confirm Modal
    if (elements.confirmOkBtn) {
        elements.confirmOkBtn.addEventListener('click', () => {
            executeConfirmCallback();
        });
    }
    if (elements.confirmCancelBtn) {
        elements.confirmCancelBtn.addEventListener('click', closeConfirmModal);
    }
    if (elements.confirmClose) {
        elements.confirmClose.addEventListener('click', closeConfirmModal);
    }
    if (elements.confirmModal) {
        elements.confirmModal.addEventListener('click', (e) => {
            if (e.target === elements.confirmModal) closeConfirmModal();
        });
    }

    // Player controls
    if (elements.playPauseBtn) elements.playPauseBtn.addEventListener('click', togglePlayPause);
    if (elements.prevBtn) elements.prevBtn.addEventListener('click', playPrev);
    if (elements.nextBtn) elements.nextBtn.addEventListener('click', playNext);
    if (elements.repeatBtn) elements.repeatBtn.addEventListener('click', toggleRepeat);
    if (elements.shuffleBtn) elements.shuffleBtn.addEventListener('click', toggleShuffle);
    if (elements.volumeBtn) elements.volumeBtn.addEventListener('click', toggleMute);
    if (elements.volumeSlider) elements.volumeSlider.addEventListener('input', (e) => setVolume(e.target.value));

    if (elements.settingVolumeSlider) {
        elements.settingVolumeSlider.addEventListener('input', (e) => setVolume(e.target.value));
    }

    if (elements.lyricsBtn) elements.lyricsBtn.addEventListener('click', openLyricsModal);
    if (elements.favBtn) elements.favBtn.addEventListener('click', () => {
        if (state.currentTrack) {
            toggleFavorite(state.currentTrack.id);
        }
    });

    // Progress bar
    if (elements.progressBar) {
        elements.progressBar.addEventListener('click', seekTo);

        // モバイル用タッチイベント
        elements.progressBar.addEventListener('touchstart', (e) => {
            e.preventDefault(); // スクロール防止
            handleSeekStart();
            handleSeekMove(e); // タップした瞬間の位置も反映
        }, { passive: false });

        elements.progressBar.addEventListener('touchmove', (e) => {
            if (e.cancelable) e.preventDefault();
            handleSeekMove(e);
        }, { passive: false });

        elements.progressBar.addEventListener('touchend', (e) => {
            if (e.cancelable) e.preventDefault();
            handleSeekEnd(e);
        }, { passive: false });
    }

    // Audio events (Bind to both players)
    [elements.audioPlayer, elements.audioPlayerAlt].forEach(player => {
        if (!player) return;

        player.addEventListener('play', () => {
            if (getActivePlayer() === player && !state.isCrossfading) {
                state.isPlaying = true;
                updatePlayPauseButton();
            }
        });

        player.addEventListener('pause', () => {
            if (getActivePlayer() === player && !state.isCrossfading) {
                state.isPlaying = false;
                updatePlayPauseButton();
            }
        });

        player.addEventListener('timeupdate', () => {
            if (getActivePlayer() === player) {
                updateProgress();

                // クロスフェード自動再生
                if (state.settings.crossfade && state.settings.autoplay && !state.isCrossfading && player.duration) {
                    const remaining = player.duration - player.currentTime;
                    // INTROスキップ秒数を考慮（実質の曲終わり）
                    // ここでのCONFIG.INTRO_SKIP_SECONDSは9秒だが、曲の末尾ではない。
                    // 以前のロジック: if (remaining <= state.settings.crossfadeDuration && remaining > 0)
                    // これは曲の終わり近くで発火。
                    // 元のコードは: 
                    // if (remaining <= state.settings.crossfadeDuration && remaining > 0) { playNext(true); }

                    if (remaining <= state.settings.crossfadeDuration && remaining > 0) {
                        playNext(true);
                    }
                }
            }
        });

        player.addEventListener('progress', () => {
            if (getActivePlayer() === player) updateProgress(); // updateBuffered in standard app? ui.js has updateProgress, player.js has updateBuffered.
            // Wait, updateProgress handles Time/Bar. updateBuffered handles grey bar.
            // My import from ui.js included updateProgress. 
            // I should import updateBuffered from player.js
            updateBuffered();
        });

        player.addEventListener('ended', () => {
            if (getActivePlayer() === player) {
                if (!state.settings.crossfade || state.isCrossfading) {
                    if (state.isRepeat) {
                        player.currentTime = CONFIG.INTRO_SKIP_SECONDS;
                        player.play().catch(err => console.warn('Playback failed:', err));
                    } else if (state.settings.autoplay && !state.isCrossfading) {
                        playNext(false);
                    }
                }
            }
        });
    });

    // Modals
    if (elements.modalClose) elements.modalClose.addEventListener('click', closeVocalModal);
    if (elements.vocalModal) elements.vocalModal.addEventListener('click', (e) => {
        if (e.target === elements.vocalModal) closeVocalModal();
    });

    if (elements.lyricsClose) elements.lyricsClose.addEventListener('click', closeLyricsModal);
    if (elements.lyricsModal) elements.lyricsModal.addEventListener('click', (e) => {
        if (e.target === elements.lyricsModal) closeLyricsModal();
    });

    // コンテキストバー
    if (elements.contextCloseBtn) elements.contextCloseBtn.addEventListener('click', switchToAllContext);
    if (elements.contextCopyBtn) elements.contextCopyBtn.addEventListener('click', () => {
        if (state.activePlaylistId) exportPlaylistIds(state.activePlaylistId);
    });
    if (elements.contextPlayBtn) elements.contextPlayBtn.addEventListener('click', () => {
        if (state.filteredData.length > 0) {
            playMusic(state.filteredData[0], getPreferredVocal(state.filteredData[0]));
        }
    });
    if (elements.contextDeleteBtn) elements.contextDeleteBtn.addEventListener('click', () => {
        if (state.activePlaylistId) deletePlaylist(state.activePlaylistId);
    });

    // 自動再生トグル
    if (elements.autoplayToggle) {
        elements.autoplayToggle.addEventListener('change', (e) => {
            state.settings.autoplay = e.target.checked;
            updateAutoplayLabel();
            saveSettings();
        });
    }

    // 最上部に戻るボタン
    if (elements.scrollToTopBtn) {
        elements.scrollToTopBtn.addEventListener('click', () => {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
        window.addEventListener('scroll', () => {
            if (window.scrollY > 300) {
                elements.scrollToTopBtn.classList.add('visible');
            } else {
                elements.scrollToTopBtn.classList.remove('visible');
            }
        });
    }

    // 楽曲名クリック
    if (elements.playerTitle) {
        elements.playerTitle.addEventListener('click', () => {
            if (state.currentTrack) {
                const playingCard = document.querySelector(`.music-card[data-id="${state.currentTrack.id}"]`);
                if (playingCard) {
                    playingCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }
        });
    }

    // アーティスト/ボーカルクリック
    if (elements.playerArtist) {
        elements.playerArtist.addEventListener('click', () => {
            if (state.currentTrack && state.currentTrack.vocals?.length > 1) {
                openVocalModal(state.currentTrack);
            }
        });
    }

    // ジャケットクリック
    if (elements.playerJacket) {
        elements.playerJacket.addEventListener('click', () => {
            if (!state.currentTrack) return;
            if (state.currentTrack.vocals?.length > 1) {
                openVocalModal(state.currentTrack);
            } else {
                const playingCard = document.querySelector(`.music-card[data-id="${state.currentTrack.id}"]`);
                if (playingCard) {
                    playingCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }
        });
    }

    // 統計モーダル
    if (elements.statsBtn) {
        elements.statsBtn.addEventListener('click', openStatsModal);
    }
    if (elements.statsClose) {
        elements.statsClose.addEventListener('click', closeStatsModal);
    }
    if (elements.statsModal) {
        elements.statsModal.addEventListener('click', (e) => {
            if (e.target === elements.statsModal) closeStatsModal();
        });
    }

    // タブ切り替え
    document.querySelectorAll('.stats-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            renderStatsContent(tab.dataset.tab);
        });
    });
}

// キーボードショートカット (Shortcuts)
// App.js had initShortcuts inside and calling it.
function initShortcuts() {
    document.addEventListener('keydown', (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

        const player = getActivePlayer();

        switch (e.code) {
            case 'Space':
                e.preventDefault();
                togglePlayPause();
                break;
            case 'ArrowLeft':
                const newTimeBack = player.currentTime - 5;
                player.currentTime = Math.max(CONFIG.INTRO_SKIP_SECONDS, newTimeBack);
                break;
            case 'ArrowRight':
                player.currentTime += 5;
                break;
            case 'ArrowUp':
                e.preventDefault();
                setVolume(Math.min(100, state.volume * 100 + 10));
                elements.volumeSlider.value = state.volume * 100;
                break;
            case 'ArrowDown':
                e.preventDefault();
                setVolume(Math.max(0, state.volume * 100 - 10));
                elements.volumeSlider.value = state.volume * 100;
                break;
            case 'KeyM':
                toggleMute();
                break;
            case 'KeyL':
                openLyricsModal();
                break;
        }
    });
}

// 初期化 (Initialization)
async function init() {
    initTheme();
    loadSettings();
    loadFavorites();
    loadPlaylists();
    loadStats(); // 統計読み込み
    initEventListeners();
    initShortcuts();
    setVolume(80);
    await Promise.all([loadMusicData(), loadLyricsData()]);
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
