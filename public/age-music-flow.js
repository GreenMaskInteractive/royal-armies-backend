/**
 * RIFT — Cross-page soundtrack flow (game, age, and seasonal event pages only).
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
        },
        cascadingSkies: {
            id: 'cascading-skies',
            title: 'CASCADING SKIES',
            file: 'audio/cascadingskies.wav'
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
    const CINEMATIC_PAGE_ID = 'age-of-war-cinematic-canvas';
    const TRAILER_PAGE_ID = 'royal-armies-ageofwar-trailer-canvas';
    const AGE_PAGE_ID = 'age-page-canvas';

    let audioEl = null;
    let volumeRampGeneration = 0;
    let trackEndWaitGeneration = 0;

    function pageId() {
        return global.document?.body?.id || '';
    }

    function isMainPage() {
        return pageId() === MAIN_PAGE_ID;
    }

    function isGamePage() {
        return pageId() === GAME_PAGE_ID;
    }

    function isCinematicPage() {
        const id = pageId();
        return id === CINEMATIC_PAGE_ID || id === TRAILER_PAGE_ID;
    }

    function isTrailerPage() {
        return pageId() === TRAILER_PAGE_ID;
    }

    function supportsPrologueSoundtrackPage() {
        return isGamePage() || isCinematicPage();
    }

    function isAgePage() {
        return pageId() === AGE_PAGE_ID;
    }

    function isSoundtrackAllowedPage() {
        return isGamePage() || isAgePage() || isCinematicPage();
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
        if (stored === TRACKS.cascadingSkies.id) return TRACKS.cascadingSkies.id;
        if (stored === TRACKS.kindred.id) return TRACKS.kindred.id;
        return TRACKS.archimedes.id;
    }

    function resolveTrackById(trackId) {
        if (trackId === TRACKS.cascadingSkies.id) return TRACKS.cascadingSkies;
        if (trackId === TRACKS.kindred.id) return TRACKS.kindred;
        return TRACKS.archimedes;
    }

    function resolveAudioElement() {
        if (audioEl && global.document.contains(audioEl)) return audioEl;

        if (!isMainPage()) {
            const portalAudio = global.document.getElementById('portal-background-theme-audio');
            if (portalAudio) {
                audioEl = portalAudio;
                return audioEl;
            }
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
            audio.load();
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

    function tryPlay(options = {}) {
        const audio = resolveAudioElement();
        if (!audio) return Promise.resolve();
        if (options.volume != null) {
            audio.volume = Math.max(0, Math.min(1, options.volume));
            writeSession(STORAGE.volume, String(audio.volume));
        } else {
            applyStoredVolumeAndMute(audio);
        }
        audio.muted = false;
        return audio.play().catch(() => {});
    }

    function startGamePageArchimedes(options = {}) {
        if (!supportsPrologueSoundtrackPage()) return Promise.resolve();

        writeSession(STORAGE.autoplayGranted, '1');
        writeSession(STORAGE.currentTrack, TRACKS.archimedes.id);
        if (options.resetTime !== false) {
            writeSession(STORAGE.currentTime, '0');
        }

        loadTrack(TRACKS.archimedes.id, { restoreTime: false });

        const playOptions = {};
        if (options.volume != null) {
            playOptions.volume = options.volume;
        }
        return tryPlay(playOptions);
    }

    function shouldAutoStartGamePageMusic() {
        if (!isGamePage()) return false;
        if (readSession(STORAGE.startRequested) === '1') return true;
        if (readSession(STORAGE.openingProloguePending) === '1') {
            return Boolean(global.RoyalArmiesOpeningPrologue);
        }
        return true;
    }

    function shouldSuppressPortalMainMusic() {
        return isMainPage();
    }

    function hideMainPagePlayer() {
        if (!isMainPage()) return;
        const playerHome = global.document.getElementById('portal-media-player-home');
        if (playerHome) playerHome.hidden = true;

        const portalAudio = global.document.getElementById('portal-background-theme-audio');
        if (portalAudio) {
            portalAudio.pause();
            portalAudio.currentTime = 0;
            portalAudio.muted = true;
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
        const playBtn = global.document.getElementById('age-bottom-music-play-btn');
        const playGlyph = playBtn?.querySelector('.age-bottom-music-transport-glyph');
        if (playBtn && audio) {
            const isPaused = audio.paused;
            playBtn.setAttribute('aria-label', isPaused ? 'Play soundtrack' : 'Pause soundtrack');
            if (playGlyph) {
                playGlyph.textContent = isPaused ? '▶' : '❚❚';
            }
        }
    }

    function buildAgeBottomPlayer() {
        if (!isAgePage()) return;
        if (global.document.getElementById(PLAYER_HOST_ID)) return;

        const tray = global.document.querySelector('.age-map-bottom-dock-tray')
            || global.document.querySelector('.age-map-bottom-dock-controls');
        if (!tray) return;

        const nametag = tray.querySelector('.age-map-bottom-commander-nametag');

        const host = global.document.createElement('div');
        host.id = PLAYER_HOST_ID;
        host.className = 'age-bottom-music-player-host';
        host.innerHTML = `
            <div class="age-bottom-music-player portal-deployment-server-panel" aria-label="Music player">
                <div class="portal-server-panel-controls game-page-panel-bezel age-bottom-music-player-bezel">
                    <button
                        type="button"
                        id="age-bottom-music-play-btn"
                        class="age-bottom-music-transport-btn"
                        aria-label="Play soundtrack">
                        <span class="age-bottom-music-transport-glyph" aria-hidden="true">▶</span>
                    </button>
                    <div class="age-bottom-music-meta">
                        <span class="age-bottom-music-eyebrow">Now playing</span>
                        <span id="age-bottom-music-title" class="age-bottom-music-title">ARCHIMEDES' LULLABY</span>
                    </div>
                    <button type="button" id="age-bottom-music-mute-btn" class="age-bottom-music-utility-btn" aria-label="Mute soundtrack">Mute</button>
                </div>
            </div>
        `.trim();
        if (nametag) {
            tray.insertBefore(host, nametag);
        } else {
            tray.appendChild(host);
        }

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
                muteBtn.setAttribute('aria-label', audio.muted ? 'Unmute soundtrack' : 'Mute soundtrack');
            });
        }
    }

    function bootGamePageMusic() {
        if (!shouldAutoStartGamePageMusic()) return;

        startGamePageArchimedes();
        writeSession(STORAGE.startRequested, '0');
        if (readSession(STORAGE.openingProloguePending) === '1') {
            global.dispatchEvent(new CustomEvent('royalarmies:opening-prologue-ready', {
                detail: { soundtrack: TRACKS.archimedes.id }
            }));
        }
    }

    function startPrologueOutroMusic(options = {}) {
        const volumeOption = options && typeof options === 'object' && options.volume != null
            ? clampVolume(options.volume)
            : null;

        writeSession(STORAGE.progressionStarted, '1');
        loadTrack(TRACKS.kindred.id, { restoreTime: false });

        const audio = resolveAudioElement();
        if (audio) {
            audio.loop = false;
        }

        return tryPlay(volumeOption != null ? { volume: volumeOption } : { volume: 0.5 });
    }

    function startProgressionPageMusic(options = {}) {
        const volumeOption = options && typeof options === 'object' && options.volume != null
            ? clampVolume(options.volume)
            : null;
        const audio = resolveAudioElement();
        const onProgressionTrack = resolveStoredTrackId() === TRACKS.cascadingSkies.id;

        if (onProgressionTrack && audio) {
            if (volumeOption != null) {
                audio.volume = volumeOption;
                writeSession(STORAGE.volume, String(audio.volume));
            }
            if (audio.paused) {
                return tryPlay(volumeOption != null ? { volume: volumeOption } : {});
            }
            return Promise.resolve();
        }

        writeSession(STORAGE.progressionStarted, '1');
        writeSession(STORAGE.currentTrack, TRACKS.cascadingSkies.id);
        writeSession(STORAGE.currentTime, '0');
        loadTrack(TRACKS.cascadingSkies.id, { restoreTime: false });

        if (audio) {
            audio.loop = true;
        }

        return tryPlay(volumeOption != null ? { volume: volumeOption } : { volume: 0.5 });
    }

    function markProgressionPhaseStart(options) {
        return startProgressionPageMusic(options);
    }

    function cancelWaitForTrackEnd() {
        trackEndWaitGeneration += 1;
    }

    function waitForCurrentTrackEnd() {
        cancelWaitForTrackEnd();
        const audio = resolveAudioElement();
        if (!audio) return Promise.resolve();

        const generation = trackEndWaitGeneration + 1;
        trackEndWaitGeneration = generation;

        if (audio.ended) return Promise.resolve();
        if (Number.isFinite(audio.duration) && audio.duration > 0 && audio.currentTime >= audio.duration - 0.05) {
            return Promise.resolve();
        }

        return new Promise((resolve) => {
            const onEnd = () => {
                if (generation !== trackEndWaitGeneration) return;
                audio.removeEventListener('ended', onEnd);
                resolve();
            };

            audio.addEventListener('ended', onEnd);
        });
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

    function cancelMusicVolumeAnimation() {
        volumeRampGeneration += 1;
    }

    function clampVolume(volume) {
        return Math.max(0, Math.min(1, Number(volume) || 0));
    }

    function rampMusicVolume(fromVolume, toVolume, durationMs) {
        const audio = resolveAudioElement();
        if (!audio) return Promise.resolve();

        const generation = volumeRampGeneration + 1;
        volumeRampGeneration = generation;
        const startVolume = clampVolume(fromVolume);
        const endVolume = clampVolume(toVolume);
        const spanMs = Math.max(0, Number(durationMs) || 0);
        audio.volume = startVolume;

        if (spanMs <= 0 || startVolume === endVolume) {
            audio.volume = endVolume;
            return Promise.resolve();
        }

        const startedAt = global.performance?.now?.() ?? Date.now();

        return new Promise((resolve) => {
            function tick(now) {
                if (generation !== volumeRampGeneration) {
                    resolve();
                    return;
                }

                const elapsed = now - startedAt;
                const progress = Math.min(1, elapsed / spanMs);
                audio.volume = startVolume + ((endVolume - startVolume) * progress);

                if (progress < 1) {
                    global.requestAnimationFrame(tick);
                } else {
                    resolve();
                }
            }

            global.requestAnimationFrame(tick);
        });
    }

    async function fadeMusicOut(durationMs) {
        cancelMusicVolumeAnimation();
        const audio = resolveAudioElement();
        if (!audio) return;

        const startVolume = audio.volume || 0;
        if (startVolume <= 0) {
            audio.pause();
            return;
        }

        await rampMusicVolume(startVolume, 0, durationMs);
        audio.pause();
    }

    async function handoffToGameplayMusic(options = {}) {
        const fadeOutMs = Math.max(0, Number(options.fadeOutMs) || 1200);
        const volume = options.volume != null
            ? clampVolume(options.volume)
            : Math.max(0, Math.min(1, parseNumber(readSession(STORAGE.volume), 0.5)));

        cancelWaitForTrackEnd();
        await fadeMusicOut(fadeOutMs);

        return startProgressionPageMusic({ volume });
    }

    function bindLifecycle() {
        if (!isSoundtrackAllowedPage()) return;
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
        } else if (isCinematicPage()) {
            writeSession(STORAGE.openingProloguePending, isTrailerPage() ? '0' : '1');
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
        startPrologueOutroMusic,
        startProgressionPageMusic,
        startGamePageArchimedes,
        rampMusicVolume,
        fadeMusicOut,
        handoffToGameplayMusic,
        cancelMusicVolumeAnimation,
        waitForCurrentTrackEnd,
        cancelWaitForTrackEnd,
        getAudioElement: resolveAudioElement,
        shouldHoldForOpeningPrologue: function shouldHoldForOpeningPrologue() {
            if (readSession(STORAGE.openingProloguePending) === '1') return true;
            try {
                return global.sessionStorage.getItem('royalArmies_localProloguePending') === '1';
            } catch (_err) {
                return false;
            }
        }
    };

    if (global.document.readyState === 'loading') {
        global.document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
        init();
    }
})(window);
