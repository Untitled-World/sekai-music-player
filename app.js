/**
 * SEKAI Music Player - メインアプリケーション
 * プロジェクトセカイ楽曲用の静的音楽プレイヤー
 */

// 設定
const CONFIG = {
    JACKET_BASE_URL: 'https://storage.sekai.best/sekai-jp-assets/music/jacket/',
    AUDIO_BASE_URL: 'https://storage.sekai.best/sekai-jp-assets/music/long/',
    MUSIC_DATA_URL: './music.json',
    LYRICS_DATA_URL: './song-lyrics.json',
    INTRO_SKIP_SECONDS: 9,
    MAX_PLAYLISTS: 10
};

// 状態管理
const state = {
    musicData: [],
    lyricsData: [],
    filteredData: [],
    currentFilter: 'all',
    searchQuery: '',
    currentTrack: null,
    currentVocal: null,
    playlist: [],
    currentIndex: 0,
    isPlaying: false,
    isRepeat: false,
    isShuffle: false,
    volume: 0.8,
    // プレイリスト＆設定の状態
    savedPlaylists: [],
    settings: {
        vocalPriority: 'sekai',
        autoplay: true,
        crossfade: false,
        crossfadeDuration: 3
    },
    playbackContext: 'all',
    activePlaylistId: null,
    pendingAddMusicId: null,  // 統合プレイリストモーダル用
    favorites: [], // お気に入りリスト
    activePlayerId: 'primary', // 'primary' or 'secondary'
    isCrossfading: false,
    sortMode: 'default' // 'default', 'newly_written'
};

// DOM要素
const elements = {
    sortToggleBtn: document.getElementById('sortToggleBtn'),
    musicGrid: document.getElementById('musicGrid'),
    searchInput: document.getElementById('searchInput'),
    searchClear: document.getElementById('searchClear'),
    musicCount: document.getElementById('musicCount'),
    currentFilter: document.getElementById('currentFilter'),
    nowPlayingBar: document.getElementById('nowPlayingBar'),
    playerJacket: document.getElementById('playerJacket'),
    playerJacketImg: document.getElementById('playerJacketImg'),
    playerTitle: document.getElementById('playerTitle'),
    playerArtist: document.getElementById('playerArtist'),
    playPauseBtn: document.getElementById('playPauseBtn'),
    prevBtn: document.getElementById('prevBtn'),
    nextBtn: document.getElementById('nextBtn'),
    progressBar: document.getElementById('progressBar'),
    progressFill: document.getElementById('progressFill'),
    progressHandle: document.getElementById('progressHandle'),
    progressBuffered: document.getElementById('progressBuffered'),
    currentTime: document.getElementById('currentTime'),
    durationTime: document.getElementById('durationTime'),
    volumeBtn: document.getElementById('volumeBtn'),
    volumeSlider: document.getElementById('volumeSlider'),
    repeatBtn: document.getElementById('repeatBtn'),
    shuffleBtn: document.getElementById('shuffleBtn'),
    lyricsBtn: document.getElementById('lyricsBtn'),
    themeToggle: document.getElementById('themeToggle'),
    dynamicBg: document.getElementById('dynamicBg'),
    // Modals
    vocalModal: document.getElementById('vocalModal'),
    modalMusicTitle: document.getElementById('modalMusicTitle'),
    vocalList: document.getElementById('vocalList'),
    modalClose: document.getElementById('modalClose'),
    lyricsModal: document.getElementById('lyricsModal'),
    lyricsMusicTitle: document.getElementById('lyricsMusicTitle'),
    lyricsContainer: document.getElementById('lyricsContainer'),
    lyricsClose: document.getElementById('lyricsClose'),
    settingsModal: document.getElementById('settingsModal'),
    settingsBtn: document.getElementById('settingsBtn'),
    settingsClose: document.getElementById('settingsClose'),
    vocalPrioritySelect: document.getElementById('vocalPrioritySelect'),
    playlistsModal: document.getElementById('playlistsModal'),
    playlistMenuBtn: document.getElementById('playlistMenuBtn'),
    playlistsClose: document.getElementById('playlistsClose'),
    playlistsList: document.getElementById('playlistsList'),
    newPlaylistName: document.getElementById('newPlaylistName'),
    newPlaylistIds: document.getElementById('newPlaylistIds'),
    createPlaylistBtn: document.getElementById('createPlaylistBtn'),
    addToPlaylistModal: document.getElementById('addToPlaylistModal'),
    addToPlaylistClose: document.getElementById('addToPlaylistClose'),
    addToPlaylistList: document.getElementById('addToPlaylistList'),
    confirmModal: document.getElementById('confirmModal'),
    confirmTitle: document.getElementById('confirmTitle'),
    confirmMessage: document.getElementById('confirmMessage'),
    confirmClose: document.getElementById('confirmClose'),
    confirmCancelBtn: document.getElementById('confirmCancelBtn'),
    confirmOkBtn: document.getElementById('confirmOkBtn'),
    confirmOkBtn: document.getElementById('confirmOkBtn'),
    audioPlayer: document.getElementById('audioPlayer'),
    audioPlayerAlt: document.getElementById('audioPlayerAlt'),
    // 追加要素
    contextBar: document.getElementById('contextBar'),
    contextTitle: document.getElementById('contextTitle'),
    contextCloseBtn: document.getElementById('contextCloseBtn'),
    contextCopyBtn: document.getElementById('contextCopyBtn'),
    contextPlayBtn: document.getElementById('contextPlayBtn'),
    contextDeleteBtn: document.getElementById('contextDeleteBtn'),
    scrollToTopBtn: document.getElementById('scrollToTopBtn'),
    autoplayToggle: document.getElementById('autoplayToggle'),
    crossfadeToggle: document.getElementById('crossfadeToggle'),
    crossfadeSlider: document.getElementById('crossfadeSlider'),
    crossfadeValue: document.getElementById('crossfadeValue'),
    crossfadeSliderContainer: document.getElementById('crossfadeSliderContainer'),
    settingVolumeSlider: document.getElementById('settingVolumeSlider'),
    favBtn: document.getElementById('favBtn')
};

