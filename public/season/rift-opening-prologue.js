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
    const CRITICAL_STYLE_ID = 'rift-opening-prologue-critical-styles-v2';
    const NARRATION_METADATA_TIMEOUT_MS = 8000;

    /**
     * Tune paragraph start/end seconds on the script timeline, then sentence cues
     * are split by word count and scaled to the actual narration file duration.
     */
    const LOCAL_PROLOGUE_PARAGRAPH_BLOCKS = Object.freeze([
        {
            start: 0,
            end: 22,
            text: 'The continent of Amnek was once a jewel of the world, its sprawling lands and islands shaped by the hands of my noble ancestors: the Aidoriian race. But time is a river that steals all things, and now, my people have forgotten the greatness that once was.'
        },
        {
            start: 22,
            end: 44,
            text: 'I still hear the whispers of our fallen glory, carried by the tales my mother and father passed down to me. Today, Vaelior stands as the last true kingdom of our bloodline, yet I watch with a heavy heart as it begins to crumble from within. I cannot bear to let our heritage fade into the shadows of history.'
        },
        {
            start: 44,
            end: 58,
            text: 'But what can one lone soul do? The hourglass empties quickly. Soon, even Vaelior will be swallowed whole by the dread invaders who seized our lands during the First Great Transition, the same dark beings who laid our countless kingdoms to ruin.'
        },
        {
            start: 58,
            end: 78,
            text: 'Is there no one left in this fractured realm—no noble heroes or sworn protectors—who still care for the Aidoriian people? Is there anyone brave enough to champion our cause, preserve our history, and deliver us from the encroaching shadows?'
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
    const PROLOGUE_SUBTITLE_LOGO_REVEAL_MS = 1500;
    const PROLOGUE_MUSIC_OUT_FADE_MS = 1200;
    const PROLOGUE_REVEAL_FADE_MS = 900;
    const PROLOGUE_LOGO_SRC = 'images/royalarmiestitle.png?v=logo-trim-gimp-1';
    const PROLOGUE_SUBTITLE_LOGO_SRC = 'season/royalarmiessubtitlelogo.png?v=age-subtitle-1';
    const PROLOGUE_LORE_TOOL_SRC = 'images/royalarmiesloretool.png?v=prologue-lore-tool-1';
    const PROLOGUE_LORE_TOOL_FADE_MS = 12000;
    const PROLOGUE_SUBTITLE_LOGO_SFX_SRC = 'audio/joinagesfxselect.wav';
    const PROLOGUE_SUBTITLE_SPARK_INTERVAL_MS = 170;
    const PROLOGUE_SUBTITLE_SPARKS_PER_BURST = 5;
    const PROLOGUE_SUBTITLE_SPARK_FLASH_CHANCE = 0.24;
    const PROLOGUE_CINEMATIC_FADE_SEC = 1;
    const PROLOGUE_CINEMATIC_IMAGE_VERSION = 'prologue-cinematic-1';

    /**
     * Narration-synced stills (script timeline seconds). Times use M:SS:ff or SS:ff
     * where the last segment is hundredths of a second (17:50 = 17.5s, 1:18:00 = 78s).
     */
    const PROLOGUE_CINEMATIC_SHOT_MARKS = Object.freeze([
        { id: 1, in: '0:00', out: '9:00' },
        { id: 2, in: '10:00', out: '17:50' },
        { id: 3, in: '19:00', out: '26:50' },
        { id: 4, in: '27:50', out: '41:50' },
        { id: 5, in: '45:00', out: '59:00' },
        { id: 6, in: '1:00:50', out: '1:08:50' },
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
    let finishCallback = null;
    const LOCAL_PROLOGUE_PENDING_KEY = 'royalArmies_localProloguePending';

    function splitParagraphIntoSentences(text) {
        return String(text || '')
            .match(/[^.!?]+[.!?]+|[^.!?]+$/g)
            ?.map((sentence) => sentence.trim())
            .filter(Boolean) || [];
    }

    const SCRIPT_TIMELINE_DURATION = LOCAL_PROLOGUE_PARAGRAPH_BLOCKS[
        LOCAL_PROLOGUE_PARAGRAPH_BLOCKS.length - 1
    ].end;

    function countCueWords(text) {
        return String(text || '').trim().split(/\s+/).filter(Boolean).length;
    }

    function buildSentenceCuesFromParagraphBlocks(blocks) {
        const cues = [];

        blocks.forEach((block) => {
            const sentences = splitParagraphIntoSentences(block.text);
            if (!sentences.length) return;

            const wordCounts = sentences.map(countCueWords);
            const totalWords = wordCounts.reduce((sum, count) => sum + count, 0) || 1;
            const span = Math.max(0.001, block.end - block.start);
            let cursor = block.start;

            sentences.forEach((sentence, index) => {
                const isLast = index === sentences.length - 1;
                const end = isLast
                    ? block.end
                    : cursor + (span * (wordCounts[index] / totalWords));
                cues.push({
                    start: cursor,
                    end,
                    text: sentence
                });
                cursor = end;
            });
        });

        return cues;
    }

    const LOCAL_PROLOGUE_CUES = Object.freeze(buildSentenceCuesFromParagraphBlocks(LOCAL_PROLOGUE_PARAGRAPH_BLOCKS));

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

    function isCinematicPage() {
        return global.document.body?.id === 'age-of-war-cinematic-canvas';
    }

    function shouldRunOpeningPrologue() {
        return isLocalDevHost() && isCinematicPage();
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
                padding: 14px 18px !important;
                border: 1px solid rgba(184, 144, 48, 0.35) !important;
                border-radius: 6px !important;
                background: rgba(8, 6, 4, 0.88) !important;
                box-shadow: 0 8px 28px rgba(0, 0, 0, 0.45) !important;
                pointer-events: none !important;
                opacity: 1 !important;
                visibility: visible !important;
                display: block !important;
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
                font-family: Georgia, 'Times New Roman', serif !important;
                font-size: clamp(0.85rem, 1.15vw, 1.05rem) !important;
                line-height: 1.65 !important;
                text-align: center !important;
                color: rgba(255, 242, 210, 0.96) !important;
                text-shadow: 0 1px 12px rgba(0, 0, 0, 0.65) !important;
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
                width: 75% !important;
                max-width: 75% !important;
                aspect-ratio: 16 / 9 !important;
                height: auto !important;
                max-height: min(75%, calc(100% - clamp(128px, 17vh, 188px))) !important;
                flex: 0 0 auto !important;
                border: 2px solid rgba(184, 144, 48, 0.62) !important;
                border-radius: 6px !important;
                overflow: hidden !important;
                background: #080604 !important;
                box-shadow:
                    0 0 0 1px rgba(255, 215, 120, 0.14),
                    0 16px 44px rgba(0, 0, 0, 0.55),
                    inset 0 0 28px rgba(0, 0, 0, 0.32) !important;
            }
            #${OVERLAY_ID} .game-opening-prologue-cinematic-shot {
                position: absolute !important;
                inset: 0 !important;
                opacity: var(--cine-shot-opacity, 0);
                pointer-events: none !important;
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
                transform: translate(-50%, -50%) scale(var(--cine-scale, 1.1))
                    translate(var(--cine-x1, 0%), var(--cine-y1, 0%)) !important;
                will-change: transform !important;
            }
            #${OVERLAY_ID} .game-opening-prologue-cinematic-shot img.is-panning {
                animation: game-opening-prologue-cinematic-pan
                    var(--cine-pan-duration, 8s) linear forwards !important;
            }
            @keyframes game-opening-prologue-cinematic-pan {
                from {
                    transform: translate(-50%, -50%) scale(var(--cine-scale, 1.1))
                        translate(var(--cine-x1, 0%), var(--cine-y1, 0%));
                }
                to {
                    transform: translate(-50%, -50%) scale(var(--cine-scale, 1.1))
                        translate(var(--cine-x2, 0%), var(--cine-y2, 0%));
                }
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

    function preloadCinematicImages() {
        PROLOGUE_CINEMATIC_SHOTS.forEach((shot) => {
            const img = new Image();
            img.decoding = 'async';
            img.src = shot.src;
        });
    }

    function assignRandomCinematicPan(imgEl, durationSec) {
        if (!imgEl) return;

        const panMag = 2.5 + (Math.random() * 4.5);
        const angle = Math.random() * Math.PI * 2;
        const x1 = Math.cos(angle) * panMag;
        const y1 = Math.sin(angle) * panMag;
        const x2 = Math.cos(angle + Math.PI) * panMag;
        const y2 = Math.sin(angle + Math.PI) * panMag;
        const scale = 1.08 + (Math.random() * 0.08);

        imgEl.style.setProperty('--cine-x1', `${x1.toFixed(2)}%`);
        imgEl.style.setProperty('--cine-y1', `${y1.toFixed(2)}%`);
        imgEl.style.setProperty('--cine-x2', `${x2.toFixed(2)}%`);
        imgEl.style.setProperty('--cine-y2', `${y2.toFixed(2)}%`);
        imgEl.style.setProperty('--cine-scale', scale.toFixed(3));
        imgEl.style.setProperty('--cine-pan-duration', `${Math.max(1, durationSec).toFixed(2)}s`);
        imgEl.classList.remove('is-panning');
        void imgEl.offsetWidth;
        imgEl.classList.add('is-panning');
    }

    function clearCinematicShots() {
        cinematicShotEls.forEach((shotEl) => {
            shotEl.style.setProperty('--cine-shot-opacity', '0');
            shotEl.style.opacity = '0';
            shotEl.classList.remove('is-visible');
            shotEl.removeAttribute('data-pan-bound');
            const imgEl = shotEl.querySelector('img');
            if (imgEl) {
                imgEl.classList.remove('is-panning');
            }
        });
        activeCinematicShotId = -1;
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

    function syncCinematicToAudioTime() {
        if (!audioEl || !isPlaying || !cinematicShotEls.length) return;

        const scriptTime = toScriptTimelineTime(audioEl.currentTime || 0);
        let dominantShotId = -1;
        let dominantOpacity = 0;

        cinematicShotEls.forEach((shotEl) => {
            const shotId = Number(shotEl.dataset.cinematicId) || 0;
            const shot = PROLOGUE_CINEMATIC_SHOTS.find((entry) => entry.id === shotId);
            if (!shot) return;

            const opacity = resolveCinematicShotOpacity(scriptTime, shot);
            shotEl.style.setProperty('--cine-shot-opacity', String(opacity));
            shotEl.style.opacity = String(opacity);
            shotEl.classList.toggle('is-visible', opacity > 0);

            if (opacity > 0) {
                const imgEl = shotEl.querySelector('img');
                const remainingScriptSec = Math.max(0.001, shot.scriptEnd - scriptTime);
                const remainingWallSec = remainingScriptSec * (cueTimelineScale > 0 ? cueTimelineScale : 1);

                if (shotEl.dataset.panBound !== '1') {
                    assignRandomCinematicPan(imgEl, remainingWallSec);
                    shotEl.dataset.panBound = '1';
                }

                if (opacity >= dominantOpacity) {
                    dominantOpacity = opacity;
                    dominantShotId = shotId;
                }
            } else {
                shotEl.removeAttribute('data-pan-bound');
                const imgEl = shotEl.querySelector('img');
                if (imgEl) imgEl.classList.remove('is-panning');
            }
        });

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

    function ensurePrologueBackgroundMusic() {
        if (global.RoyalArmiesMusicFlow
            && typeof global.RoyalArmiesMusicFlow.startGamePageArchimedes === 'function') {
            global.RoyalArmiesMusicFlow.startGamePageArchimedes({
                volume: PROLOGUE_MUSIC_VOLUME,
                resetTime: true
            });
        }
    }

    function ensureOverlay() {
        ensurePrologueCriticalStyles();
        removeStalePrologueNodes();

        if (overlayEl && global.document.contains(overlayEl)) {
            if (!overlayEl.querySelector('.game-opening-prologue-cinematic-frame')) {
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
                        <div class="game-opening-prologue-subtitle-sparks" aria-hidden="true"></div>
                        <img
                            src="${PROLOGUE_SUBTITLE_LOGO_SRC}"
                            alt=""
                            class="game-opening-prologue-logo game-opening-prologue-logo--subtitle"
                            decoding="async"
                            hidden
                        >
                    </div>
                    <button
                        type="button"
                        class="game-opening-prologue-enter-war-btn"
                        id="game-opening-prologue-enter-war-btn"
                        hidden
                    >
                        Enter the War
                    </button>
                </div>
            </div>
            <div class="game-opening-prologue-subtitle-dock">
                <p id="${SUBTITLE_ID}" class="game-opening-prologue-subtitle" aria-live="polite"></p>
            </div>
            <button type="button" class="game-opening-prologue-skip" id="game-opening-prologue-skip">${isCinematicPage() ? 'Skip to progression (local dev)' : 'Skip prologue (local dev)'}</button>
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

        audioEl.addEventListener('ended', () => finishPrologue('completed'));
        audioEl.addEventListener('error', () => finishPrologue('error'));

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

    function renderSubtitleCue(cueIndex) {
        if (!subtitleEl) refreshSubtitleElements();
        if (!subtitleEl) return;
        const cue = LOCAL_PROLOGUE_CUES[cueIndex];
        if (!cue) {
            subtitleEl.textContent = '';
            return;
        }

        subtitleEl.textContent = cue.text;
        subtitleEl.style.setProperty('color', 'rgba(255, 242, 210, 0.96)', 'important');
        subtitleEl.style.setProperty('opacity', '1', 'important');
        subtitleEl.style.setProperty('visibility', 'visible', 'important');
    }

    function resolveActiveCueIndex(audioTime) {
        const scriptTime = toScriptTimelineTime(audioTime);
        let index = 0;

        for (let i = 0; i < LOCAL_PROLOGUE_CUES.length; i += 1) {
            if (scriptTime >= LOCAL_PROLOGUE_CUES[i].start) {
                index = i;
            } else {
                break;
            }
        }

        return index;
    }

    function syncSubtitleToAudioTime() {
        if (!audioEl || !isPlaying) return;

        const cueIndex = resolveActiveCueIndex(audioEl.currentTime || 0);
        if (cueIndex === activeCueIndex) return;

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
            renderSubtitleCue(0);
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
        sfx.currentTime = 0;
        sfx.play().catch(() => {});
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
        loreToolEl.style.opacity = '1';

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
        logoEl.classList.remove('is-arriving', 'is-arrived');
        logoEl.style.removeProperty('--prologue-logo-arrive-ms');
        logoEl.style.removeProperty('animation');
        logoEl.style.removeProperty('transform');
        logoEl.style.removeProperty('opacity');
        logoEl.style.removeProperty('filter');

        if (hideSubtitle && logoEl.classList.contains('game-opening-prologue-logo--subtitle')) {
            logoEl.hidden = true;
        }
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

        await playLogoArriveAnimation(titleLogoEl, PROLOGUE_TITLE_LOGO_REVEAL_MS, generation);
        if (generation !== logoRevealGeneration) return;

        await playLogoArriveAnimation(subtitleLogoEl, PROLOGUE_SUBTITLE_LOGO_REVEAL_MS, generation, {
            easing: 'linear',
            onComplete: () => {
                if (generation !== logoRevealGeneration) return;
                playPrologueSubtitleLogoSfx();
                startSubtitleLogoSparks(subtitleLogoEl, generation);
                loreToolFadePromise = beginLoreToolFadeIn(generation);
            }
        });
        if (generation !== logoRevealGeneration) return;
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
    }

    async function waitForEnterWarGate(generation) {
        if (loreToolFadePromise) {
            await loreToolFadePromise;
        }

        if (generation !== logoRevealGeneration) return;

        return new Promise((resolve) => {
            enterWarGateResolver = resolve;
            showEnterWarButton();
        });
    }

    async function runPostNarrationHoldSequence() {
        isPostNarrationHold = true;
        clearSubtitlesForPostNarrationHold();

        const logoMusicRampMs = PROLOGUE_TITLE_LOGO_REVEAL_MS + PROLOGUE_SUBTITLE_LOGO_REVEAL_MS;
        const musicRamp = global.RoyalArmiesMusicFlow
            && typeof global.RoyalArmiesMusicFlow.rampMusicVolume === 'function'
            ? global.RoyalArmiesMusicFlow.rampMusicVolume(
                PROLOGUE_MUSIC_VOLUME,
                PROLOGUE_MUSIC_PEAK_VOLUME,
                logoMusicRampMs
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

        if (isCinematicPage() && reason !== 'error') {
            await transitionToProgressionScreen();
        }
    }

    async function startLocalPrologue(options) {
        if (!shouldRunOpeningPrologue()) {
            return Promise.resolve('disabled');
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
