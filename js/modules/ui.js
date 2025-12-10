/**
 * UI描画・管理 (User Interface)
 */
import { state } from '../state.js';
import { elements } from '../elements.js';
import { CONFIG } from '../config.js';
import { getJacketUrl, formatTime, escapeHtml } from '../utils.js';
import { playMusic, getPreferredVocal, getActivePlayer } from './player.js';
// openAddToPlaylistModalはplaylist.jsにあります
import { openAddToPlaylistModal, closePlaylistsModal, removeFromPlaylist, addToPlaylist } from './playlist.js';
import { toggleFavorite, isFavorite, updateFavoriteBtnState } from './favorites.js';
import { openVocalModal as openVM } from './modals.js'; // Card listeners require this

export function renderMusicGrid() {
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

export function createMusicCard(music) {
    const jacketUrl = getJacketUrl(music.assetbundleName);
    const primaryUnit = music.unit?.[0] || 'VIRTUAL SINGER';
    const duration = formatTime(music.time || 0);
    const vocalsCount = music.vocals?.length || 0;
    const isPlaying = state.currentTrack?.id === music.id;

    let actionBtn;
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
            <button class="card-action-btn add-btn" data-id="${music.id}" title="プレイリストに追加">
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

            // 追加ボタン
            const addBtn = e.target.closest('.add-btn');
            if (addBtn) {
                e.stopPropagation();
                openAddToPlaylistModal(musicId);
                return;
            }

            // 削除ボタン
            const deleteBtn = e.target.closest('.delete-btn');
            if (deleteBtn) {
                e.stopPropagation();
                removeFromPlaylist(state.activePlaylistId, musicId);
                return;
            }

            // お気に入りボタン
            const favBtn = e.target.closest('.fav-card-btn');
            if (favBtn) {
                e.stopPropagation();
                toggleFavorite(musicId);
                return;
            }

            // 再生またはモーダルオープン
            if (music.vocals?.length === 1 || e.target.closest('.play-overlay-btn')) {
                playMusic(music, getPreferredVocal(music));
            } else if (music.vocals?.length > 1) {
                openVM(music);
            }
        });
    });
}

export function filterMusic() {
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

    if (state.sortMode === 'newly_written') {
        state.filteredData.sort((a, b) => {
            const aVal = a.isNewlyWrittenMusic ? 1 : 0;
            const bVal = b.isNewlyWrittenMusic ? 1 : 0;
            return bVal - aVal;
        });
    }

    renderMusicGrid();
    updateStats();
}

export function updateStats() {
    elements.musicCount.textContent = `${state.filteredData.length} 曲`;
    const filterName = state.currentFilter === 'all' ? 'すべて' :
        state.currentFilter === 'favorites' ? 'お気に入り' :
            state.currentFilter;
    if (elements.currentFilter) {
        elements.currentFilter.textContent = `フィルター: ${filterName}`;
    }
}

export function switchToAllContext() {
    state.playbackContext = 'all';
    state.activePlaylistId = null;
    state.currentFilter = 'all';

    if (elements.contextBar) {
        elements.contextBar.style.display = 'none';
    }

    document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
    document.querySelector('.chip[data-filter="all"]').classList.add('active');

    filterMusic();
}

// UI Updaters for Player
export function updateNowPlayingUI() {
    if (!state.currentTrack) return;

    const jacketUrl = getJacketUrl(state.currentTrack.assetbundleName);
    elements.playerJacketImg.src = jacketUrl;
    elements.playerJacketImg.setAttribute('referrerpolicy', 'no-referrer');
    elements.playerTitle.textContent = state.currentTrack.title;
    elements.playerArtist.textContent = state.currentVocal?.vo || state.currentTrack.composer || '-';

    updateFavoriteBtnState(state.currentTrack.id);
}

export function updatePlayingCard() {
    document.querySelectorAll('.music-card').forEach(card => {
        card.classList.toggle('playing', card.dataset.id === String(state.currentTrack?.id));
    });
}

export function updateDynamicBackground(assetbundleName) {
    const jacketUrl = getJacketUrl(assetbundleName);
    elements.dynamicBg.style.backgroundImage = `url(${jacketUrl})`;
    elements.dynamicBg.classList.add('active');
}

export function updatePlayPauseButton() {
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

export function updateProgress() {
    if (state.isDragging) return; // ドラッグ中は自動更新しない

    const player = getActivePlayer();
    if (!player) return;

    const { currentTime, duration } = player;
    if (isNaN(duration)) return;

    const adjustedCurrent = Math.max(0, currentTime - CONFIG.INTRO_SKIP_SECONDS);
    const adjustedDuration = Math.max(0, duration - CONFIG.INTRO_SKIP_SECONDS);

    const percent = adjustedDuration > 0 ? (adjustedCurrent / adjustedDuration) * 100 : 0;

    renderProgress(percent, adjustedCurrent);
    elements.durationTime.textContent = formatTime(adjustedDuration);
}

export function renderProgress(percent, currentTimeVal) {
    const clampedPercent = Math.min(100, Math.max(0, percent));
    elements.progressFill.style.width = `${clampedPercent}%`;
    elements.progressHandle.style.left = `${clampedPercent}%`;
    elements.currentTime.textContent = formatTime(currentTimeVal);
}

export function updateVolumeIcon() {
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
