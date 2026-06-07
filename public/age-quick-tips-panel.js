/**
 * RIFT — Quick tips panel below the council board on the Age map left HUD.
 */
(function initAgeQuickTipsPanel(global) {
    'use strict';

    const QUICK_TIPS = [
        'Use Headquarters to draft nation plans. Council confirms orders, then Clear Plan removes them from the world map when finished.',
        'Place Hold on border cities first, then arm SF, MF, Move, or Taxi arrows along your chain.',
        'Move and MF orders spend MP along a chain. Holds can launch SF and MF without needing owned cities in between.',
        'Nation Status shows terrain bonuses — stack Holds in favorable terrain before pushing into enemy borders.',
        'Open the City tab to visit venues such as Barracks, Blacksmith, and Infirmary at larger settlements.',
        'Use Add Plan on the world map to draft nation orders in place. View Plan appears after your nation publishes a plan.'
    ];

    const TIP_ROTATE_MS = 45000;

    let tipIndex = 0;
    let rotateTimer = 0;
    let bound = false;

    function scheduleLayoutSync() {
        if (typeof global.syncAgeMapHudLayout !== 'function') return;
        global.requestAnimationFrame(() => {
            global.requestAnimationFrame(global.syncAgeMapHudLayout);
        });
    }

    function renderQuickTip() {
        const bodyEl = global.document.getElementById('age-quick-tips-body');
        const indexEl = global.document.getElementById('age-quick-tips-index');
        if (!bodyEl) return;

        const tip = QUICK_TIPS[tipIndex] || QUICK_TIPS[0];
        bodyEl.textContent = tip;

        if (indexEl) {
            indexEl.textContent = `${tipIndex + 1} / ${QUICK_TIPS.length}`;
        }
    }

    function showNextTip(advanceBy = 1) {
        tipIndex = (tipIndex + advanceBy + QUICK_TIPS.length) % QUICK_TIPS.length;
        renderQuickTip();
        scheduleLayoutSync();
    }

    function restartRotateTimer() {
        if (rotateTimer) {
            global.clearInterval(rotateTimer);
        }
        rotateTimer = global.setInterval(() => {
            showNextTip(1);
        }, TIP_ROTATE_MS);
    }

    function bindQuickTipsPanel() {
        if (bound) return;
        bound = true;

        global.document.getElementById('age-quick-tips-next')?.addEventListener('click', () => {
            showNextTip(1);
            restartRotateTimer();
        });
    }

    function enableQuickTipsPanel() {
        bindQuickTipsPanel();
        renderQuickTip();
        restartRotateTimer();
        scheduleLayoutSync();
    }

    function disableQuickTipsPanel() {
        if (rotateTimer) {
            global.clearInterval(rotateTimer);
            rotateTimer = 0;
        }
    }

    global.RoyalArmiesAgeQuickTipsPanel = {
        enable: enableQuickTipsPanel,
        disable: disableQuickTipsPanel,
        showNextTip
    };
    global.enableAgeQuickTipsPanel = enableQuickTipsPanel;
})(window);
