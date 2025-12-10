/**
 * モーダル管理 (Modals)
 */
import { elements } from '../elements.js';
import { state } from '../state.js';
import { escapeHtml } from '../utils.js';
import { playMusic } from './player.js';

let confirmCallback = null;

export function showConfirmModal(title, message, callback) {
    elements.confirmTitle.textContent = title;
    elements.confirmMessage.textContent = message;
    confirmCallback = callback;
    elements.confirmCancelBtn.style.display = 'inline-block';
    elements.confirmOkBtn.textContent = '削除する';
    elements.confirmOkBtn.className = 'btn-danger';
    elements.confirmModal.classList.add('visible');
}

export function showAlertModal(title, message) {
    elements.confirmTitle.textContent = title;
    elements.confirmMessage.textContent = message;
    confirmCallback = null;
    elements.confirmCancelBtn.style.display = 'none';
    elements.confirmOkBtn.textContent = 'OK';
    elements.confirmOkBtn.className = 'btn-primary';
    elements.confirmModal.classList.add('visible');
}

export function closeConfirmModal() {
    elements.confirmModal.classList.remove('visible');
    confirmCallback = null;
}

export function executeConfirmCallback() {
    if (confirmCallback) confirmCallback();
    closeConfirmModal();
}

export function openVocalModal(music) {
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

export function closeVocalModal() {
    elements.vocalModal.classList.remove('visible');
}

export function openLyricsModal() {
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

export function closeLyricsModal() {
    elements.lyricsModal.classList.remove('visible');
}