// プレイヤーヘルパー
function getActivePlayer() {
    return state.activePlayerId === 'primary' ? elements.audioPlayer : elements.audioPlayerAlt;
}

function getInactivePlayer() {
    return state.activePlayerId === 'primary' ? elements.audioPlayerAlt : elements.audioPlayer;
}

function switchActivePlayer() {
    state.activePlayerId = state.activePlayerId === 'primary' ? 'secondary' : 'primary';
}

// ユーティリティ関数
function formatTime(seconds) {
    if (isNaN(seconds) || seconds < 0) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function getJacketUrl(assetbundleName) {
    return `${CONFIG.JACKET_BASE_URL}${assetbundleName}/${assetbundleName}.png`;
}

function getAudioUrl(vocalAssetbundleName) {
    return `${CONFIG.AUDIO_BASE_URL}${vocalAssetbundleName}/${vocalAssetbundleName}.mp3`;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// 確認モーダルヘルパー
let confirmCallback = null;

function showConfirmModal(title, message, callback) {
    elements.confirmTitle.textContent = title;
    elements.confirmMessage.textContent = message;
    confirmCallback = callback;
    elements.confirmCancelBtn.style.display = 'inline-block';
    elements.confirmOkBtn.textContent = '削除する';
    elements.confirmOkBtn.className = 'btn-danger';
    elements.confirmModal.classList.add('visible');
}

function showAlertModal(title, message) {
    elements.confirmTitle.textContent = title;
    elements.confirmMessage.textContent = message;
    confirmCallback = null;
    elements.confirmCancelBtn.style.display = 'none';
    elements.confirmOkBtn.textContent = 'OK';
    elements.confirmOkBtn.className = 'btn-primary';
    elements.confirmModal.classList.add('visible');
}

function closeConfirmModal() {
    elements.confirmModal.classList.remove('visible');
    confirmCallback = null;
}

// 設定管理
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

function getPreferredVocal(music) {
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

// プレイリスト管理
function loadPlaylists() {
    const saved = localStorage.getItem('sekai_playlists');
    if (saved) {
        state.savedPlaylists = JSON.parse(saved);
    }
}

function savePlaylists() {
    localStorage.setItem('sekai_playlists', JSON.stringify(state.savedPlaylists));
}

function parseIdString(idString) {
    return idString.split(/[,\s]+/)
        .map(s => parseInt(s.trim(), 10))
        .filter(n => !isNaN(n) && n > 0);
}

function createPlaylist(name, initialMusicIds = null) {
    if (state.savedPlaylists.length >= CONFIG.MAX_PLAYLISTS) {
        showAlertModal('エラー', `プレイリストは最大${CONFIG.MAX_PLAYLISTS}個までしか作成できません。`);
        return;
    }

    let items = [];
    if (initialMusicIds) {
        if (Array.isArray(initialMusicIds)) {
            items = initialMusicIds.filter(id => state.musicData.some(m => m.id === id));
        } else {
            items = [initialMusicIds];
        }
    }

    const newPlaylist = {
        id: Date.now().toString(),
        name: name,
        items: items
    };

    state.savedPlaylists.push(newPlaylist);
    savePlaylists();

    // 入力フィールドをクリア
    elements.newPlaylistName.value = '';
    if (elements.newPlaylistIds) elements.newPlaylistIds.value = '';

    // 追加待ちがあった場合は完了
    if (state.pendingAddMusicId) {
        closeAddToPlaylistModal();
    } else {
        // リストを再描画
        renderPlaylistsList();
    }
}

function deletePlaylist(id) {
    showConfirmModal('プレイリストの削除', 'このプレイリストを削除しますか？', () => {
        state.savedPlaylists = state.savedPlaylists.filter(p => p.id !== id);
        savePlaylists();
        renderPlaylistsList();

        if (state.playbackContext === 'playlist' && state.activePlaylistId === id) {
            switchToAllContext();
        }
    });
}

function addToPlaylist(playlistId, musicId) {
    const playlist = state.savedPlaylists.find(p => p.id === playlistId);
    if (playlist) {
        if (!playlist.items.includes(musicId)) {
            playlist.items.push(musicId);
            savePlaylists();
        }
        closeAddToPlaylistModal();
    }
}

function removeFromPlaylist(playlistId, musicId) {
    const playlist = state.savedPlaylists.find(p => p.id === playlistId);
    if (playlist) {
        playlist.items = playlist.items.filter(id => id !== musicId);
        savePlaylists();

        // 現在のプレイリストビューを再描画
        state.filteredData = playlist.items
            .map(id => state.musicData.find(m => m.id === id))
            .filter(Boolean);

        renderMusicGrid();
        elements.musicCount.textContent = `${state.filteredData.length} 曲`;
    }
}

function exportPlaylistIds(playlistId) {
    const playlist = state.savedPlaylists.find(p => p.id === playlistId);
    if (playlist) {
        const idString = playlist.items.join(',');
        navigator.clipboard.writeText(idString).then(() => {
            showAlertModal('コピー完了', `${playlist.items.length}曲のIDをクリップボードにコピーしました。`);
        }).catch(() => {
            showAlertModal('エラー', 'クリップボードへのコピーに失敗しました。');
        });
    }
}

// テーマ管理
function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeIcon(savedTheme);
    loadFavorites();
    initShortcuts();
}

// お気に入り管理
function loadFavorites() {
    const saved = localStorage.getItem('sekai_favorites');
    if (saved) {
        state.favorites = JSON.parse(saved);
    }
}

function saveFavorites() {
    localStorage.setItem('sekai_favorites', JSON.stringify(state.favorites));
}

function toggleFavorite(musicId) {
    const index = state.favorites.indexOf(musicId);
    if (index === -1) {
        state.favorites.push(musicId);
    } else {
        state.favorites.splice(index, 1);
    }
    saveFavorites();

    // UI更新
    updateFavoriteBtnState(musicId);

    // お気に入りフィルター表示中はリストを更新
    if (state.currentFilter === 'favorites') {
        filterMusic();
    }
}

function isFavorite(musicId) {
    return state.favorites.includes(musicId);
}

function updateFavoriteBtnState(musicId) {
    // プレイヤーバーのボタン更新
    if (state.currentTrack && state.currentTrack.id === musicId) {
        const isFav = isFavorite(musicId);
        const outline = elements.favBtn.querySelector('.fav-icon-outline');
        const filled = elements.favBtn.querySelector('.fav-icon-filled');

        if (outline && filled) {
            if (isFav) {
                outline.style.display = 'none';
                filled.style.display = 'block';
                elements.favBtn.classList.add('active');
            } else {
                outline.style.display = 'block';
                filled.style.display = 'none';
                elements.favBtn.classList.remove('active');
            }
        }
    }

    // カードのボタン更新
    const cardBtn = document.querySelector(`.music-card[data-id="${musicId}"] .fav-card-btn`);
    if (cardBtn) {
        const isFav = isFavorite(musicId);
        if (isFav) {
            cardBtn.classList.add('active');
            cardBtn.innerHTML = '❤️';
        } else {
            cardBtn.classList.remove('active');
            cardBtn.innerHTML = '🤍';
        }
    }
}

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    updateThemeIcon(newTheme);
}

function updateThemeIcon(theme) {
    const icon = elements.themeToggle.querySelector('.theme-icon');
    icon.textContent = theme === 'dark' ? '🌙' : '☀️';
}

// データ読み込み
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

// コンテキスト管理
function switchToPlaylistContext(playlistId) {
    const playlist = state.savedPlaylists.find(p => p.id === playlistId);
    if (!playlist) return;

    state.playbackContext = 'playlist';
    state.activePlaylistId = playlistId;

    state.filteredData = playlist.items
        .map(id => state.musicData.find(m => m.id === id))
        .filter(Boolean);

    renderMusicGrid();
    elements.searchInput.value = '';
    elements.searchClear.classList.remove('visible');
    elements.musicCount.textContent = `${state.filteredData.length} 曲`;
    elements.currentFilter.textContent = `プレイリスト: ${playlist.name}`;

    // コンテキストバーを表示
    if (elements.contextBar) {
        elements.contextBar.style.display = 'flex';
        elements.contextTitle.textContent = `プレイリスト: ${playlist.name}`;
    }

    closePlaylistsModal();
}

function switchToAllContext() {
    state.playbackContext = 'all';
    state.activePlaylistId = null;
    state.currentFilter = 'all';

    // コンテキストバーを非表示
    if (elements.contextBar) {
        elements.contextBar.style.display = 'none';
    }

    document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
    document.querySelector('.chip[data-filter="all"]').classList.add('active');

    filterMusic();
}

// 楽曲グリッド描画
function renderMusicGrid() {
    if (state.filteredData.length === 0) {
        const msg = state.playbackContext === 'playlist'
            ? '曲が登録されていません。<br>検索画面から曲を追加してください。'
            : '該当する楽曲が見つかりません';

        elements.musicGrid.innerHTML = `
            <div class="no-results">
                <div class="no-results-icon">🔍</div>
                <div class="no-results-text">${msg}</div>
            </div>
        `;
        return;
    }

    const html = state.filteredData.map(music => createMusicCard(music)).join('');
    elements.musicGrid.innerHTML = html;
    attachCardEventListeners();
}

function createMusicCard(music) {
    const jacketUrl = getJacketUrl(music.assetbundleName);
    const primaryUnit = music.unit?.[0] || 'VIRTUAL SINGER';
    const duration = formatTime(music.time || 0);
    const vocalsCount = music.vocals?.length || 0;
    const isPlaying = state.currentTrack?.id === music.id;

    // 通常モードでは追加ボタン、プレイリストモードでは削除ボタンを表示
    if (state.playbackContext === 'playlist') {
        actionBtn = `
            <button class="card-action-btn delete-btn" data-id="${music.id}" title="プレイリストから削除">
                <svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
            </button>
        `;
    } else {
        const isFav = isFavorite(music.id);
        actionBtn = `
            <button class="card-action-btn fav-card-btn ${isFav ? 'active' : ''}" data-id="${music.id}" title="${isFav ? 'お気に入りから削除' : 'お気に入りに追加'}">
                ${isFav ? '❤️' : '🤍'}
            </button>
            <button class="card-action-btn add-btn" data-id="${music.id}" title="プレイリストに追加" style="right: 48px;">
                <svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
            </button>
        `;
    }

    return `
        <article class="music-card ${isPlaying ? 'playing' : ''}" data-id="${music.id}">
            <div class="card-jacket">
                <img src="${jacketUrl}" alt="${escapeHtml(music.title)}" 
                     loading="lazy" 
                     referrerpolicy="no-referrer"
                     onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><rect fill=%22%231a1a2e%22 width=%22100%22 height=%22100%22/><text y=%22.9em%22 x=%2230%22 font-size=%2240%22>🎵</text></svg>'">
                ${actionBtn}
                <div class="jacket-overlay">
                    <button class="play-overlay-btn" data-action="play">
                        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                    </button>
                </div>
            </div>
            <div class="card-info">
                <h3 class="card-title" title="${escapeHtml(music.title)}">${escapeHtml(music.title)}</h3>
                <p class="card-artist" title="${escapeHtml(music.composer || '-')}">${escapeHtml(music.composer || '-')}</p>
                <div class="card-meta">
                    <span class="card-duration">⏱ ${duration}</span>
                    <span class="card-unit" data-unit="${escapeHtml(primaryUnit)}">${escapeHtml(primaryUnit)}</span>
                    ${vocalsCount > 1 ? `<span class="card-vocals-count">🎤 ${vocalsCount}ver.</span>` : ''}
                </div>
            </div>
        </article>
    `;
}

function attachCardEventListeners() {
    document.querySelectorAll('.music-card').forEach(card => {
        card.addEventListener('click', (e) => {
            const musicId = parseInt(card.dataset.id);
            const music = state.musicData.find(m => m.id === musicId);
            if (!music) return;

            // 追加ボタンの処理（通常ビュー）
            const addBtn = e.target.closest('.add-btn');
            if (addBtn) {
                e.stopPropagation();
                openAddToPlaylistModal(musicId);
                return;
            }

            // 削除ボタンの処理（プレイリストビュー）
            const deleteBtn = e.target.closest('.delete-btn');
            if (deleteBtn) {
                e.stopPropagation();
                removeFromPlaylist(state.activePlaylistId, musicId);
                return;
            }

            // お気に入りボタン（カード）
            const favBtn = e.target.closest('.fav-card-btn');
            if (favBtn) {
                e.stopPropagation();
                toggleFavorite(musicId);
                return;
            }

            if (music.vocals?.length === 1 || e.target.closest('.play-overlay-btn')) {
                playMusic(music, getPreferredVocal(music));
            } else if (music.vocals?.length > 1) {
                openVocalModal(music);
            }
        });
    });
}

// 検索＆フィルター
function filterMusic() {
    if (state.playbackContext === 'playlist') return;

    const query = state.searchQuery.toLowerCase();
    const filter = state.currentFilter;

    state.filteredData = state.musicData.filter(music => {
        if (filter === 'favorites') {
            if (!state.favorites.includes(music.id)) return false;
        } else if (filter !== 'all') {
            const hasUnit = music.unit?.some(u => u === filter);
            if (!hasUnit) return false;
        }

        if (query) {
            const searchFields = [
                music.title,
                music.pronunciation,
                music.composer,
                music.lyricist,
                music.arranger,
                ...(music.unit || []),
                ...(music.vocals?.map(v => v.vo) || [])
            ].filter(Boolean).map(s => s.toLowerCase());

            return searchFields.some(field => field.includes(query));
        }

        return true;
    });

    // ソート処理
    if (state.sortMode === 'newly_written') {
        state.filteredData.sort((a, b) => {
            const aVal = a.isNewlyWrittenMusic ? 1 : 0;
            const bVal = b.isNewlyWrittenMusic ? 1 : 0;
            return bVal - aVal; // 降順（trueが先）
        });
    }

    renderMusicGrid();
    updateStats();
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

function updateStats() {
    elements.musicCount.textContent = `${state.filteredData.length} 曲`;
    const filterName = state.currentFilter === 'all' ? 'すべて' : state.currentFilter;
    elements.currentFilter.textContent = `フィルター: ${filterName}`;
}

// プレイリストUI描画
function renderPlaylistsList(addMode = false) {
    const musicId = state.pendingAddMusicId;

    if (state.savedPlaylists.length === 0) {
        if (addMode) {
            elements.playlistsList.innerHTML = '<p class="empty-state">プレイリストがまだありません。<br>上記フォームから作成して追加してください。</p>';
        } else {
            elements.playlistsList.innerHTML = '<p class="empty-state">プレイリストはまだありません</p>';
        }
        return;
    }

    elements.playlistsList.innerHTML = state.savedPlaylists.map(playlist => {
        const isAdded = musicId && playlist.items.includes(musicId);
        const addedBadge = isAdded ? '<span class="badge-added">追加済み</span>' : '';

        return `
            <div class="playlist-item ${addMode ? 'add-mode' : ''}" data-id="${playlist.id}">
                <div class="playlist-info">
                    <h3>${escapeHtml(playlist.name)}</h3>
                    <p>${playlist.items.length} 曲 ${addedBadge}</p>
                </div>
                <div class="playlist-actions-row">
                    <button class="playlist-export btn-small" data-id="${playlist.id}" title="IDをコピー">📋</button>
                    <button class="playlist-delete btn-small-danger" title="削除">✕</button>
                </div>
            </div>
        `;
    }).join('');

    elements.playlistsList.querySelectorAll('.playlist-item').forEach(item => {
        item.addEventListener('click', (e) => {
            if (e.target.closest('.playlist-delete')) {
                e.stopPropagation();
                deletePlaylist(item.dataset.id);
            } else if (e.target.closest('.playlist-export')) {
                e.stopPropagation();
                exportPlaylistIds(item.dataset.id);
            } else if (addMode && musicId) {
                // 追加モードでのクリックで楽曲を追加
                addToPlaylist(item.dataset.id, musicId);
                closeAddToPlaylistModal();
            } else {
                switchToPlaylistContext(item.dataset.id);
            }
        });
    });
}

function openAddToPlaylistModal(musicId) {
    // 追加対象の楽曲IDを保存
    state.pendingAddMusicId = musicId;

    // IDフィールドにこの楽曲のIDを事前入力
    if (elements.newPlaylistIds) {
        elements.newPlaylistIds.value = musicId.toString();
    }

    // 追加モードでプレイリスト一覧を描画
    renderPlaylistsList(true);

    // 統合プレイリストモーダルを表示
    elements.playlistsModal.classList.add('visible');
}

function closeAddToPlaylistModal() {
    state.pendingAddMusicId = null;
    if (elements.newPlaylistIds) {
        elements.newPlaylistIds.value = '';
    }
    elements.playlistsModal.classList.remove('visible');
}

function closePlaylistsModal() {
    state.pendingAddMusicId = null;
    if (elements.newPlaylistIds) {
        elements.newPlaylistIds.value = '';
    }
    elements.playlistsModal.classList.remove('visible');
}

// ボーカルモーダル
function openVocalModal(music) {
    state.currentTrack = music;
    elements.modalMusicTitle.textContent = music.title;

    const vocalHtml = music.vocals.map((vocal, index) => `
        <div class="vocal-item ${state.currentVocal?.assetbundleName === vocal.assetbundleName ? 'active' : ''}" 
             data-index="${index}">
            <div class="vocal-item-icon">🎤</div>
            <div class="vocal-item-info">
                <div class="vocal-item-type">${escapeHtml(vocal.type)}</div>
                <div class="vocal-item-singers">${escapeHtml(vocal.vo)}</div>
            </div>
            <button class="vocal-item-play">
                <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
            </button>
        </div>
    `).join('');

    elements.vocalList.innerHTML = vocalHtml;

    elements.vocalList.querySelectorAll('.vocal-item').forEach(item => {
        item.addEventListener('click', () => {
            const index = parseInt(item.dataset.index);
            playMusic(music, music.vocals[index]);
            closeVocalModal();
        });
    });

    elements.vocalModal.classList.add('visible');
}

function closeVocalModal() {
    elements.vocalModal.classList.remove('visible');
}

// 歌詞モーダル
function openLyricsModal() {
    if (!state.currentTrack) return;

    elements.lyricsMusicTitle.textContent = state.currentTrack.title;
    const lyrics = state.lyricsData.find(l => l.id === state.currentTrack.id);

    if (lyrics && lyrics.fullLyrics && lyrics.fullLyrics.length > 0) {
        const lyricsHtml = lyrics.fullLyrics.map(line => {
            return `<p class="lyrics-line">${escapeHtml(line).replace(/\n/g, '<br>')}</p>`;
        }).join('');
        elements.lyricsContainer.innerHTML = lyricsHtml;
    } else {
        elements.lyricsContainer.innerHTML = `
            <div class="no-data-placeholder">
                <p>歌詞データが見つかりませんでした。</p>
            </div>
        `;
    }

    elements.lyricsModal.classList.add('visible');
}

function closeLyricsModal() {
    elements.lyricsModal.classList.remove('visible');
}

// オーディオプレイヤー
async function playMusic(music, vocal, useCrossfade = false) {
    if (!music || !vocal) return;

    // 前の曲情報を保存（クロスフェード用）
    const previousPlayer = getActivePlayer();

    // クロスフェード条件チェック
    const doCrossfade = useCrossfade && state.settings.crossfade && state.isPlaying;

    if (doCrossfade) {
        state.isCrossfading = true;
        switchActivePlayer();
    }

    // 状態更新
    state.currentTrack = music;
    state.currentVocal = vocal;
    state.playlist = state.filteredData;
    state.currentIndex = state.playlist.findIndex(m => m.id === music.id);

    // 新しいプレイヤーの準備
    const currentPlayer = getActivePlayer();
    const audioUrl = getAudioUrl(vocal.assetbundleName);

    // イベントリスナーの再設定は不要（initで両方に同じものを登録する戦略に変更するため）
    // ただし、メタデータロード時の処理はここで行う

    const playNewTrack = () => {
        return new Promise((resolve) => {
            currentPlayer.src = audioUrl;
            currentPlayer.volume = doCrossfade ? 0 : state.volume; // クロスフェード開始時は音量0
            currentPlayer.load();

            const onLoadedMetadata = () => {
                currentPlayer.currentTime = CONFIG.INTRO_SKIP_SECONDS;
                currentPlayer.play().then(() => {
                    resolve();
                }).catch(err => console.warn('Playback failed:', err));
                currentPlayer.removeEventListener('loadedmetadata', onLoadedMetadata);
            };
            currentPlayer.addEventListener('loadedmetadata', onLoadedMetadata);
        });
    };

    await playNewTrack();

    updateNowPlayingUI();
    updatePlayingCard();
    elements.nowPlayingBar.classList.add('visible');
    updateDynamicBackground(music.assetbundleName);
    updateMediaSession(music, vocal);

    if (doCrossfade) {
        performCrossfade(previousPlayer, currentPlayer);
    } else {
        // クロスフェードしない場合、前のプレイヤーは即停止
        // ただし自分自身が停止しないように注意（同じプレイヤーを使っている場合）
        if (previousPlayer !== currentPlayer) {
            previousPlayer.pause();
            previousPlayer.currentTime = 0;
        }
        state.isPlaying = true; // 念のため
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

function updateNowPlayingUI() {
    if (!state.currentTrack) return;

    const jacketUrl = getJacketUrl(state.currentTrack.assetbundleName);
    elements.playerJacketImg.src = jacketUrl;
    elements.playerJacketImg.setAttribute('referrerpolicy', 'no-referrer');
    elements.playerTitle.textContent = state.currentTrack.title;
    elements.playerTitle.textContent = state.currentTrack.title;
    elements.playerArtist.textContent = state.currentVocal?.vo || state.currentTrack.composer || '-';

    updateFavoriteBtnState(state.currentTrack.id);
}

function updatePlayingCard() {
    document.querySelectorAll('.music-card').forEach(card => {
        card.classList.toggle('playing', card.dataset.id === String(state.currentTrack?.id));
    });
}

function updateDynamicBackground(assetbundleName) {
    const jacketUrl = getJacketUrl(assetbundleName);
    elements.dynamicBg.style.backgroundImage = `url(${jacketUrl})`;
    elements.dynamicBg.classList.add('active');
}

function togglePlayPause() {
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

function updatePlayPauseButton() {
    const playIcon = elements.playPauseBtn.querySelector('.play-icon');
    const pauseIcon = elements.playPauseBtn.querySelector('.pause-icon');

    if (state.isPlaying) {
        playIcon.style.display = 'none';
        pauseIcon.style.display = 'block';
    } else {
        playIcon.style.display = 'block';
        pauseIcon.style.display = 'none';
    }
}

function playNext(useCrossfade = false) {
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

function playPrev() {
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
        playMusic(prevMusic, vocal, false); // 前の曲へはクロスフェードしない
    }
}

function toggleRepeat() {
    state.isRepeat = !state.isRepeat;
    elements.repeatBtn.classList.toggle('active', state.isRepeat);
}

function toggleShuffle() {
    state.isShuffle = !state.isShuffle;
    elements.shuffleBtn.classList.toggle('active', state.isShuffle);
}

function setVolume(value) {
    state.volume = value / 100;
    // 両方のプレイヤーに適用（クロスフェード中なら次の更新で反映される）
    elements.audioPlayer.volume = state.volume;
    elements.audioPlayerAlt.volume = state.volume;

    // UI同期
    elements.volumeSlider.value = value;
    if (elements.settingVolumeSlider) {
        elements.settingVolumeSlider.value = value;
    }

    updateVolumeIcon();
}

function toggleMute() {
    const player = getActivePlayer();
    player.muted = !player.muted;
    // 状態同期のため両方設定
    elements.audioPlayer.muted = player.muted;
    elements.audioPlayerAlt.muted = player.muted;
    updateVolumeIcon();
}

function updateVolumeIcon() {
    const highIcon = elements.volumeBtn.querySelector('.volume-high');
    const mutedIcon = elements.volumeBtn.querySelector('.volume-muted');
    const player = getActivePlayer();

    if (player.muted || state.volume === 0) {
        highIcon.style.display = 'none';
        mutedIcon.style.display = 'block';
    } else {
        highIcon.style.display = 'block';
        mutedIcon.style.display = 'none';
    }
}

// プログレスバー
function updateProgress() {
    const player = getActivePlayer();
    // 再生中の場合のみ更新（クロスフェードの裏側からのイベントを無視）
    // playerが変わった直後などは少し不安定になるかもしれないが、getActivePlayerで追従

    const { currentTime, duration } = player;
    if (isNaN(duration)) return;

    const adjustedCurrent = Math.max(0, currentTime - CONFIG.INTRO_SKIP_SECONDS);
    const adjustedDuration = Math.max(0, duration - CONFIG.INTRO_SKIP_SECONDS);

    const percent = adjustedDuration > 0 ? (adjustedCurrent / adjustedDuration) * 100 : 0;
    const clampedPercent = Math.min(100, Math.max(0, percent));

    elements.progressFill.style.width = `${clampedPercent}%`;
    elements.progressHandle.style.left = `${clampedPercent}%`;

    elements.currentTime.textContent = formatTime(adjustedCurrent);
    elements.durationTime.textContent = formatTime(adjustedDuration);
}

function seekTo(e) {
    const rect = elements.progressBar.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;

    const player = getActivePlayer();
    const { duration } = player;
    if (isNaN(duration)) return;

    const adjustedDuration = Math.max(0, duration - CONFIG.INTRO_SKIP_SECONDS);
    const seekTimeAdjusted = percent * adjustedDuration;

    const actualSeekTime = seekTimeAdjusted + CONFIG.INTRO_SKIP_SECONDS;
    const finalSeekTime = Math.max(CONFIG.INTRO_SKIP_SECONDS, actualSeekTime);

    elements.audioPlayer.currentTime = finalSeekTime;
}

function updateBuffered() {
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

// メディアセッションAPI
function updateMediaSession(music, vocal) {
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

// イベントリスナー
function initEventListeners() {
    // 検索
    elements.searchInput.addEventListener('input', (e) => {
        state.searchQuery = e.target.value;
        elements.searchClear.classList.toggle('visible', state.searchQuery.length > 0);

        if (state.playbackContext === 'playlist') {
            switchToAllContext();
        }
        filterMusic();
    });

    elements.searchClear.addEventListener('click', () => {
        state.searchQuery = '';
        elements.searchInput.value = '';
        elements.searchClear.classList.remove('visible');
        filterMusic();
    });



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
    elements.themeToggle.addEventListener('click', toggleTheme);

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

            // 名前が入力されていない場合はデフォルト名を使用
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
            if (confirmCallback) confirmCallback();
            closeConfirmModal();
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
    elements.playPauseBtn.addEventListener('click', togglePlayPause);
    elements.prevBtn.addEventListener('click', playPrev);
    elements.nextBtn.addEventListener('click', playNext);
    elements.repeatBtn.addEventListener('click', toggleRepeat);
    elements.shuffleBtn.addEventListener('click', toggleShuffle);
    elements.volumeBtn.addEventListener('click', toggleMute);
    elements.volumeSlider.addEventListener('input', (e) => setVolume(e.target.value));

    if (elements.settingVolumeSlider) {
        elements.settingVolumeSlider.addEventListener('input', (e) => setVolume(e.target.value));
    }

    elements.lyricsBtn.addEventListener('click', openLyricsModal);
    elements.favBtn.addEventListener('click', () => {
        if (state.currentTrack) {
            toggleFavorite(state.currentTrack.id);
        }
    });

    // Progress bar
    elements.progressBar.addEventListener('click', seekTo);

    // Audio events (Bind to both players)
    [elements.audioPlayer, elements.audioPlayerAlt].forEach(player => {
        player.addEventListener('play', () => {
            if (getActivePlayer() === player && !state.isCrossfading) {
                state.isPlaying = true;
                updatePlayPauseButton();
            }
        });

        player.addEventListener('pause', () => {
            // クロスフェード中のpause無視
            if (getActivePlayer() === player && !state.isCrossfading) {
                state.isPlaying = false;
                updatePlayPauseButton();
            }
        });

        player.addEventListener('timeupdate', () => {
            // アクティブなプレイヤーのみUI更新
            if (getActivePlayer() === player) {
                updateProgress();

                // クロスフェード自動再生ロジック
                if (state.settings.crossfade && state.settings.autoplay && !state.isCrossfading && player.duration) {
                    // 残り時間がクロスフェード時間以下になったら次へ
                    const remaining = player.duration - player.currentTime;
                    // INTROスキップ考慮（実質終了位置）
                    if (remaining <= state.settings.crossfadeDuration && remaining > 0) {
                        playNext(true);
                    }
                }
            }
        });

        player.addEventListener('progress', () => {
            if (getActivePlayer() === player) updateProgress();
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
    elements.modalClose.addEventListener('click', closeVocalModal);
    elements.vocalModal.addEventListener('click', (e) => {
        if (e.target === elements.vocalModal) closeVocalModal();
    });

    elements.lyricsClose.addEventListener('click', closeLyricsModal);
    elements.lyricsModal.addEventListener('click', (e) => {
        if (e.target === elements.lyricsModal) closeLyricsModal();
    });

    // Keyboard shortcuts handled in initShortcuts()

    // コンテキストバー（プレイリストビュー）
    if (elements.contextCloseBtn) {
        elements.contextCloseBtn.addEventListener('click', switchToAllContext);
    }
    if (elements.contextCopyBtn) {
        elements.contextCopyBtn.addEventListener('click', () => {
            if (state.activePlaylistId) {
                exportPlaylistIds(state.activePlaylistId);
            }
        });
    }
    if (elements.contextPlayBtn) {
        elements.contextPlayBtn.addEventListener('click', () => {
            if (state.filteredData.length > 0) {
                playMusic(state.filteredData[0], getPreferredVocal(state.filteredData[0]));
            }
        });
    }
    if (elements.contextDeleteBtn) {
        elements.contextDeleteBtn.addEventListener('click', () => {
            if (state.activePlaylistId) {
                deletePlaylist(state.activePlaylistId);
            }
        });
    }

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

        // スクロール位置に応じて表示/非表示
        window.addEventListener('scroll', () => {
            if (window.scrollY > 300) {
                elements.scrollToTopBtn.classList.add('visible');
            } else {
                elements.scrollToTopBtn.classList.remove('visible');
            }
        });
    }

    // 楽曲名クリック - 再生中のカードへスクロール
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

    // アーティスト/ボーカルクリック - ボーカル切り替えモーダルを開く
    if (elements.playerArtist) {
        elements.playerArtist.addEventListener('click', () => {
            if (state.currentTrack && state.currentTrack.vocals?.length > 1) {
                openVocalModal(state.currentTrack);
            }
        });
    }

    // ジャケットクリック - モバイル用の代替アクション
    if (elements.playerJacket) {
        elements.playerJacket.addEventListener('click', () => {
            if (!state.currentTrack) return;

            // モバイルでボーカル切り替えとカードへのスクロールへのクイックアクセスを提供
            if (state.currentTrack.vocals?.length > 1) {
                openVocalModal(state.currentTrack);
            } else {
                // ボーカルが1つだけの場合はカードへスクロール
                const playingCard = document.querySelector(`.music-card[data-id="${state.currentTrack.id}"]`);
                if (playingCard) {
                    playingCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }
        });
    }
}

// キーボードショートカット
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

// Audio Visualizer


// 初期化
async function init() {
    initTheme();
    // initTheme calls loadFavorites, initShortcuts, setupVisualizer due to previous edit
    // But wait, initTheme implementation in app.js (lines 320-324 + my edit) calls them.
    // So good.

    loadSettings();
    loadPlaylists();
    initEventListeners();
    setVolume(80);
    await Promise.all([loadMusicData(), loadLyricsData()]);
}

// DOM準備完了時にアプリを開始
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
