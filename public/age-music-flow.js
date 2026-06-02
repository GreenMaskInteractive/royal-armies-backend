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

    const PLAYER_HOST_ID = 'game-chat-music-panel';
    const MUSIC_PANEL_READY_EVENT = 'royalarmies:age-chat-ready';

    /** Tracks selectable in the age chat Music tab (Archimedes reserved for prologue / trailer). */
    const PLAYLIST_TRACK_IDS = Object.freeze([
        TRACKS.cascadingSkies.id,
        TRACKS.kindred.id
    ]);

    /**
     * City-discoverable tracks (wav: audio/<slug>.wav, slug = lowercase title without spaces/punctuation).
     * Wired to map city entry later via markTrackDiscovered().
     */
    const DISCOVERABLE_TRACKS = Object.freeze([
        { id: 'rivers-of-blood', title: 'Rivers of Blood', file: 'audio/riversofblood.wav' },
        { id: 'dravic-fortitude', title: 'Dravic Fortitude', file: 'audio/dravicfortitude.wav' },
        { id: 'awakened', title: 'Awakened', file: 'audio/awakened.wav' },
        { id: 'aidoriian-memories', title: 'Aidoriian Memories', file: 'audio/aidoriianmemories.wav' },
        { id: 'bellows-canyon', title: "Bellow's Canyon", file: 'audio/bellowscanyon.wav' },
        { id: 'the-battles-of-old', title: 'The Battles of Old', file: 'audio/thebattlesofold.wav' },
        { id: 'a-gracious-host', title: 'A Gracious Host', file: 'audio/agracioushost.wav' },
        { id: 'arcane-soul', title: 'Arcane Soul', file: 'audio/arcanesoul.wav' },
        { id: 'a-warriors-pride', title: "A Warrior's Pride", file: 'audio/awarriorspride.wav' },
        { id: 'drunken-thrunesian', title: 'Drunken Thrunesian', file: 'audio/drunkenthrunesian.wav' },
        { id: 'field-of-gods', title: 'Field of gods', file: 'audio/fieldofgods.wav' }
    ]);

    const DISCOVERABLE_TRACK_BY_ID = DISCOVERABLE_TRACKS.reduce((map, track) => {
        map[track.id] = track;
        return map;
    }, Object.create(null));

    const STORAGE_DISCOVERED_TRACKS = 'royalArmies_discoveredMusicTracks';
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
        if (stored === TRACKS.archimedes.id) return TRACKS.archimedes.id;
        if (isDiscoverableTrackId(stored) && isTrackDiscovered(stored)) return stored;
        return TRACKS.cascadingSkies.id;
    }

    function readDiscoveredTrackIds() {
        try {
            const raw = readLocal(STORAGE_DISCOVERED_TRACKS);
            if (!raw) return new Set();
            const parsed = JSON.parse(raw);
            if (!Array.isArray(parsed)) return new Set();
            return new Set(parsed.map((id) => String(id || '').trim().toLowerCase()).filter(Boolean));
        } catch (_err) {
            return new Set();
        }
    }

    function writeDiscoveredTrackIds(trackIdSet) {
        writeLocal(STORAGE_DISCOVERED_TRACKS, JSON.stringify([...trackIdSet]));
    }

    function isDiscoverableTrackId(trackId) {
        return Boolean(DISCOVERABLE_TRACK_BY_ID[String(trackId || '').trim().toLowerCase()]);
    }

    function isTrackDiscovered(trackId) {
        const normalized = String(trackId || '').trim().toLowerCase();
        return readDiscoveredTrackIds().has(normalized);
    }

    function markTrackDiscovered(trackId) {
        const normalized = String(trackId || '').trim().toLowerCase();
        if (!isDiscoverableTrackId(normalized)) return false;
        const discovered = readDiscoveredTrackIds();
        if (discovered.has(normalized)) return true;
        discovered.add(normalized);
        writeDiscoveredTrackIds(discovered);
        syncUi();
        return true;
    }

    function resolveAgePlaylistTrackId(trackId) {
        const normalized = String(trackId || '').trim().toLowerCase();
        if (normalized === TRACKS.kindred.id) return TRACKS.kindred.id;
        if (isDiscoverableTrackId(normalized) && isTrackDiscovered(normalized)) return normalized;
        return TRACKS.cascadingSkies.id;
    }

    function resolveTrackById(trackId) {
        const normalized = String(trackId || '').trim().toLowerCase();
        if (normalized === TRACKS.cascadingSkies.id) return TRACKS.cascadingSkies;
        if (normalized === TRACKS.kindred.id) return TRACKS.kindred;
        if (normalized === TRACKS.archimedes.id) return TRACKS.archimedes;
        if (DISCOVERABLE_TRACK_BY_ID[normalized]) return DISCOVERABLE_TRACK_BY_ID[normalized];
        return TRACKS.cascadingSkies;
    }

    function isPlaylistTrackId(trackId) {
        const normalized = String(trackId || '').trim().toLowerCase();
        if (PLAYLIST_TRACK_IDS.includes(normalized)) return true;
        return isDiscoverableTrackId(normalized) && isTrackDiscovered(normalized);
    }

    function getChatPlaylistEntries() {
        const entries = PLAYLIST_TRACK_IDS.map((trackId) => {
            const track = resolveTrackById(trackId);
            return {
                id: track.id,
                title: track.title,
                locked: false,
                discovered: true
            };
        });

        DISCOVERABLE_TRACKS.forEach((track) => {
            const discovered = isTrackDiscovered(track.id);
            entries.push({
                id: track.id,
                title: track.title,
                locked: !discovered,
                discovered
            });
        });

        return entries;
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
        writeSession(STORAGE.currentTrack, TRACKS.cascadingSkies.id);
        writeSession(STORAGE.currentTime, '0');
    }

    function removeLegacyBottomMusicPlayer() {
        const legacyHost = global.document.getElementById('age-bottom-music-player-host');
        if (legacyHost) legacyHost.remove();
    }

    function escapePlaylistTitle(title) {
        return String(title || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function buildPlaylistItemMarkup(entry, activeId) {
        const isActive = !entry.locked && entry.id === activeId;
        const itemClasses = [
            'game-chat-music-playlist-item',
            isActive ? 'is-active' : '',
            entry.locked ? 'is-locked' : ''
        ].filter(Boolean).join(' ');

        const btnClasses = [
            'game-chat-music-playlist-btn',
            isActive ? 'is-active' : '',
            entry.locked ? 'is-locked' : ''
        ].filter(Boolean).join(' ');

        const label = escapePlaylistTitle(entry.title);
        const lockHint = 'Discover this track by entering certain cities on the map.';

        if (entry.locked) {
            return `
                <li class="${itemClasses}">
                    <span
                        class="${btnClasses}"
                        aria-disabled="true"
                        title="${lockHint}">
                        ${label}
                    </span>
                </li>
            `.trim();
        }

        return `
            <li class="${itemClasses}">
                <button
                    type="button"
                    class="${btnClasses}"
                    data-music-track-id="${entry.id}"
                    aria-current="${isActive ? 'true' : 'false'}">
                    ${label}
                </button>
            </li>
        `.trim();
    }

    function buildPlaylistSectionMarkup(title, entries, activeId, sectionModifier) {
        if (!entries.length) return '';

        const listClass = sectionModifier === 'undiscovered'
            ? 'game-chat-music-playlist game-chat-music-playlist--undiscovered'
            : 'game-chat-music-playlist';

        return `
            <section class="game-chat-music-playlist-section game-chat-music-playlist-section--${sectionModifier}">
                <h4 class="game-chat-music-playlist-heading">${escapePlaylistTitle(title)}</h4>
                <ul class="${listClass}">
                    ${entries.map((entry) => buildPlaylistItemMarkup(entry, activeId)).join('')}
                </ul>
            </section>
        `.trim();
    }

    function buildPlaylistMarkup(activeTrackId) {
        const activeId = resolveAgePlaylistTrackId(activeTrackId);
        const allEntries = getChatPlaylistEntries();
        const discovered = allEntries.filter((entry) => !entry.locked);
        const undiscovered = allEntries.filter((entry) => entry.locked);

        return `
            <div class="game-chat-music-playlist-catalog">
                ${buildPlaylistSectionMarkup('Discovered', discovered, activeId, 'discovered')}
                ${buildPlaylistSectionMarkup('Undiscovered', undiscovered, activeId, 'undiscovered')}
            </div>
        `.trim();
    }

    function syncUi(trackTitle) {
        const trackId = resolveStoredTrackId();
        const title = String(trackTitle || resolveTrackById(trackId).title);
        const nowPlaying = global.document.getElementById('game-chat-music-now-playing');
        if (nowPlaying) nowPlaying.textContent = title;

        const trackLabel = global.document.getElementById('media-active-track-name');
        if (trackLabel) trackLabel.textContent = `🎵 ${title}`;

        const audio = resolveAudioElement();
        const playBtn = global.document.getElementById('game-chat-music-play-btn');
        const playGlyph = playBtn?.querySelector('.game-chat-music-transport-glyph');
        if (playBtn && audio) {
            const isPaused = audio.paused;
            playBtn.setAttribute('aria-label', isPaused ? 'Play soundtrack' : 'Pause soundtrack');
            if (playGlyph) {
                playGlyph.textContent = isPaused ? '▶' : '❚❚';
            }
        }

        const muteBtn = global.document.getElementById('game-chat-music-mute-btn');
        if (muteBtn && audio) {
            muteBtn.textContent = audio.muted ? 'Unmute' : 'Mute';
            muteBtn.setAttribute('aria-label', audio.muted ? 'Unmute soundtrack' : 'Mute soundtrack');
        }

        const playlistCatalog = global.document.getElementById('game-chat-music-playlist-catalog');
        if (playlistCatalog) {
            playlistCatalog.innerHTML = buildPlaylistMarkup(trackId);
        }
    }

    function refreshChatMusicPanel() {
        syncUi();
    }

    function selectPlaylistTrack(trackId) {
        const normalized = resolveAgePlaylistTrackId(trackId);
        if (!isPlaylistTrackId(normalized)) return;

        writeSession(STORAGE.currentTrack, normalized);
        writeSession(STORAGE.currentTime, '0');
        loadTrack(normalized, { restoreTime: false });

        const audio = resolveAudioElement();
        if (audio) {
            audio.loop = normalized === TRACKS.cascadingSkies.id;
        }

        tryPlay();
        syncUi();
    }

    function bindAgeChatMusicPlayerControls(host) {
        if (!host || host.dataset.musicControlsBound === '1') return;
        host.dataset.musicControlsBound = '1';

        const playBtn = host.querySelector('#game-chat-music-play-btn');
        const muteBtn = host.querySelector('#game-chat-music-mute-btn');
        const playlistCatalog = host.querySelector('#game-chat-music-playlist-catalog');

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
                syncUi();
            });
        }

        if (playlistCatalog) {
            playlistCatalog.addEventListener('click', (event) => {
                const button = event.target.closest('[data-music-track-id]:not(.is-locked)');
                if (!button || button.disabled) return;
                selectPlaylistTrack(button.getAttribute('data-music-track-id'));
            });
        }
    }

    function mountAgeChatMusicPlayer() {
        if (!isAgePage()) return false;

        removeLegacyBottomMusicPlayer();

        const host = global.document.getElementById(PLAYER_HOST_ID);
        if (!host) return false;
        if (host.dataset.musicPlayerMounted === '1') {
            syncUi();
            return true;
        }

        host.dataset.musicPlayerMounted = '1';
        host.innerHTML = `
            <div class="game-chat-music-player" aria-label="Music player">
                <div class="game-chat-music-controls">
                    <button
                        type="button"
                        id="game-chat-music-play-btn"
                        class="game-chat-music-transport-btn"
                        aria-label="Play soundtrack">
                        <span class="game-chat-music-transport-glyph" aria-hidden="true">▶</span>
                    </button>
                    <div class="game-chat-music-meta">
                        <span class="game-chat-music-eyebrow">Now playing</span>
                        <span id="game-chat-music-now-playing" class="game-chat-music-title">${TRACKS.cascadingSkies.title}</span>
                    </div>
                    <button type="button" id="game-chat-music-mute-btn" class="game-chat-music-utility-btn" aria-label="Mute soundtrack">Mute</button>
                </div>
                <div id="game-chat-music-playlist-catalog" class="game-chat-music-playlist-catalog" aria-label="Soundtrack playlist"></div>
            </div>
        `.trim();

        bindAgeChatMusicPlayerControls(host);
        syncUi();
        return true;
    }

    function ensureAgeChatMusicPlayerMounted() {
        if (mountAgeChatMusicPlayer()) return;
        global.addEventListener(MUSIC_PANEL_READY_EVENT, () => {
            mountAgeChatMusicPlayer();
        }, { once: true });
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

        ensureAgeChatMusicPlayerMounted();

        const trackId = TRACKS.cascadingSkies.id;
        writeSession(STORAGE.currentTrack, trackId);
        loadTrack(trackId, { restoreTime: true });

        const audio = resolveAudioElement();
        if (audio) {
            audio.loop = true;
        }

        tryPlay();
        writeLocal(STORAGE.hasJoinedAgeEver, '1');
        writeSession(STORAGE.openingProloguePending, '0');
        syncUi();
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
        mountAgeChatMusicPlayer,
        refreshChatMusicPanel,
        selectPlaylistTrack,
        markTrackDiscovered,
        isTrackDiscovered,
        getDiscoverableTracks: () => DISCOVERABLE_TRACKS.slice(),
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
