/**
 * RIFT — Opening narrative prologue (local dev preview only).
 * Plays distressedwoman1.mp3 with cinematic stills + sentence subtitles (local dev).
 * Runs on ageofwarcinematic.html; on completion navigates to the game progression screen.
 */
(function initRoyalArmiesOpeningPrologue(global) {
    'use strict';

    const OVERLAY_ID = 'game-opening-prologue';
    const AUDIO_ID = 'game-opening-prologue-audio';
    const SUBTITLE_ID = 'game-opening-prologue-subtitle';
    const CRITICAL_STYLE_ID = 'rift-opening-prologue-critical-styles-v12';
    const TRAILER_LORE_TOOL_MAX_OPACITY = 0.4;
    const NARRATION_METADATA_TIMEOUT_MS = 8000;

    /**
     * Narration subtitle lines. `in` is when a line appears; it stays on screen until the next line's `in`.
     * Times use M:SS:ff hundredths and match distressedwoman1.mp3 (scaled when file duration differs).
     */
    const LOCAL_PROLOGUE_SUBTITLE_CUE_MARKS = Object.freeze([
        {
            in: '0:00:00',
            out: '0:08:87',
            text: 'The continent of Amnek was once a jewel of the world, its sprawling lands and islands shaped by the hands of my noble ancestors: the Aidoriian race.'
        },
        {
            in: '0:10:58',
            out: '0:17:60',
            text: 'But time is a river that steals all things, and now, my people have forgotten the greatness that once was.'
        },
        {
            in: '0:19:26',
            out: '0:26:09',
            text: 'I still hear the whispers of our fallen glory, carried by the tales my mother and father passed down to me.'
        },
        {
            in: '0:27:76',
            out: '0:36:36',
            text: 'Today, Vaelior stands as the last true kingdom of our bloodline, yet I watch with a heavy heart as it begins to crumble from within.'
        },
        {
            in: '0:37:82',
            out: '0:41:77',
            text: 'I cannot bear to let our heritage fade into the shadows of history.'
        },
        {
            in: '0:42:79',
            out: '0:44:68',
            text: 'But what can one lone soul do?'
        },
        {
            in: '0:45:99',
            out: '0:47:70',
            text: 'The hourglass empties quickly.'
        },
        {
            in: '0:48:64',
            out: '0:59:38',
            text: 'Soon, even Vaelior will be swallowed whole by the dread invaders who seized our lands during the First Great Transition, the same dark beings who laid our countless kingdoms to ruin.'
        },
        {
            in: '1:00:91',
            out: '1:08:82',
            text: 'Is there no one left in this fractured realm—no noble heroes or sworn protectors—who still care for the Aidoriian people?'
        },
        {
            in: '1:09:64',
            out: '1:17:52',
            text: 'Is there anyone brave enough to champion our cause, preserve our history, and deliver us from the encroaching shadows?'
        }
    ]);

    const PROLOGUE_AUDIO_SRC = 'season/distressedwoman1.mp3';
    const PROLOGUE_NARRATION_VOLUME = 1;
    const PROLOGUE_MUSIC_VOLUME = 0.4;
    const PROLOGUE_MUSIC_PEAK_VOLUME = 1;
    /** Narration starts immediately; background music joins after this delay. */
    const PROLOGUE_MUSIC_DELAY_MS = 2000;
    /** Black screen hold after narration; music ramps during logo reveals, then Cascading Skies on Enter the War. */
    const PROLOGUE_TITLE_LOGO_REVEAL_MS = 6500;
    const TRAILER_TITLE_LOGO_REVEAL_MS = 9000;
    const PROLOGUE_SUBTITLE_LOGO_EXPLOSIVE_MS = 640;
    const PROLOGUE_SUBTITLE_LOGO_EXPLOSIVE_IMPACT = 0.18;
    const PROLOGUE_SUBTITLE_LOGO_EXPLOSIVE_BURST_SPARKS = 14;
    /** Wall-clock ms for Archimedes ramp from prologue level to peak during logo reveals. */
    const PROLOGUE_MUSIC_PEAK_RAMP_MS = 2800;
    const PROLOGUE_MUSIC_OUT_FADE_MS = 1200;
    const PROLOGUE_REVEAL_FADE_MS = 900;
    const PROLOGUE_LOGO_SRC = 'images/royalarmiestitle.png?v=logo-trim-gimp-1';
    const PROLOGUE_SUBTITLE_LOGO_SRC = 'season/royalarmiessubtitlelogo.png?v=age-subtitle-1';
    const PROLOGUE_LORE_TOOL_SRC = 'images/royalarmiesloretool.png?v=prologue-lore-tool-1';
    const TRAILER_GREENMASK_LOGO_SRC = 'images/greenmaskinteractivelogo.png?v=trailer-credits-2';
    const TRAILER_LORE_TOOL_PEAK_OPACITY = 0.35;
    const TRAILER_MAIN_FINALE_HOLD_MS = 11000;
    const TRAILER_CREDITS_TAGLINES_REVEAL_MS = 860;
    const TRAILER_CREDITS_MUSIC_END_BUFFER_MS = 350;
    const PROLOGUE_LORE_TOOL_FADE_MS = 12000;
    const PROLOGUE_SUBTITLE_LOGO_SFX_SRC = 'audio/explosionsfx.wav?v=prologue-explosion-1';
    const PROLOGUE_SUBTITLE_SPARK_INTERVAL_MS = 170;
    const PROLOGUE_SUBTITLE_SPARKS_PER_BURST = 5;
    const PROLOGUE_SUBTITLE_SPARK_FLASH_CHANCE = 0.24;
    const PROLOGUE_CINEMATIC_FADE_SEC = 1;
    /** Pan duration multiplier vs remaining shot time (1 = match, >1 = slower). */
    const PROLOGUE_CINEMATIC_PAN_DURATION_SCALE = 1.3;
    const PROLOGUE_CINEMATIC_IMAGE_VERSION = 'prologue-cine-1';
    /** Native cinematic still dimensions (images/cinematic*.png). Player frame matches this aspect. */
    const TRAILER_CINE_NATIVE_WIDTH = 1408;
    const TRAILER_CINE_NATIVE_HEIGHT = 768;
    /** Ken Burns zoom range in trailer replay (scale min + random * range). */
    const TRAILER_CINE_PAN_SCALE_MIN = 1.12;
    const TRAILER_CINE_PAN_SCALE_RANGE = 0.10;
    const TRAILER_POST_NARRATION_MS = TRAILER_TITLE_LOGO_REVEAL_MS
        + PROLOGUE_SUBTITLE_LOGO_EXPLOSIVE_MS
        + 600;
    const TRAILER_MUSIC_START_SEC = PROLOGUE_MUSIC_DELAY_MS / 1000;

    /**
     * Narration-synced stills (script timeline seconds). Times use M:SS:ff or SS:ff
     * where the last segment is hundredths of a second (17:50 = 17.5s, 1:18:00 = 78s).
     */
    const PROLOGUE_CINEMATIC_SHOT_MARKS = Object.freeze([
        { id: 1, in: '0:00', out: '9:00' },
        { id: 2, in: '10:00', out: '17:50' },
        { id: 3, in: '19:00', out: '26:50' },
        { id: 4, in: '27:50', out: '41:50' },
        { id: 6, in: '45:00', out: '59:00' },
        { id: 5, in: '1:00:50', out: '1:08:50' },
        { id: 7, in: '1:09:50', out: '1:18:00' }
    ]);

    function parseNarrationTimecode(timeToken) {
        const raw = String(timeToken || '').trim();
        if (!raw) return 0;

        const segments = raw.split(':').map((part) => {
            const num = Number(part);
            return Number.isFinite(num) ? num : 0;
        });

        if (segments.length >= 3) {
            const [minutes, seconds, fraction] = segments;
            return (minutes * 60) + seconds + (fraction / 100);
        }

        if (segments.length === 2) {
            return segments[0] + (segments[1] / 100);
        }

        return segments[0] || 0;
    }

    const PROLOGUE_CINEMATIC_SHOTS = Object.freeze(
        PROLOGUE_CINEMATIC_SHOT_MARKS.map((mark) => ({
            id: mark.id,
            src: `images/cinematic${mark.id}.png?v=${PROLOGUE_CINEMATIC_IMAGE_VERSION}`,
            scriptStart: parseNarrationTimecode(mark.in),
            scriptEnd: parseNarrationTimecode(mark.out)
        }))
    );

    let overlayEl = null;
    let subtitleEl = null;
    let cinematicShotEls = [];
    let audioEl = null;
    let subtitleLogoSfxEl = null;
    let subtitleSparkTimer = null;
    let logoRevealGeneration = 0;
    let enterWarGateResolver = null;
    let enterWarExitReason = null;
    let loreToolFadePromise = null;
    let isPlaying = false;
    let isPostNarrationHold = false;
    let isFadingOut = false;
    let musicDelayTimer = null;
    let subtitleSyncFrame = null;
    let cueTimelineScale = 1;
    let activeCueIndex = -1;
    let activeCinematicShotId = -1;
    let cinematicPanStyleCounter = 0;
    let finishCallback = null;
    let isTrailerFinaleLocked = false;
    let trailerFinaleSequenceStarted = false;
    let trailerFinaleSequencePromise = null;
    let trailerCreditsRunning = false;
    let trailerCreditsGeneration = 0;
    let isTrailerReplayMode = false;
    let isTrailerReplayPlaying = false;
    let trailerReplayTimeSec = 0;
    let trailerReplayFrame = null;
    let trailerImpactAudioUnlocked = false;
    let trailerOrientationBound = false;
    let trailerAutoplayQueued = false;
    let trailerSeekActive = false;
    let trailerSeekWasPlaying = false;
    let trailerMusicInitialized = false;
    let trailerReplayInterval = null;
    let trailerUserPausedPlayback = false;
    let trailerBackgroundGuardsBound = false;
    let trailerVisibilityKeepaliveBound = false;
    let trailerMediaSessionBound = false;
    let trailerControlsHideTimer = null;
    let trailerControlsViewportEl = null;
    const TRAILER_REPLAY_SYNC_MS = 250;
    const LOCAL_PROLOGUE_PENDING_KEY = 'royalArmies_localProloguePending';

    function canSyncPrologueTimeline() {
        return isPlaying || (isTrailerReplayMode && isTrailerReplayPlaying);
    }

    function canScrubTrailerTimeline() {
        return isTrailerReplayMode;
    }

    function getTrailerNarrationDurationSec() {
        if (audioEl && Number.isFinite(audioEl.duration) && audioEl.duration > 0) {
            return audioEl.duration;
        }

        return SCRIPT_TIMELINE_DURATION * (cueTimelineScale > 0 ? cueTimelineScale : 1);
    }

    function isTrailerNarrationComplete() {
        const narrationSec = getTrailerNarrationDurationSec();

        if (trailerReplayTimeSec >= narrationSec - 0.05) {
            return true;
        }

        if (!audioEl) {
            return false;
        }

        if (audioEl.ended) {
            return true;
        }

        if (Number.isFinite(audioEl.duration) && audioEl.duration > 0
            && audioEl.currentTime >= audioEl.duration - 0.05) {
            return true;
        }

        return false;
    }

    function isTrailerMobileDevice() {
        if (!isTrailerPage()) return false;
        if (global.matchMedia && global.matchMedia('(max-width: 900px)').matches) return true;
        return /Android|iPhone|iPad|iPod|Mobile/i.test(global.navigator.userAgent || '');
    }

    function isTrailerPortraitViewport() {
        return global.matchMedia
            ? global.matchMedia('(orientation: portrait)').matches
            : (global.innerHeight > global.innerWidth);
    }

    function getTrailerMusicAudio() {
        if (!global.RoyalArmiesMusicFlow
            || typeof global.RoyalArmiesMusicFlow.getAudioElement !== 'function') {
            return null;
        }
        return global.RoyalArmiesMusicFlow.getAudioElement();
    }

    function getTrailerMusicDurationSec() {
        const musicAudio = getTrailerMusicAudio();
        if (musicAudio && Number.isFinite(musicAudio.duration) && musicAudio.duration > 0) {
            return musicAudio.duration;
        }
        return 120;
    }

    function getTrailerLastCinematicEndSec() {
        const lastShot = PROLOGUE_CINEMATIC_SHOTS[PROLOGUE_CINEMATIC_SHOTS.length - 1];
        if (!lastShot) return getTrailerNarrationDurationSec();

        const scale = cueTimelineScale > 0 ? cueTimelineScale : 1;
        return lastShot.scriptEnd * scale;
    }

    function getTrailerFinaleStartSec() {
        return getTrailerLastCinematicEndSec();
    }

    function getTrailerFinaleEndSec() {
        return getTrailerFinaleStartSec() + (TRAILER_POST_NARRATION_MS / 1000);
    }

    function getTrailerMusicEndSec() {
        return TRAILER_MUSIC_START_SEC + getTrailerMusicDurationSec();
    }

    function getTrailerCreditsTimelineStartSec() {
        return getTrailerFinaleEndSec()
            + ((TRAILER_CREDITS_TAGLINES_REVEAL_MS + TRAILER_MAIN_FINALE_HOLD_MS) / 1000);
    }

    function isTrailerScrubPreview() {
        return trailerSeekActive;
    }

    function suspendTrailerFinaleSequencesForScrub() {
        resetTrailerCreditsState();
        logoRevealGeneration += 1;
        trailerCreditsGeneration += 1;
        resetTrailerFinaleSequenceState();
        isTrailerFinaleLocked = false;
        overlayEl?.classList.remove('is-trailer-finale-locked');
        clearEnterWarGate();
    }

    function setTrailerScrubPreviewActive(active) {
        overlayEl?.classList.toggle('is-trailer-scrubbing', Boolean(active));
    }

    function setTrailerOutroInstant(visible, taglinesVisible) {
        const outroEl = overlayEl?.querySelector('#game-opening-prologue-trailer-outro');
        if (!outroEl) return;

        if (!visible) {
            outroEl.hidden = true;
            outroEl.classList.remove('is-visible', 'is-taglines-visible');
            return;
        }

        outroEl.hidden = false;
        outroEl.classList.add('is-visible');
        outroEl.classList.toggle('is-taglines-visible', Boolean(taglinesVisible));
    }

    function resolveTrailerCreditsScrubTimings() {
        const fadeOutMainMs = 1500;
        const greenmaskInMs = 2200;
        const greenmaskOutMs = 1500;
        const alphaInMs = 2200;
        const alphaOutMs = 1800;
        const thanksInMs = 2000;
        const thanksOutMs = 1500;
        const creditsStartSec = getTrailerCreditsTimelineStartSec();
        const creditsEndSec = getTrailerMusicEndSec() - (TRAILER_CREDITS_MUSIC_END_BUFFER_MS / 1000);
        const creditsSpanMs = Math.max(10000, (creditsEndSec - creditsStartSec) * 1000);
        const fixedMs = fadeOutMainMs + greenmaskInMs + greenmaskOutMs + alphaInMs + alphaOutMs
            + thanksInMs + thanksOutMs;
        const holdBudgetMs = Math.max(3000, creditsSpanMs - fixedMs);

        return {
            fadeOutMainMs,
            greenmaskInMs,
            greenmaskHoldMs: Math.round(holdBudgetMs * 0.35),
            greenmaskOutMs,
            alphaInMs,
            alphaHoldMs: Math.round(holdBudgetMs * 0.5),
            alphaOutMs,
            thanksInMs,
            thanksHoldMs: Math.round(holdBudgetMs * 0.15),
            thanksOutMs,
        };
    }

    function applyTrailerMainFinaleScrubState() {
        if (!overlayEl) return;

        overlayEl.classList.add('is-trailer-finale-visible', 'is-logo-reveal-active');
        setSubtitleDockActive(false);

        const logoStage = overlayEl.querySelector('.game-opening-prologue-logo-stage');
        const logoStack = logoStage?.querySelector('.game-opening-prologue-logo-stack');
        const loreToolEl = overlayEl.querySelector('.game-opening-prologue-lore-tool');
        const creditsEl = overlayEl.querySelector('#game-opening-prologue-trailer-credits');

        logoStage?.classList.remove('is-trailer-main-finale-hidden');

        const titleLogoEl = overlayEl.querySelector('.game-opening-prologue-logo--title');
        if (titleLogoEl) {
            titleLogoEl.hidden = false;
            titleLogoEl.classList.remove('is-arriving', 'is-exploding');
            titleLogoEl.classList.add('is-arrived');
            titleLogoEl.style.removeProperty('transform');
            titleLogoEl.style.removeProperty('opacity');
            titleLogoEl.style.removeProperty('filter');
        }

        const subtitleLogoEl = overlayEl.querySelector('.game-opening-prologue-logo--subtitle');
        if (subtitleLogoEl) {
            subtitleLogoEl.hidden = false;
            subtitleLogoEl.classList.remove('is-arriving', 'is-exploding');
            subtitleLogoEl.classList.add('is-arrived');
            subtitleLogoEl.style.removeProperty('transform');
            subtitleLogoEl.style.removeProperty('opacity');
            subtitleLogoEl.style.removeProperty('filter');
            resetSubtitleLogoExplosionState(subtitleLogoEl);
        }

        if (logoStack) {
            logoStack.style.transition = 'none';
            logoStack.style.opacity = '1';
        }

        if (loreToolEl) {
            loreToolEl.classList.add('is-visible');
            loreToolEl.style.transition = 'none';
            loreToolEl.style.opacity = String(TRAILER_LORE_TOOL_PEAK_OPACITY);
        }

        setTrailerOutroInstant(true, true);

        if (creditsEl) {
            creditsEl.hidden = true;
            creditsEl.classList.remove('is-active');
            creditsEl.querySelectorAll('.game-opening-prologue-trailer-credits-panel').forEach((panel) => {
                panel.style.transition = 'none';
                panel.style.opacity = '0';
            });
        }
    }

    function applyTrailerCreditsScrubState(timeSec) {
        if (!overlayEl) return;

        const creditsStartSec = getTrailerCreditsTimelineStartSec();
        const elapsedMs = Math.max(0, (timeSec - creditsStartSec) * 1000);
        const timings = resolveTrailerCreditsScrubTimings();

        const logoStage = overlayEl.querySelector('.game-opening-prologue-logo-stage');
        const logoStack = logoStage?.querySelector('.game-opening-prologue-logo-stack');
        const loreToolEl = overlayEl.querySelector('.game-opening-prologue-lore-tool');
        const creditsEl = overlayEl.querySelector('#game-opening-prologue-trailer-credits');
        const greenmaskPanel = creditsEl?.querySelector('.game-opening-prologue-trailer-credits-panel--greenmask');
        const alphaPanel = creditsEl?.querySelector('.game-opening-prologue-trailer-credits-panel--alpha');
        const thanksPanel = creditsEl?.querySelector('.game-opening-prologue-trailer-credits-panel--thanks');

        overlayEl.classList.add('is-trailer-finale-visible', 'is-logo-reveal-active');
        setSubtitleDockActive(false);

        if (creditsEl) {
            creditsEl.hidden = false;
            creditsEl.classList.add('is-active');
        }

        const setMainFinaleOpacity = (opacity) => {
            const clamped = Math.max(0, Math.min(1, opacity));
            if (logoStack) {
                logoStack.style.transition = 'none';
                logoStack.style.opacity = String(clamped);
            }
            if (loreToolEl) {
                loreToolEl.style.transition = 'none';
                loreToolEl.classList.toggle('is-visible', clamped > 0.01);
                loreToolEl.style.opacity = String(TRAILER_LORE_TOOL_PEAK_OPACITY * clamped);
            }
            if (clamped <= 0.001) {
                logoStage?.classList.add('is-trailer-main-finale-hidden');
            } else {
                logoStage?.classList.remove('is-trailer-main-finale-hidden');
            }
        };

        const setPanelOpacity = (panel, opacity) => {
            if (!panel) return;
            panel.style.transition = 'none';
            panel.style.opacity = String(Math.max(0, Math.min(1, opacity)));
        };

        let cursorMs = 0;

        if (elapsedMs < timings.fadeOutMainMs) {
            setMainFinaleOpacity(1 - (elapsedMs / timings.fadeOutMainMs));
            setPanelOpacity(greenmaskPanel, 0);
            setPanelOpacity(alphaPanel, 0);
            setPanelOpacity(thanksPanel, 0);
            return;
        }

        cursorMs += timings.fadeOutMainMs;
        setMainFinaleOpacity(0);
        setTrailerOutroInstant(false, false);

        if (elapsedMs < cursorMs + timings.greenmaskInMs) {
            const t = (elapsedMs - cursorMs) / timings.greenmaskInMs;
            setPanelOpacity(greenmaskPanel, t);
            setPanelOpacity(alphaPanel, 0);
            return;
        }

        cursorMs += timings.greenmaskInMs;

        if (elapsedMs < cursorMs + timings.greenmaskHoldMs) {
            setPanelOpacity(greenmaskPanel, 1);
            setPanelOpacity(alphaPanel, 0);
            return;
        }

        cursorMs += timings.greenmaskHoldMs;

        if (elapsedMs < cursorMs + timings.greenmaskOutMs) {
            const t = (elapsedMs - cursorMs) / timings.greenmaskOutMs;
            setPanelOpacity(greenmaskPanel, 1 - t);
            setPanelOpacity(alphaPanel, 0);
            return;
        }

        cursorMs += timings.greenmaskOutMs;

        if (elapsedMs < cursorMs + timings.alphaInMs) {
            const t = (elapsedMs - cursorMs) / timings.alphaInMs;
            setPanelOpacity(greenmaskPanel, 0);
            setPanelOpacity(alphaPanel, t);
            return;
        }

        cursorMs += timings.alphaInMs;

        if (elapsedMs < cursorMs + timings.alphaHoldMs) {
            setPanelOpacity(greenmaskPanel, 0);
            setPanelOpacity(alphaPanel, 1);
            return;
        }

        cursorMs += timings.alphaHoldMs;

        if (elapsedMs < cursorMs + timings.alphaOutMs) {
            const t = (elapsedMs - cursorMs) / timings.alphaOutMs;
            setPanelOpacity(greenmaskPanel, 0);
            setPanelOpacity(alphaPanel, 1 - t);
            setPanelOpacity(thanksPanel, 0);
            return;
        }

        cursorMs += timings.alphaOutMs;

        if (elapsedMs < cursorMs + timings.thanksInMs) {
            const t = (elapsedMs - cursorMs) / timings.thanksInMs;
            setPanelOpacity(greenmaskPanel, 0);
            setPanelOpacity(alphaPanel, 0);
            setPanelOpacity(thanksPanel, t);
            return;
        }

        cursorMs += timings.thanksInMs;

        if (elapsedMs < cursorMs + timings.thanksHoldMs) {
            setPanelOpacity(greenmaskPanel, 0);
            setPanelOpacity(alphaPanel, 0);
            setPanelOpacity(thanksPanel, 1);
            return;
        }

        cursorMs += timings.thanksHoldMs;

        if (elapsedMs < cursorMs + timings.thanksOutMs) {
            const t = (elapsedMs - cursorMs) / timings.thanksOutMs;
            setPanelOpacity(greenmaskPanel, 0);
            setPanelOpacity(alphaPanel, 0);
            setPanelOpacity(thanksPanel, 1 - t);
            return;
        }

        setPanelOpacity(greenmaskPanel, 0);
        setPanelOpacity(alphaPanel, 0);
        setPanelOpacity(thanksPanel, 0);
    }

    function getTrailerTimelineDurationSec() {
        const narrationSec = getTrailerNarrationDurationSec();
        const finaleEnd = getTrailerFinaleEndSec();
        const musicEnd = TRAILER_MUSIC_START_SEC + getTrailerMusicDurationSec();
        return Math.max(finaleEnd, musicEnd, narrationSec + 1);
    }

    function getTrailerFullscreenElement() {
        return overlayEl?.querySelector('#game-opening-prologue-trailer-stage') || overlayEl;
    }

    function isTrailerFullscreenActive() {
        const target = getTrailerFullscreenElement();
        const active = global.document.fullscreenElement;
        return Boolean(target && active && (active === target || target.contains(active)));
    }

    async function requestTrailerLandscapeLock() {
        if (!isTrailerMobileDevice()) return;

        try {
            if (global.screen?.orientation?.lock) {
                await global.screen.orientation.lock('landscape');
            }
        } catch (_err) {
            /* iOS may require a user gesture + fullscreen first */
        }
    }

    function updateTrailerOrientationClasses() {
        if (!overlayEl || !isTrailerPage()) return;

        const mobile = isTrailerMobileDevice();
        const portrait = isTrailerPortraitViewport();
        overlayEl.classList.toggle('is-trailer-mobile', mobile);
        overlayEl.classList.toggle('is-trailer-portrait', portrait);
        global.document.body.classList.toggle('is-trailer-mobile-device', mobile);
        global.document.body.classList.toggle('is-trailer-portrait-viewport', portrait);
        overlayEl?.classList.toggle('is-trailer-player-fullscreen', isTrailerFullscreenActive());

        const fullscreenBtn = overlayEl.querySelector('#game-opening-prologue-trailer-fullscreen-btn');
        if (fullscreenBtn) {
            setTrailerControlButtonIcon(
                fullscreenBtn,
                isTrailerFullscreenActive() ? 'exitFullscreen' : 'fullscreen',
                isTrailerFullscreenActive() ? 'Exit fullscreen' : 'Fullscreen'
            );
        }
    }

    function bindTrailerOrientationListeners() {
        if (trailerOrientationBound || !isTrailerPage()) return;
        trailerOrientationBound = true;

        const onOrientationChange = () => updateTrailerOrientationClasses();
        if (global.matchMedia) {
            global.matchMedia('(orientation: portrait)').addEventListener('change', onOrientationChange);
            global.matchMedia('(orientation: landscape)').addEventListener('change', onOrientationChange);
            global.matchMedia('(max-width: 900px)').addEventListener('change', onOrientationChange);
        }
        global.addEventListener('resize', onOrientationChange);
        global.document.addEventListener('fullscreenchange', onOrientationChange);
    }

    function mountTrailerPlayerLayout() {
        if (!overlayEl) return;

        const playerEl = overlayEl.querySelector('#game-opening-prologue-trailer-player');
        const stageEl = overlayEl.querySelector('#game-opening-prologue-trailer-stage');
        const viewportEl = overlayEl.querySelector('#game-opening-prologue-trailer-viewport');
        const finalePaneEl = overlayEl.querySelector('#game-opening-prologue-trailer-finale-pane');
        const cinematicStageEl = overlayEl.querySelector('.game-opening-prologue-cinematic-stage');
        const logoStageEl = overlayEl.querySelector('.game-opening-prologue-logo-stage');

        if (playerEl && stageEl && playerEl.parentElement === overlayEl) {
            overlayEl.appendChild(playerEl);
        }

        if (cinematicStageEl && viewportEl && cinematicStageEl.parentElement !== viewportEl) {
            viewportEl.insertBefore(cinematicStageEl, viewportEl.firstChild);
        }

        if (logoStageEl && finalePaneEl && logoStageEl.parentElement !== finalePaneEl) {
            finalePaneEl.appendChild(logoStageEl);
        }

        if (finalePaneEl && viewportEl && finalePaneEl.parentElement !== viewportEl) {
            viewportEl.appendChild(finalePaneEl);
        }

        const controlsEl = overlayEl.querySelector('.game-opening-prologue-trailer-controls');
        if (controlsEl && viewportEl) {
            viewportEl.appendChild(controlsEl);
        }

        reparentTrailerSubtitleDockForPlayer();
        refreshSubtitleElements();
        bindTrailerPlayerControls();
    }

    function resetTrailerFinaleSequenceState() {
        trailerFinaleSequenceStarted = false;
        trailerFinaleSequencePromise = null;
        isPostNarrationHold = false;
    }

    function cancelTrailerFinaleSequenceForScrub() {
        resetTrailerCreditsState();

        if (!trailerFinaleSequenceStarted && !isPostNarrationHold && !isTrailerFinaleLocked) return;

        resetTrailerFinaleSequenceState();
        clearLogoReveal();
        hideTrailerOutro();
        resetLoreToolBackdrop();
    }

    async function beginTrailerFinaleSequence() {
        if (!isTrailerReplayMode || trailerFinaleSequenceStarted) {
            return trailerFinaleSequencePromise || Promise.resolve();
        }

        trailerFinaleSequenceStarted = true;
        isPostNarrationHold = true;

        overlayEl?.classList.add('is-trailer-finale-visible', 'is-logo-reveal-active');
        setSubtitleDockActive(false);
        audioEl?.pause();
        mountTrailerPlayerLayout();

        trailerFinaleSequencePromise = (async () => {
            try {
                await fadeOutTrailerLastCinematicShotIfNeeded();
                await fadeOutCinematicChromeIfNeeded();
                clearCinematicShots();
                overlayEl?.classList.remove('is-cinematics-active');
                clearSubtitlesForPostNarrationHold();

                const musicRamp = global.RoyalArmiesMusicFlow
                    && typeof global.RoyalArmiesMusicFlow.rampMusicVolume === 'function'
                    ? global.RoyalArmiesMusicFlow.rampMusicVolume(
                        PROLOGUE_MUSIC_VOLUME,
                        PROLOGUE_MUSIC_PEAK_VOLUME,
                        PROLOGUE_MUSIC_PEAK_RAMP_MS
                    )
                    : Promise.resolve();

                await Promise.all([
                    runSequentialLogoReveal(),
                    musicRamp
                ]);

                if (!trailerFinaleSequenceStarted || !isTrailerReplayMode) return;

                await waitForEnterWarGate(logoRevealGeneration);
            } finally {
                if (trailerFinaleSequenceStarted) {
                    isPostNarrationHold = false;
                }
            }
        })();

        return trailerFinaleSequencePromise;
    }

    function applyTrailerFinaleProgress(progress, options) {
        const opts = options && typeof options === 'object' ? options : {};
        const scrubbing = Boolean(opts.scrub);
        const p = Math.max(0, Math.min(1, Number(progress) || 0));
        const titleLogoEl = overlayEl?.querySelector('.game-opening-prologue-logo--title');
        const subtitleLogoEl = overlayEl?.querySelector('.game-opening-prologue-logo--subtitle');
        const loreToolEl = overlayEl?.querySelector('.game-opening-prologue-lore-tool');
        const outroEl = overlayEl?.querySelector('#game-opening-prologue-trailer-outro');
        const titlePhaseEnd = TRAILER_TITLE_LOGO_REVEAL_MS / TRAILER_POST_NARRATION_MS;

        overlayEl?.classList.add('is-logo-reveal-active');

        if (scrubbing) {
            const logoStage = overlayEl?.querySelector('.game-opening-prologue-logo-stage');
            const logoStack = logoStage?.querySelector('.game-opening-prologue-logo-stack');
            const creditsEl = overlayEl?.querySelector('#game-opening-prologue-trailer-credits');

            logoStage?.classList.remove('is-trailer-main-finale-hidden');
            if (logoStack) {
                logoStack.style.transition = 'none';
                logoStack.style.opacity = '1';
            }
            if (creditsEl) {
                creditsEl.hidden = true;
                creditsEl.classList.remove('is-active');
            }
        }

        if (p <= 0.001) {
            overlayEl?.classList.remove('is-trailer-finale-visible');
            return;
        }

        overlayEl?.classList.add('is-trailer-finale-visible');

        if (titleLogoEl) {
            titleLogoEl.hidden = false;
            titleLogoEl.classList.remove('is-exploding');
            if (p >= titlePhaseEnd) {
                titleLogoEl.classList.remove('is-arriving');
                titleLogoEl.classList.add('is-arrived');
                titleLogoEl.style.removeProperty('transform');
                titleLogoEl.style.removeProperty('opacity');
                titleLogoEl.style.removeProperty('filter');
            } else {
                titleLogoEl.classList.add('is-arrived');
            }
        }

        if (p >= titlePhaseEnd) {
            if (subtitleLogoEl) {
                subtitleLogoEl.hidden = false;
                subtitleLogoEl.classList.remove('is-arriving', 'is-exploding');
                subtitleLogoEl.classList.add('is-arrived');
            }
            if (loreToolEl) {
                const loreProgress = Math.min(1, (p - titlePhaseEnd) / Math.max(0.001, 1 - titlePhaseEnd));
                loreToolEl.classList.toggle('is-visible', loreProgress > 0.12);
                if (scrubbing) {
                    loreToolEl.style.transition = 'none';
                }
                loreToolEl.style.opacity = String(
                    Math.min(TRAILER_LORE_TOOL_PEAK_OPACITY, loreProgress * TRAILER_LORE_TOOL_PEAK_OPACITY)
                );
            }
            if (outroEl && p > titlePhaseEnd + 0.12) {
                if (scrubbing) {
                    setTrailerOutroInstant(true, p > titlePhaseEnd + 0.2);
                } else {
                    outroEl.hidden = false;
                    outroEl.classList.add('is-visible', 'is-taglines-visible');
                }
            } else if (scrubbing) {
                setTrailerOutroInstant(false, false);
            }
        } else if (subtitleLogoEl) {
            subtitleLogoEl.hidden = true;
        }

        if (p >= 0.98) {
            ensureTrailerFinaleDomVisible();
        }
    }

    function pauseTrailerMusicPlayback() {
        const musicAudio = getTrailerMusicAudio();
        if (musicAudio) musicAudio.pause();
    }

    function syncTrailerPlaybackClock() {
        const narrationSec = getTrailerNarrationDurationSec();
        const finaleStart = getTrailerFinaleStartSec();
        const finaleEnd = getTrailerFinaleEndSec();
        const totalSec = getTrailerTimelineDurationSec();
        const musicAudio = getTrailerMusicAudio();
        const narrationDone = isTrailerNarrationComplete();

        if (!narrationDone && trailerReplayTimeSec < narrationSec - 0.03) {
            const audioClock = Number(audioEl?.currentTime);
            if (Number.isFinite(audioClock)) {
                if (audioClock >= 0.03 || trailerReplayTimeSec < 0.03) {
                    trailerReplayTimeSec = Math.max(trailerReplayTimeSec, audioClock);
                }
            }
            return;
        }

        if (narrationDone && trailerReplayTimeSec < finaleStart - 0.03) {
            trailerReplayTimeSec = Math.max(trailerReplayTimeSec, finaleStart);
        }

        if (trailerReplayTimeSec < finaleEnd) {
            if (musicAudio && !musicAudio.paused) {
                trailerReplayTimeSec = Math.min(finaleEnd, TRAILER_MUSIC_START_SEC + (musicAudio.currentTime || 0));
            }
            return;
        }

        if (musicAudio && !musicAudio.paused) {
            trailerReplayTimeSec = Math.min(totalSec, TRAILER_MUSIC_START_SEC + (musicAudio.currentTime || 0));
        }
    }

    function formatTrailerClock(totalSec) {
        const safe = Math.max(0, Number(totalSec) || 0);
        const minutes = Math.floor(safe / 60);
        const seconds = Math.floor(safe % 60);
        return `${minutes}:${String(seconds).padStart(2, '0')}`;
    }

    function unlockTrailerImpactAudio() {
        if (!isTrailerPage() || trailerImpactAudioUnlocked) return;

        const sfx = ensureSubtitleLogoSfx();
        trailerImpactAudioUnlocked = true;
        sfx.volume = 0.001;
        sfx.play()
            .then(() => {
                sfx.pause();
                sfx.currentTime = 0;
                sfx.volume = 1;
            })
            .catch(() => {
                sfx.volume = 1;
            });
    }

    function syncTrailerMusicToTimeline(timeSec, options) {
        if (!global.RoyalArmiesMusicFlow
            || typeof global.RoyalArmiesMusicFlow.getAudioElement !== 'function') {
            return;
        }

        const musicAudio = global.RoyalArmiesMusicFlow.getAudioElement();
        if (!musicAudio) return;

        const opts = options && typeof options === 'object' ? options : {};
        const musicTime = Math.max(0, timeSec - TRAILER_MUSIC_START_SEC);
        const targetTime = Number.isFinite(musicAudio.duration) && musicAudio.duration > 0
            ? Math.min(musicAudio.duration - 0.01, musicTime)
            : musicTime;

        if (!opts.force) {
            const drift = Math.abs((musicAudio.currentTime || 0) - targetTime);
            if (drift < 0.15) return;
        }

        musicAudio.currentTime = targetTime;
    }

    function ensureTrailerMusicReady(options) {
        const opts = options && typeof options === 'object' ? options : {};
        const musicAudio = getTrailerMusicAudio();
        const canReuse = Boolean(
            trailerMusicInitialized
            && musicAudio
            && musicAudio.readyState >= 1
            && !opts.forceInit
        );

        if (canReuse) {
            musicAudio.volume = PROLOGUE_MUSIC_VOLUME;
            musicAudio.muted = false;
            ensureTrailerMusicPauseGuard();
            return musicAudio;
        }

        ensurePrologueBackgroundMusic({ resetTime: opts.resetTime !== false });
        trailerMusicInitialized = true;
        ensureTrailerMusicPauseGuard();
        return getTrailerMusicAudio();
    }

    function playTrailerNarrationAtTime(timeSec) {
        if (!audioEl) return Promise.resolve();

        const narrationSec = getTrailerNarrationDurationSec();
        const target = Math.max(0, Math.min(narrationSec, Number(timeSec) || 0));
        audioEl.currentTime = target;
        return audioEl.play().catch(() => {});
    }

    function playTrailerMusicAtTime(timeSec) {
        const musicAudio = getTrailerMusicAudio();
        if (!musicAudio) return Promise.resolve();

        syncTrailerMusicToTimeline(timeSec, { force: true });
        return musicAudio.play().catch(() => {});
    }

    function resumeTrailerTimelineMedia(timeSec) {
        const finaleStart = getTrailerFinaleStartSec();
        const musicAudio = ensureTrailerMusicReady({ resetTime: false });

        applyTrailerTimelinePosition(timeSec, { syncMusic: true, seekMedia: true });

        if (timeSec < finaleStart - 0.03) {
            overlayEl?.classList.remove('is-trailer-finale-visible');
            setSubtitleDockActive(true);
            unlockTrailerImpactAudio();
            playTrailerNarrationAtTime(timeSec);
            syncTrailerMusicToTimeline(timeSec, { force: true });
            if (timeSec >= TRAILER_MUSIC_START_SEC - 0.03) {
                playTrailerMusicAtTime(timeSec);
            } else {
                musicAudio?.pause();
            }
        } else {
            audioEl?.pause();
            syncTrailerMusicToTimeline(timeSec, { force: true });
            playTrailerMusicAtTime(timeSec);
        }
    }

    function pauseTrailerReplayAtEnd() {
        const totalSec = getTrailerTimelineDurationSec();

        isTrailerReplayPlaying = false;
        trailerReplayTimeSec = totalSec;
        applyTrailerTimelinePosition(totalSec, { syncMusic: true, seekMedia: true });
        pauseTrailerMusicPlayback();
        audioEl?.pause();
        stopTrailerReplaySyncLoop();
        updateTrailerPlayerUi();
        updateTrailerMediaSession();
    }

    function ensureTrailerFinaleDomVisible() {
        if (!overlayEl) return;

        const titleLogoEl = overlayEl.querySelector('.game-opening-prologue-logo--title');
        const subtitleLogoEl = overlayEl.querySelector('.game-opening-prologue-logo--subtitle');
        const loreToolEl = overlayEl.querySelector('.game-opening-prologue-lore-tool');
        const outroEl = overlayEl.querySelector('#game-opening-prologue-trailer-outro');

        overlayEl.classList.add('is-logo-reveal-active', 'is-trailer-finale-visible');

        if (titleLogoEl) {
            titleLogoEl.hidden = false;
            titleLogoEl.classList.remove('is-arriving', 'is-exploding');
            titleLogoEl.classList.add('is-arrived');
            titleLogoEl.style.removeProperty('transform');
            titleLogoEl.style.removeProperty('opacity');
            titleLogoEl.style.removeProperty('filter');
        }

        if (subtitleLogoEl) {
            subtitleLogoEl.hidden = false;
            subtitleLogoEl.classList.remove('is-arriving', 'is-exploding');
            subtitleLogoEl.classList.add('is-arrived');
            subtitleLogoEl.style.removeProperty('transform');
            subtitleLogoEl.style.removeProperty('opacity');
            subtitleLogoEl.style.removeProperty('filter');
            resetSubtitleLogoExplosionState(subtitleLogoEl);
        }

        if (loreToolEl) {
            loreToolEl.classList.add('is-visible');
            loreToolEl.style.opacity = String(TRAILER_LORE_TOOL_MAX_OPACITY);
        }

        if (outroEl) {
            outroEl.hidden = false;
            outroEl.classList.add('is-visible', 'is-taglines-visible');
        }
    }

    function lockTrailerFinaleVisuals() {
        if (!isTrailerPage()) return;

        isTrailerFinaleLocked = true;
        overlayEl?.classList.add('is-trailer-finale-locked');
        ensureTrailerFinaleDomVisible();
        showTrailerOutro();
    }

    function reparentTrailerSubtitleDockForPlayer() {
        const frameEl = overlayEl?.querySelector('.game-opening-prologue-cinematic-frame');
        const dock = overlayEl?.querySelector('.game-opening-prologue-subtitle-dock');
        if (frameEl && dock && dock.parentElement !== frameEl) {
            frameEl.appendChild(dock);
        }
        dock?.classList.add('is-trailer-player-dock');
    }

    function updateTrailerPlayerUi() {
        const seekEl = overlayEl?.querySelector('#game-opening-prologue-trailer-seek');
        const timeEl = overlayEl?.querySelector('#game-opening-prologue-trailer-time');
        const playBtn = overlayEl?.querySelector('#game-opening-prologue-trailer-play-btn');
        const totalSec = getTrailerTimelineDurationSec();
        const progress = totalSec > 0 ? Math.min(1, trailerReplayTimeSec / totalSec) : 0;

        if (seekEl && seekEl !== global.document.activeElement) {
            seekEl.value = String(Math.round(progress * 1000));
        }
        if (timeEl) {
            timeEl.textContent = `${formatTrailerClock(trailerReplayTimeSec)} / ${formatTrailerClock(totalSec)}`;
        }
        if (playBtn) {
            setTrailerControlButtonIcon(
                playBtn,
                isTrailerReplayPlaying ? 'pause' : 'play',
                isTrailerReplayPlaying ? 'Pause' : 'Play'
            );
        }

        const viewportEl = overlayEl?.querySelector('#game-opening-prologue-trailer-viewport');
        if (viewportEl) {
            viewportEl.classList.toggle('is-trailer-controls-pinned', !isTrailerReplayPlaying);
        }
    }

    function blurTrailerControlsFocus() {
        const active = global.document.activeElement;
        if (active?.closest?.('.game-opening-prologue-trailer-controls')) {
            active.blur();
        }
    }

    function showTrailerControls() {
        if (!trailerControlsViewportEl) return;

        if (trailerControlsHideTimer) {
            global.clearTimeout(trailerControlsHideTimer);
            trailerControlsHideTimer = null;
        }

        trailerControlsViewportEl.classList.add('is-trailer-controls-hot');
    }

    function scheduleHideTrailerControls(delayMs) {
        if (!trailerControlsViewportEl || !isTrailerReplayPlaying) return;

        if (trailerControlsHideTimer) {
            global.clearTimeout(trailerControlsHideTimer);
        }

        trailerControlsHideTimer = global.setTimeout(() => {
            trailerControlsHideTimer = null;
            const seekEl = trailerControlsViewportEl?.querySelector('#game-opening-prologue-trailer-seek');
            if (!isTrailerReplayPlaying || seekEl === global.document.activeElement) return;

            blurTrailerControlsFocus();
            trailerControlsViewportEl?.classList.remove('is-trailer-controls-hot');
        }, delayMs || 900);
    }

    function bindTrailerControlsHover(viewportEl, controlsEl, seekEl) {
        if (!viewportEl || viewportEl.dataset.riftControlsHoverBound === '1') return;
        viewportEl.dataset.riftControlsHoverBound = '1';

        trailerControlsViewportEl = viewportEl;

        const stageEl = overlayEl?.querySelector('#game-opening-prologue-trailer-stage') || viewportEl;
        const hoverSurfaceEl = stageEl;
        const bottomHoverPx = 132;

        const handlePointerActivity = (event) => {
            const rect = viewportEl.getBoundingClientRect();
            const inBottomBand = event.clientY >= rect.bottom - bottomHoverPx
                && event.clientX >= rect.left
                && event.clientX <= rect.right;
            const overControls = Boolean(
                controlsEl?.contains(event.target)
                || event.target.closest?.('.game-opening-prologue-trailer-controls')
            );

            if (inBottomBand || overControls) {
                showTrailerControls();
                if (isTrailerReplayPlaying && !overControls && !seekEl?.matches(':active')) {
                    scheduleHideTrailerControls(1400);
                }
            } else if (isTrailerReplayPlaying) {
                scheduleHideTrailerControls();
            }
        };

        hoverSurfaceEl.addEventListener('mousemove', handlePointerActivity);
        hoverSurfaceEl.addEventListener('mouseleave', () => {
            if (trailerControlsHideTimer) {
                global.clearTimeout(trailerControlsHideTimer);
                trailerControlsHideTimer = null;
            }
            if (!isTrailerReplayPlaying) return;
            blurTrailerControlsFocus();
            viewportEl.classList.remove('is-trailer-controls-hot');
        });

        controlsEl?.addEventListener('mouseenter', () => {
            showTrailerControls();
            if (trailerControlsHideTimer) {
                global.clearTimeout(trailerControlsHideTimer);
                trailerControlsHideTimer = null;
            }
        });
        controlsEl?.addEventListener('mouseleave', (event) => {
            if (controlsEl.contains(event.relatedTarget)) return;
            if (!isTrailerReplayPlaying) return;
            scheduleHideTrailerControls(1400);
        });

        controlsEl?.addEventListener('pointerenter', () => {
            showTrailerControls();
        });
        controlsEl?.addEventListener('pointerleave', (event) => {
            if (controlsEl.contains(event.relatedTarget)) return;
            if (!isTrailerReplayPlaying) return;
            scheduleHideTrailerControls(1400);
        });

        seekEl?.addEventListener('pointerdown', showTrailerControls);
        seekEl?.addEventListener('focus', showTrailerControls);
        seekEl?.addEventListener('blur', () => {
            if (!isTrailerReplayPlaying) return;
            scheduleHideTrailerControls();
        });

        if (isTrailerMobileDevice()) {
            hoverSurfaceEl.addEventListener('touchstart', () => {
                showTrailerControls();
                scheduleHideTrailerControls();
            }, { passive: true });
        }

        global.document.addEventListener('fullscreenchange', () => {
            if (!isTrailerReplayMode || !isTrailerReplayPlaying) return;
            scheduleHideTrailerControls(120);
        });
    }

    function applyTrailerTimelinePosition(timeSec, options) {
        if (!isTrailerReplayMode || !overlayEl) return;

        const opts = options && typeof options === 'object' ? options : {};
        const seekMedia = opts.seekMedia !== false;
        const scrubbing = Boolean(opts.scrubbing) || isTrailerScrubPreview();
        const narrationSec = getTrailerNarrationDurationSec();
        const finaleStart = getTrailerFinaleStartSec();
        const finaleEnd = getTrailerFinaleEndSec();
        const creditsStart = getTrailerCreditsTimelineStartSec();
        const totalSec = getTrailerTimelineDurationSec();
        const clamped = Math.max(0, Math.min(totalSec, Number(timeSec) || 0));
        trailerReplayTimeSec = clamped;

        setTrailerScrubPreviewActive(scrubbing && seekMedia);

        if (clamped < finaleStart - 0.03) {
            if (trailerFinaleSequenceStarted || isPostNarrationHold || isTrailerFinaleLocked) {
                cancelTrailerFinaleSequenceForScrub();
                isTrailerFinaleLocked = false;
                overlayEl.classList.remove(
                    'is-trailer-finale-locked',
                    'is-trailer-finale-visible',
                    'is-logo-reveal-active'
                );
            }

            overlayEl.classList.remove('is-trailer-finale-visible');
            overlayEl.classList.add('is-cinematics-active');
            setSubtitleDockActive(true);

            if (audioEl && seekMedia) {
                audioEl.currentTime = clamped;
            }

            if (seekMedia && !scrubbing) {
                cinematicShotEls.forEach((shotEl) => shotEl.removeAttribute('data-pan-bound'));
            }

            syncSubtitleToAudioTime(true);
            syncCinematicToAudioTime(true, { scrub: scrubbing && seekMedia });
        } else if (clamped < creditsStart) {
            overlayEl.classList.add('is-trailer-finale-visible');
            setSubtitleDockActive(false);

            if (audioEl && seekMedia) {
                audioEl.pause();
                audioEl.currentTime = Math.max(0, narrationSec - 0.02);
            }

            const finaleProgress = (clamped - finaleStart) / Math.max(0.001, finaleEnd - finaleStart);

            if (seekMedia) {
                overlayEl.classList.remove('is-cinematics-active');
                clearCinematicShots();

                if (scrubbing) {
                    suspendTrailerFinaleSequencesForScrub();
                    if (clamped < finaleEnd) {
                        applyTrailerFinaleProgress(finaleProgress, { scrub: true });
                    } else {
                        applyTrailerMainFinaleScrubState();
                    }
                } else {
                    cancelTrailerFinaleSequenceForScrub();
                    applyTrailerFinaleProgress(finaleProgress);
                    if (finaleProgress >= 0.98) {
                        ensureTrailerFinaleDomVisible();
                    }
                }
            } else if (!trailerFinaleSequenceStarted && isTrailerReplayPlaying) {
                void beginTrailerFinaleSequence();
            } else if (!trailerFinaleSequenceStarted) {
                overlayEl.classList.remove('is-cinematics-active');
                clearCinematicShots();
                applyTrailerFinaleProgress(finaleProgress);
            }
        } else {
            overlayEl.classList.add('is-trailer-finale-visible');
            setSubtitleDockActive(false);

            if (audioEl && seekMedia) {
                audioEl.pause();
                audioEl.currentTime = Math.max(0, narrationSec - 0.02);
            }

            if (seekMedia) {
                overlayEl.classList.remove('is-cinematics-active');
                clearCinematicShots();

                if (scrubbing) {
                    suspendTrailerFinaleSequencesForScrub();
                    applyTrailerCreditsScrubState(clamped);
                } else {
                    cancelTrailerFinaleSequenceForScrub();
                    ensureTrailerFinaleDomVisible();
                    lockTrailerFinaleVisuals();
                }
            } else if (!trailerFinaleSequenceStarted && isTrailerReplayPlaying) {
                void beginTrailerFinaleSequence();
            } else if (!trailerFinaleSequenceStarted && !isTrailerFinaleLocked) {
                overlayEl.classList.remove('is-cinematics-active');
                clearCinematicShots();
                ensureTrailerFinaleDomVisible();
            }
        }

        if (opts.syncMusic !== false) {
            syncTrailerMusicToTimeline(clamped, { force: seekMedia });
        }

        updateTrailerPlayerUi();
        if (!scrubbing) {
            updateTrailerOrientationClasses();
        }
    }

    function shouldKeepTrailerMediaPlaying() {
        return isTrailerReplayMode
            && isTrailerReplayPlaying
            && !trailerUserPausedPlayback
            && !trailerSeekActive;
    }

    function resumeTrailerMediaIfInterrupted() {
        if (!shouldKeepTrailerMediaPlaying()) return;

        const totalSec = getTrailerTimelineDurationSec();
        const finaleStart = getTrailerFinaleStartSec();
        const musicAudio = getTrailerMusicAudio();
        const narrationDone = isTrailerNarrationComplete();
        const pastNarrationPhase = narrationDone || trailerReplayTimeSec >= finaleStart - 0.03;

        if (!pastNarrationPhase) {
            if (audioEl?.paused && !audioEl.ended) {
                audioEl.play().catch(() => {});
            }
            if (trailerReplayTimeSec >= TRAILER_MUSIC_START_SEC - 0.03
                && trailerReplayTimeSec < totalSec - 0.03
                && musicAudio?.paused) {
                syncTrailerMusicToTimeline(trailerReplayTimeSec, { force: true });
                musicAudio.play().catch(() => {});
            }
        } else if (musicAudio?.paused && trailerReplayTimeSec < totalSec - 0.03) {
            syncTrailerMusicToTimeline(trailerReplayTimeSec, { force: true });
            musicAudio.play().catch(() => {});
        }
    }

    function handleTrailerNarrationEnded() {
        if (!isTrailerReplayMode || !isTrailerReplayPlaying) return;

        const narrationSec = getTrailerNarrationDurationSec();
        const finaleStart = getTrailerFinaleStartSec();
        trailerReplayTimeSec = Math.max(trailerReplayTimeSec, finaleStart, narrationSec - 0.02);

        if (audioEl) {
            audioEl.pause();
            audioEl.currentTime = Math.max(0, narrationSec - 0.02);
        }

        applyTrailerTimelinePosition(trailerReplayTimeSec, { syncMusic: false, seekMedia: false });
    }

    function bindTrailerMediaPauseGuard(mediaEl) {
        if (!mediaEl || mediaEl.dataset.riftTrailerPauseGuard === '1') return;
        mediaEl.dataset.riftTrailerPauseGuard = '1';
        mediaEl.addEventListener('pause', () => {
            global.setTimeout(() => {
                resumeTrailerMediaIfInterrupted();
            }, 0);
        });
    }

    function bindTrailerBackgroundPlaybackGuards() {
        if (!isTrailerPage() || trailerBackgroundGuardsBound) return;
        trailerBackgroundGuardsBound = true;

        bindTrailerMediaPauseGuard(audioEl);
        bindTrailerMediaPauseGuard(getTrailerMusicAudio());

        if (audioEl && audioEl.dataset.riftTrailerNarrationEndedBound !== '1') {
            audioEl.dataset.riftTrailerNarrationEndedBound = '1';
            audioEl.addEventListener('ended', handleTrailerNarrationEnded);
        }
    }

    function ensureTrailerMusicPauseGuard() {
        bindTrailerMediaPauseGuard(getTrailerMusicAudio());
    }

    function updateTrailerMediaSession() {
        if (!('mediaSession' in global.navigator)) return;

        try {
            if (shouldKeepTrailerMediaPlaying()) {
                global.navigator.mediaSession.playbackState = 'playing';
                global.navigator.mediaSession.metadata = new global.MediaMetadata({
                    title: 'Age of War — Opening Trailer',
                    artist: 'Royal Armies',
                });
            } else if (isTrailerReplayMode) {
                global.navigator.mediaSession.playbackState = 'paused';
            }
        } catch (_err) {
            /* ignore */
        }
    }

    function bindTrailerMediaSession() {
        if (!('mediaSession' in global.navigator) || trailerMediaSessionBound) return;
        trailerMediaSessionBound = true;

        try {
            global.navigator.mediaSession.setActionHandler('play', () => {
                if (!isTrailerReplayPlaying) {
                    void tryStartTrailerPlaybackWithOrientation();
                }
            });
            global.navigator.mediaSession.setActionHandler('pause', () => {
                if (isTrailerReplayPlaying) {
                    pauseTrailerReplayPlayback();
                }
            });
        } catch (_err) {
            /* ignore */
        }
    }

    function bindTrailerVisibilityKeepalive() {
        if (trailerVisibilityKeepaliveBound) return;
        trailerVisibilityKeepaliveBound = true;

        global.document.addEventListener('visibilitychange', () => {
            if (!isTrailerReplayMode || !isTrailerReplayPlaying) return;

            if (global.document.visibilityState === 'hidden') {
                resumeTrailerMediaIfInterrupted();
                if (!trailerReplayInterval && isTrailerReplayPlaying) {
                    stopTrailerReplaySyncLoop();
                    startTrailerReplaySyncLoop();
                }
                return;
            }

            syncTrailerPlaybackClock();
            applyTrailerTimelinePosition(trailerReplayTimeSec, { syncMusic: false, seekMedia: false });
            resumeTrailerMediaIfInterrupted();
            if (!trailerReplayFrame && !trailerReplayInterval) {
                startTrailerReplaySyncLoop();
            } else if (trailerReplayInterval && global.document.visibilityState === 'visible') {
                stopTrailerReplaySyncLoop();
                startTrailerReplaySyncLoop();
            }
        });

        global.addEventListener('pageshow', (event) => {
            if (!event.persisted || !isTrailerReplayMode || !isTrailerReplayPlaying) return;

            syncTrailerPlaybackClock();
            applyTrailerTimelinePosition(trailerReplayTimeSec, { syncMusic: false, seekMedia: false });
            resumeTrailerMediaIfInterrupted();
            startTrailerReplaySyncLoop();
        });
    }

    function stopTrailerReplaySyncLoop() {
        if (trailerReplayFrame) {
            global.cancelAnimationFrame(trailerReplayFrame);
            trailerReplayFrame = null;
        }
        if (trailerReplayInterval) {
            global.clearInterval(trailerReplayInterval);
            trailerReplayInterval = null;
        }
    }

    function startTrailerReplaySyncLoop() {
        stopTrailerReplaySyncLoop();

        const tick = () => {
            if (!isTrailerReplayMode || !isTrailerReplayPlaying) return;

            const totalSec = getTrailerTimelineDurationSec();
            syncTrailerPlaybackClock();
            applyTrailerTimelinePosition(trailerReplayTimeSec, { syncMusic: false, seekMedia: false });

            resumeTrailerMediaIfInterrupted();

            if (trailerReplayTimeSec < getTrailerFinaleStartSec() - 0.03) {
                syncSubtitleToAudioTime(true);
                syncCinematicToAudioTime(true);
            } else if (audioEl && !audioEl.paused) {
                audioEl.pause();
            }

            updateTrailerPlayerUi();
            updateTrailerMediaSession();

            if (trailerReplayTimeSec >= totalSec - 0.03) {
                pauseTrailerReplayAtEnd();
            }
        };

        const scheduleVisibleLoop = () => {
            trailerReplayFrame = global.requestAnimationFrame(() => {
                if (!isTrailerReplayMode || !isTrailerReplayPlaying) return;

                if (global.document.visibilityState === 'hidden') {
                    stopTrailerReplaySyncLoop();
                    trailerReplayInterval = global.setInterval(tick, TRAILER_REPLAY_SYNC_MS);
                    return;
                }

                tick();
                if (isTrailerReplayMode && isTrailerReplayPlaying) {
                    scheduleVisibleLoop();
                }
            });
        };

        tick();

        if (global.document.visibilityState === 'hidden') {
            trailerReplayInterval = global.setInterval(tick, TRAILER_REPLAY_SYNC_MS);
        } else {
            scheduleVisibleLoop();
        }
    }

    function beginTrailerSeek() {
        if (trailerSeekActive) return;

        trailerSeekActive = true;
        trailerSeekWasPlaying = isTrailerReplayPlaying;

        if (isTrailerReplayPlaying) {
            isTrailerReplayPlaying = false;
            audioEl?.pause();
            pauseTrailerMusicPlayback();
            stopTrailerReplaySyncLoop();
            updateTrailerPlayerUi();
        }
    }

    function finishTrailerSeek() {
        if (!trailerSeekActive) return;

        trailerSeekActive = false;
        const shouldResume = trailerSeekWasPlaying;
        trailerSeekWasPlaying = false;
        setTrailerScrubPreviewActive(false);

        if (shouldResume) {
            const totalSec = getTrailerTimelineDurationSec();
            const atEnd = trailerReplayTimeSec >= totalSec - 0.03;
            startTrailerReplayPlayback({ fromSeekEnd: atEnd });
        } else {
            updateTrailerPlayerUi();
            updateTrailerOrientationClasses();
        }
    }

    function pauseTrailerReplayPlayback() {
        trailerUserPausedPlayback = true;
        isTrailerReplayPlaying = false;
        audioEl?.pause();
        pauseTrailerMusicPlayback();
        stopTrailerReplaySyncLoop();
        updateTrailerPlayerUi();
        updateTrailerMediaSession();
    }

    async function tryStartTrailerPlaybackWithOrientation() {
        if (!isTrailerReplayMode) return;

        if (isTrailerMobileDevice()) {
            await requestTrailerLandscapeLock();
        }

        startTrailerReplayPlayback();
    }

    function startTrailerReplayPlayback(options) {
        if (!isTrailerReplayMode) return;

        const opts = options && typeof options === 'object' ? options : {};
        const totalSec = getTrailerTimelineDurationSec();
        if (trailerReplayTimeSec >= totalSec - 0.03) {
            if (opts.fromSeekEnd) {
                pauseTrailerReplayAtEnd();
            } else {
                restartTrailerReplay();
            }
            return;
        }

        isTrailerReplayPlaying = true;
        trailerUserPausedPlayback = false;
        resumeTrailerTimelineMedia(trailerReplayTimeSec);
        startTrailerReplaySyncLoop();
        updateTrailerPlayerUi();
        updateTrailerMediaSession();
        scheduleHideTrailerControls(500);
    }

    async function toggleTrailerFullscreen() {
        const target = getTrailerFullscreenElement();
        if (!target) return;

        try {
            if (isTrailerFullscreenActive()) {
                await global.document.exitFullscreen();
            } else {
                await target.requestFullscreen();
                if (isTrailerMobileDevice()) {
                    await requestTrailerLandscapeLock();
                }
            }
        } catch (_err) {
            /* ignored */
        }

        updateTrailerOrientationClasses();
    }

    function restartTrailerReplay() {
        pauseTrailerReplayPlayback();
        stopTrailerReplaySyncLoop();

        isTrailerFinaleLocked = false;
        resetTrailerFinaleSequenceState();
        isTrailerReplayPlaying = false;
        trailerUserPausedPlayback = false;
        trailerSeekActive = false;
        trailerSeekWasPlaying = false;
        trailerReplayTimeSec = 0;
        trailerImpactAudioUnlocked = false;
        trailerAutoplayQueued = false;
        trailerMusicInitialized = false;
        isPostNarrationHold = false;

        if (overlayEl) {
            overlayEl.classList.remove(
                'is-trailer-finale-locked',
                'is-trailer-finale-visible',
                'is-logo-reveal-active'
            );
        }

        clearLogoReveal();
        clearCinematicShots();
        clearSubtitleLogoSparks();
        hideTrailerOutro();
        resetLoreToolBackdrop();
        resetTrailerCreditsState();
        applyTrailerTimelinePosition(0, { syncMusic: true });
        void tryStartTrailerPlaybackWithOrientation();
    }

    function bindTrailerControlButton(buttonEl, handler) {
        if (!buttonEl || buttonEl.dataset.riftControlActionBound === '1') return;

        buttonEl.dataset.riftControlActionBound = '1';
        const run = (event) => {
            if (event.type === 'click' && buttonEl.dataset.riftControlPointerHandled === '1') {
                buttonEl.dataset.riftControlPointerHandled = '0';
                return;
            }

            event.preventDefault();
            event.stopPropagation();
            showTrailerControls();

            if (event.type === 'pointerdown') {
                buttonEl.dataset.riftControlPointerHandled = '1';
            }

            handler(event);

            if (isTrailerReplayPlaying) {
                scheduleHideTrailerControls(1600);
            }
        };

        buttonEl.addEventListener('pointerdown', run);
        buttonEl.addEventListener('click', run);
    }

    function bindTrailerControlButtons() {
        bindTrailerControlButton(
            overlayEl?.querySelector('#game-opening-prologue-trailer-play-btn'),
            () => {
                blurTrailerControlsFocus();
                if (isTrailerReplayPlaying) {
                    pauseTrailerReplayPlayback();
                } else {
                    void tryStartTrailerPlaybackWithOrientation();
                }
            }
        );

        bindTrailerControlButton(
            overlayEl?.querySelector('#game-opening-prologue-trailer-replay-btn'),
            () => {
                blurTrailerControlsFocus();
                restartTrailerReplay();
            }
        );

        bindTrailerControlButton(
            overlayEl?.querySelector('#game-opening-prologue-trailer-fullscreen-btn'),
            () => {
                blurTrailerControlsFocus();
                void toggleTrailerFullscreen();
            }
        );
    }

    function bindTrailerPlayerControls() {
        const viewportEl = overlayEl?.querySelector('#game-opening-prologue-trailer-viewport');
        const controlsEl = overlayEl?.querySelector('#game-opening-prologue-trailer-controls');
        if (!viewportEl || !controlsEl) return;

        viewportEl.appendChild(controlsEl);
        trailerControlsViewportEl = viewportEl;
        bindTrailerControlButtons();

        if (viewportEl.dataset.riftControlsBound === '1') return;

        viewportEl.dataset.riftControlsBound = '1';
        bindTrailerOrientationListeners();

        viewportEl.addEventListener('click', (event) => {
            if (event.target.closest('.game-opening-prologue-trailer-controls')) return;

            if (isTrailerReplayPlaying) {
                showTrailerControls();
                scheduleHideTrailerControls();
            }
        });

        viewportEl.addEventListener('dblclick', (event) => {
            if (event.target.closest('.game-opening-prologue-trailer-controls')) return;
            void toggleTrailerFullscreen();
        });

        viewportEl.addEventListener('pointerdown', (event) => {
            if (event.target.closest('.game-opening-prologue-trailer-btn')) {
                showTrailerControls();
                return;
            }
            if (event.target.closest('.game-opening-prologue-trailer-controls')) {
                showTrailerControls();
                scheduleHideTrailerControls(1600);
            }
            if (event.target.closest('#game-opening-prologue-trailer-seek')) {
                beginTrailerSeek();
            }
        }, { passive: true });

        viewportEl.addEventListener('input', (event) => {
            const seekEl = event.target.closest('#game-opening-prologue-trailer-seek');
            if (!seekEl) return;

            if (!trailerSeekActive) beginTrailerSeek();

            const totalSec = getTrailerTimelineDurationSec();
            const progress = Math.max(0, Math.min(1, Number(seekEl.value) / 1000));
            applyTrailerTimelinePosition(totalSec * progress, { syncMusic: true, scrubbing: true });
        });

        viewportEl.addEventListener('change', (event) => {
            if (event.target.closest('#game-opening-prologue-trailer-seek')) {
                finishTrailerSeek();
            }
        });

        viewportEl.addEventListener('pointerup', (event) => {
            if (event.target.closest('#game-opening-prologue-trailer-seek')) {
                finishTrailerSeek();
            }
        });

        viewportEl.addEventListener('keydown', (event) => {
            if (!event.target.closest('#game-opening-prologue-trailer-seek')) return;
            if (event.key === 'ArrowLeft'
                || event.key === 'ArrowRight'
                || event.key === 'Home'
                || event.key === 'End') {
                beginTrailerSeek();
            }
        });

        viewportEl.addEventListener('keyup', (event) => {
            if (!event.target.closest('#game-opening-prologue-trailer-seek')) return;
            if (event.key === 'ArrowLeft'
                || event.key === 'ArrowRight'
                || event.key === 'Home'
                || event.key === 'End') {
                finishTrailerSeek();
            }
        });

        bindTrailerControlsHover(
            viewportEl,
            controlsEl,
            viewportEl.querySelector('#game-opening-prologue-trailer-seek')
        );
    }

    function queueTrailerPlayerAutoplay() {
        if (!isTrailerReplayMode || trailerAutoplayQueued) return;
        trailerAutoplayQueued = true;

        global.setTimeout(() => {
            if (!isTrailerReplayMode || isTrailerReplayPlaying) return;
            void tryStartTrailerPlaybackWithOrientation();
        }, isTrailerMobileDevice() ? 480 : 220);
    }

    async function waitForTrailerSoundtrackEnd() {
        if (global.RoyalArmiesMusicFlow
            && typeof global.RoyalArmiesMusicFlow.waitForCurrentTrackEnd === 'function') {
            await global.RoyalArmiesMusicFlow.waitForCurrentTrackEnd();
        }
    }

    function enterTrailerReplayMode() {
        if (!isTrailerPage() || !overlayEl || isTrailerReplayMode) return;

        isTrailerReplayMode = true;
        isTrailerReplayPlaying = false;
        trailerAutoplayQueued = false;
        mountTrailerPlayerLayout();

        const playerEl = overlayEl.querySelector('#game-opening-prologue-trailer-player');
        if (playerEl) {
            playerEl.hidden = false;
        }

        overlayEl.classList.add('is-trailer-replay-mode');
        overlayEl.style.setProperty(
            '--trailer-cine-aspect-ratio',
            `${TRAILER_CINE_NATIVE_WIDTH} / ${TRAILER_CINE_NATIVE_HEIGHT}`
        );
        overlayEl.style.setProperty('--trailer-cine-max-width', `${TRAILER_CINE_NATIVE_WIDTH}px`);
        overlayEl.classList.remove('is-revealing', 'is-trailer-finale-visible');
        overlayEl.hidden = false;
        overlayEl.removeAttribute('hidden');

        trailerReplayTimeSec = 0;
        applyTrailerTimelinePosition(0, { syncMusic: true });
        bindTrailerPlayerControls();
        bindTrailerBackgroundPlaybackGuards();
        bindTrailerVisibilityKeepalive();
        bindTrailerMediaSession();
        updateTrailerPlayerUi();
        updateTrailerOrientationClasses();
        queueTrailerPlayerAutoplay();
    }

    const LOCAL_PROLOGUE_CUES = Object.freeze(
        LOCAL_PROLOGUE_SUBTITLE_CUE_MARKS.map((mark) => ({
            start: parseNarrationTimecode(mark.in),
            end: parseNarrationTimecode(mark.out),
            text: mark.text
        }))
    );

    const SCRIPT_TIMELINE_DURATION = LOCAL_PROLOGUE_CUES[LOCAL_PROLOGUE_CUES.length - 1].end;

    function isLocalDevHost() {
        if (typeof global.isLocalDevelopmentHost === 'function') {
            return global.isLocalDevelopmentHost();
        }
        if (global.RoyalArmiesDev && typeof global.RoyalArmiesDev.isLocalDevelopmentHost === 'function') {
            return global.RoyalArmiesDev.isLocalDevelopmentHost();
        }
        const host = (global.location.hostname || '').toLowerCase();
        return host === 'localhost' || host === '127.0.0.1' || global.location.protocol === 'file:';
    }

    function isGamePage() {
        return global.document.body?.id === 'game-page-canvas';
    }

    const AGE_OF_WAR_CINEMATIC_PAGE_ID = 'age-of-war-cinematic-canvas';
    const AGE_OF_WAR_TRAILER_PAGE_ID = 'royal-armies-ageofwar-trailer-canvas';

    function isTrailerPage() {
        return global.document.body?.id === AGE_OF_WAR_TRAILER_PAGE_ID
            || global.document.body?.dataset?.ageOfWarTrailer === '1';
    }

    function isCinematicPage() {
        const pageId = global.document.body?.id || '';
        return pageId === AGE_OF_WAR_CINEMATIC_PAGE_ID || isTrailerPage();
    }

    function shouldRunOpeningPrologue() {
        if (isTrailerPage()) return true;
        return isLocalDevHost() && global.document.body?.id === AGE_OF_WAR_CINEMATIC_PAGE_ID;
    }

    function resolveProgressionPageUrl() {
        const isSeasonPreview = global.document.body?.dataset?.seasonPreview === 'age-of-war';
        const slug = isSeasonPreview ? 'season-age-of-war-game' : 'game';
        if (typeof global.resolveRoyalArmiesPageUrl === 'function') {
            return global.resolveRoyalArmiesPageUrl(slug, 'riftProgressionReset=1');
        }
        return `/${slug}.html?riftProgressionReset=1`;
    }

    async function transitionToProgressionScreen() {
        if (!isCinematicPage()) return;

        const url = resolveProgressionPageUrl();
        if (global.RoyalArmiesPageRouteTransition
            && typeof global.RoyalArmiesPageRouteTransition.navigateTo === 'function') {
            await global.RoyalArmiesPageRouteTransition.navigateTo(url);
            return;
        }

        global.location.assign(url);
    }

    function setLocalProloguePending(active) {
        try {
            if (active) {
                global.sessionStorage.setItem(LOCAL_PROLOGUE_PENDING_KEY, '1');
            } else {
                global.sessionStorage.removeItem(LOCAL_PROLOGUE_PENDING_KEY);
            }
        } catch (_err) {
            /* ignore */
        }
    }

    function isLocalProloguePending() {
        try {
            return global.sessionStorage.getItem(LOCAL_PROLOGUE_PENDING_KEY) === '1';
        } catch (_err) {
            return false;
        }
    }

    function ensurePrologueCriticalStyles() {
        const legacyStyle = global.document.getElementById('rift-opening-prologue-critical-styles');
        if (legacyStyle) legacyStyle.remove();
        const legacyStyleV2 = global.document.getElementById('rift-opening-prologue-critical-styles-v2');
        if (legacyStyleV2) legacyStyleV2.remove();
        const legacyStyleV3 = global.document.getElementById('rift-opening-prologue-critical-styles-v3');
        if (legacyStyleV3) legacyStyleV3.remove();
        const legacyStyleV4 = global.document.getElementById('rift-opening-prologue-critical-styles-v4');
        if (legacyStyleV4) legacyStyleV4.remove();
        const legacyStyleV5 = global.document.getElementById('rift-opening-prologue-critical-styles-v5');
        if (legacyStyleV5) legacyStyleV5.remove();
        const legacyStyleV6 = global.document.getElementById('rift-opening-prologue-critical-styles-v6');
        if (legacyStyleV6) legacyStyleV6.remove();
        const legacyStyleV7 = global.document.getElementById('rift-opening-prologue-critical-styles-v7');
        if (legacyStyleV7) legacyStyleV7.remove();
        const legacyStyleV8 = global.document.getElementById('rift-opening-prologue-critical-styles-v8');
        if (legacyStyleV8) legacyStyleV8.remove();
        const legacyStyleV9 = global.document.getElementById('rift-opening-prologue-critical-styles-v9');
        if (legacyStyleV9) legacyStyleV9.remove();
        const legacyStyleV10 = global.document.getElementById('rift-opening-prologue-critical-styles-v10');
        if (legacyStyleV10) legacyStyleV10.remove();
        if (global.document.getElementById(CRITICAL_STYLE_ID)) return;

        const style = global.document.createElement('style');
        style.id = CRITICAL_STYLE_ID;
        style.textContent = `
            #${OVERLAY_ID} {
                position: fixed !important;
                inset: 0 !important;
                z-index: 100100 !important;
            }
            #${OVERLAY_ID}[hidden] {
                display: none !important;
            }
            #${OVERLAY_ID} .game-opening-prologue-subtitle-dock {
                position: absolute !important;
                left: 50% !important;
                bottom: clamp(52px, 6.5vh, 76px) !important;
                transform: translateX(-50%) !important;
                z-index: 5 !important;
                width: min(920px, calc(100vw - 48px)) !important;
                padding: 0 !important;
                border: 1px solid rgba(212, 168, 64, 0.58) !important;
                border-radius: 4px !important;
                background:
                    linear-gradient(180deg, rgba(36, 28, 16, 0.94) 0%, rgba(8, 6, 4, 0.98) 100%) !important;
                box-shadow:
                    0 0 0 1px rgba(255, 215, 120, 0.14),
                    0 0 28px rgba(255, 176, 48, 0.1),
                    0 14px 42px rgba(0, 0, 0, 0.58),
                    inset 0 1px 0 rgba(255, 236, 190, 0.16),
                    inset 0 -1px 0 rgba(0, 0, 0, 0.45) !important;
                outline: 1px solid rgba(255, 215, 120, 0.16) !important;
                outline-offset: 5px !important;
                backdrop-filter: blur(8px) !important;
                pointer-events: none !important;
                opacity: var(--subtitle-dock-opacity, 1) !important;
                visibility: visible !important;
                display: block !important;
            }
            #${OVERLAY_ID} .game-opening-prologue-subtitle-dock-inner {
                position: relative !important;
                padding: 16px 34px 18px !important;
            }
            #${OVERLAY_ID} .game-opening-prologue-subtitle-dock-inner::before,
            #${OVERLAY_ID} .game-opening-prologue-subtitle-dock-inner::after {
                content: '' !important;
                position: absolute !important;
                left: 18px !important;
                right: 18px !important;
                height: 1px !important;
                pointer-events: none !important;
            }
            #${OVERLAY_ID} .game-opening-prologue-subtitle-dock-inner::before {
                top: 7px !important;
                background: linear-gradient(
                    90deg,
                    transparent 0%,
                    rgba(255, 215, 120, 0.55) 50%,
                    transparent 100%
                ) !important;
            }
            #${OVERLAY_ID} .game-opening-prologue-subtitle-dock-inner::after {
                bottom: 7px !important;
                background: linear-gradient(
                    90deg,
                    transparent 0%,
                    rgba(184, 144, 48, 0.42) 50%,
                    transparent 100%
                ) !important;
            }
            #${OVERLAY_ID} .game-opening-prologue-subtitle-corner {
                position: absolute !important;
                width: 14px !important;
                height: 14px !important;
                border: 2px solid rgba(255, 212, 120, 0.78) !important;
                pointer-events: none !important;
            }
            #${OVERLAY_ID} .game-opening-prologue-subtitle-corner--tl {
                top: 5px !important;
                left: 7px !important;
                border-right: none !important;
                border-bottom: none !important;
            }
            #${OVERLAY_ID} .game-opening-prologue-subtitle-corner--tr {
                top: 5px !important;
                right: 7px !important;
                border-left: none !important;
                border-bottom: none !important;
            }
            #${OVERLAY_ID} .game-opening-prologue-subtitle-corner--bl {
                bottom: 5px !important;
                left: 7px !important;
                border-right: none !important;
                border-top: none !important;
            }
            #${OVERLAY_ID} .game-opening-prologue-subtitle-corner--br {
                bottom: 5px !important;
                right: 7px !important;
                border-left: none !important;
                border-top: none !important;
            }
            #${OVERLAY_ID}.is-logo-reveal-active .game-opening-prologue-subtitle-dock,
            #${OVERLAY_ID}[data-subtitles-hidden="1"] .game-opening-prologue-subtitle-dock {
                opacity: 0 !important;
                visibility: hidden !important;
                display: none !important;
            }
            #${OVERLAY_ID}.is-subtitles-active .game-opening-prologue-subtitle-dock,
            #${OVERLAY_ID}[data-subtitles-active="1"] .game-opening-prologue-subtitle-dock {
                opacity: 1 !important;
                visibility: visible !important;
                display: block !important;
            }
            #${OVERLAY_ID} .game-opening-prologue-subtitle {
                margin: 0 !important;
                min-height: 2.8em !important;
                font-family: 'Cinzel', Georgia, 'Times New Roman', serif !important;
                font-size: clamp(0.88rem, 1.18vw, 1.08rem) !important;
                font-weight: 500 !important;
                line-height: 1.7 !important;
                letter-spacing: 0.045em !important;
                text-align: center !important;
                color: rgba(255, 244, 214, 0.98) !important;
                text-shadow:
                    0 0 20px rgba(255, 196, 88, 0.14),
                    0 2px 16px rgba(0, 0, 0, 0.78) !important;
            }
            #${OVERLAY_ID} .game-opening-prologue-scrim {
                position: absolute !important;
                inset: 0 !important;
                z-index: 0 !important;
                background: #000 !important;
                pointer-events: none !important;
            }
            #${OVERLAY_ID} .game-opening-prologue-cinematic-stage {
                position: absolute !important;
                inset: 0 !important;
                z-index: 2 !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                padding: clamp(12px, 2vh, 24px) clamp(12px, 2vw, 24px)
                    clamp(128px, 17vh, 188px) !important;
                box-sizing: border-box !important;
                background: transparent !important;
                pointer-events: none !important;
            }
            #${OVERLAY_ID} .game-opening-prologue-cinematic-frame {
                position: relative !important;
                width: 66% !important;
                max-width: 66% !important;
                aspect-ratio: 4 / 3 !important;
                height: auto !important;
                max-height: min(88%, calc(100% - clamp(128px, 17vh, 188px))) !important;
                flex: 0 0 auto !important;
                border: none !important;
                border-radius: 6px !important;
                overflow: hidden !important;
                background: transparent !important;
            }
            #${OVERLAY_ID} .game-opening-prologue-cinematic-frame::before {
                content: '' !important;
                position: absolute !important;
                inset: 0 !important;
                z-index: 0 !important;
                border-radius: inherit !important;
                background: #080604 !important;
                opacity: var(--cine-frame-opacity, 0) !important;
                pointer-events: none !important;
            }
            #${OVERLAY_ID} .game-opening-prologue-cinematic-frame-border {
                position: absolute !important;
                inset: 0 !important;
                z-index: 3 !important;
                border: 2px solid rgba(184, 144, 48, 0.62) !important;
                border-radius: 6px !important;
                pointer-events: none !important;
                opacity: var(--cine-frame-opacity, 0);
                box-shadow:
                    0 0 0 1px rgba(255, 215, 120, 0.14),
                    0 16px 44px rgba(0, 0, 0, 0.55),
                    inset 0 0 28px rgba(0, 0, 0, 0.32) !important;
            }
            #${OVERLAY_ID} .game-opening-prologue-cinematic-shot {
                position: absolute !important;
                inset: 0 !important;
                z-index: 1 !important;
                opacity: var(--cine-shot-opacity, 0);
                pointer-events: none !important;
                transition: opacity 0.18s linear;
            }
            #${OVERLAY_ID} .game-opening-prologue-cinematic-shot img {
                position: absolute !important;
                left: 50% !important;
                top: 50% !important;
                width: 118% !important;
                height: 118% !important;
                min-width: 118% !important;
                min-height: 118% !important;
                object-fit: cover !important;
                transform: translate(-50%, -50%) scale(1.08);
                will-change: transform !important;
            }
            #${OVERLAY_ID}.is-trailer-replay-mode .game-opening-prologue-cinematic-stage {
                padding: 0 !important;
                align-items: stretch !important;
                justify-content: stretch !important;
            }
            #${OVERLAY_ID}.is-trailer-replay-mode .game-opening-prologue-cinematic-frame {
                width: 100% !important;
                max-width: none !important;
                height: 100% !important;
                max-height: none !important;
                aspect-ratio: auto !important;
                flex: 1 1 auto !important;
                border-radius: 0 !important;
            }
            #${OVERLAY_ID}.is-trailer-replay-mode .game-opening-prologue-cinematic-frame::before,
            #${OVERLAY_ID}.is-trailer-replay-mode .game-opening-prologue-cinematic-frame-border {
                display: none !important;
            }
            #${OVERLAY_ID}.is-trailer-replay-mode .game-opening-prologue-cinematic-shot img {
                width: 100% !important;
                height: 100% !important;
                min-width: 0 !important;
                min-height: 0 !important;
                max-width: 100% !important;
                max-height: 100% !important;
                object-fit: contain !important;
            }
            #${OVERLAY_ID}.is-trailer-replay-mode .game-opening-prologue-cinematic-shot img:not(.is-panning) {
                transform: translate(-50%, -50%) scale(1.12);
            }
            #${OVERLAY_ID}.is-trailer-replay-mode .game-opening-prologue-subtitle-dock.is-trailer-player-dock {
                left: 50% !important;
                right: auto !important;
                transform: translateX(-50%) !important;
                bottom: max(8px, 0.6cqh) !important;
                width: min(92cqw, calc(100% - 16px)) !important;
                max-width: calc(100% - 16px) !important;
                box-sizing: border-box !important;
                text-align: center !important;
            }
            #${OVERLAY_ID}.is-trailer-replay-mode .game-opening-prologue-subtitle-dock.is-trailer-player-dock .game-opening-prologue-subtitle-dock-inner {
                display: flex !important;
                justify-content: center !important;
                align-items: center !important;
                text-align: center !important;
                min-height: 4.75em !important;
                padding: 14px 34px !important;
                box-sizing: border-box !important;
            }
            #${OVERLAY_ID}.is-trailer-replay-mode .game-opening-prologue-subtitle-dock.is-trailer-player-dock .game-opening-prologue-subtitle {
                width: 100% !important;
                max-width: 100% !important;
                min-height: 0 !important;
                margin: 0 !important;
                text-align: center !important;
            }
        `.trim();
        global.document.head.appendChild(style);
    }

    function removeStalePrologueNodes() {
        global.document.querySelectorAll(`#${OVERLAY_ID}`).forEach((node) => {
            if (node !== overlayEl) node.remove();
        });
        global.document.querySelectorAll(`#${AUDIO_ID}`).forEach((node) => {
            if (node !== audioEl) node.remove();
        });
    }

    function refreshSubtitleElements() {
        if (!overlayEl) return;
        subtitleEl = overlayEl.querySelector(`#${SUBTITLE_ID}`);
        cinematicShotEls = Array.from(
            overlayEl.querySelectorAll('.game-opening-prologue-cinematic-shot')
        );
    }

    function buildCinematicStageMarkup() {
        return `
            <div class="game-opening-prologue-cinematic-stage" aria-hidden="true">
                <div class="game-opening-prologue-cinematic-frame">
                    <div class="game-opening-prologue-cinematic-frame-border" aria-hidden="true"></div>
                    ${PROLOGUE_CINEMATIC_SHOTS.map((shot) => `
                        <div
                            class="game-opening-prologue-cinematic-shot"
                            data-cinematic-id="${shot.id}"
                            aria-hidden="true"
                        >
                            <img
                                src="${shot.src}"
                                alt=""
                                decoding="async"
                                draggable="false"
                            >
                        </div>
                    `.trim()).join('')}
                </div>
            </div>
        `.trim();
    }

    const TRAILER_CONTROL_ICON_SVGS = Object.freeze({
        replay: '<svg class="game-opening-prologue-trailer-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/></svg>',
        play: '<svg class="game-opening-prologue-trailer-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M8 5v14l11-7z"/></svg>',
        pause: '<svg class="game-opening-prologue-trailer-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>',
        fullscreen: '<svg class="game-opening-prologue-trailer-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg>',
        exitFullscreen: '<svg class="game-opening-prologue-trailer-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"/></svg>'
    });

    function setTrailerControlButtonIcon(btn, iconName, label) {
        if (!btn || !TRAILER_CONTROL_ICON_SVGS[iconName]) return;

        btn.innerHTML = TRAILER_CONTROL_ICON_SVGS[iconName];
        btn.setAttribute('aria-label', label);
        btn.title = label;
    }

    function buildTrailerIconButtonMarkup(id, iconName, label) {
        return `
            <button
                type="button"
                class="game-opening-prologue-trailer-btn game-opening-prologue-trailer-btn--icon"
                id="${id}"
                aria-label="${label}"
                title="${label}"
            >${TRAILER_CONTROL_ICON_SVGS[iconName]}</button>
        `.trim();
    }

    function preloadCinematicImages() {
        PROLOGUE_CINEMATIC_SHOTS.forEach((shot) => {
            const img = new Image();
            img.decoding = 'async';
            img.src = shot.src;
        });
    }

    function removeCinematicPanAnimation(imgEl) {
        if (!imgEl) return;

        if (imgEl.classList.contains('is-panning')) {
            const computed = global.getComputedStyle(imgEl).transform;
            if (computed && computed !== 'none') {
                imgEl.style.transform = computed;
            }
        }

        const styleId = imgEl.dataset.cinePanStyleId;
        if (styleId) {
            global.document.getElementById(styleId)?.remove();
            imgEl.removeAttribute('data-cine-pan-style-id');
        }
        imgEl.style.removeProperty('animation');
        imgEl.classList.remove('is-panning');
    }

    function seededUnitRandom(seed) {
        const value = Math.sin(Number(seed) * 12.9898 + 78.233) * 43758.5453;
        return value - Math.floor(value);
    }

    function ensureTrailerCinematicPanParams(shotEl) {
        if (shotEl.dataset.cinePanReady === '1') {
            return {
                x1: parseFloat(shotEl.dataset.cinePanX1) || 0,
                y1: parseFloat(shotEl.dataset.cinePanY1) || 0,
                x2: parseFloat(shotEl.dataset.cinePanX2) || 0,
                y2: parseFloat(shotEl.dataset.cinePanY2) || 0,
                scale: parseFloat(shotEl.dataset.cinePanScale) || 1.12,
            };
        }

        const shotId = Number(shotEl.dataset.cinematicId) || 1;
        const panMag = isTrailerReplayMode
            ? 4 + (seededUnitRandom(shotId * 5.43) * 5)
            : 2.5 + (seededUnitRandom(shotId * 3.17) * 4.5);
        const angle = seededUnitRandom(shotId * 7.91) * Math.PI * 2;
        const scale = isTrailerReplayMode
            ? TRAILER_CINE_PAN_SCALE_MIN + (seededUnitRandom(shotId * 11.13) * TRAILER_CINE_PAN_SCALE_RANGE)
            : 1.08 + (seededUnitRandom(shotId * 13.37) * 0.08);
        const params = {
            x1: Math.cos(angle) * panMag,
            y1: Math.sin(angle) * panMag,
            x2: Math.cos(angle + Math.PI) * panMag,
            y2: Math.sin(angle + Math.PI) * panMag,
            scale,
        };

        shotEl.dataset.cinePanX1 = String(params.x1);
        shotEl.dataset.cinePanY1 = String(params.y1);
        shotEl.dataset.cinePanX2 = String(params.x2);
        shotEl.dataset.cinePanY2 = String(params.y2);
        shotEl.dataset.cinePanScale = String(params.scale);
        shotEl.dataset.cinePanReady = '1';

        return params;
    }

    function applyTrailerCinematicPanScrub(imgEl, shotEl, shot, scriptTime) {
        if (!imgEl || !shotEl || !shot) return;

        const params = ensureTrailerCinematicPanParams(shotEl);
        const shotDuration = Math.max(0.001, shot.scriptEnd - shot.scriptStart);
        const progress = Math.max(0, Math.min(1, (scriptTime - shot.scriptStart) / shotDuration));
        const x = params.x1 + ((params.x2 - params.x1) * progress);
        const y = params.y1 + ((params.y2 - params.y1) * progress);

        removeCinematicPanAnimation(imgEl);
        imgEl.style.transform = `translate(-50%, -50%) scale(${params.scale.toFixed(3)}) translate(${x.toFixed(2)}%, ${y.toFixed(2)}%)`;
        shotEl.dataset.panBound = '1';
    }

    function assignRandomCinematicPan(imgEl, durationSec) {
        if (!imgEl) return;

        removeCinematicPanAnimation(imgEl);

        const panMag = isTrailerReplayMode
            ? 4 + (Math.random() * 5)
            : 2.5 + (Math.random() * 4.5);
        const angle = Math.random() * Math.PI * 2;
        const x1 = Math.cos(angle) * panMag;
        const y1 = Math.sin(angle) * panMag;
        const x2 = Math.cos(angle + Math.PI) * panMag;
        const y2 = Math.sin(angle + Math.PI) * panMag;
        const scale = isTrailerReplayMode
            ? TRAILER_CINE_PAN_SCALE_MIN + (Math.random() * TRAILER_CINE_PAN_SCALE_RANGE)
            : 1.08 + (Math.random() * 0.08);
        const duration = isTrailerReplayMode
            ? Math.max(0.5, durationSec)
            : Math.max(1, durationSec * PROLOGUE_CINEMATIC_PAN_DURATION_SCALE);

        cinematicPanStyleCounter += 1;
        const animName = `game-opening-prologue-cinematic-pan-${cinematicPanStyleCounter}`;
        const styleId = `${animName}-style`;
        const styleEl = global.document.createElement('style');
        styleEl.id = styleId;
        styleEl.textContent = `
            @keyframes ${animName} {
                from {
                    transform: translate(-50%, -50%) scale(${scale.toFixed(3)})
                        translate(${x1.toFixed(2)}%, ${y1.toFixed(2)}%);
                }
                to {
                    transform: translate(-50%, -50%) scale(${scale.toFixed(3)})
                        translate(${x2.toFixed(2)}%, ${y2.toFixed(2)}%);
                }
            }
        `.trim();
        global.document.head.appendChild(styleEl);

        imgEl.dataset.cinePanStyleId = styleId;
        imgEl.classList.add('is-panning');
        imgEl.style.removeProperty('transform');
        imgEl.style.animation = 'none';
        void imgEl.offsetWidth;
        imgEl.style.animation = `${animName} ${duration.toFixed(2)}s linear forwards`;
    }

    function setCinematicFrameOpacity(opacity) {
        const clamped = Math.max(0, Math.min(1, Number(opacity) || 0));
        const opacityText = String(clamped);
        const frameEl = overlayEl?.querySelector('.game-opening-prologue-cinematic-frame');
        const frameBorderEl = overlayEl?.querySelector('.game-opening-prologue-cinematic-frame-border');

        if (frameEl) {
            frameEl.style.setProperty('--cine-frame-opacity', opacityText);
        }
        if (frameBorderEl) {
            frameBorderEl.style.setProperty('--cine-frame-opacity', opacityText);
            frameBorderEl.style.opacity = opacityText;
        }
    }

    function resolveLastCinematicShotFadeOpacity(scriptTime) {
        const lastShot = PROLOGUE_CINEMATIC_SHOTS[PROLOGUE_CINEMATIC_SHOTS.length - 1];
        if (!lastShot) return 1;

        const fadeSpan = Math.max(0.001, PROLOGUE_CINEMATIC_FADE_SEC);
        if (scriptTime < lastShot.scriptEnd - fadeSpan || scriptTime > lastShot.scriptEnd) {
            return 1;
        }

        return resolveCinematicShotOpacity(scriptTime, lastShot);
    }

    async function fadeOutTrailerLastCinematicShotIfNeeded() {
        const lastShot = PROLOGUE_CINEMATIC_SHOTS[PROLOGUE_CINEMATIC_SHOTS.length - 1];
        if (!lastShot || !cinematicShotEls.length) return;

        const lastShotEl = cinematicShotEls.find(
            (shotEl) => Number(shotEl.dataset.cinematicId) === lastShot.id
        );
        if (!lastShotEl) return;

        const rawOpacity = lastShotEl.style.getPropertyValue('--cine-shot-opacity')
            || global.getComputedStyle(lastShotEl).opacity
            || '0';
        const startOpacity = Math.max(0, Math.min(1, parseFloat(rawOpacity) || 0));
        if (startOpacity <= 0.001) return;

        overlayEl?.classList.add('is-cinematics-active');

        const scale = cueTimelineScale > 0 ? cueTimelineScale : 1;
        const fadeMs = Math.max(16, startOpacity * PROLOGUE_CINEMATIC_FADE_SEC * 1000 * scale);
        const startedAt = global.performance?.now?.() ?? Date.now();

        await new Promise((resolve) => {
            const tick = (now) => {
                const progress = Math.min(1, (now - startedAt) / fadeMs);
                const opacity = startOpacity * (1 - progress);
                const opacityText = String(opacity);

                lastShotEl.style.setProperty('--cine-shot-opacity', opacityText);
                lastShotEl.classList.toggle('is-visible', opacity > 0.01);

                if (progress < 1) {
                    global.requestAnimationFrame(tick);
                } else {
                    resolve();
                }
            };

            global.requestAnimationFrame(tick);
        });
    }

    async function fadeOutCinematicChromeIfNeeded() {
        if (isTrailerReplayMode) return;

        const frameBorderEl = overlayEl?.querySelector('.game-opening-prologue-cinematic-frame-border');
        if (!frameBorderEl) return;

        const rawOpacity = frameBorderEl.style.getPropertyValue('--cine-frame-opacity')
            || global.getComputedStyle(frameBorderEl).getPropertyValue('--cine-frame-opacity')
            || '0';
        const startOpacity = Math.max(0, Math.min(1, parseFloat(rawOpacity) || 0));
        if (startOpacity <= 0.001) return;

        const scale = cueTimelineScale > 0 ? cueTimelineScale : 1;
        const fadeMs = Math.max(16, startOpacity * PROLOGUE_CINEMATIC_FADE_SEC * 1000 * scale);
        const lastShot = PROLOGUE_CINEMATIC_SHOTS[PROLOGUE_CINEMATIC_SHOTS.length - 1];
        const startedAt = global.performance?.now?.() ?? Date.now();

        await new Promise((resolve) => {
            const tick = (now) => {
                const progress = Math.min(1, (now - startedAt) / fadeMs);
                const opacity = startOpacity * (1 - progress);
                setCinematicFrameOpacity(opacity);
                overlayEl?.style.setProperty('--subtitle-dock-opacity', String(opacity));

                if (lastShot) {
                    cinematicShotEls.forEach((shotEl) => {
                        if (Number(shotEl.dataset.cinematicId) !== lastShot.id) return;
                        const opacityText = String(opacity);
                        shotEl.style.setProperty('--cine-shot-opacity', opacityText);
                    });
                }

                if (progress < 1) {
                    global.requestAnimationFrame(tick);
                } else {
                    resolve();
                }
            };

            global.requestAnimationFrame(tick);
        });
    }

    function clearCinematicShots() {
        cinematicShotEls.forEach((shotEl) => {
            shotEl.style.setProperty('--cine-shot-opacity', '0');
            shotEl.classList.remove('is-visible');
            shotEl.removeAttribute('data-pan-bound');
            const imgEl = shotEl.querySelector('img');
            if (imgEl) {
                removeCinematicPanAnimation(imgEl);
            }
        });
        activeCinematicShotId = -1;
        setCinematicFrameOpacity(0);
        overlayEl?.style.removeProperty('--subtitle-dock-opacity');
        overlayEl?.classList.remove('is-cinematics-active');
    }

    function resolveCinematicShotOpacity(scriptTime, shot) {
        if (scriptTime < shot.scriptStart || scriptTime > shot.scriptEnd) {
            return 0;
        }

        const fadeSpan = Math.max(0.001, PROLOGUE_CINEMATIC_FADE_SEC);
        const fadeIn = Math.min(1, (scriptTime - shot.scriptStart) / fadeSpan);
        const fadeOut = Math.min(1, (shot.scriptEnd - scriptTime) / fadeSpan);
        return Math.min(fadeIn, fadeOut);
    }

    function getCinematicSyncTimeSec() {
        if (isTrailerReplayMode) {
            return trailerReplayTimeSec;
        }
        return audioEl?.currentTime || 0;
    }

    function syncCinematicToAudioTime(force, options) {
        if ((!audioEl && !isTrailerReplayMode) || !cinematicShotEls.length) return;
        if (!force && !canSyncPrologueTimeline()) return;

        const opts = options && typeof options === 'object' ? options : {};
        const scrub = Boolean(opts.scrub);
        const scriptTime = toScriptTimelineTime(getCinematicSyncTimeSec());
        let dominantShotId = -1;
        let dominantOpacity = 0;

        const frameBorderOpacity = Math.max(...cinematicShotEls.map((shotEl) => {
            const shotId = Number(shotEl.dataset.cinematicId) || 0;
            const shot = PROLOGUE_CINEMATIC_SHOTS.find((entry) => entry.id === shotId);
            return shot ? resolveCinematicShotOpacity(scriptTime, shot) : 0;
        }), 0);

        cinematicShotEls.forEach((shotEl) => {
            const shotId = Number(shotEl.dataset.cinematicId) || 0;
            const shot = PROLOGUE_CINEMATIC_SHOTS.find((entry) => entry.id === shotId);
            if (!shot) return;

            const opacity = resolveCinematicShotOpacity(scriptTime, shot);
            shotEl.style.setProperty('--cine-shot-opacity', String(opacity));
            shotEl.classList.toggle('is-visible', opacity > 0);

            if (opacity > 0) {
                const imgEl = shotEl.querySelector('img');
                const remainingScriptSec = Math.max(0.001, shot.scriptEnd - scriptTime);
                const remainingWallSec = remainingScriptSec * (cueTimelineScale > 0 ? cueTimelineScale : 1);

                if (scrub && isTrailerReplayMode && imgEl) {
                    applyTrailerCinematicPanScrub(imgEl, shotEl, shot, scriptTime);
                } else if (shotEl.dataset.panBound !== '1') {
                    assignRandomCinematicPan(imgEl, remainingWallSec);
                    shotEl.dataset.panBound = '1';
                }

                if (opacity >= dominantOpacity) {
                    dominantOpacity = opacity;
                    dominantShotId = shotId;
                }
            } else {
                if (!scrub) {
                    shotEl.removeAttribute('data-pan-bound');
                    const imgEl = shotEl.querySelector('img');
                    if (imgEl) removeCinematicPanAnimation(imgEl);
                }
            }
        });

        if (isTrailerReplayMode) {
            setCinematicFrameOpacity(0);
        } else {
            setCinematicFrameOpacity(frameBorderOpacity);
        }
        overlayEl?.style.setProperty(
            '--subtitle-dock-opacity',
            String(isTrailerReplayMode ? 1 : resolveLastCinematicShotFadeOpacity(scriptTime))
        );

        if (dominantOpacity > 0) {
            overlayEl?.classList.add('is-cinematics-active');
        } else {
            overlayEl?.classList.remove('is-cinematics-active');
        }

        activeCinematicShotId = dominantShotId;
    }

    function primeCinematicFrame() {
        if (!audioEl || !cinematicShotEls.length) return;
        syncCinematicToAudioTime();
    }

    function setSubtitleDockActive(active) {
        if (!overlayEl) return;

        const dock = overlayEl.querySelector('.game-opening-prologue-subtitle-dock');
        if (active) {
            overlayEl.classList.add('is-subtitles-active');
            overlayEl.setAttribute('data-subtitles-active', '1');
            overlayEl.removeAttribute('data-subtitles-hidden');
            if (dock) {
                dock.style.setProperty('opacity', '1', 'important');
                dock.style.setProperty('visibility', 'visible', 'important');
                dock.style.setProperty('display', 'block', 'important');
            }
        } else {
            overlayEl.classList.remove('is-subtitles-active');
            overlayEl.removeAttribute('data-subtitles-active');
            overlayEl.setAttribute('data-subtitles-hidden', '1');
            if (dock) {
                dock.style.removeProperty('opacity');
                dock.style.removeProperty('visibility');
                dock.style.removeProperty('display');
            }
        }
    }

    function ensurePrologueBackgroundMusic(options) {
        const opts = options && typeof options === 'object' ? options : {};
        if (global.RoyalArmiesMusicFlow
            && typeof global.RoyalArmiesMusicFlow.startGamePageArchimedes === 'function') {
            global.RoyalArmiesMusicFlow.startGamePageArchimedes({
                volume: PROLOGUE_MUSIC_VOLUME,
                resetTime: opts.resetTime !== false
            });
        }
    }

    function ensureOverlay() {
        ensurePrologueCriticalStyles();
        removeStalePrologueNodes();

        if (overlayEl && global.document.contains(overlayEl)) {
            const missingTrailerPlayer = isTrailerPage()
                && !overlayEl.querySelector('#game-opening-prologue-trailer-stage');
            const staleTrailerViewport = isTrailerPage()
                && !overlayEl.querySelector(
                    '#game-opening-prologue-trailer-viewport #game-opening-prologue-trailer-finale-pane'
                );
            const staleTrailerControls = isTrailerPage()
                && !overlayEl.querySelector(
                    '#game-opening-prologue-trailer-viewport .game-opening-prologue-trailer-controls'
                );
            const missingTrailerCredits = isTrailerPage()
                && !overlayEl.querySelector('#game-opening-prologue-trailer-credits');
            const missingTrailerThanksPanel = isTrailerPage()
                && !overlayEl.querySelector('.game-opening-prologue-trailer-credits-panel--thanks');
            if (!overlayEl.querySelector('.game-opening-prologue-cinematic-frame-border')
                || !overlayEl.querySelector('.game-opening-prologue-subtitle-dock-inner')
                || missingTrailerPlayer
                || staleTrailerViewport
                || staleTrailerControls
                || missingTrailerCredits
                || missingTrailerThanksPanel) {
                overlayEl.remove();
                overlayEl = null;
                subtitleEl = null;
                cinematicShotEls = [];
            } else {
                refreshSubtitleElements();
                return overlayEl;
            }
        }

        overlayEl = null;
        subtitleEl = null;
        audioEl = null;

        overlayEl = global.document.createElement('div');
        overlayEl.id = OVERLAY_ID;
        overlayEl.className = 'game-opening-prologue';
        overlayEl.setAttribute('role', 'dialog');
        overlayEl.setAttribute('aria-modal', 'true');
        overlayEl.setAttribute('aria-label', 'Opening narrative');
        overlayEl.hidden = true;
        overlayEl.innerHTML = `
            <div class="game-opening-prologue-scrim" aria-hidden="true"></div>
            ${buildCinematicStageMarkup()}
            <div class="game-opening-prologue-logo-stage" aria-hidden="true">
                <img
                    src="${PROLOGUE_LORE_TOOL_SRC}"
                    alt=""
                    class="game-opening-prologue-lore-tool"
                    decoding="async"
                    aria-hidden="true"
                >
                <div class="game-opening-prologue-logo-stack">
                    <img
                        src="${PROLOGUE_LOGO_SRC}"
                        alt="Royal Armies"
                        class="game-opening-prologue-logo game-opening-prologue-logo--title"
                        decoding="async"
                    >
                    <div class="game-opening-prologue-subtitle-logo-wrap">
                        <div class="game-opening-prologue-subtitle-fire-fx" aria-hidden="true">
                            <div class="game-opening-prologue-subtitle-fire-smoke"></div>
                            <div class="game-opening-prologue-subtitle-fire-outer"></div>
                            <div class="game-opening-prologue-subtitle-fire-core"></div>
                            <div class="game-opening-prologue-subtitle-fire-embers"></div>
                        </div>
                        <div class="game-opening-prologue-subtitle-sparks" aria-hidden="true"></div>
                        <img
                            src="${PROLOGUE_SUBTITLE_LOGO_SRC}"
                            alt=""
                            class="game-opening-prologue-logo game-opening-prologue-logo--subtitle"
                            decoding="async"
                            hidden
                        >
                    </div>
                    ${isTrailerPage() ? `
                    <div
                        class="game-opening-prologue-trailer-outro"
                        id="game-opening-prologue-trailer-outro"
                        hidden
                        aria-live="polite"
                    >
                        <p class="game-opening-prologue-trailer-coming-soon">
                            <span class="game-opening-prologue-trailer-coming-soon-headline">Coming Soon</span>
                            <span class="game-opening-prologue-trailer-coming-soon-date">Winter 2026</span>
                        </p>
                        <div class="game-opening-prologue-trailer-taglines">
                            <p class="game-opening-prologue-trailer-call">Stand and Join the War!</p>
                            <p class="game-opening-prologue-trailer-site">RoyalArmies.com</p>
                        </div>
                    </div>
                    `.trim() : `
                    <button
                        type="button"
                        class="game-opening-prologue-enter-war-btn"
                        id="game-opening-prologue-enter-war-btn"
                        hidden
                    >
                        Enter the War
                    </button>
                    `.trim()}
                </div>
                ${isTrailerPage() ? `
                <div
                    class="game-opening-prologue-trailer-credits"
                    id="game-opening-prologue-trailer-credits"
                    hidden
                    aria-live="polite"
                >
                    <div class="game-opening-prologue-trailer-credits-panel game-opening-prologue-trailer-credits-panel--greenmask">
                        <img
                            src="${TRAILER_GREENMASK_LOGO_SRC}"
                            alt="GreenMask Interactive"
                            class="game-opening-prologue-trailer-credits-logo"
                            decoding="async"
                        >
                    </div>
                    <div class="game-opening-prologue-trailer-credits-panel game-opening-prologue-trailer-credits-panel--alpha">
                        <p class="game-opening-prologue-trailer-credits-alpha-copy">
                            Register to play the Alpha version and be kept up to date on the progression of the Royal Armies
                        </p>
                    </div>
                    <div class="game-opening-prologue-trailer-credits-panel game-opening-prologue-trailer-credits-panel--thanks">
                        <p class="game-opening-prologue-trailer-credits-thanks-copy">Thanks for Watching!</p>
                    </div>
                </div>
                `.trim() : ''}
            </div>
            <div class="game-opening-prologue-subtitle-dock">
                <span class="game-opening-prologue-subtitle-corner game-opening-prologue-subtitle-corner--tl" aria-hidden="true"></span>
                <span class="game-opening-prologue-subtitle-corner game-opening-prologue-subtitle-corner--tr" aria-hidden="true"></span>
                <span class="game-opening-prologue-subtitle-corner game-opening-prologue-subtitle-corner--bl" aria-hidden="true"></span>
                <span class="game-opening-prologue-subtitle-corner game-opening-prologue-subtitle-corner--br" aria-hidden="true"></span>
                <div class="game-opening-prologue-subtitle-dock-inner">
                <p id="${SUBTITLE_ID}" class="game-opening-prologue-subtitle" aria-live="polite"></p>
            </div>
            </div>
            ${isTrailerPage() ? `
            <div class="game-opening-prologue-trailer-player" id="game-opening-prologue-trailer-player" hidden>
                <div class="game-opening-prologue-trailer-stage" id="game-opening-prologue-trailer-stage">
                    <div class="game-opening-prologue-trailer-viewport" id="game-opening-prologue-trailer-viewport">
                        <div
                            class="game-opening-prologue-trailer-finale-pane"
                            id="game-opening-prologue-trailer-finale-pane"
                            hidden
                            aria-hidden="true"
                        ></div>
                        <div class="game-opening-prologue-trailer-controls" id="game-opening-prologue-trailer-controls">
                            <input type="range" class="game-opening-prologue-trailer-seek" id="game-opening-prologue-trailer-seek" min="0" max="1000" value="0" aria-label="Trailer timeline">
                            <div class="game-opening-prologue-trailer-controls-row">
                                ${buildTrailerIconButtonMarkup('game-opening-prologue-trailer-play-btn', 'play', 'Play')}
                                ${buildTrailerIconButtonMarkup('game-opening-prologue-trailer-replay-btn', 'replay', 'Replay')}
                                <span class="game-opening-prologue-trailer-time" id="game-opening-prologue-trailer-time">0:00 / 0:00</span>
                                <span class="game-opening-prologue-trailer-controls-spacer" aria-hidden="true"></span>
                                ${buildTrailerIconButtonMarkup('game-opening-prologue-trailer-fullscreen-btn', 'fullscreen', 'Fullscreen')}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            ` : ''}
            ${isTrailerPage() ? '' : `<button type="button" class="game-opening-prologue-skip" id="game-opening-prologue-skip">${global.document.body?.id === AGE_OF_WAR_CINEMATIC_PAGE_ID ? 'Skip to progression (local dev)' : 'Skip prologue (local dev)'}</button>`}
        `.trim();

        audioEl = global.document.createElement('audio');
        audioEl.id = AUDIO_ID;
        audioEl.preload = 'auto';
        audioEl.setAttribute('playsinline', '');
        audioEl.src = PROLOGUE_AUDIO_SRC;
        audioEl.volume = PROLOGUE_NARRATION_VOLUME;

        (global.document.documentElement || global.document.body).appendChild(overlayEl);
        global.document.body.appendChild(audioEl);

        refreshSubtitleElements();
        const skipBtn = overlayEl.querySelector('#game-opening-prologue-skip');
        if (skipBtn) {
            skipBtn.addEventListener('click', () => finishPrologue('skipped'));
        }

        const enterWarBtn = overlayEl.querySelector('#game-opening-prologue-enter-war-btn');
        if (enterWarBtn && enterWarBtn.dataset.riftBound !== '1') {
            enterWarBtn.dataset.riftBound = '1';
            enterWarBtn.addEventListener('click', () => {
                void resolveEnterWarGate('button');
            });
        }

        audioEl.addEventListener('ended', () => {
            if (isTrailerPage()) return;
            finishPrologue('completed');
        });
        audioEl.addEventListener('error', () => {
            if (isTrailerPage() && isTrailerReplayMode) return;
            finishPrologue('error');
        });

        if (isTrailerPage() && isTrailerReplayMode && overlayEl) {
            mountTrailerPlayerLayout();
        }

        return overlayEl;
    }

    function toScriptTimelineTime(audioTime) {
        const scale = cueTimelineScale > 0 ? cueTimelineScale : 1;
        return (Number(audioTime) || 0) / scale;
    }

    function toAudioTimelineTime(scriptTime) {
        return (Number(scriptTime) || 0) * (cueTimelineScale > 0 ? cueTimelineScale : 1);
    }

    function updateCueTimelineScale(audioDuration) {
        if (!Number.isFinite(audioDuration) || audioDuration <= 0 || SCRIPT_TIMELINE_DURATION <= 0) {
            cueTimelineScale = 1;
            return;
        }

        cueTimelineScale = audioDuration / SCRIPT_TIMELINE_DURATION;
    }

    function waitForNarrationMetadata() {
        ensureOverlay();
        if (!audioEl) return Promise.resolve(null);

        if (Number.isFinite(audioEl.duration) && audioEl.duration > 0) {
            return Promise.resolve(audioEl.duration);
        }

        return Promise.race([
            new Promise((resolve) => {
            const onReady = () => {
                const duration = Number.isFinite(audioEl.duration) && audioEl.duration > 0
                    ? audioEl.duration
                    : null;
                resolve(duration);
            };

            audioEl.addEventListener('loadedmetadata', onReady, { once: true });
            audioEl.addEventListener('durationchange', onReady, { once: true });
                audioEl.addEventListener('error', () => resolve(null), { once: true });
            audioEl.load();
            }),
            new Promise((resolve) => {
                global.setTimeout(() => resolve(null), NARRATION_METADATA_TIMEOUT_MS);
            })
        ]);
    }

    async function prepareCueTimeline() {
        const audioDuration = await waitForNarrationMetadata();
        updateCueTimelineScale(audioDuration);
    }

    function getSubtitleSyncTimeSec() {
        if (isTrailerReplayMode) {
            return trailerReplayTimeSec;
        }
        return audioEl?.currentTime || 0;
    }

    function resolveActiveCueIndexAtTime(scriptTime) {
        const t = Number(scriptTime) || 0;
        let index = -1;

        for (let i = 0; i < LOCAL_PROLOGUE_CUES.length; i += 1) {
            if (t >= LOCAL_PROLOGUE_CUES[i].start) {
                index = i;
            } else {
                break;
            }
        }

        return index;
    }

    function renderSubtitleCue(cueIndex) {
        if (!subtitleEl) refreshSubtitleElements();
        if (!subtitleEl) return;

        const cue = cueIndex >= 0 ? LOCAL_PROLOGUE_CUES[cueIndex] : null;
        subtitleEl.textContent = cue ? cue.text : '';
    }

    function resolveActiveCueIndex(audioTime) {
        return resolveActiveCueIndexAtTime(toScriptTimelineTime(audioTime));
    }

    function syncSubtitleToAudioTime(force) {
        if (!audioEl && !isTrailerReplayMode) return;
        if (!force && !canSyncPrologueTimeline()) return;

        const scriptTime = toScriptTimelineTime(getSubtitleSyncTimeSec());
        const cueIndex = resolveActiveCueIndexAtTime(scriptTime);

        if (!force && cueIndex === activeCueIndex) return;

        activeCueIndex = cueIndex;
        renderSubtitleCue(cueIndex);
    }

    function syncPrologueToAudioTime() {
        syncSubtitleToAudioTime();
        syncCinematicToAudioTime();
    }

    function startSubtitleSyncLoop() {
        stopSubtitleSyncLoop();

        const tick = () => {
            syncPrologueToAudioTime();
            if (isPlaying) {
                subtitleSyncFrame = global.requestAnimationFrame(tick);
            }
        };

        subtitleSyncFrame = global.requestAnimationFrame(tick);
    }

    function stopSubtitleSyncLoop() {
        if (subtitleSyncFrame) {
            global.cancelAnimationFrame(subtitleSyncFrame);
            subtitleSyncFrame = null;
        }
    }

    function showOverlay(options) {
        ensureOverlay();
        overlayEl.removeAttribute('hidden');
        overlayEl.hidden = false;
        overlayEl.classList.remove('is-revealing');
        if (options && options.subtitles === true) {
            setSubtitleDockActive(true);
            activeCueIndex = -1;
            syncSubtitleToAudioTime(true);
        } else {
            setSubtitleDockActive(false);
        }
        global.document.body.classList.add('game-opening-prologue-active');
    }

    function hideOverlay() {
        if (overlayEl) {
            overlayEl.hidden = true;
            overlayEl.setAttribute('hidden', '');
            overlayEl.classList.remove('is-revealing');
            setSubtitleDockActive(false);
        }
        clearLogoReveal();
        global.document.body.classList.remove('game-opening-prologue-active');
        if (subtitleEl) subtitleEl.textContent = '';
        activeCueIndex = -1;
        clearCinematicShots();
        isFadingOut = false;
        stopSubtitleSyncLoop();
    }

    function waitPrologueFade(ms) {
        return new Promise((resolve) => {
            global.setTimeout(resolve, ms);
        });
    }

    function clearPrologueMusicAnimation() {
        if (global.RoyalArmiesMusicFlow
            && typeof global.RoyalArmiesMusicFlow.cancelMusicVolumeAnimation === 'function') {
            global.RoyalArmiesMusicFlow.cancelMusicVolumeAnimation();
        }
    }

    function ensureSubtitleLogoSfx() {
        if (subtitleLogoSfxEl && global.document.contains(subtitleLogoSfxEl)) {
            return subtitleLogoSfxEl;
        }

        subtitleLogoSfxEl = global.document.createElement('audio');
        subtitleLogoSfxEl.preload = 'auto';
        subtitleLogoSfxEl.setAttribute('playsinline', '');
        subtitleLogoSfxEl.src = PROLOGUE_SUBTITLE_LOGO_SFX_SRC;
        global.document.body.appendChild(subtitleLogoSfxEl);
        return subtitleLogoSfxEl;
    }

    function playPrologueSubtitleLogoSfx() {
        const sfx = ensureSubtitleLogoSfx();
        sfx.volume = 1;
        sfx.muted = false;
        sfx.currentTime = 0;

        const attemptPlay = () => {
            const playPromise = sfx.play();
            if (playPromise && typeof playPromise.catch === 'function') {
                playPromise.catch(() => {
                    global.setTimeout(() => {
        sfx.currentTime = 0;
        sfx.play().catch(() => {});
                    }, 32);
                });
            }
        };

        attemptPlay();
    }

    function clearSubtitleLogoSparks() {
        if (subtitleSparkTimer) {
            if (typeof subtitleSparkTimer === 'function') {
                subtitleSparkTimer();
            } else {
                global.clearInterval(subtitleSparkTimer);
            }
            subtitleSparkTimer = null;
        }

        overlayEl?.querySelectorAll('.game-opening-prologue-subtitle-sparks').forEach((host) => {
            if (global.RoyalArmiesSubtitleLogoSparks
                && typeof global.RoyalArmiesSubtitleLogoSparks.stop === 'function') {
                global.RoyalArmiesSubtitleLogoSparks.stop(host);
            } else {
                host.innerHTML = '';
            }
        });
    }

    function resolveSubtitleSparksHost(subtitleLogoEl) {
        return subtitleLogoEl?.closest('.game-opening-prologue-subtitle-logo-wrap')
            ?.querySelector('.game-opening-prologue-subtitle-sparks')
            || null;
    }

    function startSubtitleLogoSparks(subtitleLogoEl, generation) {
        clearSubtitleLogoSparks();
        if (!subtitleLogoEl) return;

        const sparksHost = resolveSubtitleSparksHost(subtitleLogoEl);
        if (!sparksHost) return;

        if (global.RoyalArmiesSubtitleLogoSparks
            && typeof global.RoyalArmiesSubtitleLogoSparks.startLoop === 'function') {
            subtitleSparkTimer = global.RoyalArmiesSubtitleLogoSparks.startLoop(sparksHost, {
                intervalMs: PROLOGUE_SUBTITLE_SPARK_INTERVAL_MS,
                sparksPerBurst: PROLOGUE_SUBTITLE_SPARKS_PER_BURST,
                flashChance: PROLOGUE_SUBTITLE_SPARK_FLASH_CHANCE,
                shouldContinue: () => (
                    generation === logoRevealGeneration
                    && !subtitleLogoEl.hidden
                )
            });
            return;
        }

        subtitleSparkTimer = null;
    }

    function resetLoreToolBackdrop() {
        const loreToolEl = overlayEl?.querySelector('.game-opening-prologue-lore-tool');
        if (!loreToolEl) return;

        loreToolEl.classList.remove('is-visible');
        loreToolEl.style.removeProperty('transition');
        loreToolEl.style.opacity = '0';
        loreToolFadePromise = null;
    }

    function beginLoreToolFadeIn(generation) {
        const loreToolEl = overlayEl?.querySelector('.game-opening-prologue-lore-tool');
        if (!loreToolEl || generation !== logoRevealGeneration) {
            return Promise.resolve();
        }

        loreToolEl.classList.remove('is-visible');
        loreToolEl.style.opacity = '0';
        loreToolEl.style.transition = `opacity ${PROLOGUE_LORE_TOOL_FADE_MS}ms ease-in`;
        void loreToolEl.offsetWidth;

        if (generation !== logoRevealGeneration) {
            return Promise.resolve();
        }

        loreToolEl.classList.add('is-visible');
        const peakOpacity = isTrailerPage() ? TRAILER_LORE_TOOL_PEAK_OPACITY : 1;
        loreToolEl.style.opacity = String(peakOpacity);

        return new Promise((resolve) => {
            let settled = false;

            const finish = () => {
                if (settled || generation !== logoRevealGeneration) return;
                settled = true;
                resolve();
            };

            loreToolEl.addEventListener('transitionend', (event) => {
                if (event.propertyName === 'opacity') {
                    finish();
                }
            }, { once: true });

            global.setTimeout(finish, PROLOGUE_LORE_TOOL_FADE_MS + 80);
        });
    }

    function resetLogoElement(logoEl, options) {
        if (!logoEl) return;

        const hideSubtitle = Boolean(options && options.hideSubtitle);
        logoEl.classList.remove('is-arriving', 'is-arrived', 'is-exploding');
        logoEl.style.removeProperty('--prologue-logo-arrive-ms');
        logoEl.style.removeProperty('animation');
        logoEl.style.removeProperty('transform');
        logoEl.style.removeProperty('opacity');
        logoEl.style.removeProperty('filter');
        resetSubtitleLogoExplosionState(logoEl);

        if (hideSubtitle && logoEl.classList.contains('game-opening-prologue-logo--subtitle')) {
            logoEl.hidden = true;
        }
    }

    function resolveSubtitleLogoWrap(logoEl) {
        return logoEl?.closest('.game-opening-prologue-subtitle-logo-wrap') || null;
    }

    function resetSubtitleLogoExplosionState(logoEl) {
        const wrap = resolveSubtitleLogoWrap(logoEl);
        if (!wrap) return;

        wrap.classList.remove('is-exploding');
        wrap.style.removeProperty('transform');
        wrap.querySelectorAll([
            '.game-opening-prologue-subtitle-fire-core',
            '.game-opening-prologue-subtitle-fire-outer',
            '.game-opening-prologue-subtitle-fire-smoke',
            '.game-opening-prologue-subtitle-fire-fx'
        ].join(', ')).forEach((node) => {
            node.style.removeProperty('opacity');
            node.style.removeProperty('transform');
        });
        const embersHost = wrap.querySelector('.game-opening-prologue-subtitle-fire-embers');
        if (embersHost) embersHost.innerHTML = '';
    }

    function resolveSubtitleLogoFireMotion(progress, flickerSeed) {
        const impact = PROLOGUE_SUBTITLE_LOGO_EXPLOSIVE_IMPACT;
        const flicker = 0.82 + (0.18 * Math.sin((progress * 48) + flickerSeed));

        if (progress < impact) {
            const t = progress / impact;
            return {
                scale: 0.04 + (t * 0.1),
                opacity: t * 0.18,
                blur: 10,
                brightness: 0.28 + (t * 0.22),
                fireCoreOpacity: t * 0.28 * flicker,
                fireCoreScale: 0.12 + (t * 0.28),
                fireCoreScaleY: 0.18 + (t * 0.42),
                fireOuterOpacity: t * 0.16 * flicker,
                fireOuterScale: 0.1 + (t * 0.34),
                fireOuterScaleY: 0.14 + (t * 0.52),
                fireOuterRotate: -4 + (t * 8),
                fireSmokeOpacity: 0,
                fireSmokeScale: 0.2,
                shake: 0
            };
        }

        if (progress < 0.48) {
            const t = (progress - impact) / (0.48 - impact);
            const burst = 1 - ((1 - t) ** 2.2);
            return {
                scale: 0.14 + (burst * 1.2),
                opacity: Math.min(1, 0.18 + (burst * 1.02)),
                blur: Math.max(0, 8 * (1 - t)),
                brightness: 1.1 + ((1 - t) * 0.95),
                fireCoreOpacity: (0.2 + ((1 - t) * 0.95)) * flicker,
                fireCoreScale: 0.4 + (burst * 1.05),
                fireCoreScaleY: 0.55 + (burst * 1.45),
                fireOuterOpacity: (0.15 + ((1 - t) * 0.88)) * flicker,
                fireOuterScale: 0.35 + (burst * 1.55),
                fireOuterScaleY: 0.5 + (burst * 1.85),
                fireOuterRotate: -8 + (burst * 16),
                fireSmokeOpacity: Math.max(0, (t - 0.35) * 0.55),
                fireSmokeScale: 0.45 + (burst * 1.15),
                shake: Math.sin((progress - impact) * 88) * 6 * (1 - t)
            };
        }

        const t = (progress - 0.48) / 0.52;
        const settle = 1 - ((1 - t) ** 3);
        const emberGlow = Math.max(0, 0.42 * (1 - t));
        return {
            scale: 1.34 - (settle * 0.34),
            opacity: 1,
            blur: 0,
            brightness: 1 + ((1 - settle) * 0.12),
            fireCoreOpacity: emberGlow * flicker,
            fireCoreScale: 1.45 - (settle * 0.35),
            fireCoreScaleY: 1.95 - (settle * 0.75),
            fireOuterOpacity: emberGlow * 0.72 * flicker,
            fireOuterScale: 1.9 - (settle * 0.45),
            fireOuterScaleY: 2.25 - (settle * 0.55),
            fireOuterRotate: 8 - (settle * 8),
            fireSmokeOpacity: Math.max(0, 0.38 * (1 - t)),
            fireSmokeScale: 1.55 + (t * 0.35),
            shake: 0
        };
    }

    function spawnFireEmberBurst(wrap) {
        const embersHost = wrap?.querySelector('.game-opening-prologue-subtitle-fire-embers');
        if (!embersHost) return;

        const width = embersHost.clientWidth || wrap.clientWidth || 320;
        const height = embersHost.clientHeight || wrap.clientHeight || 120;
        const emberCount = 22;

        for (let i = 0; i < emberCount; i += 1) {
            const ember = global.document.createElement('span');
            ember.className = 'game-opening-prologue-fire-ember';
            const x = width * (0.12 + (Math.random() * 0.76));
            const y = height * (0.34 + (Math.random() * 0.42));
            const dx = (Math.random() - 0.5) * 120;
            const dy = -(36 + (Math.random() * 92));
            const duration = 420 + Math.floor(Math.random() * 520);
            const size = 3 + (Math.random() * 7);
            const isHot = Math.random() < 0.35;

            ember.style.left = `${x}px`;
            ember.style.top = `${y}px`;
            ember.style.width = `${size}px`;
            ember.style.height = `${size * (0.75 + Math.random() * 0.8)}px`;
            ember.style.setProperty('--ember-dx', `${dx.toFixed(1)}px`);
            ember.style.setProperty('--ember-dy', `${dy.toFixed(1)}px`);
            ember.style.setProperty('--ember-duration', `${duration}ms`);
            if (isHot) ember.classList.add('is-hot');

            embersHost.appendChild(ember);
            ember.addEventListener('animationend', () => ember.remove(), { once: true });
            global.setTimeout(() => ember.remove(), duration + 80);
        }
    }

    function applySubtitleLogoFireLayers(wrap, motion) {
        if (!wrap) return;

        const coreEl = wrap.querySelector('.game-opening-prologue-subtitle-fire-core');
        const outerEl = wrap.querySelector('.game-opening-prologue-subtitle-fire-outer');
        const smokeEl = wrap.querySelector('.game-opening-prologue-subtitle-fire-smoke');

        if (coreEl) {
            coreEl.style.opacity = String(motion.fireCoreOpacity);
            coreEl.style.transform = `translate(-50%, -50%) scale(${motion.fireCoreScale.toFixed(3)}, ${motion.fireCoreScaleY.toFixed(3)})`;
        }
        if (outerEl) {
            outerEl.style.opacity = String(motion.fireOuterOpacity);
            outerEl.style.transform = `translate(-50%, -50%) rotate(${motion.fireOuterRotate.toFixed(2)}deg) scale(${motion.fireOuterScale.toFixed(3)}, ${motion.fireOuterScaleY.toFixed(3)})`;
        }
        if (smokeEl) {
            smokeEl.style.opacity = String(motion.fireSmokeOpacity);
            smokeEl.style.transform = `translate(-50%, -50%) scale(${motion.fireSmokeScale.toFixed(3)})`;
        }
    }

    function fireSubtitleLogoExplosionImpact(subtitleLogoEl, generation) {
        playPrologueSubtitleLogoSfx();

        const wrap = resolveSubtitleLogoWrap(subtitleLogoEl);
        if (wrap) spawnFireEmberBurst(wrap);

        const sparksHost = resolveSubtitleSparksHost(subtitleLogoEl);
        if (sparksHost && global.RoyalArmiesSubtitleLogoSparks) {
            if (typeof global.RoyalArmiesSubtitleLogoSparks.burst === 'function') {
                for (let i = 0; i < 3; i += 1) {
                    global.RoyalArmiesSubtitleLogoSparks.burst(sparksHost, {
                        sparksPerBurst: PROLOGUE_SUBTITLE_LOGO_EXPLOSIVE_BURST_SPARKS,
                        flashChance: 1
                    });
                }
            }
            startSubtitleLogoSparks(subtitleLogoEl, generation);
        }
    }

    function playSubtitleLogoExplosiveAnimation(logoEl, generation, options) {
        if (!logoEl) return Promise.resolve();

        const animationOptions = options && typeof options === 'object' ? options : {};
        const onComplete = typeof animationOptions.onComplete === 'function'
            ? animationOptions.onComplete
            : null;
        const wrap = resolveSubtitleLogoWrap(logoEl);
        const durationMs = PROLOGUE_SUBTITLE_LOGO_EXPLOSIVE_MS;
        const flickerSeed = Math.random() * Math.PI * 2;
        const reducedMotion = global.matchMedia
            && global.matchMedia('(prefers-reduced-motion: reduce)').matches;

        if (reducedMotion) {
            return playLogoArriveAnimation(logoEl, 360, generation, {
                easing: 'linear',
                onComplete: () => {
                    fireSubtitleLogoExplosionImpact(logoEl, generation);
                    if (onComplete) onComplete();
                }
            });
        }

        return new Promise((resolve) => {
            logoEl.hidden = false;
            logoEl.classList.remove('is-arrived');
            logoEl.classList.add('is-arriving', 'is-exploding');
            wrap?.classList.add('is-exploding');

            const startedAt = global.performance?.now?.() ?? Date.now();
            let settled = false;
            let impactFired = false;
            let completeFired = false;

            const finish = () => {
                if (settled || generation !== logoRevealGeneration) return;
                settled = true;
                logoEl.classList.remove('is-arriving', 'is-exploding');
                logoEl.classList.add('is-arrived');
                logoEl.style.removeProperty('transform');
                logoEl.style.removeProperty('opacity');
                logoEl.style.removeProperty('filter');
                resetSubtitleLogoExplosionState(logoEl);
                resolve();
            };

            const tick = (now) => {
                if (settled || generation !== logoRevealGeneration) return;

                const elapsed = now - startedAt;
                const progress = durationMs <= 0 ? 1 : Math.min(1, elapsed / durationMs);
                const motion = resolveSubtitleLogoFireMotion(progress, flickerSeed);

                if (!impactFired && progress >= PROLOGUE_SUBTITLE_LOGO_EXPLOSIVE_IMPACT) {
                    impactFired = true;
                    fireSubtitleLogoExplosionImpact(logoEl, generation);
                }

                logoEl.style.opacity = String(motion.opacity);
                logoEl.style.transform = `scale3d(${motion.scale}, ${motion.scale}, ${motion.scale}) translateZ(0)`;
                logoEl.style.filter = [
                    `blur(${motion.blur}px)`,
                    `brightness(${motion.brightness})`,
                    `saturate(${1.05 + (motion.fireCoreOpacity * 0.35)})`,
                    `drop-shadow(0 0 ${10 + (motion.fireCoreOpacity * 18)}px rgba(255, 96, 12, 0.72))`,
                    `drop-shadow(0 0 ${24 + (motion.fireOuterOpacity * 34)}px rgba(255, 42, 0, 0.48))`
                ].join(' ');

                if (wrap) {
                    wrap.style.transform = motion.shake
                        ? `translate(${motion.shake.toFixed(2)}px, ${(motion.shake * 0.35).toFixed(2)}px)`
                        : '';
                }

                applySubtitleLogoFireLayers(wrap, motion);

                if (progress < 1) {
                    global.requestAnimationFrame(tick);
                    return;
                }

                if (onComplete && !completeFired) {
                    completeFired = true;
                    onComplete();
                }

                finish();
            };

            logoEl.style.opacity = '0';
            logoEl.style.transform = 'scale3d(0.04, 0.04, 0.04) translateZ(0)';
            logoEl.style.filter = 'blur(10px) brightness(0.28) saturate(0.85)';
            applySubtitleLogoFireLayers(wrap, resolveSubtitleLogoFireMotion(0, flickerSeed));

            global.requestAnimationFrame(tick);
            global.setTimeout(finish, durationMs + 160);
        });
    }

    function playLogoArriveAnimation(logoEl, durationMs, generation, options) {
        if (!logoEl) return Promise.resolve();

        const animationOptions = options && typeof options === 'object' ? options : {};
        const useLinearMotion = animationOptions.easing === 'linear';
        const onComplete = typeof animationOptions.onComplete === 'function'
            ? animationOptions.onComplete
            : null;

        return new Promise((resolve) => {
            logoEl.hidden = false;
            logoEl.classList.remove('is-arrived');
            logoEl.classList.add('is-arriving');

            const startedAt = global.performance?.now?.() ?? Date.now();
            let settled = false;
            let completeFired = false;

            const finish = () => {
                if (settled || generation !== logoRevealGeneration) return;
                settled = true;
                logoEl.classList.remove('is-arriving');
                logoEl.classList.add('is-arrived');
                logoEl.style.removeProperty('transform');
                logoEl.style.removeProperty('opacity');
                logoEl.style.removeProperty('filter');
                resolve();
            };

            const resolveMotionProgress = (progress) => {
                if (useLinearMotion) return progress;
                return 1 - ((1 - progress) ** 3);
            };

            const tick = (now) => {
                if (settled || generation !== logoRevealGeneration) return;

                const elapsed = now - startedAt;
                const progress = durationMs <= 0 ? 1 : Math.min(1, elapsed / durationMs);
                const motion = resolveMotionProgress(progress);
                const scale = 0.04 + (0.96 * motion);
                const depth = -1400 + (1400 * motion);
                const opacity = useLinearMotion ? motion : Math.min(1, motion * 1.15);
                const blur = 14 * (1 - motion);

                logoEl.style.opacity = String(opacity);
                logoEl.style.transform = `scale3d(${scale}, ${scale}, ${scale}) translateZ(${depth}px)`;
                logoEl.style.filter = `blur(${blur}px)`;

                if (progress < 1) {
                    global.requestAnimationFrame(tick);
                    return;
                }

                if (onComplete && !completeFired) {
                    completeFired = true;
                    onComplete();
                }

                finish();
            };

            logoEl.style.opacity = '0';
            logoEl.style.transform = 'scale3d(0.04, 0.04, 0.04) translateZ(-1400px)';
            logoEl.style.filter = 'blur(14px)';
            global.requestAnimationFrame(tick);
            global.setTimeout(finish, durationMs + 160);
        });
    }

    function clearSubtitlesForPostNarrationHold() {
        if (subtitleEl) subtitleEl.textContent = '';
        setSubtitleDockActive(false);
        clearCinematicShots();
    }

    function clearLogoReveal() {
        logoRevealGeneration += 1;

        if (!overlayEl) return;

        overlayEl.classList.remove('is-logo-reveal-active');
        resetLoreToolBackdrop();
        clearSubtitleLogoSparks();
        clearEnterWarGate();
        overlayEl.querySelectorAll('.game-opening-prologue-logo').forEach((logoEl) => {
            resetLogoElement(logoEl, { hideSubtitle: true });
        });

        if (subtitleLogoSfxEl) {
            subtitleLogoSfxEl.pause();
            subtitleLogoSfxEl.currentTime = 0;
        }
    }

    async function runSequentialLogoReveal() {
        ensureOverlay();
        if (!overlayEl) return;

        const generation = logoRevealGeneration + 1;
        logoRevealGeneration = generation;

        const titleLogoEl = overlayEl.querySelector('.game-opening-prologue-logo--title');
        const subtitleLogoEl = overlayEl.querySelector('.game-opening-prologue-logo--subtitle');

        overlayEl.classList.add('is-logo-reveal-active');
        resetLoreToolBackdrop();
        resetLogoElement(titleLogoEl);
        resetLogoElement(subtitleLogoEl, { hideSubtitle: true });

        await playLogoArriveAnimation(
            titleLogoEl,
            isTrailerPage() ? TRAILER_TITLE_LOGO_REVEAL_MS : PROLOGUE_TITLE_LOGO_REVEAL_MS,
            generation
        );
        if (generation !== logoRevealGeneration) return;

        if (isTrailerPage()) {
            unlockTrailerImpactAudio();
        }

        await playSubtitleLogoExplosiveAnimation(subtitleLogoEl, generation, {
            onComplete: () => {
                if (generation !== logoRevealGeneration) return;
                loreToolFadePromise = beginLoreToolFadeIn(generation);
            }
        });
        if (generation !== logoRevealGeneration) return;
    }

    function getTrailerPlaybackNowSec() {
        const musicAudio = getTrailerMusicAudio();
        if (musicAudio && Number.isFinite(musicAudio.currentTime)) {
            return TRAILER_MUSIC_START_SEC + musicAudio.currentTime;
        }
        return trailerReplayTimeSec;
    }

    function resetTrailerCreditsState() {
        trailerCreditsGeneration += 1;
        trailerCreditsRunning = false;

        const logoStage = overlayEl?.querySelector('.game-opening-prologue-logo-stage');
        logoStage?.classList.remove('is-trailer-main-finale-hidden');
        logoStage?.querySelector('.game-opening-prologue-logo-stack')?.style.removeProperty('opacity');
        logoStage?.querySelector('.game-opening-prologue-lore-tool')?.style.removeProperty('opacity');

        const creditsEl = overlayEl?.querySelector('#game-opening-prologue-trailer-credits');
        if (!creditsEl) return;

        creditsEl.hidden = true;
        creditsEl.classList.remove('is-active');
        creditsEl.querySelectorAll('.game-opening-prologue-trailer-credits-panel').forEach((panel) => {
            panel.style.removeProperty('opacity');
        });
    }

    function waitTrailerPlaybackMs(ms, generation) {
        let remaining = Math.max(0, Number(ms) || 0);

        return new Promise((resolve) => {
            const tick = () => {
                if (!isTrailerReplayMode || generation !== logoRevealGeneration) {
                    resolve(false);
                    return;
                }

                if (trailerCreditsRunning && generation !== trailerCreditsGeneration) {
                    resolve(false);
                    return;
                }

                if (!isTrailerReplayPlaying) {
                    global.setTimeout(tick, 120);
                    return;
                }

                if (remaining <= 0) {
                    resolve(true);
                    return;
                }

                const slice = Math.min(120, remaining);
                remaining -= slice;
                global.setTimeout(tick, slice);
            };

            tick();
        });
    }

    function animateTrailerElementsOpacity(elements, from, to, durationMs) {
        const targets = (elements || []).filter(Boolean);
        if (!targets.length) return Promise.resolve();

        const spanMs = Math.max(16, Number(durationMs) || 0);
        const startOpacity = Math.max(0, Math.min(1, Number(from) || 0));
        const endOpacity = Math.max(0, Math.min(1, Number(to) || 0));
        const startedAt = global.performance?.now?.() ?? Date.now();

        return new Promise((resolve) => {
            const tick = (now) => {
                const progress = Math.min(1, (now - startedAt) / spanMs);
                const opacity = startOpacity + ((endOpacity - startOpacity) * progress);
                const opacityText = String(opacity);

                targets.forEach((el) => {
                    el.style.opacity = opacityText;
                });

                if (progress < 1) {
                    global.requestAnimationFrame(tick);
                } else {
                    resolve();
                }
            };

            global.requestAnimationFrame(tick);
        });
    }

    function computeTrailerCreditsTimings() {
        const fadeOutMainMs = 1500;
        const greenmaskInMs = 2200;
        const greenmaskOutMs = 1500;
        const alphaInMs = 2200;
        const alphaOutMs = 1800;
        const thanksInMs = 2000;
        const thanksOutMs = 1500;

        const remainingMs = Math.max(
            6000,
            ((getTrailerMusicEndSec() - getTrailerPlaybackNowSec()) * 1000) - TRAILER_CREDITS_MUSIC_END_BUFFER_MS
        );
        const fixedMs = fadeOutMainMs + greenmaskInMs + greenmaskOutMs + alphaInMs + alphaOutMs
            + thanksInMs + thanksOutMs;
        const holdBudgetMs = Math.max(3000, remainingMs - fixedMs);

        return {
            fadeOutMainMs,
            greenmaskInMs,
            greenmaskHoldMs: Math.round(holdBudgetMs * 0.35),
            greenmaskOutMs,
            alphaInMs,
            alphaHoldMs: Math.round(holdBudgetMs * 0.5),
            alphaOutMs,
            thanksInMs,
            thanksHoldMs: Math.round(holdBudgetMs * 0.15),
            thanksOutMs,
        };
    }

    function computeTrailerCreditsFadeOutMs(defaultMs) {
        const msUntilEnd = ((getTrailerMusicEndSec() - getTrailerPlaybackNowSec()) * 1000)
            - TRAILER_CREDITS_MUSIC_END_BUFFER_MS;
        return Math.max(800, Math.min(defaultMs, msUntilEnd));
    }

    async function fadeTrailerMainFinaleOut(durationMs) {
        const logoStage = overlayEl?.querySelector('.game-opening-prologue-logo-stage');
        if (!logoStage) return;

        const logoStack = logoStage.querySelector('.game-opening-prologue-logo-stack');
        const loreToolEl = logoStage.querySelector('.game-opening-prologue-lore-tool');

        if (loreToolEl) {
            loreToolEl.style.transition = 'none';
            void loreToolEl.offsetWidth;
        }

        const fadeJobs = [];
        if (logoStack) {
            fadeJobs.push(animateTrailerElementsOpacity([logoStack], 1, 0, durationMs));
        }
        if (loreToolEl) {
            const inlineOpacity = parseFloat(loreToolEl.style.opacity);
            const fromOpacity = Number.isFinite(inlineOpacity) && inlineOpacity > 0
                ? inlineOpacity
                : TRAILER_LORE_TOOL_PEAK_OPACITY;
            fadeJobs.push(animateTrailerElementsOpacity([loreToolEl], fromOpacity, 0, durationMs));
        }

        await Promise.all(fadeJobs);
        logoStage.classList.add('is-trailer-main-finale-hidden');
    }

    async function runTrailerCreditsSequence(generation) {
        if (!isTrailerPage() || !isTrailerReplayMode || generation !== logoRevealGeneration) return;

        trailerCreditsGeneration = generation;
        trailerCreditsRunning = true;

        const creditsEl = overlayEl?.querySelector('#game-opening-prologue-trailer-credits');
        const greenmaskPanel = creditsEl?.querySelector('.game-opening-prologue-trailer-credits-panel--greenmask');
        const alphaPanel = creditsEl?.querySelector('.game-opening-prologue-trailer-credits-panel--alpha');
        const thanksPanel = creditsEl?.querySelector('.game-opening-prologue-trailer-credits-panel--thanks');
        if (!creditsEl || !greenmaskPanel || !alphaPanel || !thanksPanel) {
            trailerCreditsRunning = false;
            return;
        }

        creditsEl.hidden = false;
        creditsEl.classList.add('is-active');
        greenmaskPanel.style.opacity = '0';
        alphaPanel.style.opacity = '0';
        thanksPanel.style.opacity = '0';

        const timings = computeTrailerCreditsTimings();

        if (generation !== logoRevealGeneration || generation !== trailerCreditsGeneration) {
            trailerCreditsRunning = false;
            return;
        }

        await fadeTrailerMainFinaleOut(timings.fadeOutMainMs);

        if (generation !== logoRevealGeneration || generation !== trailerCreditsGeneration) {
            trailerCreditsRunning = false;
            return;
        }

        await animateTrailerElementsOpacity([greenmaskPanel], 0, 1, timings.greenmaskInMs);

        if (!(await waitTrailerPlaybackMs(timings.greenmaskHoldMs, generation))) {
            trailerCreditsRunning = false;
            return;
        }

        await animateTrailerElementsOpacity([greenmaskPanel], 1, 0, timings.greenmaskOutMs);

        if (generation !== logoRevealGeneration || generation !== trailerCreditsGeneration) {
            trailerCreditsRunning = false;
            return;
        }

        await animateTrailerElementsOpacity([alphaPanel], 0, 1, timings.alphaInMs);

        if (!(await waitTrailerPlaybackMs(timings.alphaHoldMs, generation))) {
            trailerCreditsRunning = false;
            return;
        }

        const alphaOutMs = computeTrailerCreditsFadeOutMs(timings.alphaOutMs);
        await animateTrailerElementsOpacity([alphaPanel], 1, 0, alphaOutMs);

        if (generation !== logoRevealGeneration || generation !== trailerCreditsGeneration) {
            trailerCreditsRunning = false;
            return;
        }

        await animateTrailerElementsOpacity([thanksPanel], 0, 1, timings.thanksInMs);

        if (!(await waitTrailerPlaybackMs(timings.thanksHoldMs, generation))) {
            trailerCreditsRunning = false;
            return;
        }

        const thanksOutMs = computeTrailerCreditsFadeOutMs(timings.thanksOutMs);
        await animateTrailerElementsOpacity([thanksPanel], 1, 0, thanksOutMs);

        trailerCreditsRunning = false;
    }

    function showTrailerOutro() {
        const outroEl = overlayEl?.querySelector('#game-opening-prologue-trailer-outro');
        if (!outroEl) return;

        outroEl.hidden = false;
        outroEl.classList.remove('is-visible', 'is-taglines-visible');
        void outroEl.offsetWidth;
        global.requestAnimationFrame(() => {
            outroEl.classList.add('is-visible');
            global.setTimeout(() => {
                outroEl.classList.add('is-taglines-visible');
            }, 860);
        });
    }

    function hideTrailerOutro() {
        const outroEl = overlayEl?.querySelector('#game-opening-prologue-trailer-outro');
        if (!outroEl) return;
        outroEl.hidden = true;
        outroEl.classList.remove('is-visible', 'is-taglines-visible');
    }

    function showEnterWarButton() {
        const enterWarBtn = overlayEl?.querySelector('#game-opening-prologue-enter-war-btn');
        if (!enterWarBtn) return;
        enterWarBtn.classList.remove('is-visible');
        enterWarBtn.hidden = false;
        // Let the browser paint opacity:0 before animating — hidden→visible in one frame skips the transition.
        void enterWarBtn.offsetWidth;
        global.requestAnimationFrame(() => {
            enterWarBtn.classList.add('is-visible');
        });
    }

    function hideEnterWarButton() {
        const enterWarBtn = overlayEl?.querySelector('#game-opening-prologue-enter-war-btn');
        if (!enterWarBtn) return;
        enterWarBtn.hidden = true;
        enterWarBtn.classList.remove('is-visible');
    }

    async function resolveEnterWarGate(reason) {
        if (!enterWarGateResolver) return;
        const resolve = enterWarGateResolver;
        enterWarGateResolver = null;
        enterWarExitReason = reason;
        hideEnterWarButton();

        if (global.RoyalArmiesMusicFlow
            && typeof global.RoyalArmiesMusicFlow.cancelWaitForTrackEnd === 'function') {
            global.RoyalArmiesMusicFlow.cancelWaitForTrackEnd();
        }

        if (reason === 'button'
            && global.RoyalArmiesMusicFlow
            && typeof global.RoyalArmiesMusicFlow.handoffToGameplayMusic === 'function') {
            await global.RoyalArmiesMusicFlow.handoffToGameplayMusic({
                fadeOutMs: PROLOGUE_MUSIC_OUT_FADE_MS
            });
        }

        resolve(reason);
    }

    function clearEnterWarGate() {
        if (global.RoyalArmiesMusicFlow
            && typeof global.RoyalArmiesMusicFlow.cancelWaitForTrackEnd === 'function') {
            global.RoyalArmiesMusicFlow.cancelWaitForTrackEnd();
        }
        if (enterWarGateResolver) {
            const resolve = enterWarGateResolver;
            enterWarGateResolver = null;
            resolve('cancelled');
        }
        enterWarExitReason = null;
        hideEnterWarButton();
        if (!isTrailerFinaleLocked) {
            hideTrailerOutro();
        }
    }

    async function waitForEnterWarGate(generation) {
        if (loreToolFadePromise) {
            await loreToolFadePromise;
        }

        if (generation !== logoRevealGeneration) return;

        if (isTrailerPage()) {
            if (generation !== logoRevealGeneration) return;

            isTrailerFinaleLocked = true;
            overlayEl?.classList.add('is-trailer-finale-locked');
            ensureTrailerFinaleDomVisible();
            showTrailerOutro();

            const holdOk = await waitTrailerPlaybackMs(
                TRAILER_CREDITS_TAGLINES_REVEAL_MS + TRAILER_MAIN_FINALE_HOLD_MS,
                generation
            );
            if (!holdOk || generation !== logoRevealGeneration) return;

            await runTrailerCreditsSequence(generation);
            return;
        }

        return new Promise((resolve) => {
            enterWarGateResolver = resolve;
            showEnterWarButton();
        });
    }

    async function runPostNarrationHoldSequence() {
        isPostNarrationHold = true;
        await fadeOutCinematicChromeIfNeeded();
        clearSubtitlesForPostNarrationHold();

        const musicRamp = global.RoyalArmiesMusicFlow
            && typeof global.RoyalArmiesMusicFlow.rampMusicVolume === 'function'
            ? global.RoyalArmiesMusicFlow.rampMusicVolume(
                PROLOGUE_MUSIC_VOLUME,
                PROLOGUE_MUSIC_PEAK_VOLUME,
                PROLOGUE_MUSIC_PEAK_RAMP_MS
            )
            : Promise.resolve();

        await Promise.all([
            runSequentialLogoReveal(),
            musicRamp
        ]);

        if (!isPostNarrationHold) return;

        await waitForEnterWarGate(logoRevealGeneration);
        isPostNarrationHold = false;
    }

    async function fadePrologueBackgroundMusicOut() {
        if (global.RoyalArmiesMusicFlow
            && typeof global.RoyalArmiesMusicFlow.fadeMusicOut === 'function') {
            await global.RoyalArmiesMusicFlow.fadeMusicOut(PROLOGUE_MUSIC_OUT_FADE_MS);
            return;
        }

        clearPrologueMusicAnimation();
    }

    function clearMusicDelayTimer() {
        if (musicDelayTimer) {
            global.clearTimeout(musicDelayTimer);
            musicDelayTimer = null;
        }
    }

    function isProloguePlaybackActive() {
        return isPlaying || isPostNarrationHold || isFadingOut;
    }

    function shouldForcePrologueRestart() {
        try {
            return new URLSearchParams(global.location.search).get('riftProgressionReset') === '1';
        } catch (_err) {
            return false;
        }
    }

    function resetStaleLocalPrologueState(options) {
        const force = Boolean(options && options.force);
        if (!force && isProloguePlaybackActive()) return;

        clearMusicDelayTimer();
        clearPrologueMusicAnimation();
        stopSubtitleSyncLoop();
        clearCinematicShots();
        clearLogoReveal();
        clearEnterWarGate();
        isPlaying = false;
        isPostNarrationHold = false;
        isFadingOut = false;
        setLocalProloguePending(false);
    }

    async function finishPrologue(reason) {
        if (!isProloguePlaybackActive() || isFadingOut) return;

        if (isTrailerPage()) {
            pauseTrailerReplayPlayback();
            clearMusicDelayTimer();
            clearPrologueMusicAnimation();
            stopSubtitleSyncLoop();
            isPlaying = false;
            audioEl?.pause();

            if (reason !== 'completed') {
                await fadePrologueBackgroundMusicOut();
                hideOverlay();
            }

            setLocalProloguePending(false);
            global.dispatchEvent(new CustomEvent('royalarmies:opening-prologue-finished', {
                detail: {
                    reason: reason || 'completed',
                    enterWarExitReason: enterWarExitReason || null,
                    trailerReplayMode: isTrailerReplayMode
                }
            }));
            enterWarExitReason = null;
            return;
        }

        clearEnterWarGate();
        clearMusicDelayTimer();
        clearPrologueMusicAnimation();
        stopSubtitleSyncLoop();
        isPlaying = false;

        if (audioEl) {
            audioEl.pause();
            audioEl.currentTime = 0;
        }

        if (reason === 'completed') {
            await runPostNarrationHoldSequence();
        }

        isFadingOut = true;

        if (reason !== 'completed') {
            await fadePrologueBackgroundMusicOut();
        }

        if (overlayEl && !overlayEl.hidden) {
            overlayEl.classList.add('is-revealing');
            await waitPrologueFade(PROLOGUE_REVEAL_FADE_MS);
        }

        hideOverlay();
        setLocalProloguePending(false);

        global.dispatchEvent(new CustomEvent('royalarmies:opening-prologue-finished', {
            detail: {
                reason: reason || 'completed',
                enterWarExitReason: enterWarExitReason || null
            }
        }));

        enterWarExitReason = null;

        if (typeof finishCallback === 'function') {
            const cb = finishCallback;
            finishCallback = null;
            cb(reason);
        }

        if (isCinematicPage() && !isTrailerPage() && reason !== 'error') {
            await transitionToProgressionScreen();
        }
    }

    async function startTrailerPlayerExperience(options) {
        if (!isTrailerPage() || !shouldRunOpeningPrologue()) {
            return Promise.resolve('disabled');
        }
        if (isTrailerReplayMode && isTrailerReplayPlaying) {
            return Promise.resolve('already-playing');
        }

        resetStaleLocalPrologueState({ force: shouldForcePrologueRestart() });

        ensureOverlay();
        preloadCinematicImages();
        finishCallback = typeof options?.onComplete === 'function' ? options.onComplete : null;
        ensureSubtitleLogoSfx();

        activeCueIndex = -1;
        showOverlay({ subtitles: true });

        await prepareCueTimeline();

        if (audioEl) {
            audioEl.volume = PROLOGUE_NARRATION_VOLUME;
            audioEl.currentTime = 0;
        }

        mountTrailerPlayerLayout();
        enterTrailerReplayMode();

        return Promise.resolve('playing');
    }

    async function startLocalPrologue(options) {
        if (!shouldRunOpeningPrologue()) {
            return Promise.resolve('disabled');
        }
        if (isTrailerPage()) {
            return startTrailerPlayerExperience(options);
        }
        if (isProloguePlaybackActive()) {
            return Promise.resolve('already-playing');
        }

        resetStaleLocalPrologueState({ force: shouldForcePrologueRestart() });

        ensureOverlay();
        preloadCinematicImages();
        finishCallback = typeof options?.onComplete === 'function' ? options.onComplete : null;
        setLocalProloguePending(true);
        isPlaying = true;

        activeCueIndex = -1;
        showOverlay({ subtitles: true });

        await prepareCueTimeline();

        primeCinematicFrame();

        if (audioEl) {
            audioEl.volume = PROLOGUE_NARRATION_VOLUME;
            audioEl.currentTime = 0;
            audioEl.play()
                .catch(() => {
                    finishPrologue('blocked');
                });
        }

        startSubtitleSyncLoop();

        musicDelayTimer = global.setTimeout(() => {
            musicDelayTimer = null;
            ensurePrologueBackgroundMusic();
        }, PROLOGUE_MUSIC_DELAY_MS);

        return Promise.resolve('playing');
    }

    function bootOpeningPrologue() {
        if (!shouldRunOpeningPrologue()) return;
        if (isTrailerPage()) {
            bindTrailerOrientationListeners();
            updateTrailerOrientationClasses();
            void startTrailerPlayerExperience();
            return;
        }
        startLocalPrologue();
    }

    global.RoyalArmiesOpeningPrologue = {
        isCinematicPage: function isOpeningPrologueCinematicPage() {
            return isCinematicPage();
        },
        isPlaying: function isProloguePlaying() {
            return isPlaying || isPostNarrationHold;
        },
        shouldHoldProgression: function shouldHoldProgression() {
            return isProloguePlaybackActive();
        },
        start: startLocalPrologue,
        skip: function skipPrologue() {
            finishPrologue('skipped');
        },
        getCueTimings: function getCueTimings() {
            return LOCAL_PROLOGUE_CUES.map((cue) => ({
                scriptStart: cue.start,
                scriptEnd: cue.end,
                audioStart: toAudioTimelineTime(cue.start),
                audioEnd: toAudioTimelineTime(cue.end),
                scale: cueTimelineScale,
                text: cue.text
            }));
        },
        getCinematicTimings: function getCinematicTimings() {
            return PROLOGUE_CINEMATIC_SHOTS.map((shot) => ({
                id: shot.id,
                src: shot.src,
                scriptStart: shot.scriptStart,
                scriptEnd: shot.scriptEnd,
                audioStart: toAudioTimelineTime(shot.scriptStart),
                audioEnd: toAudioTimelineTime(shot.scriptEnd),
                scale: cueTimelineScale
            }));
        }
    };

    if (global.document.readyState === 'loading') {
        global.document.addEventListener('DOMContentLoaded', bootOpeningPrologue, { once: true });
    } else {
        bootOpeningPrologue();
    }
})(window);
