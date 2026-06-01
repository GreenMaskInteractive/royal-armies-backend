/**
 * RIFT — Global UI hover/select SFX (uihover.wav / uiselect.wav) for mouse-driven controls.
 */
(function initRoyalArmiesUiSfx(global) {
    'use strict';

    const HOVER_AUDIO_ID = 'hover-sound';
    const SELECT_AUDIO_ID = 'select-sound';
    const HOVER_SRC = 'audio/uihover.wav';
    const SELECT_SRC = 'audio/uiselect.wav';
    const DEFAULT_VOLUME = 0.2;

    const INTERACTIVE_SELECTOR = [
        'a[href]',
        'button',
        'summary',
        'select',
        'input[type="button"]',
        'input[type="submit"]',
        'input[type="reset"]',
        'input[type="checkbox"]',
        'input[type="radio"]',
        'label[for]',
        '[role="button"]',
        '[role="menuitem"]',
        '[role="tab"]',
        '[role="link"]',
        '[role="option"]',
        '[role="switch"]',
        '[role="checkbox"]',
        '[role="radio"]',
        '[data-ui-interactive]',
        '.nav-icon',
        '.img-btn',
        '.radial-slot',
        '.update-item',
        '.quest-card',
        '.close-modal',
        '.forgot-link',
        '.confirm-btn',
        '.cancel-btn',
        '.revert-btn',
        '.portal-nav-tab',
        '.portal-mobile-nav-page-item',
        '.media-playlist-track-btn',
        '.game-onboarding-progress-step',
        '.game-class-option',
        '.game-region-list-item',
        '.game-region-nation-item',
        '.game-opening-prologue-enter-war-btn',
        '.game-opening-prologue-skip',
        '.age-bottom-music-btn',
        '.age-guild-training-return-btn',
        '#age-guild-battle-btn'
    ].join(', ');

    const HOVER_SKIP_SELECTOR = [
        '[data-ui-sfx-hover="off"]',
        '.action-btn-aura-housing',
        '.action-btn-aura-housing *'
    ].join(', ');

    const SELECT_SKIP_SELECTOR = [
        '[data-ui-sfx-select="off"]',
        '.action-btn-aura-housing',
        '.action-btn-aura-housing *'
    ].join(', ');

    let hoverAudio = null;
    let selectAudio = null;
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
    }

    function isDisabledControl(element) {
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

    function isPointerInteractive(element) {
        if (!element || !(element instanceof Element)) return false;
        if (isDisabledControl(element)) return false;
        if (element.matches('input:not([type="button"]):not([type="submit"]):not([type="reset"]):not([type="checkbox"]):not([type="radio"]), textarea')) {
            return false;
        }

        if (element.matches(INTERACTIVE_SELECTOR)) return true;

        try {
            const style = global.getComputedStyle(element);
            if (style.cursor === 'pointer' && style.pointerEvents !== 'none') {
                return !element.matches('[aria-hidden="true"], .is-hidden, [hidden]');
            }
        } catch (_err) {
            /* ignore */
        }

        return false;
    }

    function resolveInteractiveTarget(fromElement) {
        let node = fromElement instanceof Element ? fromElement : null;

        while (node && node !== global.document.documentElement) {
            if (isPointerInteractive(node)) {
                return node;
            }
            node = node.parentElement;
        }

        return null;
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

    function onDocumentMouseOver(event) {
        const target = resolveInteractiveTarget(event.target);
        if (!target) return;
        if (matchesSkipSelector(target, HOVER_SKIP_SELECTOR)) return;
        if (target.contains(event.relatedTarget)) return;

        playHoverSFX();
    }

    function onDocumentClick(event) {
        if (event.defaultPrevented) return;

        const target = resolveInteractiveTarget(event.target);
        if (!target) return;
        if (matchesSkipSelector(target, SELECT_SKIP_SELECTOR)) return;

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

    global.RoyalArmiesUiSfx = {
        playHover: playHoverSFX,
        playSelect: playSelectSFX,
        resolveInteractiveTarget
    };

    if (global.document.readyState === 'loading') {
        global.document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
        init();
    }
})(window);
