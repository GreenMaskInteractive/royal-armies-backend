/**
 * RIFT — wraps plain action button labels with shine/label structure for the canonical framed design.
 * Applies to confirm, cancel, revert, undo, and related modal action buttons.
 */
(function initRoyalArmiesConfirmButtons(global) {
    'use strict';

    const ENHANCED_FLAG = 'confirmEnhanced';
    const ACTION_BTN_SELECTOR = [
        '.confirm-btn',
        '.revert-btn',
        '.cancel-btn',
        '.modal-action-btn.confirm',
        '.modal-action-btn.cancel',
        '.chat-compose-context-cancel',
        '.age-hq-planning-clear-btn',
        '.game-location-back-region-btn',
        '.suicide-safe-retreat-btn'
    ].join(', ');

    function isActionButton(button) {
        return Boolean(button && button.matches && button.matches(ACTION_BTN_SELECTOR));
    }

    function enhanceActionButton(button) {
        if (!isActionButton(button)) return;
        if (button.dataset[ENHANCED_FLAG] === 'true') return;
        if (button.querySelector('.confirm-btn-label')) {
            button.dataset[ENHANCED_FLAG] = 'true';
            return;
        }

        const label = global.document.createElement('span');
        label.className = 'confirm-btn-label';

        while (button.firstChild) {
            label.appendChild(button.firstChild);
        }

        const shine = global.document.createElement('span');
        shine.className = 'confirm-btn-shine';
        shine.setAttribute('aria-hidden', 'true');

        button.appendChild(shine);
        button.appendChild(label);
        button.dataset[ENHANCED_FLAG] = 'true';
    }

    function enhanceAll(root) {
        const scope = root && typeof root.querySelectorAll === 'function' ? root : global.document;
        scope.querySelectorAll(ACTION_BTN_SELECTOR).forEach(enhanceActionButton);
    }

    function observeDynamicButtons() {
        if (!global.document.body || typeof global.MutationObserver !== 'function') return;

        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (!node || node.nodeType !== 1) return;
                    if (isActionButton(node)) {
                        enhanceActionButton(node);
                    }
                    if (node.querySelectorAll) {
                        enhanceAll(node);
                    }
                });
            });
        });

        observer.observe(global.document.body, { childList: true, subtree: true });
    }

    function boot() {
        enhanceAll(global.document);
        observeDynamicButtons();
    }

    if (global.document.readyState === 'loading') {
        global.document.addEventListener('DOMContentLoaded', boot, { once: true });
    } else {
        boot();
    }

    global.RoyalArmiesConfirmButtons = {
        enhance: enhanceActionButton,
        enhanceAll,
        isActionButton
    };
})(typeof window !== 'undefined' ? window : globalThis);
