/**
 * SEKAI Music Player - Main Application
 * A static music player for Project SEKAI songs
 */

// Configuration
const CONFIG = {
    JACKET_BASE_URL: 'https://storage.sekai.best/sekai-jp-assets/music/jacket/',
    AUDIO_BASE_URL: 'https://storage.sekai.best/sekai-jp-assets/music/long/',
    MUSIC_DATA_URL: './music.json',
    LYRICS_DATA_URL: './song-lyrics.json',
    INTRO_SKIP_SECONDS: 9 // Skip the first 9 seconds of audio
};

// State
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
    volume: 0.8
};

// DOM Elements
const elements = {
    musicGrid: document.getElementById('musicGrid'),
    searchInput: document.getElementById('searchInput'),
    searchClear: document.getElementById('searchClear'),
    musicCount: document.getElementById('musicCount'),
    currentFilter: document.getElementById('currentFilter'),
    nowPlayingBar: document.getElementById('nowPlayingBar'),
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
    vocalModal: document.getElementById('vocalModal'),
    modalMusicTitle: document.getElementById('modalMusicTitle'),
    vocalList: document.getElementById('vocalList'),
    modalClose: document.getElementById('modalClose'),
    lyricsModal: document.getElementById('lyricsModal'),
    lyricsMusicTitle: document.getElementById('lyricsMusicTitle'),
    lyricsContainer: document.getElementById('lyricsContainer'),
    lyricsClose: document.getElementById('lyricsClose'),
    audioPlayer: document.getElementById('audioPlayer')
};

// Utility Functions
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

// Theme Management
function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeIcon(savedTheme);
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

// Data Loading
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
        // Don't show critical error, simply lyrics won't be available
    }
}

// Music Grid Rendering
function renderMusicGrid() {
    if (state.filteredData.length === 0) {
        elements.musicGrid.innerHTML = `
            <div class="no-results">
                <div class="no-results-icon">🔍</div>
                <div class="no-results-text">該当する楽曲が見つかりません</div>
                <div class="no-results-hint">検索条件を変更してみてください</div>
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

    return `
        <article class="music-card ${isPlaying ? 'playing' : ''}" data-id="${music.id}">
            <div class="card-jacket">
                <img src="${jacketUrl}" alt="${escapeHtml(music.title)}" 
                     loading="lazy" 
                     onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><rect fill=%22%231a1a2e%22 width=%22100%22 height=%22100%22/><text y=%22.9em%22 x=%2230%22 font-size=%2240%22>🎵</text></svg>'">
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

            // If clicking play button or if only one vocal, play directly
            if (music.vocals?.length === 1 || e.target.closest('.play-overlay-btn')) {
                playMusic(music, music.vocals?.[0]);
            } else if (music.vocals?.length > 1) {
                openVocalModal(music);
            }
        });
    });
}

