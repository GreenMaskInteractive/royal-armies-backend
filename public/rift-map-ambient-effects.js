/**
 * RIFT — map weather and time-of-day ambient effects preference bridge.
 * Default: disabled (effects are not created until the commander opts in).
 */
(function (global) {
    const STORAGE_KEY = 'savedMapAmbientEffects';

    function readEnabled() {
        return global.localStorage?.getItem(STORAGE_KEY) === 'true';
    }

    function writeEnabled(enabled) {
        try {
            global.localStorage.setItem(STORAGE_KEY, enabled ? 'true' : 'false');
        } catch (_err) {
            /* ignore quota errors */
        }
    }

    function apply(enabled) {
        const next = !!enabled;
        writeEnabled(next);
        if (typeof global.RoyalArmiesAgeWorldMapAmbient?.setEnabled === 'function') {
            global.RoyalArmiesAgeWorldMapAmbient.setEnabled(next);
        }
    }

    global.RoyalArmiesMapAmbientEffects = {
        isEnabled: readEnabled,
        readPreference: readEnabled,
        apply
    };
})(typeof window !== 'undefined' ? window : globalThis);
