/**
 * RIFT — Full-screen settlement workspaces: hide map chrome while any venue workspace is open.
 */
(function initRoyalArmiesImmersiveWorkspace(global) {
    'use strict';

    const IMMERSIVE_CLASS = 'age-immersive-workspace-open';

    const WORKSPACE_OPEN_BODY_CLASSES = Object.freeze([
        'age-settlement-venue-open',
        'age-army-workspace-open',
        'age-barracks-open',
        'age-roster-review-open',
        'age-unit-evolution-open',
        'age-guild-hub-open',
        'age-guild-overlay-open',
        'age-guild-training-open',
        'age-watchtower-open'
    ]);

    const VISIBLE_WORKSPACE_SELECTORS = Object.freeze([
        '#age-settlement-venue-workspace:not([hidden])',
        '#age-barracks-workspace:not([hidden])',
        '#age-roster-review-workspace:not([hidden])',
        '#age-unit-evolution-workspace:not([hidden])',
        '#age-guild-workspace:not([hidden])',
        '#age-watchtower-workspace:not([hidden])'
    ]);

    function hasVisibleWorkspaceElement() {
        const doc = global.document;
        if (!doc) return false;
        return VISIBLE_WORKSPACE_SELECTORS.some((selector) => doc.querySelector(selector));
    }

    function hasWorkspaceBodyClass() {
        const body = global.document?.body;
        if (!body) return false;
        return WORKSPACE_OPEN_BODY_CLASSES.some((cls) => body.classList.contains(cls));
    }

    function isAnyWorkspaceOpen() {
        return hasWorkspaceBodyClass() && hasVisibleWorkspaceElement();
    }

    function sync() {
        const body = global.document?.body;
        if (!body) return;
        body.classList.toggle(IMMERSIVE_CLASS, isAnyWorkspaceOpen());
    }

    global.RoyalArmiesImmersiveWorkspace = Object.freeze({
        sync,
        isOpen: isAnyWorkspaceOpen
    });
})(typeof window !== 'undefined' ? window : globalThis);