// Search & Filter
function filterMusic() {
    const query = state.searchQuery.toLowerCase();
    const filter = state.currentFilter;

    state.filteredData = state.musicData.filter(music => {
        // Unit filter
        if (filter !== 'all') {
            const hasUnit = music.unit?.some(u => u === filter);
            if (!hasUnit) return false;
        }

        // Search query
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

    renderMusicGrid();
    updateStats();
}

function updateStats() {
    elements.musicCount.textContent = `${state.filteredData.length} 曲`;
    const filterName = state.currentFilter === 'all' ? 'すべて' : state.currentFilter;
    elements.currentFilter.textContent = `フィルター: ${filterName}`;
}

// Vocal Modal
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

    // Attach event listeners
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

// Lyrics Modal
function openLyricsModal() {
    if (!state.currentTrack) return;

    elements.lyricsMusicTitle.textContent = state.currentTrack.title;
    const lyrics = state.lyricsData.find(l => l.id === state.currentTrack.id);

    if (lyrics && lyrics.fullLyrics && lyrics.fullLyrics.length > 0) {
        const lyricsHtml = lyrics.fullLyrics.map(line => {
            // Converts newlines in the string to <br>
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

// Audio Player
function playMusic(music, vocal) {
    if (!music || !vocal) return;

    state.currentTrack = music;
    state.currentVocal = vocal;

    // Update playlist
    state.playlist = state.filteredData;
    state.currentIndex = state.playlist.findIndex(m => m.id === music.id);

    // Set audio source
    const audioUrl = getAudioUrl(vocal.assetbundleName);
    elements.audioPlayer.src = audioUrl;
    elements.audioPlayer.load();

    // Skip intro when metadata is loaded or when playing starts
    const onLoadedMetadata = () => {
        elements.audioPlayer.currentTime = CONFIG.INTRO_SKIP_SECONDS;
        elements.audioPlayer.play().catch(err => console.warn('Playback failed:', err));
        elements.audioPlayer.removeEventListener('loadedmetadata', onLoadedMetadata);
    };
    elements.audioPlayer.addEventListener('loadedmetadata', onLoadedMetadata);

    // Also try to set currentTime immediately if possible (some browsers might allow it)
    elements.audioPlayer.currentTime = CONFIG.INTRO_SKIP_SECONDS;

    // Update UI
    updateNowPlayingUI();
    updatePlayingCard();
    elements.nowPlayingBar.classList.add('visible');

    // Update dynamic background
    updateDynamicBackground(music.assetbundleName);

    // Update media session for background playback
    updateMediaSession(music, vocal);
}

function updateNowPlayingUI() {
    if (!state.currentTrack) return;

    const jacketUrl = getJacketUrl(state.currentTrack.assetbundleName);
    elements.playerJacketImg.src = jacketUrl;
    elements.playerTitle.textContent = state.currentTrack.title;
    elements.playerArtist.textContent = state.currentVocal?.vo || state.currentTrack.composer || '-';
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
    if (elements.audioPlayer.paused) {
        // If we are somehow before the skip point (e.g. stopped), jump to skip point
        if (elements.audioPlayer.currentTime < CONFIG.INTRO_SKIP_SECONDS) {
            elements.audioPlayer.currentTime = CONFIG.INTRO_SKIP_SECONDS;
        }
        elements.audioPlayer.play().catch(err => console.warn('Playback failed:', err));
    } else {
        elements.audioPlayer.pause();
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

function playNext() {
    if (state.playlist.length === 0) return;

    let nextIndex;
    if (state.isShuffle) {
        nextIndex = Math.floor(Math.random() * state.playlist.length);
    } else {
        nextIndex = (state.currentIndex + 1) % state.playlist.length;
    }

    const nextMusic = state.playlist[nextIndex];
    if (nextMusic) {
        const vocal = nextMusic.vocals?.[0];
        playMusic(nextMusic, vocal);
    }
}

function playPrev() {
    if (state.playlist.length === 0) return;

    // If more than 3 seconds past the skip point, restart current track
    // (Total time > SKIP_SECONDS + 3)
    if (elements.audioPlayer.currentTime > CONFIG.INTRO_SKIP_SECONDS + 3) {
        elements.audioPlayer.currentTime = CONFIG.INTRO_SKIP_SECONDS;
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
        const vocal = prevMusic.vocals?.[0];
        playMusic(prevMusic, vocal);
    }
}

function toggleRepeat() {
    state.isRepeat = !state.isRepeat;
    elements.repeatBtn.classList.toggle('active', state.isRepeat);
    // Cannot use native loop because we need to jump to skip point, handle in 'ended' event
    // elements.audioPlayer.loop = state.isRepeat; 
}

function toggleShuffle() {
    state.isShuffle = !state.isShuffle;
    elements.shuffleBtn.classList.toggle('active', state.isShuffle);
}

function setVolume(value) {
    state.volume = value / 100;
    elements.audioPlayer.volume = state.volume;
    updateVolumeIcon();
}

function toggleMute() {
    elements.audioPlayer.muted = !elements.audioPlayer.muted;
    updateVolumeIcon();
}

function updateVolumeIcon() {
    const highIcon = elements.volumeBtn.querySelector('.volume-high');
    const mutedIcon = elements.volumeBtn.querySelector('.volume-muted');

    if (elements.audioPlayer.muted || state.volume === 0) {
        highIcon.style.display = 'none';
        mutedIcon.style.display = 'block';
    } else {
        highIcon.style.display = 'block';
        mutedIcon.style.display = 'none';
    }
}

// Progress Bar
function updateProgress() {
    const { currentTime, duration } = elements.audioPlayer;
    if (isNaN(duration)) return;

    // Adjust for intro skip
    const adjustedCurrent = Math.max(0, currentTime - CONFIG.INTRO_SKIP_SECONDS);
    const adjustedDuration = Math.max(0, duration - CONFIG.INTRO_SKIP_SECONDS);

    // Calculate percentage (based on adjusted duration)
    // Avoid division by zero
    const percent = adjustedDuration > 0 ? (adjustedCurrent / adjustedDuration) * 100 : 0;

    // Clamp percent between 0 and 100
    const clampedPercent = Math.min(100, Math.max(0, percent));

    elements.progressFill.style.width = `${clampedPercent}%`;
    elements.progressHandle.style.left = `${clampedPercent}%`;

    elements.currentTime.textContent = formatTime(adjustedCurrent);
    elements.durationTime.textContent = formatTime(adjustedDuration);
}

function seekTo(e) {
    const rect = elements.progressBar.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;

    const { duration } = elements.audioPlayer;
    if (isNaN(duration)) return;

    const adjustedDuration = Math.max(0, duration - CONFIG.INTRO_SKIP_SECONDS);
    const seekTimeAdjusted = percent * adjustedDuration;

    // Convert back to actual time
    const actualSeekTime = seekTimeAdjusted + CONFIG.INTRO_SKIP_SECONDS;

    // Ensure we don't seek before the skip point
    const finalSeekTime = Math.max(CONFIG.INTRO_SKIP_SECONDS, actualSeekTime);

    elements.audioPlayer.currentTime = finalSeekTime;
}

function updateBuffered() {
    const buffered = elements.audioPlayer.buffered;
    if (buffered.length > 0) {
        const bufferedEnd = buffered.end(buffered.length - 1);
        const duration = elements.audioPlayer.duration;

        if (duration > 0) {
            // Visualize buffered relative to the full track, OR relative to the playable part?
            // Usually simpler to visualize relative to full track, but we are hiding the first 9s.
            // Let's adjust it to match the visible bar.

            const adjustedDuration = Math.max(0, duration - CONFIG.INTRO_SKIP_SECONDS);
            const adjustedBuffered = Math.max(0, bufferedEnd - CONFIG.INTRO_SKIP_SECONDS);

            const percent = adjustedDuration > 0 ? (adjustedBuffered / adjustedDuration) * 100 : 0;
            const clampedPercent = Math.min(100, Math.max(0, percent));

            elements.progressBuffered.style.width = `${clampedPercent}%`;
        }
    }
}

// Media Session API for Background Playback
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
                // Media Session might pass time relative to 0 (audio file 0) or relative to display duration?
                // Usually it's absolute time of the media.
                // If the user drags standard OS media controls, they might drag into the first 9 seconds.
                // We should enforce the floor.
                elements.audioPlayer.currentTime = Math.max(CONFIG.INTRO_SKIP_SECONDS, details.seekTime);
            }
        });
    }
}

// Event Listeners
function initEventListeners() {
    // Search
    elements.searchInput.addEventListener('input', (e) => {
        state.searchQuery = e.target.value;
        elements.searchClear.classList.toggle('visible', state.searchQuery.length > 0);
        filterMusic();
    });

    elements.searchClear.addEventListener('click', () => {
        state.searchQuery = '';
        elements.searchInput.value = '';
        elements.searchClear.classList.remove('visible');
        filterMusic();
    });

    // Filter chips
    document.querySelectorAll('.chip').forEach(chip => {
        chip.addEventListener('click', () => {
            document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            state.currentFilter = chip.dataset.filter;
            filterMusic();
        });
    });

    // Theme toggle
    elements.themeToggle.addEventListener('click', toggleTheme);

    // Player controls
    elements.playPauseBtn.addEventListener('click', togglePlayPause);
    elements.prevBtn.addEventListener('click', playPrev);
    elements.nextBtn.addEventListener('click', playNext);
    elements.repeatBtn.addEventListener('click', toggleRepeat);
    elements.shuffleBtn.addEventListener('click', toggleShuffle);
    elements.volumeBtn.addEventListener('click', toggleMute);
    elements.volumeSlider.addEventListener('input', (e) => setVolume(e.target.value));
    elements.lyricsBtn.addEventListener('click', openLyricsModal);

    // Progress bar
    elements.progressBar.addEventListener('click', seekTo);

    // Audio events
    elements.audioPlayer.addEventListener('play', () => {
        state.isPlaying = true;
        updatePlayPauseButton();
    });

    elements.audioPlayer.addEventListener('pause', () => {
        state.isPlaying = false;
        updatePlayPauseButton();
    });

    elements.audioPlayer.addEventListener('timeupdate', updateProgress);
    elements.audioPlayer.addEventListener('progress', updateBuffered);
    elements.audioPlayer.addEventListener('ended', () => {
        if (state.isRepeat) {
            // Manual loop logic to skip intro
            elements.audioPlayer.currentTime = CONFIG.INTRO_SKIP_SECONDS;
            elements.audioPlayer.play().catch(err => console.warn('Playback failed:', err));
        } else {
            playNext();
        }
    });

    // Modal
    elements.modalClose.addEventListener('click', closeVocalModal);
    elements.vocalModal.addEventListener('click', (e) => {
        if (e.target === elements.vocalModal) closeVocalModal();
    });

    elements.lyricsClose.addEventListener('click', closeLyricsModal);
    elements.lyricsModal.addEventListener('click', (e) => {
        if (e.target === elements.lyricsModal) closeLyricsModal();
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if (e.target.tagName === 'INPUT') return;

        switch (e.code) {
            case 'Space':
                e.preventDefault();
                togglePlayPause();
                break;
            case 'ArrowLeft':
                // Seek backward, respecting the intro skip
                const newTimeBack = elements.audioPlayer.currentTime - 10;
                elements.audioPlayer.currentTime = Math.max(CONFIG.INTRO_SKIP_SECONDS, newTimeBack);
                break;
            case 'ArrowRight':
                elements.audioPlayer.currentTime += 10;
                break;
            case 'ArrowUp':
                setVolume(Math.min(100, state.volume * 100 + 10));
                elements.volumeSlider.value = state.volume * 100;
                break;
            case 'ArrowDown':
                setVolume(Math.max(0, state.volume * 100 - 10));
                elements.volumeSlider.value = state.volume * 100;
                break;
        }
    });
}

// Initialize
async function init() {
    initTheme();
    initEventListeners();
    setVolume(80);
    // Load music and lyrics data in parallel
    await Promise.all([loadMusicData(), loadLyricsData()]);
}

// Start app when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
