/**

 * RIFT — Adventurer's Guild venue (hold-to-battle training simulator).

 */

(function initRoyalArmiesAdventurersGuild(global) {

    'use strict';



    const BATTLE_CHARGE_MS = 2000;

    const CHARGE_RING_RADIUS = 46;

    const CHARGE_RING_CIRCUMFERENCE = 2 * Math.PI * CHARGE_RING_RADIUS;



    let bound = false;

    let guildState = null;

    let battleInFlight = false;

    let battleHeld = false;

    let chargeTimerId = null;

    let autoHealEnabled = false;

    let lastBattleResult = null;



    function escapeHtml(value) {

        return String(value ?? '')

            .replace(/&/g, '&amp;')

            .replace(/</g, '&lt;')

            .replace(/>/g, '&gt;')

            .replace(/"/g, '&quot;');

    }



    function resolveWorkspace() {

        return global.document.getElementById('age-guild-workspace');

    }



    function isOpen() {

        const workspace = resolveWorkspace();

        return Boolean(workspace && !workspace.hidden);

    }



    function resolveApi() {

        return global.RoyalArmiesAgeGuildTraining || null;

    }



    function formatWinnerLabel(winner) {

        if (winner === 'commander') return 'Victory';

        if (winner === 'npc') return 'Defeat';

        return 'Draw';

    }



    function formatEndReason(result) {

        if (result.endReason === 'annihilation') return 'Annihilation';

        if (result.endReason === 'routing') return 'Morale rout';

        if (result.endReason === 'infantry_phase') return 'Infantry phase';

        if (result.endReason === 'mutual_rout') return 'Mutual rout';

        return 'Concluded';

    }



    function mergeGuildState(payload) {

        if (!payload || typeof payload !== 'object') return guildState;

        guildState = {

            ...(guildState || {}),

            rank: payload.rank ?? guildState?.rank ?? 1,

            ageGuildXp: payload.ageGuildXp ?? guildState?.ageGuildXp ?? 0,

            ageGuildXpRequired: payload.ageGuildXpRequired ?? guildState?.ageGuildXpRequired ?? 95,

            ageGuildXpProgress: payload.ageGuildXpProgress ?? guildState?.ageGuildXpProgress ?? 0,

            unitsTotal: payload.unitsTotal ?? guildState?.unitsTotal ?? 0,

            unitsUninjured: payload.unitsUninjured ?? guildState?.unitsUninjured ?? 0,

            unitsInjured: payload.unitsInjured ?? guildState?.unitsInjured ?? 0,

            unitsHealthProgress: payload.unitsHealthProgress ?? guildState?.unitsHealthProgress ?? 1,

            ageGold: payload.ageGold ?? guildState?.ageGold ?? 0,

            rankAtMax: payload.rankAtMax ?? guildState?.rankAtMax ?? false

        };

        return guildState;

    }



    function updateProgressBars() {

        const state = guildState || {};

        const rankEl = global.document.getElementById('age-guild-rank');

        const xpFill = global.document.getElementById('age-guild-xp-fill');

        const xpText = global.document.getElementById('age-guild-xp-text');

        const xpBar = global.document.getElementById('age-guild-xp-bar');

        const unitsFill = global.document.getElementById('age-guild-units-fill');

        const unitsText = global.document.getElementById('age-guild-units-text');

        const unitsBar = global.document.getElementById('age-guild-units-bar');



        const rank = Math.max(1, Math.floor(Number(state.rank) || 1));

        const xp = Math.max(0, Math.floor(Number(state.ageGuildXp) || 0));

        const xpRequired = Math.max(0, Math.floor(Number(state.ageGuildXpRequired) || 0));

        const xpProgress = state.rankAtMax ? 1 : Math.min(1, Math.max(0, Number(state.ageGuildXpProgress) || 0));

        const unitsTotal = Math.max(0, Math.floor(Number(state.unitsTotal) || 0));

        const unitsUninjured = Math.max(0, Math.floor(Number(state.unitsUninjured) || 0));

        const healthProgress = unitsTotal > 0

            ? Math.min(1, Math.max(0, unitsUninjured / unitsTotal))

            : 1;



        if (rankEl) rankEl.textContent = String(rank);

        if (xpFill) xpFill.style.width = `${(xpProgress * 100).toFixed(1)}%`;

        if (xpText) {

            xpText.textContent = state.rankAtMax

                ? `${xp} XP · Max rank`

                : `${xp} / ${xpRequired} XP`;

        }

        if (xpBar) {

            xpBar.setAttribute('aria-valuenow', String(Math.round(xpProgress * 100)));

            xpBar.setAttribute('aria-valuetext', state.rankAtMax ? 'Maximum rank reached' : `${xp} of ${xpRequired} guild XP`);

        }



        if (unitsFill) unitsFill.style.width = `${(healthProgress * 100).toFixed(1)}%`;

        if (unitsText) unitsText.textContent = `${unitsUninjured} / ${unitsTotal}`;

        if (unitsBar) {

            unitsBar.setAttribute('aria-valuenow', String(Math.round(healthProgress * 100)));

            unitsBar.setAttribute('aria-valuetext', `${unitsUninjured} healthy of ${unitsTotal} total units`);

        }

    }



    function renderBattleLog() {

        const logEl = global.document.getElementById('age-guild-log');

        if (!logEl) return;



        if (!lastBattleResult) {

            logEl.innerHTML = (

                '<div class="age-guild-log-idle">'

                + '<p class="age-guild-log-title">Adventurer\'s Guild</p>'

                + '<p>Hold <strong>Battle</strong> to charge a training bout. Release to cancel. '

                + 'Each victory earns guild XP toward your next commander rank and provisions.</p>'

                + '<p>Injured units can be healed with gold — veteran ranks and above cost slightly more.</p>'

                + '</div>'

            );

            return;

        }



        const result = lastBattleResult;

        const winnerClass = result.winner === 'commander'

            ? 'is-victory'

            : (result.winner === 'npc' ? 'is-defeat' : 'is-draw');

        const logLines = (Array.isArray(result.log) ? result.log : [])

            .map((line) => `<li>${escapeHtml(line)}</li>`)

            .join('');



        const rankLine = result.rankPromoted

            ? `<p class="age-guild-log-promotion">Promoted to rank ${escapeHtml(result.rank)}`

            + `${result.provisionsGranted ? ` · +${escapeHtml(result.provisionsGranted)} provisions` : ''}</p>`

            : '';



        logEl.innerHTML = (

            `<article class="age-guild-log-entry ${winnerClass}">`

            + `<header class="age-guild-log-head">`

            + `<p class="age-guild-log-outcome">${escapeHtml(formatWinnerLabel(result.winner))}</p>`

            + `<p class="age-guild-log-meta">`

            + `${escapeHtml(formatEndReason(result))} · +${escapeHtml(result.xpGain ?? 0)} XP`

            + `${result.injuriesApplied ? ` · ${escapeHtml(result.injuriesApplied)} injured` : ''}`

            + '</p>'

            + rankLine

            + '</header>'

            + `<ol class="age-guild-battle-log">${logLines}</ol>`

            + '</article>'

        );



        logEl.scrollTop = 0;

    }



    function updateControlStates() {

        const battleBtn = global.document.getElementById('age-guild-battle-btn');

        const healOneBtn = global.document.getElementById('age-guild-heal-one');

        const healAllBtn = global.document.getElementById('age-guild-heal-all');

        const autoHealBtn = global.document.getElementById('age-guild-auto-heal');



        const unitsUninjured = Math.max(0, Math.floor(Number(guildState?.unitsUninjured) || 0));

        const unitsInjured = Math.max(0, Math.floor(Number(guildState?.unitsInjured) || 0));

        const canBattle = unitsUninjured > 0 && !battleInFlight;



        if (battleBtn) {

            battleBtn.disabled = !canBattle;

            battleBtn.classList.toggle('is-ready', canBattle);

            battleBtn.classList.toggle('is-busy', battleInFlight);

        }

        if (healOneBtn) healOneBtn.disabled = !unitsInjured || battleInFlight;

        if (healAllBtn) healAllBtn.disabled = !unitsInjured || battleInFlight;

        if (autoHealBtn) {

            autoHealBtn.classList.toggle('is-active', autoHealEnabled);

            autoHealBtn.setAttribute('aria-pressed', autoHealEnabled ? 'true' : 'false');

        }

    }



    function renderGuildPanel() {

        updateProgressBars();

        renderBattleLog();

        updateControlStates();

    }



    function clearChargeTimer() {

        if (chargeTimerId) {

            global.clearTimeout(chargeTimerId);

            chargeTimerId = null;

        }

    }



    function resetChargeRing() {

        const wrap = global.document.getElementById('age-guild-battle-wrap');

        const progress = wrap?.querySelector('.age-guild-charge-ring-progress');

        wrap?.classList.remove('is-charging');

        if (progress) {

            progress.style.animation = 'none';

            progress.getBoundingClientRect();

            progress.style.animation = '';

        }

    }



    function startChargeRing() {

        const wrap = global.document.getElementById('age-guild-battle-wrap');

        if (!wrap) return;

        wrap.classList.add('is-charging');

    }



    function scheduleBattleCharge() {

        clearChargeTimer();

        if (!battleHeld || battleInFlight) return;



        const unitsUninjured = Math.max(0, Math.floor(Number(guildState?.unitsUninjured) || 0));

        if (!unitsUninjured) {

            stopBattleHold();

            return;

        }



        startChargeRing();

        chargeTimerId = global.setTimeout(() => {

            chargeTimerId = null;

            void fireTrainingBattle();

        }, BATTLE_CHARGE_MS);

    }



    function stopBattleHold() {

        battleHeld = false;

        clearChargeTimer();

        resetChargeRing();

    }



    async function runAutoHealAfterBattle() {

        if (!autoHealEnabled || battleInFlight) return;



        const api = resolveApi();

        if (!api?.healUnits) return;



        let safety = 200;

        while (safety > 0 && autoHealEnabled && isOpen()) {

            safety -= 1;

            const injured = Math.max(0, Math.floor(Number(guildState?.unitsInjured) || 0));

            if (!injured) break;



            try {

                const payload = await api.healUnits({ mode: 'one' });

                mergeGuildState(payload);

            } catch (error) {

                if (error?.code === 'NEXUS-AGE-011' || error?.code === 'NEXUS-AGE-019') break;

                if (typeof global.showRiftError === 'function' && error?.code) {

                    global.showRiftError(error.code, error.message);

                }

                break;

            }

        }



        renderGuildPanel();

    }



    async function fireTrainingBattle() {

        if (battleInFlight) return;



        const api = resolveApi();

        if (!api?.runTrainingBattle) {

            if (typeof global.showRiftError === 'function') {

                global.showRiftError('RIFT-NET-001', 'Training battle is unavailable right now.');

            }

            stopBattleHold();

            return;

        }



        battleInFlight = true;

        resetChargeRing();

        updateControlStates();



        try {

            lastBattleResult = await api.runTrainingBattle();

            mergeGuildState(lastBattleResult);

            renderGuildPanel();

            await runAutoHealAfterBattle();

        } catch (error) {

            if (typeof global.showRiftError === 'function' && error?.code) {

                global.showRiftError(error.code, error.message);

            }

            stopBattleHold();

        } finally {

            battleInFlight = false;

            renderGuildPanel();



            if (battleHeld) {

                scheduleBattleCharge();

            }

        }

    }



    async function healUnits(mode) {

        if (battleInFlight) return;



        const api = resolveApi();

        if (!api?.healUnits) return;



        try {

            const payload = await api.healUnits({ mode });

            mergeGuildState(payload);

            renderGuildPanel();

        } catch (error) {

            if (typeof global.showRiftError === 'function' && error?.code) {

                global.showRiftError(error.code, error.message);

            }

        }

    }



    async function loadGuildState() {

        const api = resolveApi();

        if (!api?.fetchGuildState) return;



        try {

            const payload = await api.fetchGuildState();

            mergeGuildState(payload);

        } catch (error) {

            mergeGuildState({

                rank: global.player?.rank,

                ageGuildXp: global.player?.ageGuildXp,

                unitsTotal: global.player?.unitsTotal,

                unitsUninjured: global.player?.unitsUninjured

            });

            if (typeof global.showRiftError === 'function' && error?.code) {

                global.showRiftError(error.code, error.message);

            }

        }

    }



    function onBattlePointerDown(event) {

        if (event.button !== 0) return;

        if (battleInFlight) return;



        const unitsUninjured = Math.max(0, Math.floor(Number(guildState?.unitsUninjured) || 0));

        if (!unitsUninjured) return;



        event.preventDefault();

        battleHeld = true;

        scheduleBattleCharge();

    }



    function onBattlePointerUp() {

        if (!battleHeld) return;

        stopBattleHold();

    }



    function onWorkspaceClick(event) {

        if (event.target.closest('#age-guild-close')) {

            event.preventDefault();

            close();

            return;

        }

        if (event.target.closest('#age-guild-heal-one')) {

            event.preventDefault();

            void healUnits('one');

            return;

        }

        if (event.target.closest('#age-guild-heal-all')) {

            event.preventDefault();

            void healUnits('all');

            return;

        }

        if (event.target.closest('#age-guild-auto-heal')) {

            event.preventDefault();

            autoHealEnabled = !autoHealEnabled;

            updateControlStates();

        }

    }



    function onWorkspaceKeydown(event) {

        if (event.key === 'Escape' && isOpen()) {

            event.preventDefault();

            close();

        }

    }



    async function open() {

        const workspace = resolveWorkspace();

        if (!workspace) return;



        workspace.hidden = false;

        workspace.setAttribute('aria-hidden', 'false');

        global.document.body.classList.add('age-guild-open');



        await loadGuildState();

        renderGuildPanel();

    }



    function close() {

        stopBattleHold();



        const workspace = resolveWorkspace();

        if (!workspace) return;



        workspace.hidden = true;

        workspace.setAttribute('aria-hidden', 'true');

        global.document.body.classList.remove('age-guild-open');

    }



    function onSettlementVenueOpen(event) {

        if (event?.detail?.venueId !== 'adventurers-guild') return;

        void open();

    }



    function onGuildUpdated(event) {

        mergeGuildState(event?.detail || {});

        if (isOpen()) renderGuildPanel();

    }



    function onArmyUpdated() {

        if (!isOpen()) return;

        void loadGuildState().then(() => renderGuildPanel());

    }



    function bindGuild() {

        if (bound) return;

        bound = true;



        const workspace = resolveWorkspace();

        const battleBtn = global.document.getElementById('age-guild-battle-btn');
        const wrap = global.document.getElementById('age-guild-battle-wrap');
        const progressRing = workspace?.querySelector('.age-guild-charge-ring-progress');

        if (wrap) {
            wrap.style.setProperty('--age-guild-charge-circumference', String(CHARGE_RING_CIRCUMFERENCE));
        }
        if (progressRing) {

            progressRing.style.strokeDasharray = `${CHARGE_RING_CIRCUMFERENCE}`;

            progressRing.style.strokeDashoffset = `${CHARGE_RING_CIRCUMFERENCE}`;

        }



        workspace?.addEventListener('click', onWorkspaceClick);

        global.document.addEventListener('keydown', onWorkspaceKeydown);

        global.addEventListener('royal-armies-settlement-venue-open', onSettlementVenueOpen);

        global.addEventListener('royalarmies:age-guild-updated', onGuildUpdated);

        global.addEventListener('royalarmies:age-recruitment-updated', onArmyUpdated);

        global.addEventListener('royalarmies:age-movement-updated', onArmyUpdated);



        battleBtn?.addEventListener('pointerdown', onBattlePointerDown);

        battleBtn?.addEventListener('pointerup', onBattlePointerUp);

        battleBtn?.addEventListener('pointerleave', onBattlePointerUp);

        battleBtn?.addEventListener('pointercancel', onBattlePointerUp);

        global.addEventListener('pointerup', onBattlePointerUp);

    }



    function enableAgeAdventurersGuild() {

        bindGuild();

    }



    global.RoyalArmiesAdventurersGuild = {

        open,

        close,

        isOpen,

        enableAgeAdventurersGuild

    };



    global.enableAgeAdventurersGuild = enableAgeAdventurersGuild;

})(window);


