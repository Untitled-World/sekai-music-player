/**
 * お気に入り機能 (Favorites)
 */
import { state } from '../state.js';
import { elements } from '../elements.js';
import { filterMusic } from './ui.js';

export function loadFavorites() {
    const saved = localStorage.getItem('sekai_favorites');
    if (saved) {
        state.favorites = JSON.parse(saved);
    }
}

export function saveFavorites() {
    localStorage.setItem('sekai_favorites', JSON.stringify(state.favorites));
}

export function toggleFavorite(musicId) {
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

export function isFavorite(musicId) {
    return state.favorites.includes(musicId);
}

export function updateFavoriteBtnState(musicId) {
    // プレイヤーバーのボタン更新
    if (state.currentTrack && state.currentTrack.id === musicId) {
        const isFav = isFavorite(musicId);
        const outline = elements.favBtn ? elements.favBtn.querySelector('.fav-icon-outline') : null;
        const filled = elements.favBtn ? elements.favBtn.querySelector('.fav-icon-filled') : null;

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
            cardBtn.title = 'お気に入りから削除';
        } else {
            cardBtn.classList.remove('active');
            cardBtn.innerHTML = '🤍';
            cardBtn.title = 'お気に入りに追加';
        }
    }
}
