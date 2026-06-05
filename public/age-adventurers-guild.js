/**
 * RIFT — Adventurer's Guild venue (job board + training / trade / bounties).
 */
(function initRoyalArmiesAdventurersGuild(global) {
    'use strict';

    const BATTLE_CHARGE_MS = 930;
    const BATTLE_RING_CIRCUMFERENCE = 2 * Math.PI * 46;
    const EXTENDED_BATTLE_LOG_STORAGE_KEY = 'rift-age-guild-extended-battle-log';
    const BATTLE_DEBUG = (
        new URLSearchParams(global.location?.search || '').has('guildBattleDebug')
        || global.localStorage?.getItem('rift-guild-battle-debug') === '1'
    );
    let battleChargeGen = 0;

    function battleLog(label, extra) {
        if (!BATTLE_DEBUG) return;
        const api = resolveApi();
        console.log('[RIFT][guild-battle]', label, {
            holdActive: battle.holdActive,
            fighting: battle.fighting,
            chargeTimerActive: battle.chargeTimer != null,
            battleChargeGen,
            pointerId: battle.pointerId,
            unitsUninjured: getUnitsUninjuredCount?.() ?? guildState?.unitsUninjured,
            apiPresent: Boolean(api),
            runTrainingBattle: typeof api?.runTrainingBattle,
            activeTrainingMode,
            ...(extra && typeof extra === 'object' ? extra : { detail: extra })
        });
    }

    let bound = false;
    let guildState = null;
    let hubManifest = null;
    let bountyList = [];
    let bountyRewards = null;
    let activeView = null;
    let activeTrainingMode = 'street-patrol';
    let activeTrainingLabel = 'Street Patrol';
    let settlementTier = 'village';
    let lastBattleResult = null;
    let guildJobsExpanded = false;
    let guildStateLoadInFlight = null;
    let lootLog = [];
    let activeBattleTab = 'details';
    let showExtendedBattleLog = false;
    let lootTabAlert = false;
    let trainingViewActive = false;
    let overlayJobActive = false;
    let hubViewActive = false;

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
        return trainingViewActive || overlayJobActive || hubViewActive;
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
            ageGuildXpRequired: payload.ageGuildXpRequired ?? guildState?.ageGuildXpRequired ?? 90,
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
        if (payload.hub?.settlementTier) {
            settlementTier = String(payload.hub.settlementTier).trim().toLowerCase();
        }
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
        if (viewId === 'hub') return global.document.getElementById('age-guild-jobs-arena');
        return null;
    }

    function syncImmersiveWorkspace() {
        global.RoyalArmiesImmersiveWorkspace?.sync?.();
    }

    function setHubViewOpen(isOpen) {
        hubViewActive = isOpen;
        global.document.body.classList.toggle('age-guild-hub-open', isOpen);
        syncImmersiveWorkspace();
    }

    function setTrainingViewOpen(isOpen) {
        trainingViewActive = isOpen;
        global.document.getElementById('age-page-canvas')?.classList.toggle('age-guild-training-view-open', isOpen);
        global.document.body.classList.toggle('age-guild-training-open', isOpen);
        syncImmersiveWorkspace();
    }

    function setOverlayJobOpen(isOpen) {
        overlayJobActive = isOpen;
        global.document.getElementById('age-page-canvas')?.classList.toggle('age-guild-overlay-open', isOpen);
        global.document.body.classList.toggle('age-guild-overlay-open', isOpen);
        syncImmersiveWorkspace();
    }

    function hideAllJobArenas() {
        ['training', 'trade', 'bounties', 'hub'].forEach((viewId) => {
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
        battleControlsReset();
        const workspace = resolveWorkspace();
        if (workspace) {
            workspace.hidden = true;
            workspace.setAttribute('aria-hidden', 'true');
        }
        setOverlayJobOpen(false);
        setHubViewOpen(false);
        hideAllJobArenas();
        activeView = null;
        refreshGuildWorkspaceVisibility();
    }

    function dismissGuildWorkspacesForSettlementAction() {
        guildJobsExpanded = false;
        syncSettlementMenuGuild();
        if (trainingViewActive || overlayJobActive || hubViewActive) {
            closeTrainingView({ skipViewRestore: true });
            closeJobWorkspace();
        }
        if (global.RoyalArmiesAgeViewTabs?.getActiveView?.() === 'guild-training') {
            global.RoyalArmiesAgeViewTabs.openMapSettlementPanel?.()
                || global.RoyalArmiesAgeViewTabs.setActiveView('city');
        }
    }

    function resolveGuildHubJobsHost() {
        return global.document.getElementById('age-guild-hub-jobs-host');
    }

    function renderGuildHubJobOption(job) {
        const lockedClass = job.available ? '' : ' is-locked';
        const featuredClass = job.featured ? ' is-featured' : '';
        const lockLine = job.available
            ? ''
            : `<span class="age-settlement-guild-job-lock">${escapeHtml(job.lockReason || 'Unavailable')}</span>`;
        const featuredTag = job.featured ? '<span class="age-settlement-guild-job-tag">Primary</span>' : '';

        return (
            `<button type="button" class="age-settlement-guild-job age-guild-hub-job${lockedClass}${featuredClass}"`
            + ` data-guild-job="${escapeHtml(job.id)}"`
            + `${job.available ? '' : ' disabled'}>`
            + `<span class="age-settlement-guild-job-label">${escapeHtml(job.label)}</span>`
            + featuredTag
            + `<span class="age-settlement-guild-job-desc">${escapeHtml(job.description)}</span>`
            + lockLine
            + '</button>'
        );
    }

    function renderGuildHubJobs(options = {}) {
        const host = resolveGuildHubJobsHost();
        const hub = hubManifest || { jobs: [], settlementTierLabel: 'Settlement', rank: 1 };
        if (!host) return;

        const jobs = Array.isArray(hub.jobs) ? hub.jobs : [];
        let nextHtml;
        if (!jobs.length && options.loading) {
            nextHtml = '<p class="age-settlement-guild-jobs-empty">Loading guild contracts…</p>';
        } else if (!jobs.length) {
            nextHtml = '<p class="age-settlement-guild-jobs-empty">No guild jobs are configured for this settlement.</p>';
        } else {
            nextHtml = jobs.map((job) => renderGuildHubJobOption(job)).join('');
        }

        if (host.innerHTML !== nextHtml) {
            host.innerHTML = nextHtml;
        }
    }

    async function openSettlementHub(detail = {}) {
        global.RoyalArmiesSettlementVenueWorkspaces?.close?.();
        guildJobsExpanded = false;
        syncSettlementMenuGuild();
        settlementTier = String(detail?.settlementTier || settlementTier || 'village').trim().toLowerCase();
        resolveApi()?.setSettlementTier?.(settlementTier);

        renderGuildHubJobs({ loading: true });
        await ensureSettlementGuildHubLoaded({ settlementTier });
        renderGuildHubJobs();

        openJobWorkspace();
        setHubViewOpen(true);
        setOverlayJobOpen(false);
        setTrainingViewOpen(false);
        showJobArena('hub');
        refreshGuildWorkspaceVisibility();
    }

    function closeTrainingView(options = {}) {
        battleControlsReset();
        hideAllJobArenas();
        activeView = null;
        setTrainingViewOpen(false);
        closeJobWorkspace();

        if (!options.skipViewRestore && global.RoyalArmiesAgeViewTabs?.getActiveView?.() === 'guild-training') {
            global.RoyalArmiesAgeViewTabs.openMapSettlementPanel?.()
                || global.RoyalArmiesAgeViewTabs.setActiveView('city');
        }
    }

    function onTrainingViewOpen() {
        setTrainingViewOpen(true);
        openJobWorkspace();
        showJobArena('training');
        battleControlsBind();
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

    function renderSettlementGuildJobs(options = {}) {
        const optionsEl = resolveGuildJobsContainer();
        const hub = hubManifest || { jobs: [], settlementTierLabel: 'Settlement', rank: 1 };
        if (!optionsEl) return;

        const jobs = Array.isArray(hub.jobs) ? hub.jobs : [];
        let nextHtml;
        if (!jobs.length && options.loading) {
            nextHtml = '<p class="age-settlement-guild-jobs-empty">Loading guild contracts…</p>';
        } else if (!jobs.length) {
            nextHtml = '<p class="age-settlement-guild-jobs-empty">No guild jobs are configured for this settlement.</p>';
        } else {
            nextHtml = jobs.map((job) => renderSettlementGuildJobOption(job)).join('');
        }

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

    async function ensureSettlementGuildHubLoaded(detail = {}) {
        settlementTier = String(detail?.settlementTier || settlementTier || 'village').trim().toLowerCase();
        resolveApi()?.setSettlementTier?.(settlementTier);

        if (Array.isArray(hubManifest?.jobs) && hubManifest.jobs.length) {
            return hubManifest;
        }

        await loadGuildState();
        return hubManifest;
    }

    async function toggleSettlementJobs(detail) {
        settlementTier = String(detail?.settlementTier || settlementTier || 'village').trim().toLowerCase();
        resolveApi()?.setSettlementTier?.(settlementTier);

        guildJobsExpanded = !guildJobsExpanded;
        syncSettlementMenuGuild();
        if (guildJobsExpanded) {
            renderSettlementGuildJobs({ loading: !Array.isArray(hubManifest?.jobs) || !hubManifest.jobs.length });
            await ensureSettlementGuildHubLoaded({ settlementTier });
            renderSettlementGuildJobs();
        }
    }

    function loadExtendedBattleLogPreference() {
        try {
            showExtendedBattleLog = global.localStorage?.getItem(EXTENDED_BATTLE_LOG_STORAGE_KEY) === '1';
        } catch {
            showExtendedBattleLog = false;
        }
    }

    function setExtendedBattleLog(enabled) {
        showExtendedBattleLog = Boolean(enabled);
        try {
            global.localStorage?.setItem(
                EXTENDED_BATTLE_LOG_STORAGE_KEY,
                showExtendedBattleLog ? '1' : '0'
            );
        } catch {
            /* ignore */
        }
        syncExtendedBattleLogToggle();
        renderBattleLog();
    }

    function syncExtendedBattleLogToggle() {
        const toggle = global.document.getElementById('age-guild-battle-log-extended-toggle');
        if (!toggle) return;
        toggle.checked = showExtendedBattleLog;
        toggle.setAttribute('aria-checked', showExtendedBattleLog ? 'true' : 'false');
    }

    function renderCommanderXpSummaryRow(result) {
        const xp = Math.max(0, Math.floor(Number(result?.xpGain) || 0));
        return (
            '<p class="age-guild-log-summary-row age-guild-log-summary-xp">'
            + '<span class="age-guild-log-summary-label">Guild XP</span> '
            + `<span class="age-guild-log-summary-value">+${escapeHtml(xp)}</span>`
            + '</p>'
        );
    }

    function renderInjuriesSummaryRow(injuriesApplied) {
        const count = Math.max(0, Math.floor(Number(injuriesApplied) || 0));
        return (
            '<p class="age-guild-log-summary-row age-guild-log-summary-injuries">'
            + '<span class="age-guild-log-summary-label">Injuries</span> '
            + `<span class="age-guild-log-summary-value">${count ? `${escapeHtml(count)} unit(s) injured` : 'None'}</span>`
            + '</p>'
        );
    }

    function renderBattleLogExtendedBlock(result) {
        const xpBreakdown = result.xpBreakdown && typeof result.xpBreakdown === 'object' ? result.xpBreakdown : null;
        const survivorMeta = xpBreakdown && Number.isFinite(xpBreakdown.totalSurviving)
            ? ` · ${xpBreakdown.totalSurviving} survivor(s)`
            : '';
        const logLines = (Array.isArray(result.log) ? result.log : [])
            .map((line) => `<li>${escapeHtml(line)}</li>`)
            .join('');

        return (
            '<div class="age-guild-log-extended">'
            + '<header class="age-guild-log-head age-guild-log-head--extended">'
            + `<p class="age-guild-log-outcome">${escapeHtml(formatWinnerLabel(result.winner))}</p>`
            + `<p class="age-guild-log-meta">${escapeHtml(formatEndReason(result))} · +${escapeHtml(result.xpGain ?? 0)} XP${escapeHtml(survivorMeta)}`
            + `${result.injuriesApplied ? ` · ${escapeHtml(result.injuriesApplied)} injured` : ''}</p>`
            + '</header>'
            + `<ol class="age-guild-battle-log">${logLines}</ol>`
            + '</div>'
        );
    }

    function renderBattleLogSummaryBlock(result) {
        const rankLine = result.rankPromoted
            ? `<p class="age-guild-log-promotion">Promoted to rank ${escapeHtml(result.rank)}`
            + `${result.provisionsGranted ? ` · +${escapeHtml(result.provisionsGranted)} provisions` : ''}</p>`
            : '';

        const promoteReady = Array.isArray(result.unitsReadyToPromote) ? result.unitsReadyToPromote : [];
        const unitPromoteBlock = promoteReady.length
            ? (
                '<div class="age-guild-log-unit-promote">'
                + `<p class="age-guild-log-unit-promote-title">${escapeHtml(promoteReady.length)} unit stack(s) ready for promotion</p>`
                + '<ul class="age-guild-log-unit-promote-list">'
                + promoteReady.map((entry) => (
                    `<li>${escapeHtml(entry.name)} → ${escapeHtml(entry.nextPromotionLabel || 'next rank')}</li>`
                )).join('')
                + '</ul>'
                + '</div>'
            )
            : '';

        const showWorkspaceLinks = Boolean(result.rankPromoted);
        const workspaceLinksBlock = showWorkspaceLinks ? renderBattleLogWorkspaceLinks() : '';

        return (
            '<div class="age-guild-log-summary">'
            + renderCommanderXpSummaryRow(result)
            + renderInjuriesSummaryRow(result.injuriesApplied)
            + (rankLine || unitPromoteBlock || workspaceLinksBlock
                ? `<div class="age-guild-log-summary-section age-guild-log-summary-section--promotions">${rankLine}${unitPromoteBlock}${workspaceLinksBlock}</div>`
                : '')
            + '</div>'
        );
    }

    function renderBattleLogToolbar() {
        return (
            '<div class="age-guild-battle-report-toolbar">'
            + '<label class="age-guild-battle-log-toggle">'
            + '<input type="checkbox" id="age-guild-battle-log-extended-toggle" class="age-guild-battle-log-toggle-input">'
            + '<span class="age-guild-battle-log-toggle-label">Show full battle log</span>'
            + '</label>'
            + '</div>'
        );
    }

    function ensureBattleLogToolbar() {
        const panel = global.document.getElementById('age-guild-battle-tab-details');
        if (!panel || panel.querySelector('.age-guild-battle-report-toolbar')) return;
        panel.insertAdjacentHTML('afterbegin', renderBattleLogToolbar());
        syncExtendedBattleLogToggle();
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

    function formatSettlementTierLabel(tier) {
        const key = String(tier || settlementTier || 'village').trim().toLowerCase();
        if (typeof global.RoyalArmiesAgeMovementPanel?.formatSettlementTier === 'function') {
            return global.RoyalArmiesAgeMovementPanel.formatSettlementTier(key);
        }
        const labels = {
            village: 'Village',
            town: 'Town',
            city: 'City',
            kingdom: 'Kingdom',
            citadel: 'Citadel'
        };
        return labels[key] || key.charAt(0).toUpperCase() + key.slice(1);
    }

    function syncTrainingReturnButton() {
        const btn = global.document.getElementById('age-guild-training-return-btn');
        if (!btn) return;
        const tierLabel = formatSettlementTierLabel(settlementTier);
        btn.textContent = `← ${tierLabel}`;
        btn.setAttribute('aria-label', `Return to ${tierLabel.toLowerCase()}`);
    }

    function renderGuildPanel() {
        if (guildJobsExpanded) renderSettlementGuildJobs();
        syncTrainingReturnButton();
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

    function renderBattleLogWorkspaceLinks() {
        return (
            '<p class="age-guild-log-workspace-links">'
            + '<span class="age-guild-log-workspace-links-label">Barracks:</span> '
            + '<button type="button" class="age-guild-log-workspace-link" data-guild-log-workspace="registry">Garrison Registry</button>'
            + '<span class="age-guild-log-workspace-sep" aria-hidden="true"> · </span>'
            + '<button type="button" class="age-guild-log-workspace-link" data-guild-log-workspace="evolution">Unit Evolution Workspace</button>'
            + '</p>'
        );
    }

    function openBattleLogWorkspace(target) {
        const normalized = String(target || '').trim().toLowerCase();
        if (normalized === 'registry') {
            global.RoyalArmiesAgeBarracks?.open();
            return;
        }
        if (normalized === 'evolution') {
            global.RoyalArmiesAgeUnitEvolution?.open({ highlightReady: true });
        }
    }

    function renderBattleLog() {
        ensureBattleLogToolbar();
        syncExtendedBattleLogToggle();

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
        const extendedBlock = showExtendedBattleLog ? renderBattleLogExtendedBlock(result) : '';

        logEl.innerHTML = (
            `<article class="age-guild-log-entry ${winnerClass} age-guild-log-entry--summary">`
            + renderBattleLogSummaryBlock(result)
            + extendedBlock
            + '</article>'
        );
        logEl.scrollTop = 0;
    }

    function showCommanderRankPromotionPopup(result) {
        const overlay = global.document.getElementById('age-rank-promotion-overlay');
        if (!overlay || !result?.rankPromoted) return;

        const rankEl = global.document.getElementById('age-rank-promotion-rank');
        const detailEl = global.document.getElementById('age-rank-promotion-detail');
        const provisionsEl = global.document.getElementById('age-rank-promotion-provisions');

        if (rankEl) rankEl.textContent = String(result.rank ?? '');
        if (detailEl) {
            detailEl.textContent = `You have reached commander rank ${result.rank}. Train your units and expand your army.`;
        }
        if (provisionsEl) {
            if (result.provisionsGranted) {
                provisionsEl.hidden = false;
                const balance = result.ageProvisions != null
                    ? Math.max(0, Math.floor(Number(result.ageProvisions) || 0))
                    : null;
                provisionsEl.textContent = balance != null
                    ? `+${result.provisionsGranted} provisions (balance now ${balance.toLocaleString('en-US')})`
                    : `+${result.provisionsGranted} provisions granted`;
            } else {
                provisionsEl.hidden = true;
                provisionsEl.textContent = '';
            }
        }

        overlay.hidden = false;
        overlay.setAttribute('aria-hidden', 'false');
        global.document.body.classList.add('age-rank-promotion-open');
        global.document.getElementById('age-rank-promotion-dismiss')?.focus();
    }

    function dismissCommanderRankPromotionPopup() {
        const overlay = global.document.getElementById('age-rank-promotion-overlay');
        if (!overlay) return;

        overlay.hidden = true;
        overlay.setAttribute('aria-hidden', 'true');
        global.document.body.classList.remove('age-rank-promotion-open');
    }

    function openBarracksFromRankPopup() {
        dismissCommanderRankPromotionPopup();
        dismissGuildWorkspacesForSettlementAction();
        global.RoyalArmiesAgeBarracks?.open();
    }

    function openUnitEvolutionFromRankPopup() {
        dismissCommanderRankPromotionPopup();
        dismissGuildWorkspacesForSettlementAction();
        global.RoyalArmiesAgeUnitEvolution?.open({ highlightReady: true });
    }

    function onRankPromotionOverlayClick(event) {
        if (event.target.closest('#age-rank-promotion-dismiss')) {
            event.preventDefault();
            dismissCommanderRankPromotionPopup();
            return;
        }
        if (event.target.closest('#age-rank-promotion-barracks')) {
            event.preventDefault();
            openBarracksFromRankPopup();
            return;
        }
        if (event.target.closest('#age-rank-promotion-evolution')) {
            event.preventDefault();
            openUnitEvolutionFromRankPopup();
        }
    }

    function onRankPromotionOverlayKeydown(event) {
        if (event.key !== 'Escape') return;
        const overlay = global.document.getElementById('age-rank-promotion-overlay');
        if (!overlay || overlay.hidden) return;
        event.preventDefault();
        dismissCommanderRankPromotionPopup();
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

    function getUnitsUninjuredCount() {
        return Math.max(0, Math.floor(Number(guildState?.unitsUninjured) || 0));
    }

    function getUnitsInjuredCount() {
        return Math.max(0, Math.floor(Number(guildState?.unitsInjured) || 0));
    }

    /** @type {{ holdActive: boolean, fighting: boolean, chargeTimer: ReturnType<typeof setTimeout> | null, pointerId: number | null, autoHeal: boolean, bound: boolean, wrap: HTMLElement | null }} */
    const battle = {
        holdActive: false,
        fighting: false,
        chargeTimer: null,
        pointerId: null,
        autoHeal: false,
        bound: false,
        wrap: null
    };

    function battleCanFight() {
        return getUnitsUninjuredCount() > 0 && !battle.fighting;
    }

    function battleGetWrap() {
        return battle.wrap || global.document.getElementById('age-guild-battle-wrap');
    }

    function battleClearChargeVisual() {
        const wrap = battleGetWrap();
        if (!wrap) return;
        wrap.classList.remove('is-charging');
        const progress = wrap.querySelector('.age-guild-charge-ring-progress');
        if (!progress) return;
        progress.style.animation = 'none';
        progress.getBoundingClientRect();
        progress.style.animation = '';
    }

    function battleClearChargeTimer() {
        if (battle.chargeTimer) {
            global.clearTimeout(battle.chargeTimer);
            battle.chargeTimer = null;
            battleChargeGen += 1;
            battleLog('charge timer cleared');
        }
    }

    function battleDetachHoldListeners() {
        const wrap = battleGetWrap();
        if (!wrap) return;
        wrap.removeEventListener('pointerup', battleOnWrapPointerUp);
        wrap.removeEventListener('pointercancel', battleOnWrapPointerUp);
        wrap.removeEventListener('lostpointercapture', battleOnWrapPointerLost);
        if (battle.pointerId != null && wrap.hasPointerCapture?.(battle.pointerId)) {
            try {
                wrap.releasePointerCapture(battle.pointerId);
            } catch (err) {
                // Pointer already released.
            }
        }
    }

    function battleEndHold(cancelCharge) {
        battleLog('battleEndHold', { cancelCharge, stack: BATTLE_DEBUG ? new Error().stack : undefined });
        battleDetachHoldListeners();
        battle.holdActive = false;
        battle.pointerId = null;
        if (cancelCharge) {
            battleClearChargeTimer();
            battleClearChargeVisual();
        } else {
            battleGetWrap()?.classList.remove('is-hold-active');
        }
        battleSyncUi();
    }

    function battleStartCharge() {
        battleLog('battleStartCharge enter');
        battleClearChargeTimer();
        if (!battle.holdActive || battle.fighting || !battleCanFight()) {
            battleLog('battleStartCharge aborted', {
                reason: !battle.holdActive ? 'holdInactive' : (battle.fighting ? 'fighting' : 'cannotFight')
            });
            if (!battleCanFight()) battleEndHold(true);
            return;
        }

        const wrap = battleGetWrap();
        if (!wrap) {
            battleLog('battleStartCharge aborted', { reason: 'noWrap' });
            return;
        }

        const chargeGen = battleChargeGen;
        wrap.classList.add('is-charging');
        battleLog('battleStartCharge scheduled', { chargeGen, delayMs: BATTLE_CHARGE_MS });
        battle.chargeTimer = global.setTimeout(() => {
            battle.chargeTimer = null;
            if (chargeGen !== battleChargeGen) {
                battleLog('charge callback aborted (superseded)', { chargeGen, battleChargeGen });
                return;
            }
            battleLog('charge callback firing → battleExecute');
            wrap.classList.remove('is-charging');
            void battleExecute();
        }, BATTLE_CHARGE_MS);
    }

    async function battleRunAutoHealLoop() {
        if (!battle.autoHeal || battle.fighting) return;
        const api = resolveApi();
        if (!api?.healUnits) return;

        let safety = 200;
        while (safety > 0 && battle.autoHeal && isOpen()) {
            safety -= 1;
            if (!getUnitsInjuredCount()) break;
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

    async function battleExecute() {
        battleLog('battleExecute enter');
        if (battle.fighting) {
            battleLog('battleExecute early return', { reason: 'alreadyFighting' });
            return;
        }

        const api = resolveApi();
        battleLog('battleExecute api check', {
            apiKeys: api ? Object.keys(api) : null,
            hasRunTrainingBattle: Boolean(api?.runTrainingBattle)
        });
        if (!api?.runTrainingBattle) {
            console.error('[RIFT][guild-battle] RoyalArmiesAgeGuildTraining.runTrainingBattle is unavailable', {
                RoyalArmiesAgeGuildTraining: global.RoyalArmiesAgeGuildTraining
            });
            battleEndHold(true);
            return;
        }

        battle.fighting = true;
        battleClearChargeTimer();
        battleClearChargeVisual();
        battleSyncUi();
        battleLog('battleExecute calling runTrainingBattle', { trainingMode: activeTrainingMode });

        try {
            lastBattleResult = await api.runTrainingBattle({ trainingMode: activeTrainingMode });
            battleLog('battleExecute success', {
                winner: lastBattleResult?.winner,
                xpGain: lastBattleResult?.xpGain
            });
            mergeGuildState(lastBattleResult);
            appendLootEntries(lastBattleResult.lootEntries);
            showXpFloat(lastBattleResult.xpGain);
            if (Array.isArray(lastBattleResult.lootEntries) && lastBattleResult.lootEntries.length) {
                lootTabAlert = true;
            }
            setBattleTab('details');
            renderGuildPanel();
            if (lastBattleResult.rankPromoted) {
                showCommanderRankPromotionPopup(lastBattleResult);
            }
        } catch (error) {
            console.error('[RIFT][guild-battle] runTrainingBattle failed', error);
            if (typeof global.showRiftError === 'function' && error?.code) {
                global.showRiftError(error.code, error.message);
            } else if (error?.message) {
                console.warn('[RIFT][guild-battle]', error.message);
                if (typeof global.showRiftError === 'function') {
                    global.showRiftError('NEXUS-GEN-001', error.message);
                }
            }
            battleEndHold(true);
        } finally {
            battle.fighting = false;
            renderGuildPanel();
            battleLog('battleExecute finally', { holdActive: battle.holdActive });

            if (battle.autoHeal && getUnitsInjuredCount()) {
                await battleRunAutoHealLoop();
            }

            if (!battle.holdActive) {
                battleSyncUi();
                return;
            }

            if (battleCanFight()) {
                battleStartCharge();
            } else {
                battleEndHold(true);
            }
        }
    }

    function battleOnWrapPointerDown(event) {
        if (event.button !== 0 || battle.fighting || battle.holdActive) return;
        if (!event.currentTarget?.contains(event.target)) return;
        if (!battleCanFight()) return;

        event.preventDefault();

        const wrap = event.currentTarget;
        battle.holdActive = true;
        battle.pointerId = event.pointerId;
        wrap.classList.add('is-hold-active');

        wrap.addEventListener('pointerup', battleOnWrapPointerUp);
        wrap.addEventListener('pointercancel', battleOnWrapPointerUp);
        wrap.addEventListener('lostpointercapture', battleOnWrapPointerLost);

        if (typeof wrap.setPointerCapture === 'function') {
            try {
                wrap.setPointerCapture(event.pointerId);
            } catch (err) {
                battleLog('setPointerCapture failed', { message: err?.message });
            }
        }

        battleLog('pointerdown hold started', {
            pointerId: event.pointerId,
            pointerType: event.pointerType,
            target: event.target?.id || event.target?.className
        });
        battleSyncUi();
        battleStartCharge();
    }

    function battleOnWrapPointerUp(event) {
        if (battle.pointerId == null || event.pointerId !== battle.pointerId) return;
        const cancelCharge = Boolean(battle.chargeTimer);
        battleLog('pointerup/cancel', {
            type: event.type,
            cancelCharge,
            buttons: event.buttons
        });
        battleEndHold(cancelCharge);
    }

    function battleOnWrapPointerLost(event) {
        if (battle.pointerId == null || event.pointerId !== battle.pointerId) return;
        // lostpointercapture often fires before pointerup while the button is still held.
        // Cancelling here clears the charge timer while the CSS ring keeps animating.
        if (battle.chargeTimer != null) {
            battleLog('lostpointercapture ignored (charge pending)', { type: event.type });
            return;
        }
        battleLog('lostpointercapture end hold', { type: event.type });
        battleEndHold(false);
    }

    function battleSyncUi() {
        const battleBtn = global.document.getElementById('age-guild-battle-btn');
        const healOneBtn = global.document.getElementById('age-guild-heal-one');
        const healAllBtn = global.document.getElementById('age-guild-heal-all');
        const autoHealBtn = global.document.getElementById('age-guild-auto-heal');
        const unitsUninjured = getUnitsUninjuredCount();
        const unitsInjured = getUnitsInjuredCount();
        const canFight = unitsUninjured > 0 && !battle.fighting;
        const showReady = battle.holdActive ? unitsUninjured > 0 : canFight;

        if (battleBtn) {
            battleBtn.disabled = false;
            battleBtn.setAttribute('aria-disabled', showReady ? 'false' : 'true');
            battleBtn.classList.toggle('is-ready', showReady);
            battleBtn.classList.toggle('is-disabled', !showReady);
            battleBtn.classList.toggle('is-busy', battle.fighting);
            battleBtn.setAttribute('aria-busy', battle.fighting ? 'true' : 'false');
        }
        if (healOneBtn) healOneBtn.disabled = !unitsInjured || battle.fighting;
        if (healAllBtn) healAllBtn.disabled = !unitsInjured || battle.fighting;
        if (autoHealBtn) {
            autoHealBtn.classList.toggle('is-active', battle.autoHeal);
            autoHealBtn.setAttribute('aria-pressed', battle.autoHeal ? 'true' : 'false');
        }
    }

    function battleControlsReset() {
        battleEndHold(true);
        battle.fighting = false;
        battleSyncUi();
    }

    function battleControlsBind() {
        const wrap = global.document.getElementById('age-guild-battle-wrap');
        const progressRing = global.document.getElementById('age-guild-training-arena')
            ?.querySelector('.age-guild-charge-ring-progress');

        if (!wrap) return;

        battle.wrap = wrap;
        wrap.style.setProperty('--age-guild-charge-circumference', String(BATTLE_RING_CIRCUMFERENCE));
        wrap.style.setProperty('--age-guild-charge-duration', `${BATTLE_CHARGE_MS}ms`);

        if (progressRing) {
            progressRing.style.strokeDasharray = `${BATTLE_RING_CIRCUMFERENCE}`;
            progressRing.style.strokeDashoffset = `${BATTLE_RING_CIRCUMFERENCE}`;
        }

        if (battle.bound) return;
        battle.bound = true;

        wrap.addEventListener('pointerdown', battleOnWrapPointerDown);
        global.window.addEventListener('blur', battleOnWindowBlur);

        battleLog('battleControlsBind', {
            wrapId: wrap.id,
            api: global.RoyalArmiesAgeGuildTraining,
            debugHint: 'Add ?guildBattleDebug=1 or localStorage rift-guild-battle-debug=1'
        });
    }

    function battleOnWindowBlur() {
        if (battle.holdActive || battle.chargeTimer) {
            battleLog('window blur → end hold');
            battleEndHold(true);
        }
    }

    async function healUnits(mode) {
        if (battle.fighting) return;
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

    function updateControlStates() {
        battleSyncUi();
    }

    function openTrainingJob(job) {
        activeTrainingMode = job.id;
        activeTrainingLabel = job.label;
        lastBattleResult = null;
        activeBattleTab = 'details';
        lootTabAlert = false;

        void loadGuildState().then(() => {
            openJobWorkspace();
            showJobArena('training');
            setTrainingViewOpen(true);
            if (global.RoyalArmiesAgeViewTabs?.setActiveView) {
                global.RoyalArmiesAgeViewTabs.setActiveView('guild-training');
            }
            renderGuildPanel();
            battleControlsBind();
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

        if (hubViewActive) {
            setHubViewOpen(false);
        }

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

    function onWorkspaceClick(event) {
        const battleTab = event.target.closest('[data-guild-battle-tab]');
        if (battleTab) {
            event.preventDefault();
            setBattleTab(battleTab.getAttribute('data-guild-battle-tab'));
            return;
        }

        if (event.target.closest('[data-age-guild-close]')) {
            event.preventDefault();
            if (trainingViewActive) {
                closeTrainingView();
            } else {
                closeJobWorkspace();
            }
            return;
        }
        if (event.target.closest('[data-age-guild-back]') || event.target.closest('#age-guild-training-return-btn')) {
            event.preventDefault();
            battleControlsReset();
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
            battle.autoHeal = !battle.autoHeal;
            updateControlStates();
            if (battle.autoHeal) {
                void battleRunAutoHealLoop();
            }
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
            return;
        }
        const workspaceLink = event.target.closest('[data-guild-log-workspace]');
        if (workspaceLink) {
            event.preventDefault();
            openBattleLogWorkspace(workspaceLink.getAttribute('data-guild-log-workspace'));
        }
    }

    function onBattleLogToggleChange(event) {
        if (event.target?.id !== 'age-guild-battle-log-extended-toggle') return;
        setExtendedBattleLog(event.target.checked);
    }

    function onSettlementMenuClick(event) {
        const jobBtn = event.target.closest('[data-guild-job]');
        if (!jobBtn) return;
        if (event.target.closest('[data-garrison-option]')) return;
        event.preventDefault();
        event.stopPropagation();
        openJob(jobBtn.getAttribute('data-guild-job'));
    }

    function onWorkspaceKeydown(event) {
        if (event.key === 'Escape' && isOpen()) {
            event.preventDefault();
            battleControlsReset();
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

        loadExtendedBattleLogPreference();

        const workspace = resolveWorkspace();

        battleControlsBind();

        workspace?.addEventListener('click', onWorkspaceClick);
        workspace?.addEventListener('change', onBattleLogToggleChange);
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

        const rankOverlay = global.document.getElementById('age-rank-promotion-overlay');
        rankOverlay?.addEventListener('click', onRankPromotionOverlayClick);
        global.document.addEventListener('keydown', onRankPromotionOverlayKeydown);
    }

    function enableAgeAdventurersGuild() {
        bindGuild();
        global.enableAgeUnitEvolution?.();
    }

    global.RoyalArmiesAdventurersGuild = {
        toggleSettlementJobs,
        syncSettlementMenuGuild,
        ensureSettlementGuildHubLoaded,
        openSettlementHub,
        openJob,
        closeJobWorkspace,
        dismissGuildWorkspacesForSettlementAction,
        closeTrainingView,
        onTrainingViewOpen,
        onTrainingViewClose,
        isOpen,
        isOverlayOpen,
        enableAgeAdventurersGuild
    };
    global.enableAgeAdventurersGuild = enableAgeAdventurersGuild;
})(window);
