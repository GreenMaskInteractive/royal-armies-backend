/**
 * RIFT — Cross-page soundtrack flow (main -> game -> age).
 */
(function initRoyalArmiesMusicFlow(global) {
    'use strict';

    const TRACKS = Object.freeze({
        archimedes: {
            id: 'archimedes',
            title: "ARCHIMEDES' LULLABY",
            file: 'audio/archimedeslullaby.wav'
        },
        kindred: {
            id: 'kindred',
            title: 'KINDRED MEMORIES',
            file: 'audio/Kindred%20Memories.wav'
        }
    });

    const STORAGE = Object.freeze({
        startRequested: 'royalArmies_musicStartRequested',
        autoplayGranted: 'royalArmies_musicAutoplayGranted',
        progressionStarted: 'royalArmies_musicProgressionStarted',
        currentTrack: 'royalArmies_musicCurrentTrack',
        currentTime: 'royalArmies_musicCurrentTime',
        volume: 'royalArmies_musicVolume',
        muted: 'royalArmies_musicMuted',
        openingProloguePending: 'royalArmies_openingProloguePending',
        hasJoinedAgeEver: 'royalArmies_hasJoinedAgeEver'
    });

    const PLAYER_HOST_ID = 'age-bottom-music-player-host';
    const AUDIO_ID = 'ra-global-music-audio';
    const MAIN_PAGE_ID = 'main-dashboard-canvas';
    const GAME_PAGE_ID = 'game-page-canvas';
    const AGE_PAGE_ID = 'age-page-canvas';

    let audioEl = null;

    function pageId() {
        return global.document?.body?.id || '';
    }

    function isMainPage() {
        return pageId() === MAIN_PAGE_ID;
    }

    function isGamePage() {
        return pageId() === GAME_PAGE_ID;
    }

    function isAgePage() {
        return pageId() === AGE_PAGE_ID;
    }

    function readSession(key) {
        try {
            return global.sessionStorage.getItem(key);
        } catch (_err) {
            return null;
        }
    }

    function writeSession(key, value) {
        try {
            global.sessionStorage.setItem(key, String(value));
        } catch (_err) {
            /* ignore */
        }
    }

    function removeSession(key) {
        try {
            global.sessionStorage.removeItem(key);
        } catch (_err) {
            /* ignore */
        }
    }

    function readLocal(key) {
        try {
            return global.localStorage.getItem(key);
        } catch (_err) {
            return null;
        }
    }

    function writeLocal(key, value) {
        try {
            global.localStorage.setItem(key, String(value));
        } catch (_err) {
            /* ignore */
        }
    }

    function parseNumber(value, fallback) {
        const numeric = Number(value);
        return Number.isFinite(numeric) ? numeric : fallback;
    }

    function resolveStoredTrackId() {
        const stored = String(readSession(STORAGE.currentTrack) || '').trim().toLowerCase();
        if (stored === TRACKS.kindred.id) return TRACKS.kindred.id;
        return TRACKS.archimedes.id;
    }

    function resolveTrackById(trackId) {
        if (trackId === TRACKS.kindred.id) return TRACKS.kindred;
        return TRACKS.archimedes;
    }

    function resolveAudioElement() {
        if (audioEl && global.document.contains(audioEl)) return audioEl;

        const portalAudio = global.document.getElementById('portal-background-theme-audio');
        if (portalAudio) {
            audioEl = portalAudio;
            return audioEl;
        }

        const existingGlobal = global.document.getElementById(AUDIO_ID);
        if (existingGlobal) {
            audioEl = existingGlobal;
            return audioEl;
        }

        const created = global.document.createElement('audio');
        created.id = AUDIO_ID;
        created.preload = 'auto';
        created.setAttribute('playsinline', '');
        (global.document.body || global.document.documentElement).appendChild(created);
        audioEl = created;
        return audioEl;
    }

    function persistAudioState() {
        const audio = resolveAudioElement();
        if (!audio) return;
        writeSession(STORAGE.currentTime, String(Math.max(0, audio.currentTime || 0)));
        writeSession(STORAGE.volume, String(Math.max(0, Math.min(1, audio.volume || 0.5))));
        writeSession(STORAGE.muted, audio.muted ? '1' : '0');
    }

    function applyStoredVolumeAndMute(audio) {
        audio.volume = Math.max(0, Math.min(1, parseNumber(readSession(STORAGE.volume), 0.5)));
        audio.muted = String(readSession(STORAGE.muted) || '') === '1';
    }

    function loadTrack(trackId, options = {}) {
        const audio = resolveAudioElement();
        if (!audio) return;

        const track = resolveTrackById(trackId);
        const previousTime = parseNumber(readSession(STORAGE.currentTime), 0);
        const shouldRestoreTime = options.restoreTime === true;

        const source = audio.querySelector('source');
        if (source) {
            source.src = track.file;
            audio.load();
        } else {
            audio.src = track.file;
        }
        writeSession(STORAGE.currentTrack, track.id);

        applyStoredVolumeAndMute(audio);
        if (shouldRestoreTime && previousTime > 0) {
            audio.currentTime = previousTime;
        } else {
            audio.currentTime = 0;
            writeSession(STORAGE.currentTime, '0');
        }

        syncUi(track.title);
    }

    function tryPlay() {
        const audio = resolveAudioElement();
        if (!audio) return;
        audio.play().catch(() => {});
    }

    function shouldSuppressPortalMainMusic() {
        return isMainPage();
    }

    function hideMainPagePlayer() {
        if (!isMainPage()) return;
        const playerHome = global.document.getElementById('portal-media-player-home');
        if (playerHome) playerHome.hidden = true;

        const audio = resolveAudioElement();
        if (audio) {
            audio.pause();
            audio.currentTime = 0;
        }
        removeSession(STORAGE.startRequested);
    }

    function prepareJoinAgeLaunch() {
        const hasJoinedBefore = readLocal(STORAGE.hasJoinedAgeEver) === '1';
        writeSession(STORAGE.startRequested, '1');
        writeSession(STORAGE.autoplayGranted, '1');
        writeSession(STORAGE.progressionStarted, '0');
        writeSession(STORAGE.openingProloguePending, hasJoinedBefore ? '0' : '1');
        writeSession(STORAGE.currentTrack, TRACKS.archimedes.id);
        writeSession(STORAGE.currentTime, '0');
    }

    function syncUi(trackTitle) {
        const title = String(trackTitle || resolveTrackById(resolveStoredTrackId()).title);
        const compactLabel = global.document.getElementById('age-bottom-music-title');
        if (compactLabel) compactLabel.textContent = title;

        const trackLabel = global.document.getElementById('media-active-track-name');
        if (trackLabel) trackLabel.textContent = `🎵 ${title}`;

        const audio = resolveAudioElement();
        const playGlyph = global.document.getElementById('age-bottom-music-play-btn');
        if (playGlyph && audio) {
            playGlyph.textContent = audio.paused ? 'Play' : 'Pause';
        }
    }

    function buildAgeBottomPlayer() {
        if (!isAgePage()) return;
        if (global.document.getElementById(PLAYER_HOST_ID)) return;

        const controls = global.document.querySelector('.age-map-bottom-dock-controls');
        if (!controls) return;

        const host = global.document.createElement('div');
        host.id = PLAYER_HOST_ID;
        host.className = 'age-bottom-music-player-host';
        host.innerHTML = `
            <div class="age-bottom-music-player" aria-label="Music player">
                <span id="age-bottom-music-title" class="age-bottom-music-title">ARCHIMEDES' LULLABY</span>
                <button type="button" id="age-bottom-music-play-btn" class="age-bottom-music-btn">Play</button>
                <button type="button" id="age-bottom-music-mute-btn" class="age-bottom-music-btn">Mute</button>
            </div>
        `.trim();
        controls.prepend(host);

        const playBtn = host.querySelector('#age-bottom-music-play-btn');
        const muteBtn = host.querySelector('#age-bottom-music-mute-btn');
        if (playBtn) {
            playBtn.addEventListener('click', () => {
                const audio = resolveAudioElement();
                if (!audio) return;
                if (audio.paused) {
                    tryPlay();
                } else {
                    audio.pause();
                }
                syncUi();
            });
        }
        if (muteBtn) {
            muteBtn.addEventListener('click', () => {
                const audio = resolveAudioElement();
                if (!audio) return;
                audio.muted = !audio.muted;
                writeSession(STORAGE.muted, audio.muted ? '1' : '0');
                muteBtn.textContent = audio.muted ? 'Unmute' : 'Mute';
            });
        }
    }

    function bootGamePageMusic() {
        if (!isGamePage()) return;
        if (readSession(STORAGE.startRequested) !== '1') return;

        loadTrack(TRACKS.archimedes.id, { restoreTime: false });
        tryPlay();
        writeSession(STORAGE.startRequested, '0');
        if (readSession(STORAGE.openingProloguePending) === '1') {
            global.dispatchEvent(new CustomEvent('royalarmies:opening-prologue-ready', {
                detail: { soundtrack: TRACKS.archimedes.id }
            }));
        }
    }

    function markProgressionPhaseStart() {
        if (readSession(STORAGE.progressionStarted) === '1') return;
        writeSession(STORAGE.progressionStarted, '1');
        loadTrack(TRACKS.kindred.id, { restoreTime: false });
        tryPlay();
    }

    function bootAgePageMusic() {
        if (!isAgePage()) return;
        buildAgeBottomPlayer();
        const trackId = resolveStoredTrackId();
        loadTrack(trackId, { restoreTime: true });
        tryPlay();
        writeLocal(STORAGE.hasJoinedAgeEver, '1');
        writeSession(STORAGE.openingProloguePending, '0');
    }

    function bindLifecycle() {
        global.addEventListener('beforeunload', persistAudioState);
        global.document.addEventListener('visibilitychange', () => {
            if (global.document.visibilityState === 'hidden') persistAudioState();
        });
    }

    function init() {
        if (isMainPage()) {
            hideMainPagePlayer();
        } else if (isGamePage()) {
            bootGamePageMusic();
        } else if (isAgePage()) {
            bootAgePageMusic();
        }
        bindLifecycle();
        syncUi();
    }

    global.RoyalArmiesMusicFlow = {
        shouldSuppressPortalMainMusic,
        prepareJoinAgeLaunch,
        markProgressionPhaseStart,
        markIntroCinematicComplete: markProgressionPhaseStart,
        shouldHoldForOpeningPrologue: function shouldHoldForOpeningPrologue() {
            return readSession(STORAGE.openingProloguePending) === '1';
        }
    };

    if (global.document.readyState === 'loading') {
        global.document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
        init();
    }
})(window);
