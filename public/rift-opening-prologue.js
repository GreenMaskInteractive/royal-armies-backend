/**
 * RIFT — Opening narrative prologue (local dev preview only).
 * Plays distressedwoman.mp3 with karaoke-style subtitles on every game-page visit.
 */
(function initRoyalArmiesOpeningPrologue(global) {
    'use strict';

    const OVERLAY_ID = 'game-opening-prologue';
    const AUDIO_ID = 'game-opening-prologue-audio';
    const SUBTITLE_ID = 'game-opening-prologue-subtitle';

    /**
     * Tune paragraph start/end seconds, then sentence cues are split automatically.
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
    /** Background music plays through the whole prologue; narration starts after this lead-in. */
    const PROLOGUE_MUSIC_LEAD_MS = 5000;
    const PROLOGUE_REVEAL_FADE_MS = 900;

    let overlayEl = null;
    let subtitleEl = null;
    let audioEl = null;
    let isPlaying = false;
    let isLeadInActive = false;
    let isFadingOut = false;
    let leadInTimer = null;
    let activeCueIndex = -1;
    let finishCallback = null;
    const LOCAL_PROLOGUE_PENDING_KEY = 'royalArmies_localProloguePending';

    function splitParagraphIntoSentences(text) {
        return String(text || '')
            .match(/[^.!?]+[.!?]+|[^.!?]+$/g)
            ?.map((sentence) => sentence.trim())
            .filter(Boolean) || [];
    }

    function buildSentenceCuesFromParagraphBlocks(blocks) {
        const cues = [];

        blocks.forEach((block) => {
            const sentences = splitParagraphIntoSentences(block.text);
            if (!sentences.length) return;

            const totalWeight = sentences.reduce((sum, sentence) => sum + sentence.length, 0) || 1;
            const span = Math.max(0.001, block.end - block.start);
            let cursor = block.start;

            sentences.forEach((sentence, index) => {
                const isLast = index === sentences.length - 1;
                const end = isLast
                    ? block.end
                    : cursor + (span * (sentence.length / totalWeight));
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
            global.RoyalArmiesMusicFlow.startGamePageArchimedes();
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

        (global.document.body || global.document.documentElement).appendChild(overlayEl);
        global.document.body.appendChild(audioEl);

        subtitleEl = overlayEl.querySelector(`#${SUBTITLE_ID}`);
        const skipBtn = overlayEl.querySelector('#game-opening-prologue-skip');
        if (skipBtn) {
            skipBtn.addEventListener('click', () => finishPrologue('skipped'));
        }

        audioEl.addEventListener('timeupdate', onPrologueTimeUpdate);
        audioEl.addEventListener('ended', () => finishPrologue('completed'));
        audioEl.addEventListener('error', () => finishPrologue('error'));

        return overlayEl;
    }

    function tokenizeCueText(text) {
        return String(text || '').trim().split(/\s+/).filter(Boolean);
    }

    function renderSubtitleCue(cueIndex, spokenWordCount) {
        if (!subtitleEl) return;
        const cue = LOCAL_PROLOGUE_CUES[cueIndex];
        if (!cue) {
            subtitleEl.textContent = '';
            return;
        }

        const words = tokenizeCueText(cue.text);
        subtitleEl.innerHTML = words.map((word, index) => {
            const spoken = index < spokenWordCount;
            const pending = index === spokenWordCount;
            const classes = [
                'game-opening-prologue-word',
                spoken ? 'is-spoken' : '',
                pending ? 'is-pending' : ''
            ].filter(Boolean).join(' ');
            return `<span class="${classes}">${escapeHtml(word)}</span>`;
        }).join(' ');
    }

    function escapeHtml(value) {
        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function resolveActiveCueIndex(currentTime) {
        for (let i = 0; i < LOCAL_PROLOGUE_CUES.length; i += 1) {
            const cue = LOCAL_PROLOGUE_CUES[i];
            if (currentTime >= cue.start && currentTime < cue.end) {
                return i;
            }
        }
        if (currentTime >= LOCAL_PROLOGUE_CUES[LOCAL_PROLOGUE_CUES.length - 1].end) {
            return LOCAL_PROLOGUE_CUES.length - 1;
        }
        return 0;
    }

    function resolveSpokenWordCount(cue, currentTime) {
        const words = tokenizeCueText(cue.text);
        if (!words.length) return 0;
        const span = Math.max(0.001, cue.end - cue.start);
        const progress = Math.max(0, Math.min(1, (currentTime - cue.start) / span));
        return Math.min(words.length, Math.floor(progress * words.length) + (progress > 0 ? 1 : 0));
    }

    function onPrologueTimeUpdate() {
        if (!audioEl || !isPlaying) return;

        const t = audioEl.currentTime || 0;
        const cueIndex = resolveActiveCueIndex(t);
        const cue = LOCAL_PROLOGUE_CUES[cueIndex];
        const spokenCount = resolveSpokenWordCount(cue, t);

        if (cueIndex !== activeCueIndex) {
            activeCueIndex = cueIndex;
        }
        renderSubtitleCue(cueIndex, spokenCount);
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
    }

    function waitPrologueFade(ms) {
        return new Promise((resolve) => {
            global.setTimeout(resolve, ms);
        });
    }

    function clearPrologueLeadInTimer() {
        if (leadInTimer) {
            global.clearTimeout(leadInTimer);
            leadInTimer = null;
        }
        isLeadInActive = false;
    }

    function isPrologueSequenceActive() {
        return isPlaying || isLeadInActive || isFadingOut || isLocalProloguePending();
    }

    function beginNarrationPlayback() {
        clearPrologueLeadInTimer();
        isPlaying = true;
        activeCueIndex = -1;
        ensurePrologueBackgroundMusic();
        showOverlay({ subtitles: true });
        renderSubtitleCue(0, 0);

        if (!audioEl) return;
        audioEl.currentTime = 0;
        audioEl.play()
            .catch(() => {
                finishPrologue('blocked');
            });
    }

    async function finishPrologue(reason) {
        if (!isPrologueSequenceActive() || isFadingOut) return;

        clearPrologueLeadInTimer();
        isPlaying = false;
        isLeadInActive = false;
        isFadingOut = true;

        if (audioEl) {
            audioEl.pause();
            audioEl.currentTime = 0;
        }

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

    function startLocalPrologue(options) {
        if (!shouldRunLocalPrologue()) {
            return Promise.resolve('disabled');
        }
        if (isPrologueSequenceActive()) {
            return Promise.resolve('already-playing');
        }

        ensureOverlay();
        finishCallback = typeof options?.onComplete === 'function' ? options.onComplete : null;
        setLocalProloguePending(true);
        isLeadInActive = true;
        ensurePrologueBackgroundMusic();
        showOverlay({ subtitles: false });

        leadInTimer = global.setTimeout(() => {
            beginNarrationPlayback();
        }, PROLOGUE_MUSIC_LEAD_MS);

        return Promise.resolve('lead-in');
    }

    function bootGamePagePrologue() {
        if (!shouldRunLocalPrologue()) return;
        startLocalPrologue();
    }

    global.RoyalArmiesOpeningPrologue = {
        isPlaying: function isProloguePlaying() {
            return isPlaying || isLeadInActive;
        },
        shouldHoldProgression: function shouldHoldProgression() {
            return isPrologueSequenceActive();
        },
        start: startLocalPrologue,
        skip: function skipPrologue() {
            finishPrologue('skipped');
        },
        getCueTimings: function getCueTimings() {
            return LOCAL_PROLOGUE_CUES.map((cue) => ({ start: cue.start, end: cue.end, text: cue.text }));
        }
    };

    if (global.document.readyState === 'loading') {
        global.document.addEventListener('DOMContentLoaded', bootGamePagePrologue, { once: true });
    } else {
        bootGamePagePrologue();
    }
})(window);
