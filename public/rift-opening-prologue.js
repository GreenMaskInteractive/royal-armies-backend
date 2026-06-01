/**
 * RIFT — Opening narrative prologue (local dev preview only).
 * Plays distressedwoman.mp3 with sentence subtitles on every game-page visit.
 */
(function initRoyalArmiesOpeningPrologue(global) {
    'use strict';

    const OVERLAY_ID = 'game-opening-prologue';
    const AUDIO_ID = 'game-opening-prologue-audio';
    const SUBTITLE_ID = 'game-opening-prologue-subtitle';

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

    const PROLOGUE_AUDIO_SRC = 'audio/distressedwoman.mp3';
    const PROLOGUE_NARRATION_VOLUME = 1;
    const PROLOGUE_MUSIC_VOLUME = 0.3;
    const PROLOGUE_MUSIC_PEAK_VOLUME = 0.7;
    /** Narration starts immediately; background music joins after this delay. */
    const PROLOGUE_MUSIC_DELAY_MS = 2000;
    /** Black screen hold after narration; music ramps to peak over this duration. */
    const PROLOGUE_POST_NARRATION_HOLD_MS = 15000;
    const PROLOGUE_MUSIC_OUT_FADE_MS = 1200;
    const PROLOGUE_REVEAL_FADE_MS = 900;

    let overlayEl = null;
    let subtitleEl = null;
    let audioEl = null;
    let isPlaying = false;
    let isPostNarrationHold = false;
    let isFadingOut = false;
    let musicDelayTimer = null;
    let subtitleSyncFrame = null;
    let cueTimelineScale = 1;
    let activeCueIndex = -1;
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

    function shouldRunLocalPrologue() {
        return isLocalDevHost() && isGamePage();
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
        if (overlayEl && global.document.contains(overlayEl)) return overlayEl;

        overlayEl = global.document.createElement('div');
        overlayEl.id = OVERLAY_ID;
        overlayEl.className = 'game-opening-prologue';
        overlayEl.setAttribute('role', 'dialog');
        overlayEl.setAttribute('aria-modal', 'true');
        overlayEl.setAttribute('aria-label', 'Opening narrative');
        overlayEl.hidden = true;
        overlayEl.innerHTML = `
            <div class="game-opening-prologue-scrim" aria-hidden="true"></div>
            <div class="game-opening-prologue-subtitle-dock">
                <p id="${SUBTITLE_ID}" class="game-opening-prologue-subtitle" aria-live="polite"></p>
            </div>
            <button type="button" class="game-opening-prologue-skip" id="game-opening-prologue-skip">Skip prologue (local dev)</button>
        `.trim();

        audioEl = global.document.createElement('audio');
        audioEl.id = AUDIO_ID;
        audioEl.preload = 'auto';
        audioEl.setAttribute('playsinline', '');
        audioEl.src = PROLOGUE_AUDIO_SRC;
        audioEl.volume = PROLOGUE_NARRATION_VOLUME;

        (global.document.body || global.document.documentElement).appendChild(overlayEl);
        global.document.body.appendChild(audioEl);

        subtitleEl = overlayEl.querySelector(`#${SUBTITLE_ID}`);
        const skipBtn = overlayEl.querySelector('#game-opening-prologue-skip');
        if (skipBtn) {
            skipBtn.addEventListener('click', () => finishPrologue('skipped'));
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

        return new Promise((resolve) => {
            const onReady = () => {
                const duration = Number.isFinite(audioEl.duration) && audioEl.duration > 0
                    ? audioEl.duration
                    : null;
                resolve(duration);
            };

            audioEl.addEventListener('loadedmetadata', onReady, { once: true });
            audioEl.addEventListener('durationchange', onReady, { once: true });
            audioEl.load();
        });
    }

    async function prepareCueTimeline() {
        const audioDuration = await waitForNarrationMetadata();
        updateCueTimelineScale(audioDuration);
    }

    function renderSubtitleCue(cueIndex) {
        if (!subtitleEl) return;
        const cue = LOCAL_PROLOGUE_CUES[cueIndex];
        if (!cue) {
            subtitleEl.textContent = '';
            return;
        }

        subtitleEl.textContent = cue.text;
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

    function startSubtitleSyncLoop() {
        stopSubtitleSyncLoop();

        const tick = () => {
            syncSubtitleToAudioTime();
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
        overlayEl.hidden = false;
        overlayEl.classList.remove('is-revealing');
        if (options && options.subtitles === true) {
            overlayEl.classList.add('is-subtitles-active');
        } else {
            overlayEl.classList.remove('is-subtitles-active');
        }
        global.document.body.classList.add('game-opening-prologue-active');
    }

    function hideOverlay() {
        if (overlayEl) {
            overlayEl.hidden = true;
            overlayEl.classList.remove('is-revealing', 'is-subtitles-active');
        }
        global.document.body.classList.remove('game-opening-prologue-active');
        if (subtitleEl) subtitleEl.textContent = '';
        activeCueIndex = -1;
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

    function clearSubtitlesForPostNarrationHold() {
        if (subtitleEl) subtitleEl.textContent = '';
        if (overlayEl) overlayEl.classList.remove('is-subtitles-active');
    }

    async function runPostNarrationHoldSequence() {
        isPostNarrationHold = true;
        clearSubtitlesForPostNarrationHold();

        if (global.RoyalArmiesMusicFlow
            && typeof global.RoyalArmiesMusicFlow.rampMusicVolume === 'function') {
            await global.RoyalArmiesMusicFlow.rampMusicVolume(
                PROLOGUE_MUSIC_VOLUME,
                PROLOGUE_MUSIC_PEAK_VOLUME,
                PROLOGUE_POST_NARRATION_HOLD_MS
            );
        } else {
            await waitPrologueFade(PROLOGUE_POST_NARRATION_HOLD_MS);
        }

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
        isPlaying = false;
        isPostNarrationHold = false;
        isFadingOut = false;
        setLocalProloguePending(false);
    }

    async function finishPrologue(reason) {
        if (!isProloguePlaybackActive() || isFadingOut) return;

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
        await fadePrologueBackgroundMusicOut();

        if (overlayEl && !overlayEl.hidden) {
            overlayEl.classList.add('is-revealing');
            await waitPrologueFade(PROLOGUE_REVEAL_FADE_MS);
        }

        hideOverlay();
        setLocalProloguePending(false);

        global.dispatchEvent(new CustomEvent('royalarmies:opening-prologue-finished', {
            detail: { reason: reason || 'completed' }
        }));

        if (typeof finishCallback === 'function') {
            const cb = finishCallback;
            finishCallback = null;
            cb(reason);
        }
    }

    async function startLocalPrologue(options) {
        if (!shouldRunLocalPrologue()) {
            return Promise.resolve('disabled');
        }
        if (isProloguePlaybackActive()) {
            return Promise.resolve('already-playing');
        }

        resetStaleLocalPrologueState({ force: shouldForcePrologueRestart() });

        ensureOverlay();
        finishCallback = typeof options?.onComplete === 'function' ? options.onComplete : null;
        setLocalProloguePending(true);

        await prepareCueTimeline();

        isPlaying = true;
        activeCueIndex = -1;
        showOverlay({ subtitles: true });
        syncSubtitleToAudioTime();

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

    function bootGamePagePrologue() {
        if (!shouldRunLocalPrologue()) return;
        startLocalPrologue();
    }

    global.RoyalArmiesOpeningPrologue = {
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
        }
    };

    if (global.document.readyState === 'loading') {
        global.document.addEventListener('DOMContentLoaded', bootGamePagePrologue, { once: true });
    } else {
        bootGamePagePrologue();
    }
})(window);
