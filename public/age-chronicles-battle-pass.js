/**
 * RIFT — Age page Chronicles Battle Pass modal (horizontal free + premium tracks).
 */
(function initAgeChroniclesBattlePass(global) {
    'use strict';

    const TIER_MAX_LEVEL = 50;
    const FREE_PASS_LABEL = 'Free Pass';
    const PREMIUM_PASS_LABEL = 'Premium Pass';
    const BATTLE_PASS_HEADING = 'The Chronicles Battle Pass';
    const XP_STORAGE_KEY = 'savedChronicleMeritProgress';
    const XP_PROGRESS_VERSION = 2;
    const MEMBERSHIP_STORAGE_KEY = 'savedCommanderMembershipTitle';

    const LEVEL_EPITHETS = [
        'Ledger Initiate', 'Field Observer', 'Skirmish Scribe', 'Banner Chronicler', 'Siege Witness',
        'Duel Scribe', 'Lore Seeker', 'War Archivist', 'Vanguard Scribe', 'Battle Cantor',
        'Citadel Herald', 'PvP Annotator', 'Relic Hunter', 'Frontline Archivist', 'War-Chronicle Knight',
        'High Scribe', 'Siege Laureate', 'Bloodfield Historian', 'Mapward Sage', 'Grand Chronicler',
        'Iron Quill', 'Bastion Keeper', 'Rivalry Scribe', 'Hidden Lore Walker', 'Siege Chronicler',
        'Warband Archivist', 'Duelist Laureate', 'Codex Pathfinder', 'Citadel Loremaster', 'Chronicle Vanguard',
        'Frontline Sovereign', 'PvP High Scribe', 'Relic Sovereign', 'Siege Archon', 'Lorebound Knight',
        'War Sage', 'Battle Archivist', 'Map Legend', 'Citadel Paragon', 'Chronicle Warlord',
        'Grand Mapwarden', 'High Lorekeeper', 'Siege Paragon', 'Bloodfield Sovereign', 'Relic Archon',
        'Chronicle Ascendant', 'Amnek Witness', 'Age Chronicler', 'War of Ages Scribe', 'Eternal Loremaster',
        'Chronicle Apex'
    ];

    const LEVEL_XP_THRESHOLDS = (function buildThresholds() {
        const thresholds = [0];
        for (let level = 2; level <= TIER_MAX_LEVEL; level += 1) {
            thresholds.push(Math.round(28 * Math.pow(level - 1, 1.62)));
        }
        return thresholds;
    }());

    const BASIC_REWARDS_BY_RANK = {
        5: { title: 'Scout\'s Crest Frame', reward: 'Profile avatar border — bronze filigree' },
        10: { title: 'Quartermaster Stipend', reward: '+5% provision cap while enrolled in an Age' },
        15: { title: 'War Table Emote Pack I', reward: 'Three commander salute animations for chat' },
        18: { title: 'Campaign Pennant', reward: 'Nation-colored pennant on your public profile card' },
        22: { title: 'Lord-High Commendation', reward: 'Exclusive title flair and silver nameplate trim' },
        25: { title: 'Veteran\'s March Pennant', reward: 'Animated campaign streamer on your public dossier' },
        30: { title: 'War Table Emote Pack II', reward: 'Six additional tactical salute animations for chat' },
        35: { title: 'Expeditioner\'s Kit', reward: '+8% march readiness bonus while enrolled in an Age' },
        40: { title: 'Silver Commendation Frame', reward: 'Animated silver avatar border and chronicle ribbon' },
        45: { title: 'High Command Insignia', reward: 'Exclusive commander insignia slot on your profile card' },
        50: { title: 'Chronicle Apex — Agebringer', reward: 'Legendary title flair, gold nameplate trim, and codex portrait frame' }
    };

    const PREMIUM_REWARDS_BY_RANK = {
        5: { title: 'Gilded Chronicle Frame', reward: 'Animated gold avatar border for your commander dossier' },
        10: { title: 'Royal Courier Slots', reward: '+3 extra recipients per outbound message while subscribed' },
        15: { title: 'Premium War Table Emotes', reward: 'Six exclusive salute and victory animations for chat' },
        18: { title: 'Sovereign Banner Overlay', reward: 'Animated nation banner backdrop on your profile' },
        22: { title: 'Crownwright\'s Laurels', reward: 'Golden nameplate glow, crown flair, and premium chat badge' },
        25: { title: 'Royal Vanguard Pennant', reward: 'Animated gold campaign streamer on your public dossier' },
        30: { title: 'Premium Emote Pack II', reward: 'Twelve exclusive Royalty salute and victory animations' },
        35: { title: 'Crown Provision Edict', reward: '+12% resource generation while Royalty is active' },
        40: { title: 'Sovereign Portrait Frame', reward: 'Animated royal portrait frame and crown chat badge tier II' },
        45: { title: 'Imperial Command Crest', reward: 'Exclusive animated crest slot on your commander dossier' },
        50: { title: 'Royal Chronicle Apex', reward: 'Supreme crown flair, radiant nameplate, and Royalty codex portrait frame' }
    };

    const PREMIUM_MEMBER_BADGE_SRC = 'images/royaltybadge.png';

    let bound = false;

    function ensureBattlePassModalPortaled() {
        const modal = global.document.getElementById('age-chronicles-battle-pass-modal');
        if (!modal || modal.dataset.ageBpPortaled === 'true') return;
        global.document.body.appendChild(modal);
        modal.dataset.ageBpPortaled = 'true';
    }

    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function isOwnerExcluded() {
        if (typeof global.getCommanderChronicleProgressSnapshot === 'function'
            && typeof global.isCommanderExcludedFromChronicleTiers === 'function') {
            return global.isCommanderExcludedFromChronicleTiers();
        }
        return typeof global.isPortalSiteOwner === 'function' && global.isPortalSiteOwner();
    }

    function isRoyaltyMember() {
        if (typeof global.isCommanderRoyaltyMember === 'function') {
            return global.isCommanderRoyaltyMember();
        }
        if (typeof global.isPortalSiteOwner === 'function' && global.isPortalSiteOwner()) {
            return false;
        }
        const stored = String(global.localStorage.getItem(MEMBERSHIP_STORAGE_KEY) || '').trim();
        if (stored === 'Royalty' || stored === 'Royalty Member') return true;
        return global.localStorage.getItem('savedChroniclePremiumMember') === 'true';
    }

    function readXpProgressRaw() {
        try {
            const stored = global.localStorage.getItem(XP_STORAGE_KEY);
            if (!stored) return null;
            return JSON.parse(stored);
        } catch (err) {
            return null;
        }
    }

    function resolveLevelFromXp(totalXp) {
        let level = 1;
        for (let candidate = 2; candidate <= TIER_MAX_LEVEL; candidate += 1) {
            if (totalXp >= LEVEL_XP_THRESHOLDS[candidate - 1]) {
                level = candidate;
            }
        }
        return level;
    }

    function getProgressSnapshot() {
        if (typeof global.getCommanderChronicleProgressSnapshot === 'function') {
            return global.getCommanderChronicleProgressSnapshot();
        }

        const raw = readXpProgressRaw();
        const totalXp = raw && raw.version === XP_PROGRESS_VERSION
            ? Math.max(0, Math.round(Number(raw.totalXp) || 0))
            : 0;
        const currentLevel = resolveLevelFromXp(totalXp);
        const floorXp = LEVEL_XP_THRESHOLDS[currentLevel - 1] || 0;
        const ceilingXp = currentLevel >= TIER_MAX_LEVEL
            ? floorXp
            : LEVEL_XP_THRESHOLDS[currentLevel];
        const spanToNext = Math.max(1, ceilingXp - floorXp);
        const xpInLevel = Math.max(0, totalXp - floorXp);
        const progressPct = currentLevel >= TIER_MAX_LEVEL
            ? 100
            : Math.min(100, Math.round((xpInLevel / spanToNext) * 100));

        return {
            totalXp,
            currentLevel,
            levelEpithet: LEVEL_EPITHETS[Math.min(currentLevel, LEVEL_EPITHETS.length) - 1] || `Level ${currentLevel}`,
            xpInLevel,
            xpToNextLevel: currentLevel >= TIER_MAX_LEVEL ? 0 : spanToNext - xpInLevel,
            progressPct,
            isMaxLevel: currentLevel >= TIER_MAX_LEVEL
        };
    }

    function getRewardEntry(level, trackKey) {
        if (trackKey === 'basic' && level === 1) return null;
        const map = trackKey === 'premium' ? PREMIUM_REWARDS_BY_RANK : BASIC_REWARDS_BY_RANK;
        const reward = map[level];
        if (!reward) return null;
        return { rank: level, ...reward };
    }

    function isLevelReached(level, trackKey) {
        if (trackKey === 'basic' && level === 1) return false;
        return getProgressSnapshot().currentLevel >= level;
    }

    function resolveTrackProgressPct(snapshot) {
        if (snapshot.isMaxLevel) return 100;
        const span = Math.max(1, TIER_MAX_LEVEL - 1);
        const progressed = (snapshot.currentLevel - 1) + (snapshot.progressPct / 100);
        return Math.min(100, Math.max(0, (progressed / span) * 100));
    }

    function isMilestoneLevel(level) {
        return Boolean(getRewardEntry(level, 'basic') || getRewardEntry(level, 'premium'));
    }

    function buildLevelNodeMarkup(level, snapshot) {
        const reached = !isOwnerExcluded() && snapshot.currentLevel >= level;
        const isCurrent = snapshot.currentLevel === level;
        const isMilestone = isMilestoneLevel(level);

        let stateClass = 'is-locked';
        if (isOwnerExcluded()) {
            stateClass = 'is-owner-exempt';
        } else if (isCurrent) {
            stateClass = 'is-current';
        } else if (reached) {
            stateClass = 'is-completed';
        }

        return (
            `<div class="age-chronicles-bp-node ${stateClass}${isMilestone ? ' is-milestone-node' : ''}" aria-label="Level ${level}">`
            + `<span class="age-chronicles-bp-node-ring" aria-hidden="true"></span>`
            + `<span class="age-chronicles-bp-node-num">${level}</span>`
            + `</div>`
        );
    }

    function resolveRewardDetail(level, trackKey) {
        const ownerExcluded = isOwnerExcluded();
        const entry = getRewardEntry(level, trackKey);
        const reached = !ownerExcluded && isLevelReached(level, trackKey);
        const premiumLocked = !ownerExcluded && trackKey === 'premium' && !isRoyaltyMember();
        const isMilestone = Boolean(entry);
        const trackLabel = trackKey === 'premium' ? PREMIUM_PASS_LABEL : FREE_PASS_LABEL;
        const levelEpithet = LEVEL_EPITHETS[Math.min(level, LEVEL_EPITHETS.length) - 1] || `Level ${level}`;

        let stateClass = 'is-locked';
        let statusLabel = 'Locked';
        let statusHint = 'Earn Battle Pass XP in Ages to unlock this level.';

        if (ownerExcluded) {
            stateClass = 'is-owner-exempt';
            statusLabel = 'Owner account';
            statusHint = 'Battle Pass rewards do not apply to site owner accounts.';
        } else if (trackKey === 'basic' && level === 1) {
            stateClass = 'is-pass-start';
            statusLabel = 'Pass start';
            statusHint = 'Every commander begins here at 0 Battle Pass XP.';
        } else if (reached && !premiumLocked) {
            stateClass = 'is-unlocked';
            statusLabel = isMilestone ? 'Unlocked' : 'Level reached';
            statusHint = isMilestone
                ? 'You have reached this reward tier. Claim flow will arrive in a future update.'
                : 'This tier is complete. The next bonus reward unlocks at a higher level.';
        } else if (premiumLocked) {
            stateClass = 'is-premium-locked';
            statusLabel = 'Royalty required';
            statusHint = `${PREMIUM_PASS_LABEL} rewards require an active Royalty membership.`;
        }

        const title = entry?.title
            || (trackKey === 'basic' && level === 1
                ? `${FREE_PASS_LABEL} begins`
                : `Level ${level} — ${levelEpithet}`);
        const description = entry?.reward
            || (trackKey === 'basic' && level === 1
                ? 'Start earning Battle Pass XP through city battles, PvP, and map lore to advance the chart.'
                : 'No bonus reward is placed at this level. Continue earning Battle Pass XP to reach the next milestone.');

        return {
            level,
            trackKey,
            trackLabel,
            levelEpithet,
            title,
            description,
            statusLabel,
            statusHint,
            stateClass,
            isMilestone,
            imageUrl: entry?.imageUrl || ''
        };
    }

    function buildTrackSlotIconMarkup(trackKey) {
        if (trackKey === 'premium') {
            return (
                `<img class="age-chronicles-bp-cell-slot-badge" src="${PREMIUM_MEMBER_BADGE_SRC}" alt="" aria-hidden="true" loading="lazy" decoding="async">`
            );
        }
        return '<span class="age-chronicles-bp-cell-slot-icon" aria-hidden="true">✦</span>';
    }

    function buildRewardCellMarkup(level, trackKey) {
        const detail = resolveRewardDetail(level, trackKey);
        const ariaLabel = `Level ${level} ${detail.trackLabel}${detail.isMilestone ? `: ${detail.title}` : ''}`;

        return (
            `<button type="button"`
            + ` class="age-chronicles-bp-cell-slot age-chronicles-bp-cell-slot--${trackKey} ${detail.stateClass}${detail.isMilestone ? ' is-milestone' : ' is-compact'}"`
            + ` data-bp-level="${level}"`
            + ` data-bp-track="${trackKey}"`
            + ` aria-label="${escapeHtml(ariaLabel)}">`
            + buildTrackSlotIconMarkup(trackKey)
            + `<span class="age-chronicles-bp-cell-art-frame" aria-hidden="true"></span>`
            + `</button>`
        );
    }

    function buildLevelCellMarkup(level, snapshot, innerMarkup) {
        const isCurrent = snapshot.currentLevel === level;
        const isMilestone = isMilestoneLevel(level);

        return (
            `<div class="age-chronicles-bp-level-cell${isCurrent ? ' is-current' : ''}${isMilestone ? ' is-milestone' : ''}">`
            + innerMarkup
            + `</div>`
        );
    }

    function buildTrackMarkup(snapshot) {
        const levelCells = [];
        const freeCells = [];
        const premiumCells = [];

        for (let level = 1; level <= TIER_MAX_LEVEL; level += 1) {
            levelCells.push(buildLevelCellMarkup(level, snapshot, buildLevelNodeMarkup(level, snapshot)));
            freeCells.push(buildLevelCellMarkup(level, snapshot, buildRewardCellMarkup(level, 'basic')));
            premiumCells.push(buildLevelCellMarkup(level, snapshot, buildRewardCellMarkup(level, 'premium')));
        }

        const trackProgressPct = resolveTrackProgressPct(snapshot);
        const dividerMarkup = '<div class="age-chronicles-bp-track-divider" aria-hidden="true"></div>';

        return (
            `<div class="age-chronicles-bp-chart">`
            + `<aside class="age-chronicles-bp-lane-labels" aria-hidden="true">`
            + `<div class="age-chronicles-bp-lane-label age-chronicles-bp-lane-label--levels">`
            + `<span class="age-chronicles-bp-lane-label-kicker">Progress</span>`
            + `<span class="age-chronicles-bp-lane-label-title">Levels</span>`
            + `</div>`
            + `<div class="age-chronicles-bp-lane-label age-chronicles-bp-lane-label--free">`
            + `<span class="age-chronicles-bp-lane-label-kicker">Track I</span>`
            + `<span class="age-chronicles-bp-lane-label-title">${FREE_PASS_LABEL}</span>`
            + `</div>`
            + dividerMarkup
            + `<div class="age-chronicles-bp-lane-label age-chronicles-bp-lane-label--premium">`
            + `<span class="age-chronicles-bp-lane-label-kicker">Track II</span>`
            + `<span class="age-chronicles-bp-lane-label-title">${PREMIUM_PASS_LABEL}</span>`
            + `</div>`
            + `</aside>`
            + `<div class="age-chronicles-bp-chart-scroll" tabindex="0" aria-label="Battle Pass progression chart">`
            + `<div class="age-chronicles-bp-chart-canvas">`
            + `<div class="age-chronicles-bp-row age-chronicles-bp-row--levels">`
            + `<div class="age-chronicles-bp-progress-spine" aria-hidden="true">`
            + `<div class="age-chronicles-bp-progress-spine-track"></div>`
            + `<div class="age-chronicles-bp-progress-spine-fill" style="width:${trackProgressPct}%"></div>`
            + `</div>`
            + `<div class="age-chronicles-bp-row-track">${levelCells.join('')}</div>`
            + `</div>`
            + `<div class="age-chronicles-bp-row age-chronicles-bp-row--free">`
            + `<div class="age-chronicles-bp-row-track">${freeCells.join('')}</div>`
            + `</div>`
            + dividerMarkup
            + `<div class="age-chronicles-bp-row age-chronicles-bp-row--premium">`
            + `<div class="age-chronicles-bp-row-track">${premiumCells.join('')}</div>`
            + `</div>`
            + `</div>`
            + `</div>`
            + `</div>`
        );
    }

    function scrollToCurrentBattlePassLevel() {
        const scroll = global.document.querySelector('.age-chronicles-bp-chart-scroll');
        const current = global.document.querySelector('.age-chronicles-bp-row--levels .age-chronicles-bp-level-cell.is-current');
        if (!scroll || !current) return;

        const targetLeft = current.offsetLeft - ((scroll.clientWidth - current.offsetWidth) / 2);
        scroll.scrollTo({
            left: Math.max(0, targetLeft),
            behavior: 'smooth'
        });
    }

    function renderModalBody() {
        const body = global.document.getElementById('age-chronicles-battle-pass-body');
        if (!body) return;

        const ownerExcluded = isOwnerExcluded();
        const snapshot = getProgressSnapshot();
        const xpLabel = snapshot.isMaxLevel
            ? `${snapshot.totalXp} XP · max level`
            : `${snapshot.xpInLevel} / ${snapshot.xpToNextLevel + snapshot.xpInLevel} XP toward next level`;

        body.innerHTML = `
            <div class="age-chronicles-bp-hero">
                <div class="age-chronicles-bp-hero-badge" aria-hidden="true">
                    <span class="age-chronicles-bp-hero-badge-label">Level</span>
                    <span class="age-chronicles-bp-hero-badge-value">${snapshot.currentLevel}</span>
                </div>
                <div class="age-chronicles-bp-hero-copy">
                    <p class="age-chronicles-bp-level-readout">${escapeHtml(snapshot.levelEpithet)}</p>
                    <p class="age-chronicles-bp-xp-readout">${escapeHtml(xpLabel)} · ${snapshot.totalXp} total Battle Pass XP</p>
                    <div class="age-chronicles-bp-progress-track" aria-hidden="true">
                        <div class="age-chronicles-bp-progress-fill" style="width:${snapshot.progressPct}%"></div>
                    </div>
                </div>
                <div class="age-chronicles-bp-hero-tracks" aria-hidden="true">
                    <span class="age-chronicles-bp-hero-track age-chronicles-bp-hero-track--free">${FREE_PASS_LABEL}</span>
                    <span class="age-chronicles-bp-hero-track age-chronicles-bp-hero-track--premium">${PREMIUM_PASS_LABEL}</span>
                </div>
            </div>
            ${ownerExcluded ? `
                <p class="age-chronicles-bp-owner-note">
                    Owner accounts are not enrolled in ${FREE_PASS_LABEL} or ${PREMIUM_PASS_LABEL} rewards.
                </p>
            ` : ''}
            ${!ownerExcluded && !isRoyaltyMember() ? `
                <p class="age-chronicles-bp-premium-note">
                    ${PREMIUM_PASS_LABEL} rewards require Royalty membership. Scroll the chart to browse all ${TIER_MAX_LEVEL} levels.
                </p>
            ` : ''}
            ${buildTrackMarkup(snapshot)}
        `;

        bindRewardSlotHandlers();
    }

    function buildRewardDetailArtMarkup(detail) {
        if (detail.imageUrl) {
            return `<img class="age-chronicles-bp-reward-detail-image" src="${escapeHtml(detail.imageUrl)}" alt="${escapeHtml(detail.title)}" loading="lazy" decoding="async">`;
        }
        return '<span class="age-chronicles-bp-reward-detail-frame" aria-hidden="true"></span>';
    }

    function openRewardDetail(level, trackKey) {
        const overlay = global.document.getElementById('age-chronicles-bp-reward-detail');
        const dialog = global.document.querySelector('.age-chronicles-battle-pass-dialog');
        if (!overlay || !dialog) return;

        const detail = resolveRewardDetail(level, trackKey);
        const artHost = global.document.getElementById('age-chronicles-bp-reward-detail-art');
        const kicker = global.document.getElementById('age-chronicles-bp-reward-detail-kicker');
        const title = global.document.getElementById('age-chronicles-bp-reward-detail-title');
        const description = global.document.getElementById('age-chronicles-bp-reward-detail-description');
        const status = global.document.getElementById('age-chronicles-bp-reward-detail-status');
        const panel = overlay.querySelector('.age-chronicles-bp-reward-detail-panel');

        if (artHost) {
            artHost.innerHTML = buildRewardDetailArtMarkup(detail);
            artHost.className = `age-chronicles-bp-reward-detail-art age-chronicles-bp-reward-detail-art--${detail.trackKey} ${detail.stateClass}`;
        }
        if (kicker) {
            kicker.textContent = `Level ${detail.level} · ${detail.levelEpithet} · ${detail.trackLabel}`;
        }
        if (title) title.textContent = detail.title;
        if (description) description.textContent = detail.description;
        if (status) {
            status.textContent = `${detail.statusLabel} — ${detail.statusHint}`;
            status.className = `age-chronicles-bp-reward-detail-status ${detail.stateClass}`;
        }
        if (panel) {
            panel.classList.toggle('is-milestone', detail.isMilestone);
            panel.dataset.bpTrack = detail.trackKey;
        }

        overlay.hidden = false;
        overlay.setAttribute('aria-hidden', 'false');
        dialog.classList.add('is-reward-detail-open');

        if (typeof global.playSelectSFX === 'function') {
            global.playSelectSFX();
        }

        global.document.getElementById('age-chronicles-bp-reward-detail-close')?.focus();
    }

    function closeRewardDetail() {
        const overlay = global.document.getElementById('age-chronicles-bp-reward-detail');
        const dialog = global.document.querySelector('.age-chronicles-battle-pass-dialog');
        if (!overlay) return;

        overlay.hidden = true;
        overlay.setAttribute('aria-hidden', 'true');
        dialog?.classList.remove('is-reward-detail-open');
    }

    function isRewardDetailOpen() {
        const overlay = global.document.getElementById('age-chronicles-bp-reward-detail');
        return Boolean(overlay && !overlay.hidden);
    }

    function bindRewardSlotHandlers() {
        const body = global.document.getElementById('age-chronicles-battle-pass-body');
        if (!body || body.dataset.bpSlotsBound === 'true') return;
        body.dataset.bpSlotsBound = 'true';

        body.addEventListener('click', (event) => {
            const slot = event.target.closest('[data-bp-level][data-bp-track]');
            if (!slot || !body.contains(slot)) return;
            event.preventDefault();
            event.stopPropagation();

            const level = Number.parseInt(slot.getAttribute('data-bp-level'), 10);
            const trackKey = slot.getAttribute('data-bp-track');
            if (!Number.isFinite(level) || !trackKey) return;

            openRewardDetail(level, trackKey);
        });
    }

    function openAgeChroniclesBattlePassModal(event) {
        if (event) {
            event.preventDefault();
            event.stopPropagation();
        }
        global.RoyalArmiesAgeNationHub?.close?.();
        if (typeof global.closePortalCommanderIdentityMenu === 'function') {
            global.closePortalCommanderIdentityMenu();
        }
        if (typeof global.playSelectSFX === 'function') {
            global.playSelectSFX();
        }

        ensureBattlePassModalPortaled();

        const modal = global.document.getElementById('age-chronicles-battle-pass-modal');
        if (!modal) return;

        closeRewardDetail();
        modal.hidden = false;
        modal.removeAttribute('hidden');
        modal.setAttribute('aria-hidden', 'false');
        modal.classList.add('is-open');
        global.document.body.classList.add('is-age-chronicles-battle-pass-open');
        global.document.body.classList.add('age-chronicles-battle-pass-open');

        try {
            renderModalBody();
        } catch (err) {
            console.error('[RIFT] Battle Pass render failed:', err);
        }

        global.requestAnimationFrame(() => {
            scrollToCurrentBattlePassLevel();
        });

        const closeBtn = global.document.getElementById('age-chronicles-battle-pass-close');
        closeBtn?.focus();
    }

    function closeAgeChroniclesBattlePassModal() {
        const modal = global.document.getElementById('age-chronicles-battle-pass-modal');
        if (!modal) return;
        closeRewardDetail();
        modal.hidden = true;
        modal.setAttribute('aria-hidden', 'true');
        modal.classList.remove('is-open');
        global.document.body.classList.remove('is-age-chronicles-battle-pass-open');
        global.document.body.classList.remove('age-chronicles-battle-pass-open');
    }

    function bindModalHandlers() {
        if (bound) return;
        bound = true;

        global.document.getElementById('age-chronicles-battle-pass-close')
            ?.addEventListener('click', closeAgeChroniclesBattlePassModal);
        global.document.getElementById('age-chronicles-battle-pass-backdrop')
            ?.addEventListener('click', closeAgeChroniclesBattlePassModal);

        global.document.getElementById('age-chronicles-bp-reward-detail-close')
            ?.addEventListener('click', closeRewardDetail);
        global.document.getElementById('age-chronicles-bp-reward-detail-backdrop')
            ?.addEventListener('click', closeRewardDetail);

        global.document.addEventListener('keydown', (event) => {
            if (event.key !== 'Escape') return;

            if (isRewardDetailOpen()) {
                closeRewardDetail();
                return;
            }

            const modal = global.document.getElementById('age-chronicles-battle-pass-modal');
            if (modal && !modal.hidden) {
                closeAgeChroniclesBattlePassModal();
            }
        });
    }

    function initAgeChroniclesBattlePass() {
        bindModalHandlers();
    }

    global.openAgeChroniclesBattlePassModal = openAgeChroniclesBattlePassModal;
    global.closeAgeChroniclesBattlePassModal = closeAgeChroniclesBattlePassModal;
    global.refreshAgeChroniclesBattlePassModal = renderModalBody;

    if (global.document.readyState === 'loading') {
        global.document.addEventListener('DOMContentLoaded', initAgeChroniclesBattlePass, { once: true });
    } else {
        initAgeChroniclesBattlePass();
    }
})(window);
