/**
 * RIFT — Global UI hover/select SFX (uihover.wav / uiselect.wav) for button controls only.
 */
(function initRoyalArmiesUiSfx(global) {
    'use strict';

    const HOVER_AUDIO_ID = 'hover-sound';
    const SELECT_AUDIO_ID = 'select-sound';
    const HOVER_SRC = 'audio/uihover.wav';
    const SELECT_SRC = 'audio/uiselect.wav';
    const DISCOVERY_SWOOSH_AUDIO_ID = 'discovery-swoosh-sound';
    const DISCOVERY_SWOOSH_SRC = 'audio/swoosh.wav';
    const JOIN_AGE_SELECT_AUDIO_ID = 'join-age-select-sound';
    const JOIN_AGE_SELECT_SRC = 'audio/joinagesfxselect.wav';
    const DISCOVERY_UNLOCK_VOLUME_SCALE = 0.68;
    /** Synced to FLEX `riftDiscoveryToastReveal` duration (style2.css). */
    const DISCOVERY_TOAST_REVEAL_MS = 720;
    const DISCOVERY_SWOOSH_AT_MS = 0;
    const DISCOVERY_CHIME_AT_MS = DISCOVERY_TOAST_REVEAL_MS;
    const DEFAULT_VOLUME = 0.2;

    const BUTTON_SELECTOR = [
        'button',
        'input[type="button"]',
        'input[type="submit"]',
        'input[type="reset"]',
        '[role="button"]'
    ].join(', ');

    const HOVER_SKIP_SELECTOR = [
        '[data-ui-sfx-hover="off"]',
        '[role="tab"]',
        '.action-btn-aura-housing',
        '.action-btn-aura-housing *',
        '.rift-discovery-toast',
        '.rift-discovery-toast *'
    ].join(', ');

    const SELECT_SKIP_SELECTOR = [
        '[data-ui-sfx-select="off"]',
        '[role="tab"]',
        '.action-btn-aura-housing',
        '.action-btn-aura-housing *',
        '.rift-discovery-toast',
        '.rift-discovery-toast *'
    ].join(', ');

    let hoverAudio = null;
    let selectAudio = null;
    let discoverySwooshAudio = null;
    let discoveryUnlockTimers = [];
    let listenersBound = false;

    function resolvePortalSfxVolume() {
        if (typeof global.currentPortalSfxVol === 'number'
            && typeof global.currentPortalMasterVol === 'number') {
            return Math.max(0, Math.min(1, global.currentPortalSfxVol * global.currentPortalMasterVol));
        }
        return DEFAULT_VOLUME;
    }

    function ensureAudioElement(id, src) {
        let audio = global.document.getElementById(id);
        if (audio) return audio;

        audio = global.document.createElement('audio');
        audio.id = id;
        audio.preload = 'auto';
        audio.setAttribute('playsinline', '');
        audio.src = src;
        (global.document.body || global.document.documentElement).appendChild(audio);
        return audio;
    }

    function primeAudioElements() {
        hoverAudio = ensureAudioElement(HOVER_AUDIO_ID, HOVER_SRC);
        selectAudio = ensureAudioElement(SELECT_AUDIO_ID, SELECT_SRC);
        discoverySwooshAudio = ensureAudioElement(DISCOVERY_SWOOSH_AUDIO_ID, DISCOVERY_SWOOSH_SRC);
    }

    function resolveDiscoveryChimeAudio() {
        const existing = global.document.getElementById(JOIN_AGE_SELECT_AUDIO_ID);
        if (existing) return existing;
        return ensureAudioElement(JOIN_AGE_SELECT_AUDIO_ID, JOIN_AGE_SELECT_SRC);
    }

    function clearDiscoveryUnlockTimers() {
        discoveryUnlockTimers.forEach((timerId) => global.clearTimeout(timerId));
        discoveryUnlockTimers = [];
    }

    function playDiscoveryAudioElement(audio, volume) {
        if (!audio) return;
        audio.volume = volume;
        audio.currentTime = 0;
        audio.play().catch(() => {});
    }

    function isDisabledButton(element) {
        if (!element) return true;
        if (element.matches(':disabled')) return true;
        if (element.getAttribute('aria-disabled') === 'true') return true;
        if (element.classList.contains('disabled') || element.classList.contains('is-disabled')) return true;
        if (element.hasAttribute('hidden')) return true;
        return false;
    }

    function matchesSkipSelector(element, skipSelector) {
        return Boolean(element && element.closest(skipSelector));
    }

    function isButtonControl(element) {
        if (!element || !(element instanceof Element)) return false;
        if (!element.matches(BUTTON_SELECTOR)) return false;
        if (element.getAttribute('role') === 'tab') return false;
        return !isDisabledButton(element);
    }

    function resolveButtonTarget(fromElement) {
        const button = fromElement instanceof Element ? fromElement.closest(BUTTON_SELECTOR) : null;
        return isButtonControl(button) ? button : null;
    }

    function playHoverSFX() {
        primeAudioElements();
        if (!hoverAudio) return;

        hoverAudio.volume = resolvePortalSfxVolume();
        hoverAudio.currentTime = 0;
        hoverAudio.play().catch(() => {});
    }

    function playSelectSFX() {
        primeAudioElements();
        if (!selectAudio) return;

        selectAudio.volume = resolvePortalSfxVolume();
        selectAudio.currentTime = 0;
        selectAudio.play().catch(() => {});
    }

    function playDiscoveryUnlockSfx() {
        const volume = resolvePortalSfxVolume() * DISCOVERY_UNLOCK_VOLUME_SCALE;
        if (volume <= 0) return;

        primeAudioElements();
        clearDiscoveryUnlockTimers();

        const chimeAudio = resolveDiscoveryChimeAudio();

        discoveryUnlockTimers.push(global.setTimeout(() => {
            playDiscoveryAudioElement(discoverySwooshAudio, volume);
        }, DISCOVERY_SWOOSH_AT_MS));

        discoveryUnlockTimers.push(global.setTimeout(() => {
            playDiscoveryAudioElement(chimeAudio, volume);
        }, DISCOVERY_CHIME_AT_MS));
    }

    function onDocumentMouseOver(event) {
        const target = resolveButtonTarget(event.target);
        if (!target) return;
        if (matchesSkipSelector(target, HOVER_SKIP_SELECTOR)) return;
        if (target.contains(event.relatedTarget)) return;

        playHoverSFX();
    }

    function onDocumentClick(event) {
        if (event.defaultPrevented) return;

        const target = resolveButtonTarget(event.target);
        if (!target) return;
        if (matchesSkipSelector(target, SELECT_SKIP_SELECTOR)) return;
        if (global.RoyalArmiesDiscoveries
            && typeof global.RoyalArmiesDiscoveries.shouldSuppressPortalUiSelect === 'function'
            && global.RoyalArmiesDiscoveries.shouldSuppressPortalUiSelect()) {
            return;
        }

        playSelectSFX();
    }

    function bindDocumentListeners() {
        if (listenersBound || !global.document) return;
        listenersBound = true;

        global.document.addEventListener('mouseover', onDocumentMouseOver, true);
        global.document.addEventListener('click', onDocumentClick, true);
    }

    function init() {
        primeAudioElements();
        bindDocumentListeners();
    }

    global.playHoverSFX = playHoverSFX;
    global.playSelectSFX = playSelectSFX;
    global.playDiscoveryUnlockSfx = playDiscoveryUnlockSfx;

    global.RoyalArmiesUiSfx = {
        playHover: playHoverSFX,
        playSelect: playSelectSFX,
        playDiscoveryUnlock: playDiscoveryUnlockSfx,
        discoveryToastRevealMs: DISCOVERY_TOAST_REVEAL_MS,
        discoverySwooshAtMs: DISCOVERY_SWOOSH_AT_MS,
        discoveryChimeAtMs: DISCOVERY_CHIME_AT_MS,
        resolveButtonTarget,
        resolveInteractiveTarget: resolveButtonTarget
    };

    if (global.document.readyState === 'loading') {
        global.document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
        init();
    }
})(window);
