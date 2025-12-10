/**
 * 統計・履歴機能 (Statistics & History)
 */
import { state } from '../state.js';
import { CONFIG } from '../config.js';
import { elements } from '../elements.js';
import { getJacketUrl } from '../utils.js';
import { playMusic, getPreferredVocal } from './player.js';

const STORAGE_KEY_STATS = 'sekai_stats';

export function loadStats() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY_STATS);
        if (saved) {
            const parsed = JSON.parse(saved);
            state.stats.history = parsed.history || [];
            state.stats.playCounts = parsed.playCounts || {};
        }
    } catch (e) {
        console.error('Failed to load stats:', e);
    }
}

export function saveStats() {
    try {
        localStorage.setItem(STORAGE_KEY_STATS, JSON.stringify(state.stats));
    } catch (e) {
        console.error('Failed to save stats:', e);
    }
}

export function recordPlay(musicId) {
    if (!musicId) return;

    const id = String(musicId);

    // 再生回数の更新
    state.stats.playCounts[id] = (state.stats.playCounts[id] || 0) + 1;

    // 履歴の更新 (既存の同じIDを削除して先頭に追加)
    state.stats.history = state.stats.history.filter(histId => String(histId) !== id);
    state.stats.history.unshift(id);

    // 履歴の上限 (100件)
    if (state.stats.history.length > 100) {
        state.stats.history.pop();
    }

    saveStats();
}

// 統計モーダルの表示
export function openStatsModal() {
    renderStatsContent('history'); // デフォルトは履歴タブ
    elements.statsModal.classList.add('visible');
}

export function closeStatsModal() {
    elements.statsModal.classList.remove('visible');
}

// 統計コンテンツのレンダリング
export function renderStatsContent(tab = 'history') {
    const container = document.getElementById('statsContent');
    if (!container) return;

    // タブのアクティブ状態更新
    document.querySelectorAll('.stats-tab').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tab);
    });

    container.innerHTML = '';

    if (tab === 'history') {
        renderHistory(container);
    } else if (tab === 'ranking') {
        renderRanking(container);
    }
}

function renderHistory(container) {
    if (state.stats.history.length === 0) {
        container.innerHTML = '<p class="empty-state">再生履歴はありません</p>';
        return;
    }

    const list = document.createElement('div');
    list.className = 'stats-list';

    state.stats.history.slice(0, 50).forEach((id, index) => {
        const music = state.musicData.find(m => String(m.id) === String(id));
        if (!music) return;

        const row = createStatsRow(music, index + 1, 'history');
        list.appendChild(row);
    });

    container.appendChild(list);
}

function renderRanking(container) {
    const ranking = Object.entries(state.stats.playCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 50); // Top 50

    if (ranking.length === 0) {
        container.innerHTML = '<p class="empty-state">データがありません</p>';
        return;
    }

    const list = document.createElement('div');
    list.className = 'stats-list';

    ranking.forEach(([id, count], index) => {
        const music = state.musicData.find(m => String(m.id) === String(id));
        if (!music) return;

        const row = createStatsRow(music, index + 1, 'ranking', count);
        list.appendChild(row);
    });

    container.appendChild(list);
}

function createStatsRow(music, rank, type, count = null) {
    const div = document.createElement('div');
    div.className = 'stats-row';

    // ジャケット画像
    const jacketUrl = getJacketUrl(music.assetbundleName);

    // ランク表示 (ランキングの場合)
    let rankBadge = '';
    if (type === 'ranking') {
        let rankClass = 'rank-badge';
        if (rank === 1) rankClass += ' rank-1';
        else if (rank === 2) rankClass += ' rank-2';
        else if (rank === 3) rankClass += ' rank-3';
        rankBadge = `<div class="${rankClass}">${rank}</div>`;
    } else {
        // 履歴の場合は相対時間などを出したいが、今回はシンプルに順序のみ
        rankBadge = `<div class="history-index">${rank}</div>`;
    }

    const countDisplay = count !== null ? `<div class="play-count">${count} 回再生</div>` : '';

    div.innerHTML = `
        ${rankBadge}
        <div class="stats-jacket">
            <img src="${jacketUrl}" alt="${music.title}" loading="lazy">
        </div>
        <div class="stats-info">
            <div class="stats-title">${music.title}</div>
            <div class="stats-artist">${music.composer}</div>
        </div>
        ${countDisplay}
        <button class="btn-icon play-direct-btn" title="再生">
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
        </button>
    `;

    // 再生ボタンのイベント
    const playBtn = div.querySelector('.play-direct-btn');
    playBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const vocal = getPreferredVocal(music);
        playMusic(music, vocal);
        closeStatsModal();
    });

    return div;
}
