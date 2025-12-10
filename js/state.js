/**
 * 状態管理 (State Management)
 */
export const state = {
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
    isDragging: false,
    // プレイリスト＆設定の状態
    savedPlaylists: [],
    stats: {
        history: [], // 楽曲IDの配列 (最新が先頭)
        playCounts: {} // { musicId: count }
    },
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
