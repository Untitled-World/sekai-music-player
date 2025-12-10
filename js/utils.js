/**
 * ユーティリティ関数 (Utility Functions)
 */
import { CONFIG } from './config.js';

export function formatTime(seconds) {
    if (isNaN(seconds) || seconds < 0) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function getJacketUrl(assetbundleName) {
    return `${CONFIG.JACKET_BASE_URL}${assetbundleName}/${assetbundleName}.png`;
}

export function getAudioUrl(vocalAssetbundleName) {
    return `${CONFIG.AUDIO_BASE_URL}${vocalAssetbundleName}/${vocalAssetbundleName}.mp3`;
}

export function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
