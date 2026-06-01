/**
 * RIFT — Gold spark bursts for subtitle logo (prologue + Age Alpha HUD).
 */
(function initRoyalArmiesSubtitleLogoSparks(global) {
    'use strict';

    const DEFAULT_INTERVAL_MS = 170;
    const DEFAULT_SPARKS_PER_BURST = 5;
    const DEFAULT_FLASH_CHANCE = 0.24;

    const activeLoops = new WeakMap();

    function spawnSparkParticle(sparksHost, x, y) {
        const spark = global.document.createElement('span');
        spark.className = 'game-opening-prologue-spark';

        const angle = (Math.random() * Math.PI * 2);
        const distance = 16 + (Math.random() * 48);
        const dx = Math.cos(angle) * distance;
        const dy = Math.sin(angle) * distance - (10 + (Math.random() * 28));
        const duration = 280 + Math.floor(Math.random() * 460);
        const isStreak = Math.random() < 0.38;
        const isWhiteHot = Math.random() < 0.42;

        spark.style.left = `${x}px`;
        spark.style.top = `${y}px`;
        spark.style.setProperty('--spark-dx', `${dx.toFixed(1)}px`);
        spark.style.setProperty('--spark-dy', `${dy.toFixed(1)}px`);
        spark.style.setProperty('--spark-duration', `${duration}ms`);

        if (isStreak) {
            spark.classList.add('is-streak');
            spark.style.setProperty('--spark-rotation', `${((angle * 180) / Math.PI).toFixed(1)}deg`);
            spark.style.width = `${8 + Math.floor(Math.random() * 16)}px`;
            spark.style.height = '2px';
        } else {
            const size = 2 + Math.random() * 3.5;
            spark.style.width = `${size}px`;
            spark.style.height = `${size}px`;
        }

        if (isWhiteHot) {
            spark.classList.add('is-white-hot');
        }

        sparksHost.appendChild(spark);
        spark.addEventListener('animationend', () => spark.remove(), { once: true });
        global.setTimeout(() => spark.remove(), duration + 80);
    }

    function spawnSparkFlash(sparksHost, x, y) {
        const flash = global.document.createElement('span');
        flash.className = 'game-opening-prologue-spark-flash';
        flash.style.left = `${x}px`;
        flash.style.top = `${y}px`;
        sparksHost.appendChild(flash);
        flash.addEventListener('animationend', () => flash.remove(), { once: true });
        global.setTimeout(() => flash.remove(), 320);
    }

    function burst(sparksHost, options = {}) {
        if (!sparksHost) return;

        const sparksPerBurst = Number(options.sparksPerBurst) || DEFAULT_SPARKS_PER_BURST;
        const flashChance = Number(options.flashChance) || DEFAULT_FLASH_CHANCE;
        const width = sparksHost.clientWidth;
        const height = sparksHost.clientHeight;
        if (width <= 0 || height <= 0) return;

        for (let i = 0; i < sparksPerBurst; i += 1) {
            const x = width * (0.08 + (Math.random() * 0.84));
            const y = height * (0.12 + (Math.random() * 0.76));
            spawnSparkParticle(sparksHost, x, y);
        }

        if (Math.random() < flashChance) {
            const flashX = width * (0.15 + (Math.random() * 0.7));
            const flashY = height * (0.18 + (Math.random() * 0.64));
            spawnSparkFlash(sparksHost, flashX, flashY);
        }
    }

    function clearHost(sparksHost) {
        if (!sparksHost) return;
        sparksHost.innerHTML = '';
    }

    function stopLoop(sparksHost) {
        const state = activeLoops.get(sparksHost);
        if (!state) return;

        if (state.timerId) {
            global.clearInterval(state.timerId);
        }
        activeLoops.delete(sparksHost);
        clearHost(sparksHost);
    }

    function startLoop(sparksHost, options = {}) {
        if (!sparksHost) return () => {};

        stopLoop(sparksHost);

        if (global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            return () => stopLoop(sparksHost);
        }

        const intervalMs = Math.max(80, Number(options.intervalMs) || DEFAULT_INTERVAL_MS);
        const shouldContinue = typeof options.shouldContinue === 'function'
            ? options.shouldContinue
            : () => true;
        const burstOptions = {
            sparksPerBurst: options.sparksPerBurst,
            flashChance: options.flashChance
        };

        const runBurst = () => {
            if (!shouldContinue()) {
                stopLoop(sparksHost);
                return;
            }
            burst(sparksHost, burstOptions);
        };

        runBurst();
        const timerId = global.setInterval(runBurst, intervalMs);
        activeLoops.set(sparksHost, { timerId });

        return () => stopLoop(sparksHost);
    }

    function initAgeHudSubtitleSparks() {
        const canvas = global.document.getElementById('age-page-canvas');
        if (!canvas) return;

        const sparksHost = canvas.querySelector('.age-map-hud-subtitle-slot .game-opening-prologue-subtitle-sparks');
        if (!sparksHost) return;

        const shouldRun = () => {
            const view = canvas.dataset.ageView || 'map';
            if (view !== 'map') return false;
            const slot = canvas.querySelector('.age-map-hud-subtitle-slot');
            if (!slot || slot.hidden) return false;
            return sparksHost.clientWidth > 0 && sparksHost.clientHeight > 0;
        };

        if (!shouldRun()) {
            stopLoop(sparksHost);
            return;
        }

        if (activeLoops.has(sparksHost)) return;

        startLoop(sparksHost, { shouldContinue: shouldRun });
    }

    function syncAgeHudSubtitleSparks() {
        const canvas = global.document.getElementById('age-page-canvas');
        if (!canvas) return;

        const sparksHost = canvas.querySelector('.age-map-hud-subtitle-slot .game-opening-prologue-subtitle-sparks');
        if (!sparksHost) return;

        const view = canvas.dataset.ageView || 'map';
        if (view !== 'map') {
            stopLoop(sparksHost);
            return;
        }

        initAgeHudSubtitleSparks();
    }

    global.RoyalArmiesSubtitleLogoSparks = {
        burst,
        startLoop,
        stop: stopLoop,
        clear: clearHost,
        syncAgeHud: syncAgeHudSubtitleSparks
    };

    function bindAgeHudLifecycle() {
        if (global.document.body?.id !== 'age-page-canvas') return;

        global.addEventListener('royalarmies:age-view-changed', () => {
            syncAgeHudSubtitleSparks();
            if (typeof global.syncAgeHudSubtitleVerticalCenter === 'function') {
                global.requestAnimationFrame(() => global.syncAgeHudSubtitleVerticalCenter());
            }
        });

        if (typeof global.ResizeObserver === 'function') {
            const slot = global.document.querySelector('.age-map-hud-subtitle-slot');
            const sparksHost = slot?.querySelector('.game-opening-prologue-subtitle-sparks');
            if (slot && sparksHost) {
                const observer = new global.ResizeObserver(() => {
                    if (!activeLoops.has(sparksHost) && sparksHost.clientWidth > 0) {
                        syncAgeHudSubtitleSparks();
                    }
                });
                observer.observe(slot);
                observer.observe(sparksHost);
            }
        }

        if (global.document.readyState === 'loading') {
            global.document.addEventListener('DOMContentLoaded', () => {
                global.requestAnimationFrame(syncAgeHudSubtitleSparks);
            }, { once: true });
        } else {
            global.requestAnimationFrame(syncAgeHudSubtitleSparks);
        }
    }

    bindAgeHudLifecycle();
})(window);
