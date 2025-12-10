/**
 * テーマ管理 (Theme Management)
 */
import { elements } from '../elements.js';

export function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeIcon(savedTheme);
}

export function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    updateThemeIcon(newTheme);
}

function updateThemeIcon(theme) {
    const icon = elements.themeToggle?.querySelector('.theme-icon');
    if (icon) {
        icon.textContent = theme === 'dark' ? '🌙' : '☀️';
    }

    // ラベルも更新
    const label = document.getElementById('themeLabel');
    if (label) {
        label.textContent = theme === 'dark' ? 'ダークモード' : 'ライトモード';
    }
}

// ユニット別ダイナミックテーマ
// 対応ユニット名のリスト
const THEME_UNITS = [
    'Leo/need',
    'MORE MORE JUMP！',
    'Vivid BAD SQUAD',
    'ワンダーランズ×ショウタイム',
    '25時、ナイトコードで。'
];

// VIRTUAL SINGER扱いのユニット名
const VIRTUAL_SINGER_UNITS = ['VIRTUAL SINGER', 'バーチャル・シンガー'];

export function applyUnitTheme(unitArray) {
    if (!unitArray || !Array.isArray(unitArray) || unitArray.length === 0) {
        clearUnitTheme();
        return;
    }

    // VIRTUAL SINGER以外のユニットを抽出
    const nonVsUnits = unitArray.filter(u =>
        THEME_UNITS.includes(u) && !VIRTUAL_SINGER_UNITS.includes(u)
    );

    // VIRTUAL SINGERが含まれているかチェック
    const hasVirtualSinger = unitArray.some(u => VIRTUAL_SINGER_UNITS.includes(u));

    if (nonVsUnits.length === 1) {
        // 1ユニットのみ（VIRTUAL SINGER + 1ユニット、または1ユニットのみ）
        document.documentElement.setAttribute('data-unit-theme', nonVsUnits[0]);
    } else if (nonVsUnits.length === 0 && hasVirtualSinger) {
        // VIRTUAL SINGERのみ
        document.documentElement.setAttribute('data-unit-theme', 'VIRTUAL SINGER');
    } else {
        // 2ユニット以上、またはマッチなし → デフォルト色
        clearUnitTheme();
    }
}

export function clearUnitTheme() {
    document.documentElement.removeAttribute('data-unit-theme');
}
