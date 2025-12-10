/**
 * プレイリスト機能 (Playlists)
 */
import { state } from '../state.js';
import { CONFIG } from '../config.js';
import { elements } from '../elements.js';
import { showAlertModal, showConfirmModal } from './modals.js';
import { renderMusicGrid, switchToAllContext, filterMusic } from './ui.js';
import { escapeHtml } from '../utils.js';

export function loadPlaylists() {
    const saved = localStorage.getItem('sekai_playlists');
    if (saved) {
        state.savedPlaylists = JSON.parse(saved);
    }
}

export function savePlaylists() {
    localStorage.setItem('sekai_playlists', JSON.stringify(state.savedPlaylists));
}

export function parseIdString(idString) {
    return idString.split(/[,\s]+/)
        .map(s => parseInt(s.trim(), 10))
        .filter(n => !isNaN(n) && n > 0);
}

export function createPlaylist(name, initialMusicIds = null) {
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

export function deletePlaylist(id) {
    showConfirmModal('プレイリストの削除', 'このプレイリストを削除しますか？', () => {
        state.savedPlaylists = state.savedPlaylists.filter(p => p.id !== id);
        savePlaylists();
        renderPlaylistsList();

        if (state.playbackContext === 'playlist' && state.activePlaylistId === id) {
            switchToAllContext();
        }
    });
}

export function addToPlaylist(playlistId, musicId) {
    const playlist = state.savedPlaylists.find(p => p.id === playlistId);
    if (playlist) {
        if (!playlist.items.includes(musicId)) {
            playlist.items.push(musicId);
            savePlaylists();
        }
        closeAddToPlaylistModal();
    }
}

export function removeFromPlaylist(playlistId, musicId) {
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

export function exportPlaylistIds(playlistId) {
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

export function switchToPlaylistContext(playlistId) {
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

// プレイリスト一覧の描画（モーダル内）
export function renderPlaylistsList(addMode = false) {
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
export function openAddToPlaylistModal(musicId) {
    state.pendingAddMusicId = musicId;
    if (elements.newPlaylistIds) {
        elements.newPlaylistIds.value = musicId.toString();
    }
    renderPlaylistsList(true);
    elements.playlistsModal.classList.add('visible');
}

export function closeAddToPlaylistModal() {
    state.pendingAddMusicId = null;
    if (elements.newPlaylistIds) {
        elements.newPlaylistIds.value = '';
    }
    elements.playlistsModal.classList.remove('visible');
}

export function closePlaylistsModal() {
    state.pendingAddMusicId = null;
    if (elements.newPlaylistIds) {
        elements.newPlaylistIds.value = '';
    }
    elements.playlistsModal.classList.remove('visible');
}
