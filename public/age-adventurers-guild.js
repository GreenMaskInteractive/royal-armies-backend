/**
 * RIFT — Adventurer's Guild venue (job board + training / trade / bounties).
 */
(function initRoyalArmiesAdventurersGuild(global) {
    'use strict';

    const BATTLE_CHARGE_MS = 2000;
    const CHARGE_RING_RADIUS = 46;
    const CHARGE_RING_CIRCUMFERENCE = 2 * Math.PI * CHARGE_RING_RADIUS;

    let bound = false;
    let guildState = null;
    let hubManifest = null;
    let bountyList = [];
    let bountyRewards = null;
    let activeView = null;
    let activeTrainingMode = 'street-patrol';
    let activeTrainingLabel = 'Street Patrol';
    let settlementTier = 'village';
    let battleInFlight = false;
    let battleHeld = false;
    let chargeTimerId = null;
    let autoHealEnabled = false;
    let lastBattleResult = null;
    let guildJobsExpanded = false;
    let guildStateLoadInFlight = null;
    let lootLog = [];
    let activeBattleTab = 'details';
    let lootTabAlert = false;
    let trainingViewActive = false;
    let overlayJobActive = false;

    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function resolveApi() {
        return global.RoyalArmiesAgeGuildTraining || null;
    }

    function resolveWorkspace() {
        return global.document.getElementById('age-guild-workspace');
    }

    function isOpen() {
        return trainingViewActive || overlayJobActive;
    }

    function isOverlayOpen() {
        return overlayJobActive;
    }

    function resolveSettlementTierFromEvent(event) {
        return String(event?.detail?.settlementTier || settlementTier || 'village').trim().toLowerCase();
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
            ageGuildMerch: payload.ageGuildMerch ?? guildState?.ageGuildMerch ?? [],
            tradeConvoyLots: payload.tradeConvoyLots ?? guildState?.tradeConvoyLots ?? [],
            ageGuildAcceptedBountyId: payload.ageGuildAcceptedBountyId ?? guildState?.ageGuildAcceptedBountyId ?? null,
            commanderGear: payload.commanderGear ?? guildState?.commanderGear ?? null
        };
        if (payload.hub) hubManifest = payload.hub;
        if (Array.isArray(payload.bounties)) bountyList = payload.bounties;
        if (payload.bountyRewards) bountyRewards = payload.bountyRewards;
        return guildState;
    }

    function resolveGuildJobsContainer() {
        return global.document.getElementById('age-settlement-guild-jobs');
    }

    function resolveGuildMenuWrap() {
        return global.document.querySelector('.age-settlement-menu-guild-wrap');
    }

    function resolveJobArena(viewId) {
        if (viewId === 'training') return global.document.getElementById('age-guild-training-arena');
        if (viewId === 'trade') return global.document.getElementById('age-guild-trade-arena');
        if (viewId === 'bounties') return global.document.getElementById('age-guild-bounties-arena');
        return null;
    }

    function setTrainingViewOpen(isOpen) {
        trainingViewActive = isOpen;
        global.document.getElementById('age-page-canvas')?.classList.toggle('age-guild-training-view-open', isOpen);
    }

    function setOverlayJobOpen(isOpen) {
        overlayJobActive = isOpen;
        global.document.getElementById('age-page-canvas')?.classList.toggle('age-guild-overlay-open', isOpen);
        global.document.body.classList.toggle('age-guild-overlay-open', isOpen);
    }

    function hideAllJobArenas() {
        ['training', 'trade', 'bounties'].forEach((viewId) => {
            const arena = resolveJobArena(viewId);
            if (!arena) return;
            arena.hidden = true;
            arena.setAttribute('aria-hidden', 'true');
        });
    }

    function showJobArena(viewId) {
        activeView = viewId;
        hideAllJobArenas();
        const arena = resolveJobArena(viewId);
        if (arena) {
            arena.hidden = false;
            arena.setAttribute('aria-hidden', 'false');
        }
    }

    function openJobWorkspace() {
        const workspace = resolveWorkspace();
        if (!workspace) return;
        workspace.hidden = false;
        workspace.setAttribute('aria-hidden', 'false');
    }

    function closeJobWorkspace() {
        stopBattleHold();
        const workspace = resolveWorkspace();
        if (workspace) {
            workspace.hidden = true;
            workspace.setAttribute('aria-hidden', 'true');
        }
        setOverlayJobOpen(false);
        hideAllJobArenas();
        activeView = null;
        refreshGuildWorkspaceVisibility();
    }

    function closeTrainingView(options = {}) {
        stopBattleHold();
        hideAllJobArenas();
        activeView = null;
        setTrainingViewOpen(false);
        closeJobWorkspace();

        if (!options.skipViewRestore && global.RoyalArmiesAgeViewTabs?.getActiveView?.() === 'guild-training') {
            global.RoyalArmiesAgeViewTabs.setActiveView('city');
        }
    }

    function onTrainingViewOpen() {
        setTrainingViewOpen(true);
        renderGuildPanel();
    }

    function onTrainingViewClose() {
        if (!trainingViewActive) return;
        closeTrainingView({ skipViewRestore: true });
    }

    function renderSettlementGuildJobOption(job) {
        const lockedClass = job.available ? '' : ' is-locked';
        const featuredClass = job.featured ? ' is-featured' : '';
        const lockLine = job.available
            ? ''
            : `<span class="age-settlement-guild-job-lock">${escapeHtml(job.lockReason || 'Unavailable')}</span>`;
        const featuredTag = job.featured ? '<span class="age-settlement-guild-job-tag">Primary</span>' : '';

        return (
            `<button type="button" class="age-settlement-guild-job${lockedClass}${featuredClass}"`
            + ` data-guild-job="${escapeHtml(job.id)}"`
            + `${job.available ? '' : ' disabled'}>`
            + `<span class="age-settlement-guild-job-label">${escapeHtml(job.label)}</span>`
            + featuredTag
            + `<span class="age-settlement-guild-job-desc">${escapeHtml(job.description)}</span>`
            + lockLine
            + '</button>'
        );
    }

    function renderSettlementGuildJobs() {
        const optionsEl = resolveGuildJobsContainer();
        const hub = hubManifest || { jobs: [], settlementTierLabel: 'Settlement', rank: 1 };
        if (!optionsEl) return;

        const jobs = Array.isArray(hub.jobs) ? hub.jobs : [];
        const nextHtml = !jobs.length
            ? '<p class="age-settlement-guild-jobs-empty">No guild jobs are configured for this settlement.</p>'
            : jobs.map((job) => renderSettlementGuildJobOption(job)).join('');

        if (optionsEl.innerHTML !== nextHtml) {
            optionsEl.innerHTML = nextHtml;
        }
    }

    function syncSettlementMenuGuild() {
        const wrap = resolveGuildMenuWrap();
        const jobsEl = resolveGuildJobsContainer();
        const toggleBtn = wrap?.querySelector('[data-settlement-venue="adventurers-guild"]');
        if (!wrap || !jobsEl) return;

        if (guildJobsExpanded) {
            wrap.classList.add('is-expanded');
            jobsEl.hidden = false;
            toggleBtn?.setAttribute('aria-expanded', 'true');
            renderSettlementGuildJobs();
            return;
        }

        wrap.classList.remove('is-expanded');
        jobsEl.hidden = true;
        toggleBtn?.setAttribute('aria-expanded', 'false');
    }

    async function toggleSettlementJobs(detail) {
        settlementTier = String(detail?.settlementTier || settlementTier || 'village').trim().toLowerCase();
        resolveApi()?.setSettlementTier?.(settlementTier);

        guildJobsExpanded = !guildJobsExpanded;
        syncSettlementMenuGuild();
        if (guildJobsExpanded) {
            await loadGuildState();
            renderSettlementGuildJobs();
        }
    }

    function setBattleTab(tabId) {
        activeBattleTab = tabId === 'loot' ? 'loot' : 'details';
        const tabs = global.document.querySelectorAll('[data-guild-battle-tab]');
        tabs.forEach((tab) => {
            const isActive = tab.getAttribute('data-guild-battle-tab') === activeBattleTab;
            tab.classList.toggle('is-active', isActive);
            tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
            tab.tabIndex = isActive ? 0 : -1;
        });

        const lootPanel = global.document.getElementById('age-guild-battle-tab-loot');
        const detailsPanel = global.document.getElementById('age-guild-battle-tab-details');
        if (lootPanel) {
            lootPanel.hidden = activeBattleTab !== 'loot';
            lootPanel.classList.toggle('is-active', activeBattleTab === 'loot');
        }
        if (detailsPanel) {
            detailsPanel.hidden = activeBattleTab !== 'details';
            detailsPanel.classList.toggle('is-active', activeBattleTab === 'details');
        }

        if (activeBattleTab === 'loot') {
            lootTabAlert = false;
        }
        updateLootTabAlert();
    }

    function updateLootTabAlert() {
        const lootTab = global.document.getElementById('age-guild-battle-tab-btn-loot');
        if (!lootTab) return;
        lootTab.classList.toggle('is-loot-found', lootTabAlert && activeBattleTab !== 'loot');
        lootTab.setAttribute('aria-label', lootTabAlert && activeBattleTab !== 'loot'
            ? 'Loot — new findings available'
            : 'Loot');
    }

    function renderLootLog() {
        const lootEl = global.document.getElementById('age-guild-loot-log');
        if (!lootEl) return;

        if (!lootLog.length) {
            lootEl.innerHTML = (
                '<p class="age-guild-loot-idle">Victory skirmishes may yield gold from the streets.'
                + ' Loot entries will appear here after successful patrols.</p>'
            );
            return;
        }

        lootEl.innerHTML = lootLog.map((entry) => (
            `<p class="age-guild-loot-entry">`
            + `${escapeHtml(entry.label)} `
            + `<span class="age-guild-loot-entry-gold">+${escapeHtml(entry.gold)} gold</span>`
            + '</p>'
        )).join('');
    }

    function appendLootEntries(entries) {
        if (!Array.isArray(entries) || !entries.length) return;
        entries.forEach((entry) => {
            if (!entry || !entry.label) return;
            lootLog.unshift({
                label: String(entry.label),
                gold: Math.max(0, Math.floor(Number(entry.gold) || 0))
            });
        });
        if (lootLog.length > 40) {
            lootLog.length = 40;
        }
        if (entries.length) {
            lootTabAlert = true;
        }
    }

    function showXpFloat(xpGain) {
        const host = global.document.getElementById('age-guild-xp-float-host');
        if (!host) return;
        const amount = Math.max(0, Math.floor(Number(xpGain) || 0));
        if (!amount) return;

        host.innerHTML = `<span class="age-guild-xp-float">+${amount} XP</span>`;
        global.setTimeout(() => {
            if (host.firstElementChild?.classList.contains('age-guild-xp-float')) {
                host.innerHTML = '';
            }
        }, 2800);
    }
    function formatWinnerLabel(winner) {
        if (winner === 'commander') return 'Victory';
        if (winner === 'npc') return 'Defeat';
        return 'Draw';
    }

    function formatGearSlotStats(stats) {
        if (!stats || typeof stats !== 'object') return '';
        return Object.entries(stats)
            .map(([key, value]) => {
                const numeric = Number(value) || 0;
                if (!numeric) return '';
                if (key === 'injuryMitigation' || key === 'guildXp') {
                    return `+${Math.round(numeric * 1000) / 10}% ${key === 'guildXp' ? 'Guild XP' : 'Injury Mitigation'}`;
                }
                const label = key.charAt(0).toUpperCase() + key.slice(1);
                return `+${Math.round(numeric * 10) / 10} ${label}`;
            })
            .filter(Boolean)
            .join(' · ');
    }

    function renderGearSlotMarkup(slot) {
        const slotLabel = escapeHtml(slot?.label || 'Slot');
        const equipped = slot?.equipped;
        if (!equipped) {
            return (
                `<div class="age-guild-gear-slot is-empty" data-gear-slot="${escapeHtml(slot?.id || '')}">`
                + `<span class="age-guild-gear-slot-label">${slotLabel}</span>`
                + '<span class="age-guild-gear-slot-empty">Empty</span>'
                + '</div>'
            );
        }

        const rarity = escapeHtml(equipped.rarity || 'common');
        const statSummary = formatGearSlotStats(equipped.stats);
        const title = statSummary
            ? `${equipped.name} — ${statSummary}`
            : String(equipped.name || 'Equipped item');

        return (
            `<button type="button" class="age-guild-gear-slot is-equipped is-rarity-${rarity}"`
            + ` data-gear-slot="${escapeHtml(slot?.id || '')}"`
            + ` title="${escapeHtml(title)}"`
            + ` aria-label="${escapeHtml(`${slotLabel}: ${equipped.name}`)}">`
            + `<span class="age-guild-gear-slot-label">${slotLabel}</span>`
            + `<span class="age-guild-gear-slot-item">${escapeHtml(equipped.name || 'Equipped')}</span>`
            + '</button>'
        );
    }

    function renderCommanderGearPanel() {
        const gear = guildState?.commanderGear;
        const nameEl = global.document.getElementById('age-guild-commander-name');
        const classEl = global.document.getElementById('age-guild-commander-class');
        const sheetEl = global.document.getElementById('age-guild-gear-sheet');
        const statsEl = global.document.getElementById('age-guild-gear-stat-lines');

        if (!sheetEl) return;

        if (!gear) {
            if (nameEl) nameEl.textContent = 'Commander';
            if (classEl) classEl.textContent = 'Equipment unavailable';
            sheetEl.innerHTML = '<p class="age-guild-gear-stat-lines is-neutral">Load guild state to view equipment.</p>';
            if (statsEl) statsEl.innerHTML = '';
            return;
        }

        if (nameEl) nameEl.textContent = gear.commanderName || 'Commander';
        if (classEl) {
            classEl.textContent = `${gear.classLabel || 'Commander'} · Rank ${Math.max(1, Math.floor(Number(gear.rank) || 1))}`;
        }

        const slots = Array.isArray(gear.slots) ? gear.slots : [];
        const slotById = Object.fromEntries(slots.map((slot) => [slot.id, slot]));
        const renderColumn = (slotIds) => slotIds
            .map((slotId) => renderGearSlotMarkup(slotById[slotId]))
            .join('');

        const portraitSrc = escapeHtml(gear.portraitSrc || gear.classPortraitSrc || 'images/battlemasterclass.png');
        sheetEl.innerHTML = (
            '<div class="age-guild-gear-layout">'
            + `<div class="age-guild-gear-col age-guild-gear-col--left">${renderColumn(['mainHand', 'hands', 'cloak'])}</div>`
            + '<div class="age-guild-gear-col age-guild-gear-col--center">'
            + renderGearSlotMarkup(slotById.head)
            + `<div class="age-guild-gear-portrait-wrap"><img class="age-guild-gear-portrait" src="${portraitSrc}" alt="" decoding="async"></div>`
            + renderGearSlotMarkup(slotById.chest)
            + renderGearSlotMarkup(slotById.legs)
            + renderGearSlotMarkup(slotById.feet)
            + '</div>'
            + `<div class="age-guild-gear-col age-guild-gear-col--right">${renderColumn(['offHand', 'ring', 'amulet'])}</div>`
            + '</div>'
        );

        if (statsEl) {
            const statLines = Array.isArray(gear.statLines) ? gear.statLines : [];
            statsEl.innerHTML = statLines.length
                ? statLines.map((line) => `<li>${escapeHtml(line.formatted || line.label || '')}</li>`).join('')
                : '<li class="is-neutral">No equipment bonuses equipped.</li>';
        }
    }

    function renderGuildPanel() {
        if (guildJobsExpanded) renderSettlementGuildJobs();
        updateProgressBars();
        renderCommanderGearPanel();
        renderLootLog();
        renderBattleLog();
        setBattleTab(activeBattleTab);
        updateLootTabAlert();
        renderTradeView();
        renderBountiesView();
        updateControlStates();
    }

    function formatEndReason(result) {
        if (result.endReason === 'annihilation') return 'Annihilation';
        if (result.endReason === 'routing') return 'Morale rout';
        if (result.endReason === 'infantry_phase') return 'Infantry phase';
        if (result.endReason === 'mutual_rout') return 'Mutual rout';
        return 'Concluded';
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
        const healthProgress = unitsTotal > 0 ? Math.min(1, unitsUninjured / unitsTotal) : 1;

        if (rankEl) rankEl.textContent = String(rank);
        if (xpFill) xpFill.style.width = `${(xpProgress * 100).toFixed(1)}%`;
        if (xpText) {
            xpText.textContent = state.rankAtMax ? `${xp} XP · Max rank` : `${xp} / ${xpRequired} XP`;
        }
        if (xpBar) xpBar.setAttribute('aria-valuenow', String(Math.round(xpProgress * 100)));
        if (unitsFill) unitsFill.style.width = `${(healthProgress * 100).toFixed(1)}%`;
        if (unitsText) unitsText.textContent = `${unitsUninjured} / ${unitsTotal}`;
        if (unitsBar) unitsBar.setAttribute('aria-valuenow', String(Math.round(healthProgress * 100)));
    }

    function renderBattleLog() {
        const logEl = global.document.getElementById('age-guild-log');
        if (!logEl) return;

        const titleEl = global.document.getElementById('age-guild-training-title');
        if (titleEl) titleEl.textContent = activeTrainingLabel;

        if (!lastBattleResult) {
            logEl.innerHTML = (
                '<div class="age-guild-log-idle">'
                + `<p class="age-guild-log-title">${escapeHtml(activeTrainingLabel)}</p>`
                + '<p>Hold <strong>Battle</strong> to charge a bout. Release to cancel. Injuries apply — heal with gold when needed.</p>'
                + '</div>'
            );
            return;
        }

        const result = lastBattleResult;
        const winnerClass = result.winner === 'commander' ? 'is-victory' : (result.winner === 'npc' ? 'is-defeat' : 'is-draw');
        const xpBreakdown = result.xpBreakdown && typeof result.xpBreakdown === 'object' ? result.xpBreakdown : null;
        const survivorMeta = xpBreakdown && Number.isFinite(xpBreakdown.totalSurviving)
            ? ` · ${xpBreakdown.totalSurviving} survivor(s)`
            : '';
        const logLines = (Array.isArray(result.log) ? result.log : [])
            .map((line) => `<li>${escapeHtml(line)}</li>`)
            .join('');
        const rankLine = result.rankPromoted
            ? `<p class="age-guild-log-promotion">Promoted to rank ${escapeHtml(result.rank)}`
            + `${result.provisionsGranted ? ` · +${escapeHtml(result.provisionsGranted)} provisions` : ''}</p>`
            : '';

        logEl.innerHTML = (
            `<article class="age-guild-log-entry ${winnerClass}">`
            + '<header class="age-guild-log-head">'
            + `<p class="age-guild-log-outcome">${escapeHtml(formatWinnerLabel(result.winner))}</p>`
            + `<p class="age-guild-log-meta">${escapeHtml(formatEndReason(result))} · +${escapeHtml(result.xpGain ?? 0)} XP${escapeHtml(survivorMeta)}`
            + `${result.injuriesApplied ? ` · ${escapeHtml(result.injuriesApplied)} injured` : ''}</p>`
            + rankLine
            + '</header>'
            + `<ol class="age-guild-battle-log">${logLines}</ol>`
            + '</article>'
        );
        logEl.scrollTop = 0;
    }

    function renderTradeView() {
        const lotsEl = global.document.getElementById('age-guild-trade-lots');
        const inventoryEl = global.document.getElementById('age-guild-trade-inventory');
        const lots = Array.isArray(guildState?.tradeConvoyLots) ? guildState.tradeConvoyLots : [];
        const merch = Array.isArray(guildState?.ageGuildMerch) ? guildState.ageGuildMerch : [];

        if (lotsEl) {
            lotsEl.innerHTML = lots.map((lot) => (
                `<article class="age-guild-trade-lot">`
                + `<h4 class="age-guild-trade-lot-title">${escapeHtml(lot.label)}</h4>`
                + `<p class="age-guild-trade-lot-meta">Cost ${escapeHtml(lot.costGold)} gold · Resale ${escapeHtml(lot.resaleGold)} gold</p>`
                + `<button type="button" class="age-guild-trade-buy-btn" data-trade-lot="${escapeHtml(lot.id)}">Purchase</button>`
                + '</article>'
            )).join('');
        }

        if (inventoryEl) {
            inventoryEl.innerHTML = merch.length
                ? merch.map((item) => (
                    `<div class="age-guild-trade-inventory-row">`
                    + `<span>${escapeHtml(item.label)} × ${escapeHtml(item.qty)}</span>`
                    + `<span>${escapeHtml(item.resaleGold)} gold each</span>`
                    + '</div>'
                )).join('')
                : '<p class="age-guild-trade-empty">No merchandise yet. Purchase a convoy lot to begin.</p>';
        }
    }

    function renderBountiesView() {
        const listEl = global.document.getElementById('age-guild-bounty-list');
        const noteEl = global.document.getElementById('age-guild-bounty-active-note');
        const rewards = bountyRewards || {
            hunterGold: 100000,
            hunterChronicleXp: 10000,
            hunterNationRsd: 50000
        };

        if (noteEl) {
            if (guildState?.ageGuildAcceptedBountyId) {
                noteEl.hidden = false;
                noteEl.textContent = 'You are carrying one active bounty contract. Win a PvP attack against your mark before it expires.';
            } else {
                noteEl.hidden = true;
                noteEl.textContent = '';
            }
        }

        if (!listEl) return;

        if (!bountyList.length) {
            listEl.innerHTML = '<p class="age-guild-bounty-empty">No active bounty contracts. Check back shortly.</p>';
            return;
        }

        listEl.innerHTML = bountyList.map((bounty) => {
            const canAccept = !guildState?.ageGuildAcceptedBountyId && !bounty.taken && !bounty.expired;
            return (
                `<article class="age-guild-bounty-card${bounty.acceptedByYou ? ' is-yours' : ''}${bounty.taken && !bounty.acceptedByYou ? ' is-taken' : ''}">`
                + `<header class="age-guild-bounty-card-head">`
                + `<h4 class="age-guild-bounty-target">${escapeHtml(bounty.targetUsername)}</h4>`
                + `<span class="age-guild-bounty-timer">${escapeHtml(bounty.hoursRemaining)}h left</span>`
                + '</header>'
                + `<p class="age-guild-bounty-nation">${escapeHtml(bounty.targetNation || 'Unknown nation')}</p>`
                + `<p class="age-guild-bounty-reward">Reward: ${escapeHtml(rewards.hunterChronicleXp)} BP XP · ${escapeHtml(rewards.hunterGold)} gold · ${escapeHtml(rewards.hunterNationRsd)} RSD</p>`
                + (canAccept
                    ? `<button type="button" class="age-guild-bounty-accept-btn" data-bounty-id="${escapeHtml(bounty.id)}">Accept Bounty</button>`
                    : `<p class="age-guild-bounty-status">${bounty.acceptedByYou ? 'Contract accepted' : (bounty.taken ? 'Taken by another hunter' : 'Expired')}</p>`)
                + '</article>'
            );
        }).join('');
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

    function openTrainingJob(job) {
        activeTrainingMode = job.id;
        activeTrainingLabel = job.label;
        lastBattleResult = null;
        activeBattleTab = 'details';
        lootTabAlert = false;

        void loadGuildState().then(() => {
            if (global.RoyalArmiesAgeViewTabs?.setActiveView) {
                global.RoyalArmiesAgeViewTabs.setActiveView('guild-training');
            } else {
                openJobWorkspace();
                showJobArena('training');
                setTrainingViewOpen(true);
            }
            renderGuildPanel();
        });
    }

    function refreshGuildWorkspaceVisibility() {
        const activeView = global.RoyalArmiesAgeViewTabs?.getActiveView?.();
        if (activeView && global.RoyalArmiesAgeViewTabs?.setActiveView) {
            global.RoyalArmiesAgeViewTabs.setActiveView(activeView, { force: true });
        }
    }

    function openOverlayJob(viewId) {
        openJobWorkspace();
        setOverlayJobOpen(true);
        showJobArena(viewId);
        refreshGuildWorkspaceVisibility();
        renderGuildPanel();
    }

    function openJob(jobId) {
        const hub = hubManifest || { jobs: [] };
        const job = (hub.jobs || []).find((entry) => entry.id === jobId);
        if (!job || !job.available) return;

        if (job.kind === 'training') {
            openTrainingJob(job);
            return;
        }
        if (job.kind === 'trade') {
            openOverlayJob('trade');
            return;
        }
        if (job.kind === 'bounties') {
            openOverlayJob('bounties');
        }
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
        global.document.getElementById('age-guild-battle-wrap')?.classList.add('is-charging');
    }

    function stopBattleHold() {
        battleHeld = false;
        clearChargeTimer();
        resetChargeRing();
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

    async function runAutoHealAfterBattle() {
        if (!autoHealEnabled || battleInFlight) return;
        const api = resolveApi();
        if (!api?.healUnits) return;

        let safety = 200;
        while (safety > 0 && autoHealEnabled && isOpen()) {
            safety -= 1;
            if (!Math.max(0, Math.floor(Number(guildState?.unitsInjured) || 0))) break;
            try {
                mergeGuildState(await api.healUnits({ mode: 'one' }));
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
        if (!api?.runTrainingBattle) return;

        battleInFlight = true;
        resetChargeRing();
        updateControlStates();

        try {
            lastBattleResult = await api.runTrainingBattle({ trainingMode: activeTrainingMode });
            mergeGuildState(lastBattleResult);
            appendLootEntries(lastBattleResult.lootEntries);
            showXpFloat(lastBattleResult.xpGain);
            if (Array.isArray(lastBattleResult.lootEntries) && lastBattleResult.lootEntries.length) {
                lootTabAlert = true;
            }
            setBattleTab('details');
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
            if (battleHeld) scheduleBattleCharge();
        }
    }

    async function healUnits(mode) {
        if (battleInFlight) return;
        const api = resolveApi();
        if (!api?.healUnits) return;
        try {
            mergeGuildState(await api.healUnits({ mode }));
            renderGuildPanel();
        } catch (error) {
            if (typeof global.showRiftError === 'function' && error?.code) {
                global.showRiftError(error.code, error.message);
            }
        }
    }

    async function purchaseTradeLot(lotId) {
        const api = resolveApi();
        if (!api?.purchaseTradeConvoyLot) return;
        try {
            mergeGuildState(await api.purchaseTradeConvoyLot({ lotId }));
            renderGuildPanel();
        } catch (error) {
            if (typeof global.showRiftError === 'function' && error?.code) {
                global.showRiftError(error.code, error.message);
            }
        }
    }

    async function acceptBountyContract(bountyId) {
        const api = resolveApi();
        if (!api?.acceptBounty) return;
        try {
            mergeGuildState(await api.acceptBounty({ bountyId }));
            renderGuildPanel();
        } catch (error) {
            if (typeof global.showRiftError === 'function' && error?.code) {
                global.showRiftError(error.code, error.message);
            }
        }
    }

    async function loadGuildState() {
        if (guildStateLoadInFlight) {
            return guildStateLoadInFlight;
        }

        const api = resolveApi();
        if (!api?.fetchGuildState) return null;

        guildStateLoadInFlight = (async () => {
            api.setSettlementTier?.(settlementTier);
            try {
                mergeGuildState(await api.fetchGuildState({ settlementTier }));
            } catch (error) {
                if (typeof global.showRiftError === 'function' && error?.code) {
                    global.showRiftError(error.code, error.message);
                }
            } finally {
                guildStateLoadInFlight = null;
            }
        })();

        return guildStateLoadInFlight;
    }

    function onBattlePointerDown(event) {
        if (event.button !== 0 || battleInFlight) return;
        if (!Math.max(0, Math.floor(Number(guildState?.unitsUninjured) || 0))) return;
        event.preventDefault();
        battleHeld = true;
        scheduleBattleCharge();
    }

    function onBattlePointerUp() {
        if (!battleHeld) return;
        stopBattleHold();
    }

    function onWorkspaceClick(event) {
        const battleTab = event.target.closest('[data-guild-battle-tab]');
        if (battleTab) {
            event.preventDefault();
            setBattleTab(battleTab.getAttribute('data-guild-battle-tab'));
            return;
        }

        if (event.target.closest('[data-age-guild-close]') || event.target.closest('#age-guild-training-close')) {
            event.preventDefault();
            if (trainingViewActive) {
                closeTrainingView();
            } else {
                closeJobWorkspace();
            }
            return;
        }
        if (event.target.closest('#age-guild-back') || event.target.closest('[data-age-guild-back]')) {
            event.preventDefault();
            stopBattleHold();
            if (trainingViewActive) {
                closeTrainingView();
            } else {
                closeJobWorkspace();
            }
            return;
        }
        const jobBtn = event.target.closest('[data-guild-job]');
        if (jobBtn) {
            event.preventDefault();
            openJob(jobBtn.getAttribute('data-guild-job'));
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
            return;
        }
        const tradeBtn = event.target.closest('[data-trade-lot]');
        if (tradeBtn) {
            event.preventDefault();
            void purchaseTradeLot(tradeBtn.getAttribute('data-trade-lot'));
            return;
        }
        const bountyBtn = event.target.closest('[data-bounty-id]');
        if (bountyBtn) {
            event.preventDefault();
            void acceptBountyContract(bountyBtn.getAttribute('data-bounty-id'));
        }
    }

    function onSettlementMenuClick(event) {
        const jobBtn = event.target.closest('[data-guild-job]');
        if (!jobBtn) return;
        event.preventDefault();
        event.stopPropagation();
        openJob(jobBtn.getAttribute('data-guild-job'));
    }

    function onWorkspaceKeydown(event) {
        if (event.key === 'Escape' && isOpen()) {
            event.preventDefault();
            stopBattleHold();
            if (trainingViewActive) {
                closeTrainingView();
            } else {
                closeJobWorkspace();
            }
        }
    }

    function bindGuild() {
        if (bound) return;
        bound = true;

        const workspace = resolveWorkspace();
        const battleBtn = global.document.getElementById('age-guild-battle-btn');
        const wrap = global.document.getElementById('age-guild-battle-wrap');
        const progressRing = global.document.getElementById('age-guild-training-arena')?.querySelector('.age-guild-charge-ring-progress');

        if (wrap) {
            wrap.style.setProperty('--age-guild-charge-circumference', String(CHARGE_RING_CIRCUMFERENCE));
        }
        if (progressRing) {
            progressRing.style.strokeDasharray = `${CHARGE_RING_CIRCUMFERENCE}`;
            progressRing.style.strokeDashoffset = `${CHARGE_RING_CIRCUMFERENCE}`;
        }

        workspace?.addEventListener('click', onWorkspaceClick);
        global.document.addEventListener('keydown', onWorkspaceKeydown);
        global.addEventListener('royalarmies:age-guild-updated', (event) => {
            mergeGuildState(event?.detail || {});
            if (guildJobsExpanded) renderSettlementGuildJobs();
            if (isOpen()) renderGuildPanel();
        });
        global.addEventListener('royalarmies:age-recruitment-updated', () => {
            if (!guildJobsExpanded && !isOpen()) return;
            void loadGuildState().then(() => {
                if (guildJobsExpanded) renderSettlementGuildJobs();
                if (isOpen()) renderGuildPanel();
            });
        });

        global.document.getElementById('age-settlement-menu-list')?.addEventListener('click', onSettlementMenuClick, true);

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
        toggleSettlementJobs,
        syncSettlementMenuGuild,
        openJob,
        closeJobWorkspace,
        closeTrainingView,
        onTrainingViewOpen,
        onTrainingViewClose,
        isOpen,
        isOverlayOpen,
        enableAgeAdventurersGuild
    };
    global.enableAgeAdventurersGuild = enableAgeAdventurersGuild;
})(window);
