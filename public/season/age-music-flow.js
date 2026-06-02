/**
 * @deprecated Use /age-music-flow.js (canonical cross-page soundtrack module).
 * Season preview HTML now loads the root module directly.
 */
(function loadCanonicalRoyalArmiesMusicFlow(global) {
    'use strict';
    if (global.RoyalArmiesMusicFlow) return;

    const script = global.document.createElement('script');
    script.src = '../age-music-flow.js?v=game-age-only-1';
    script.async = false;
    (global.document.head || global.document.documentElement).appendChild(script);
}(window));
