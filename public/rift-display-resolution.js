/**
 * RIFT — Display resolution presets (virtual layout scale for desktop game pages).
 */
(function initRoyalArmiesDisplayResolution(global) {
    'use strict';

    const STORAGE_KEY = 'savedDisplayResolution';
    const DEFAULT_PRESET_ID = 'auto';
    const SCALE_MIN = 0.45;
    const SCALE_MAX = 2;

    const PRESETS = Object.freeze([
        { id: 'auto', label: 'Auto (monitor native)', width: 0, height: 0 },
        { id: '1280x720', label: '1280 × 720 (HD)', width: 1280, height: 720 },
        { id: '1366x768', label: '1366 × 768 (WXGA)', width: 1366, height: 768 },
        { id: '1600x900', label: '1600 × 900 (HD+)', width: 1600, height: 900 },
        { id: '1920x1080', label: '1920 × 1080 (Full HD)', width: 1920, height: 1080 },
        { id: '2560x1440', label: '2560 × 1440 (QHD)', width: 2560, height: 1440 },
        { id: '3840x2160', label: '3840 × 2160 (4K UHD)', width: 3840, height: 2160 }
    ]);

    const PRESET_BY_ID = PRESETS.reduce((map, preset) => {
        map[preset.id] = preset;
        return map;
    }, Object.create(null));

    const CANVAS_SELECTORS = [
        '#main-dashboard-canvas',
        '#game-page-canvas',
        '.game-page-canvas',
        '#age-page-canvas',
        '.age-page-canvas',
        '#how-did-you-get-here-canvas',
        '.how-did-you-get-here-canvas'
    ];

    function normalizePresetId(raw) {
        const id = String(raw || '').trim().toLowerCase();
        return PRESET_BY_ID[id] ? id : DEFAULT_PRESET_ID;
    }

    function readStoredPresetId() {
        try {
            return normalizePresetId(global.localStorage.getItem(STORAGE_KEY));
        } catch (_err) {
            return DEFAULT_PRESET_ID;
        }
    }

    function writeStoredPresetId(presetId) {
        try {
            global.localStorage.setItem(STORAGE_KEY, normalizePresetId(presetId));
        } catch (_err) {
            /* ignore */
        }
    }

    function isDesktopGameLayout() {
        try {
            return global.matchMedia('(min-width: 1025px)').matches;
        } catch (_err) {
            return true;
        }
    }

    function resolvePreset(presetId) {
        return PRESET_BY_ID[normalizePresetId(presetId)] || PRESET_BY_ID[DEFAULT_PRESET_ID];
    }

    function computeScaleForFrame(frame, presetId) {
        const preset = resolvePreset(presetId);
        if (preset.id === 'auto' || !isDesktopGameLayout()) {
            return 1;
        }

        const layoutWidth = Math.max(320, Number(frame?.layoutWidth) || 0);
        const layoutHeight = Math.max(320, Number(frame?.layoutHeight) || 0);
        if (!layoutWidth || !layoutHeight) return 1;

        const scale = Math.min(
            preset.width / layoutWidth,
            preset.height / layoutHeight
        );

        return Math.min(SCALE_MAX, Math.max(SCALE_MIN, scale));
    }

    function resolveCanvasSurfaces() {
        const surfaces = [];
        const seen = new Set();
        CANVAS_SELECTORS.forEach((selector) => {
            global.document.querySelectorAll(selector).forEach((node) => {
                if (!seen.has(node)) {
                    seen.add(node);
                    surfaces.push(node);
                }
            });
        });
        return surfaces;
    }

    function clearResolutionArtifacts() {
        const docEl = global.document.documentElement;
        if (!docEl) return;

        docEl.classList.remove('ra-display-resolution-active');
        docEl.dataset.raDisplayResolution = DEFAULT_PRESET_ID;
        docEl.style.removeProperty('--ra-display-resolution-scale');
        docEl.style.removeProperty('--ra-display-resolution-label');

        resolveCanvasSurfaces().forEach((surface) => {
            surface.classList.remove('ra-display-resolution-surface');
            surface.style.removeProperty('transform');
            surface.style.removeProperty('transform-origin');
            surface.style.removeProperty('width');
            surface.style.removeProperty('min-height');
        });
    }

    function applyPreset(presetId, frame) {
        const docEl = global.document.documentElement;
        if (!docEl) return { presetId: DEFAULT_PRESET_ID, scale: 1 };

        const normalizedId = normalizePresetId(presetId);
        const preset = resolvePreset(normalizedId);
        const scale = computeScaleForFrame(frame, normalizedId);

        clearResolutionArtifacts();

        docEl.dataset.raDisplayResolution = preset.id;
        docEl.style.setProperty('--ra-display-resolution-label', preset.label);

        if (preset.id === 'auto' || !isDesktopGameLayout()) {
            return { presetId: preset.id, scale: 1 };
        }

        docEl.classList.add('ra-display-resolution-active');
        docEl.style.setProperty('--ra-display-resolution-scale', String(scale));

        resolveCanvasSurfaces().forEach((surface) => {
            surface.classList.add('ra-display-resolution-surface');
            surface.style.transform = `scale(${scale})`;
            surface.style.transformOrigin = 'top center';
            surface.style.width = `calc(100% / ${scale})`;
            surface.style.minHeight = `calc(100dvh / ${scale})`;
        });

        return { presetId: preset.id, scale };
    }

    function sync(frame) {
        const presetId = readStoredPresetId();
        return applyPreset(presetId, frame);
    }

    function stagePreset(presetId, frame) {
        return applyPreset(presetId, frame);
    }

    function confirmPreset(presetId, frame) {
        const normalizedId = normalizePresetId(presetId);
        writeStoredPresetId(normalizedId);
        return applyPreset(normalizedId, frame);
    }

    function getPresets() {
        return PRESETS.slice();
    }

    global.RoyalArmiesDisplayResolution = {
        STORAGE_KEY,
        DEFAULT_PRESET_ID,
        getPresets,
        resolvePreset,
        normalizePresetId,
        readStoredPresetId,
        writeStoredPresetId,
        computeScaleForFrame,
        applyPreset,
        stagePreset,
        confirmPreset,
        sync
    };

    if (global.document.readyState === 'loading') {
        global.document.addEventListener('DOMContentLoaded', () => {
            sync({
                layoutWidth: global.innerWidth,
                layoutHeight: global.innerHeight
            });
        }, { once: true });
    } else {
        sync({
            layoutWidth: global.innerWidth,
            layoutHeight: global.innerHeight
        });
    }
})(typeof window !== 'undefined' ? window : globalThis);
