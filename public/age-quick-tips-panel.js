/**
 * RIFT — Quick tips panel pinned to the left end of the Age map bottom bar.
 */
(function initAgeQuickTipsPanel(global) {
    'use strict';

    const QUICK_TIPS = [
        'Open MENU (Game Hub) for Headquarters, Records, Discoveries, Banner, and Battle Pass.',
        'Open Buildings on the right HUD to reach venues such as Adventurer\'s Guild, Barracks, Church, and Infirmary.',
        'Settlement Info shows your city\'s region, terrain, and City Movement routes.',
        'Click a city on the world map to open City Info and Watchtower.',
        'Nation Status on the left HUD lists terrain bonuses for map cities.',
        'Battles run Ranged, Beasts, Cavalry, and Infantry phases — mixed unit armies cover every phase and earn stronger composition bonuses in city assault and border PvP.',
        'Council Board posts nation notices and scheduled Next SF / Expected PvP times.',
        'Leader, Vice Leader, Council, and Planners draft nation orders in Headquarters.',
        'Hold Battle in Adventurer\'s Guild until the charge ring completes to start a bout.',
        'From commander rank 14, Border Patrol is the guild training job offered.',
        'Guild training drills use base matrix combat — class perks, gear, banners, and composition bonuses are inactive.',
        'Trade Convoy is available at Village, Town, Citadel, and Kingdom settlements.',
        'Commander rank and unit promotion advance on separate tracks after guild fights.',
        'Rank promotions can grant Provisions.',
        'Turn on Show full battle log in the battle report for phase-by-phase detail and composition lines.',
        'Auto-heal spends gold to heal injured units between bouts.',
        'Spread recruits across artillery, beasts, cavalry, and infantry — balanced rosters fight every phase and scale up with Dual, Tri, and Grand bonuses in city assault and border PvP.',
        'Battles run Ranged → Beasts → Cavalry → Infantry (up to five infantry rounds); the attacker strikes first in phases 1–3.',
        'An army routs at morale 22 or below, or after losing 68% or more of starting HP.',
        'A lane counts as active when it holds at least 15% of your army\'s starting HP.',
        'Dual, Tri, and Grand bonuses scale with how evenly HP is spread across active lanes in city assault and border PvP.',
        'Grand Combined adds an infantry shield based on surviving Ranged, Beasts, and Cavalry HP from earlier phases.',
        'Matrix Equalizer on defended settlements can reduce attack on a lane holding more than 60% of total army attack.',
        'Perk 1 (Option A or B) locks when you confirm class during onboarding.',
        'Banner branches from the Church apply in nation defense and assault when their conditions are met.',
        'Battle gear bonuses appear under Commander Bonuses in the guild panel — city assault and border PvP only, not guild training.',
        'One unit type leaves battle phases empty. Mix lanes in Barracks so your army stays active from Ranged through Infantry.',
        'Bloodied Sword and Unyielding Wall reward armies with multiple active or damaged lanes across phases.',
        'War Room sonar places a rescue ping at your map position for 30 minutes.',
        'List yourself as SF Lead in War Room to appear as a strike-force candidate.',
        'Watchtower garrison spy is one report per commander per city per intel cycle.',
        'Watchtower compiler merges spy fragments from multiple commanders into a shared garrison estimate.',
        'Commander rank titles follow your class path and rank title gender preference.',
        'Onboarding steps in the progression track are clickable to return to earlier steps once unlocked.'
    ];

    const TIP_ROTATE_MS = 45000;

    let tipIndex = 0;
    let rotateTimer = 0;
    let bound = false;

    function pickRandomTipIndex(excludeIndex = -1) {
        const total = QUICK_TIPS.length;
        if (total <= 1) return 0;
        if (total === 2) return excludeIndex === 0 ? 1 : 0;

        let next = excludeIndex;
        let guard = 0;
        while (next === excludeIndex && guard < 16) {
            next = Math.floor(Math.random() * total);
            guard += 1;
        }
        return next === excludeIndex ? (excludeIndex + 1) % total : next;
    }

    function renderQuickTip() {
        const bodyEl = global.document.getElementById('age-quick-tips-body');
        const indexEl = global.document.getElementById('age-quick-tips-index');
        if (!bodyEl) return;

        const tip = QUICK_TIPS[tipIndex] || QUICK_TIPS[0];
        bodyEl.textContent = tip;

        if (indexEl) {
            indexEl.textContent = '';
            indexEl.setAttribute('aria-hidden', 'true');
        }
    }

    function showRandomTip(excludeIndex = tipIndex) {
        tipIndex = pickRandomTipIndex(excludeIndex);
        renderQuickTip();
    }

    function restartRotateTimer() {
        if (rotateTimer) {
            global.clearInterval(rotateTimer);
        }
        rotateTimer = global.setInterval(() => {
            showRandomTip(tipIndex);
        }, TIP_ROTATE_MS);
    }

    function bindQuickTipsPanel() {
        if (bound) return;
        bound = true;

        global.document.getElementById('age-quick-tips-next')?.addEventListener('click', () => {
            showRandomTip(tipIndex);
            restartRotateTimer();
        });
    }

    function enableQuickTipsPanel() {
        bindQuickTipsPanel();
        tipIndex = pickRandomTipIndex(-1);
        renderQuickTip();
        restartRotateTimer();
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
        showNextTip: showRandomTip
    };
    global.enableAgeQuickTipsPanel = enableQuickTipsPanel;
})(window);
