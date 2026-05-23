/**
 * Commander achievements — local profile storage + fixed lower-right unlock toasts.
 */
(function initRoyalArmiesAchievementSystem(global) {
    'use strict';

    const FIRST_TIMER_ID = 'first_timer';
    const WHO_SLOW_DOWN_ID = 'whoa_slow_down';
    const COMMANDER_AWARDS_STORAGE_KEY = 'savedCommanderAwards';
    const PENDING_UNLOCKS_SESSION_KEY = 'royalArmiesPendingAchievementUnlocks';
    const JOIN_AGE_ATTEMPT_FLAG = 'royalArmiesJoinAgeAttempt';
    const JOIN_AGE_ATTEMPT_LOCAL_KEY = 'royalArmiesJoinAgeAttemptLocal';
    const JOIN_AGE_ATTEMPT_LOCAL_TTL_MS = 5 * 60 * 1000;
    const JOIN_AGE_QUERY_PARAM = 'joinAge';
    const ACHIEVEMENT_TOAST_GROW_MS = 450;
    const ACHIEVEMENT_TOAST_HOLD_MS = 7000;
    const ACHIEVEMENT_TOAST_SHRINK_MS = 220;
    const ACHIEVEMENT_DISPLAY_ORDER = [FIRST_TIMER_ID, WHO_SLOW_DOWN_ID];

    const FIRST_TIMER_DEFINITION = Object.freeze({
        id: FIRST_TIMER_ID,
        label: 'First Timer',
        achievement: 'Logging in for the first time',
        iconUrl: 'images/first_timer.png',
        xpReward: 15
    });

    const WHO_SLOW_DOWN_DEFINITION = Object.freeze({
        id: WHO_SLOW_DOWN_ID,
        label: "Whoa, slow down! We're not finished yet.",
        achievement: 'Attempt to JOIN AGE before the game engine has been developed.',
        iconUrl: 'images/whoa_slow_down_icon.png',
        xpReward: 30
    });

    const ACHIEVEMENT_DEFINITIONS = Object.freeze({
        [FIRST_TIMER_ID]: FIRST_TIMER_DEFINITION,
        [WHO_SLOW_DOWN_ID]: WHO_SLOW_DOWN_DEFINITION
    });

    let activeToastTimers = new WeakMap();

    function clearAchievementToastTimers(toast) {
        const timers = activeToastTimers.get(toast);
        if (!timers) return;
        timers.forEach((timerId) => global.clearTimeout(timerId));
        activeToastTimers.delete(toast);
    }

    function resolveCommanderUsername() {
        if (typeof global.getActiveCommanderUsername === 'function') {
            const name = global.getActiveCommanderUsername();
            if (name && String(name).trim() && String(name).trim().toLowerCase() !== 'testaccount') {
                return String(name).trim();
            }
        }
        const saved = global.localStorage.getItem('activeCommanderUser');
        return saved && saved.trim() ? saved.trim() : '';
    }

    function sortAwardsByDisplayOrder(awards) {
        const orderIndex = (entry) => {
            const id = String(entry?.id || entry?.achievementId || '').trim();
            const idx = ACHIEVEMENT_DISPLAY_ORDER.indexOf(id);
            return idx === -1 ? ACHIEVEMENT_DISPLAY_ORDER.length + 1 : idx;
        };

        return (Array.isArray(awards) ? awards : []).slice().sort((a, b) => {
            const orderDiff = orderIndex(a) - orderIndex(b);
            if (orderDiff !== 0) return orderDiff;
            const aTime = Date.parse(a?.earnedAt || '') || 0;
            const bTime = Date.parse(b?.earnedAt || '') || 0;
            return aTime - bTime;
        });
    }

    function resolvePortalPublicAssetUrl(relativePath) {
        const raw = String(relativePath || '').trim();
        if (!raw) return '';
        if (/^https?:\/\//i.test(raw) || raw.startsWith('data:')) return raw;

        try {
            if (raw.startsWith('/')) {
                return new URL(raw, global.location.origin).href;
            }
            return new URL(raw, global.location.href).href;
        } catch (_err) {
            const normalized = raw.replace(/^\.\//, '');
            return normalized.startsWith('/') ? normalized : `/${normalized}`;
        }
    }

    function enrichAchievementRecord(record) {
        if (!record || typeof record !== 'object') return record;

        const id = String(record.id || record.achievementId || '').trim();
        const definition = ACHIEVEMENT_DEFINITIONS[id];
        const copy = record.achievement || record.description || definition?.achievement || '';
        const catalogIcon = definition?.iconUrl || '';
        const rawIcon = definition ? catalogIcon : (record.iconUrl || record.icon || catalogIcon);
        const iconUrl = resolvePortalPublicAssetUrl(rawIcon);

        if (!definition) {
            return iconUrl ? { ...record, iconUrl } : record;
        }

        return {
            ...record,
            id: definition.id,
            label: record.label || definition.label,
            achievement: copy,
            description: copy,
            iconUrl,
            xpReward: Number(record.xpReward ?? record.xp ?? definition.xpReward) || 0
        };
    }

    function enrichAchievementRecords(awards) {
        return sortAwardsByDisplayOrder(
            (Array.isArray(awards) ? awards : []).map((entry) => enrichAchievementRecord(entry))
        );
    }

    function resolveAchievementIconUrl(record) {
        const enriched = enrichAchievementRecord(record || {});
        return enriched.iconUrl || resolvePortalPublicAssetUrl(FIRST_TIMER_DEFINITION.iconUrl);
    }

    function loadCommanderAwardsList() {
        let list = [];
        if (typeof global.player !== 'undefined' && Array.isArray(global.player.awards)) {
            list = global.player.awards.slice();
        } else {
            try {
                const cached = global.localStorage.getItem(COMMANDER_AWARDS_STORAGE_KEY);
                if (cached) {
                    const parsed = JSON.parse(cached);
                    list = Array.isArray(parsed) ? parsed : [];
                }
            } catch (_err) {
                /* ignore */
            }
        }
        return enrichAchievementRecords(list);
    }

    async function syncCommanderAwardsFromServer() {
        if (typeof global.fetchCommanderDossierFromServer === 'function') {
            await global.fetchCommanderDossierFromServer();
            return true;
        }
        return false;
    }

    function persistCommanderAwardsList(awards) {
        const list = enrichAchievementRecords(Array.isArray(awards) ? awards : []);
        try {
            global.localStorage.setItem(COMMANDER_AWARDS_STORAGE_KEY, JSON.stringify(list));
        } catch (_err) {
            /* ignore */
        }
        if (typeof global.player !== 'undefined') {
            global.player.awards = list;
        }
        if (typeof global.scheduleCommanderDossierSave === 'function') {
            global.scheduleCommanderDossierSave({ awards: list }, { immediate: true });
        }
        return list;
    }

    function hasCommanderAchievement(achievementId, username) {
        const id = String(achievementId || '').trim();
        if (!id) return false;
        const subject = String(username || resolveCommanderUsername() || '').trim();
        if (!subject) return false;

        return loadCommanderAwardsList().some((entry) => {
            const entryId = String(entry?.id || entry?.achievementId || '').trim();
            const entryUser = String(entry?.username || entry?.commander || '').trim();
            if (entryId !== id) return false;
            if (!entryUser) return true;
            return entryUser.toLowerCase() === subject.toLowerCase();
        });
    }

    function buildAwardRecord(definition, username) {
        const subject = String(username || resolveCommanderUsername() || '').trim();
        const copy = definition.achievement || definition.description || '';
        return {
            id: definition.id,
            label: definition.label,
            achievement: copy,
            description: copy,
            iconUrl: definition.iconUrl,
            xpReward: Number(definition.xpReward ?? definition.xp ?? definition.chronicleXp ?? 0) || 0,
            username: subject,
            earnedAt: new Date().toISOString()
        };
    }

    function insertAwardInDisplayOrder(awards, record) {
        const next = awards.slice();
        const recordId = String(record?.id || '').trim();
        const recordOrder = ACHIEVEMENT_DISPLAY_ORDER.indexOf(recordId);
        let insertAt = next.length;

        for (let i = 0; i < next.length; i += 1) {
            const existingId = String(next[i]?.id || next[i]?.achievementId || '').trim();
            const existingOrder = ACHIEVEMENT_DISPLAY_ORDER.indexOf(existingId);
            if (existingOrder !== -1 && recordOrder !== -1 && existingOrder > recordOrder) {
                insertAt = i;
                break;
            }
        }

        next.splice(insertAt, 0, record);
        return sortAwardsByDisplayOrder(next);
    }

    function grantAchievementById(achievementId, username) {
        const id = String(achievementId || '').trim();
        const definition = ACHIEVEMENT_DEFINITIONS[id];
        if (!definition) {
            return { granted: false, award: null, reason: 'unknown_achievement' };
        }

        const subject = String(username || resolveCommanderUsername() || '').trim();
        if (!subject) {
            return { granted: false, award: null, reason: 'no_username' };
        }
        if (hasCommanderAchievement(id, subject)) {
            return { granted: false, award: null, reason: 'already_owned' };
        }

        const award = buildAwardRecord(definition, subject);
        const nextAwards = insertAwardInDisplayOrder(loadCommanderAwardsList(), award);
        persistCommanderAwardsList(nextAwards);
        return { granted: true, award, reason: 'granted' };
    }

    function grantFirstTimerAchievement(username) {
        return grantAchievementById(FIRST_TIMER_ID, username);
    }

    function grantWhoaSlowDownAchievement(username) {
        return grantAchievementById(WHO_SLOW_DOWN_ID, username);
    }

    function resolveAchievementToastDisplay(record) {
        const source = enrichAchievementRecord(record || FIRST_TIMER_DEFINITION);
        const title = String(source.label || FIRST_TIMER_DEFINITION.label).trim();
        const iconUrl = resolveAchievementIconUrl(source);
        const xpValue = Number(source.xpReward ?? source.xp ?? source.chronicleXp ?? 0);
        const xpLabel = Number.isFinite(xpValue) && xpValue > 0 ? `${xpValue} XP` : '';
        return { title, iconUrl, xpLabel };
    }

    function syncAchievementToastStackPosition() {
        const anchor = global.document.getElementById('royal-armies-achievement-toast-anchor');
        if (!anchor) return;

        const gapPx = 14;
        const deck = global.document.getElementById('portal-floating-media-player-deck');
        let bottomPx = 16 + gapPx;

        if (deck) {
            const style = global.getComputedStyle(deck);
            const visible = style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
            if (visible) {
                const rect = deck.getBoundingClientRect();
                if (rect.height > 0 && rect.top < global.innerHeight) {
                    bottomPx = Math.max(bottomPx, global.innerHeight - rect.top + gapPx);
                }
            }
        }

        anchor.style.setProperty('--achievement-toast-stack-bottom', `${Math.round(bottomPx)}px`);
    }

    function ensureAchievementToastAnchor() {
        let anchor = global.document.getElementById('royal-armies-achievement-toast-anchor');
        if (anchor) {
            syncAchievementToastStackPosition();
            return anchor;
        }

        anchor = global.document.createElement('div');
        anchor.id = 'royal-armies-achievement-toast-anchor';
        anchor.className = 'achievement-toast-anchor';
        anchor.setAttribute('role', 'presentation');
        anchor.setAttribute('aria-live', 'polite');
        anchor.setAttribute('aria-relevant', 'additions');
        global.document.body.appendChild(anchor);
        syncAchievementToastStackPosition();
        return anchor;
    }

    function buildAchievementToastElement(award) {
        const display = resolveAchievementToastDisplay(award);

        const toast = global.document.createElement('div');
        toast.className = 'achievement-unlock-toast';
        toast.setAttribute('role', 'status');
        toast.setAttribute('aria-live', 'polite');
        toast.innerHTML = `
            <div class="achievement-unlock-card">
                <div class="achievement-unlock-card-glow" aria-hidden="true"></div>
                <div class="achievement-unlock-card-body">
                    <div class="achievement-unlock-icon-slot">
                        <img class="achievement-unlock-icon" src="${display.iconUrl}" alt="">
                    </div>
                    <div class="achievement-unlock-copy">
                        <p class="achievement-unlock-headline">Achievement Unlocked!</p>
                        <p class="achievement-unlock-detail">
                            <span class="achievement-unlock-xp"></span>
                            <span class="achievement-unlock-title"></span>
                        </p>
                    </div>
                </div>
            </div>
        `;

        const iconEl = toast.querySelector('.achievement-unlock-icon');
        const titleEl = toast.querySelector('.achievement-unlock-title');
        const xpEl = toast.querySelector('.achievement-unlock-xp');
        if (iconEl) {
            const fallbackIcon = resolveAchievementIconUrl(award);
            iconEl.src = display.iconUrl || fallbackIcon;
            iconEl.alt = display.title;
            iconEl.onerror = () => {
                if (fallbackIcon && iconEl.src !== fallbackIcon) {
                    iconEl.onerror = null;
                    iconEl.src = fallbackIcon;
                }
            };
        }
        if (titleEl) titleEl.textContent = display.title;
        if (xpEl) {
            xpEl.textContent = display.xpLabel;
            xpEl.hidden = !display.xpLabel;
        }

        return toast;
    }

    function runAchievementToastLifecycle(toast) {
        const card = toast.querySelector('.achievement-unlock-card');
        clearAchievementToastTimers(toast);

        toast.classList.remove('is-held', 'is-exiting');
        toast.classList.add('is-growing');
        if (card) card.classList.remove('is-reveal-active');

        void toast.offsetWidth;

        global.requestAnimationFrame(() => {
            if (card) card.classList.add('is-reveal-active');
        });

        const timers = [];

        const growDoneTimer = global.setTimeout(() => {
            toast.classList.remove('is-growing');
            toast.classList.add('is-held');

            const holdDoneTimer = global.setTimeout(() => {
                toast.classList.remove('is-held');
                toast.classList.add('is-exiting');
                if (card) card.classList.remove('is-reveal-active');

                const removeTimer = global.setTimeout(() => {
                    toast.remove();
                    activeToastTimers.delete(toast);
                }, ACHIEVEMENT_TOAST_SHRINK_MS);

                timers.push(removeTimer);
            }, ACHIEVEMENT_TOAST_HOLD_MS);

            timers.push(holdDoneTimer);
        }, ACHIEVEMENT_TOAST_GROW_MS);

        timers.push(growDoneTimer);
        activeToastTimers.set(toast, timers);
    }

    function showAchievementUnlockPopup(award) {
        const anchor = ensureAchievementToastAnchor();
        syncAchievementToastStackPosition();
        const toast = buildAchievementToastElement(award);
        anchor.appendChild(toast);
        runAchievementToastLifecycle(toast);
        return toast;
    }

    function waitMs(ms) {
        return new Promise((resolve) => global.setTimeout(resolve, ms));
    }

    async function showAchievementUnlockQueue(awards) {
        const queue = sortAwardsByDisplayOrder(Array.isArray(awards) ? awards : []);
        if (!queue.length) return;

        await syncCommanderAwardsFromServer();

        for (let i = 0; i < queue.length; i += 1) {
            if (i > 0) {
                await waitMs(ACHIEVEMENT_TOAST_GROW_MS + ACHIEVEMENT_TOAST_HOLD_MS + ACHIEVEMENT_TOAST_SHRINK_MS + 120);
            }
            showAchievementUnlockPopup(queue[i]);
        }
    }

    function stashPendingAchievementUnlocks(unlocks) {
        const list = Array.isArray(unlocks) ? unlocks.filter((entry) => entry && typeof entry === 'object') : [];
        if (!list.length) return;
        try {
            global.sessionStorage.setItem(PENDING_UNLOCKS_SESSION_KEY, JSON.stringify(list));
        } catch (_err) {
            /* ignore */
        }
    }

    function consumePendingAchievementUnlocks() {
        try {
            const raw = global.sessionStorage.getItem(PENDING_UNLOCKS_SESSION_KEY);
            global.sessionStorage.removeItem(PENDING_UNLOCKS_SESSION_KEY);
            if (!raw) return [];
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed : [];
        } catch (_err) {
            return [];
        }
    }

    async function processLoginAchievementUnlocks(loginPayload) {
        const fromPayload = Array.isArray(loginPayload?.achievementUnlocks)
            ? loginPayload.achievementUnlocks
            : [];
        const pending = consumePendingAchievementUnlocks();
        const combined = sortAwardsByDisplayOrder(fromPayload.concat(pending));
        if (!combined.length) return;
        await showAchievementUnlockQueue(combined);
    }

    function closeAchievementUnlockPopup() {
        const anchor = global.document.getElementById('royal-armies-achievement-toast-anchor');
        if (!anchor) return;
        anchor.querySelectorAll('.achievement-unlock-toast').forEach((toast) => {
            clearAchievementToastTimers(toast);
            toast.remove();
        });
    }

    function markJoinAgeAttemptForAchievement() {
        try {
            global.sessionStorage.setItem(JOIN_AGE_ATTEMPT_FLAG, '1');
            global.localStorage.setItem(JOIN_AGE_ATTEMPT_LOCAL_KEY, String(Date.now()));
        } catch (_err) {
            /* ignore */
        }
    }

    function consumeJoinAgeAttemptFlag() {
        let consumed = false;

        try {
            if (global.sessionStorage.getItem(JOIN_AGE_ATTEMPT_FLAG) === '1') {
                consumed = true;
            }
            global.sessionStorage.removeItem(JOIN_AGE_ATTEMPT_FLAG);

            const localStamp = parseInt(global.localStorage.getItem(JOIN_AGE_ATTEMPT_LOCAL_KEY) || '', 10);
            if (Number.isFinite(localStamp) && (Date.now() - localStamp) <= JOIN_AGE_ATTEMPT_LOCAL_TTL_MS) {
                consumed = true;
            }
            global.localStorage.removeItem(JOIN_AGE_ATTEMPT_LOCAL_KEY);
        } catch (_err) {
            /* ignore */
        }

        try {
            const params = new URLSearchParams(global.location.search || '');
            if (params.get(JOIN_AGE_QUERY_PARAM) === '1') {
                consumed = true;
                params.delete(JOIN_AGE_QUERY_PARAM);
                const query = params.toString();
                const nextUrl = `${global.location.pathname}${query ? `?${query}` : ''}${global.location.hash || ''}`;
                global.history.replaceState({}, '', nextUrl);
            }
        } catch (_err) {
            /* ignore */
        }

        return consumed;
    }

    async function tryGrantWhoaSlowDownFromJoinAttempt(username) {
        if (!consumeJoinAgeAttemptFlag()) {
            return { granted: false, award: null, reason: 'no_join_attempt' };
        }

        await syncCommanderAwardsFromServer();
        return grantWhoaSlowDownAchievement(username);
    }

    function previewAchievementPopup(achievementId, options) {
        const opts = options && typeof options === 'object' ? options : {};
        const id = String(achievementId || WHO_SLOW_DOWN_ID).trim();
        const definition = ACHIEVEMENT_DEFINITIONS[id] || WHO_SLOW_DOWN_DEFINITION;

        if (opts.grantIfMissing) {
            const result = grantAchievementById(id, opts.username);
            if (result.granted && result.award) {
                showAchievementUnlockPopup(result.award);
                return result;
            }
        }

        const existing = loadCommanderAwardsList().find((entry) => String(entry?.id || '') === id);
        showAchievementUnlockPopup(existing || buildAwardRecord(definition, opts.username));
        return { granted: false, award: existing || definition, reason: 'preview' };
    }

    function previewWhoaSlowDownPopup(options) {
        return previewAchievementPopup(WHO_SLOW_DOWN_ID, options);
    }

    function isLocalAchievementDevToolsEnabled() {
        return typeof global.isLocalDevelopmentHost === 'function' && global.isLocalDevelopmentHost();
    }

    function maybeRunDevAchievementPopupFromQuery() {
        if (!isLocalAchievementDevToolsEnabled()) return;
        try {
            const params = new URLSearchParams(global.location.search || '');
            if (params.get('devAchievement') === '1' || params.get('devTestAchievement') === '1') {
                global.setTimeout(() => previewWhoaSlowDownPopup({ grantIfMissing: false }), 400);
            }
            if (params.get('devFirstTimerAchievement') === '1') {
                global.setTimeout(() => previewAchievementPopup(FIRST_TIMER_ID, { grantIfMissing: false }), 400);
            }
        } catch (_err) {
            /* ignore */
        }
    }

    async function maybeShowPendingLoginAchievementUnlocks() {
        const pending = consumePendingAchievementUnlocks();
        if (!pending.length) return;
        await showAchievementUnlockQueue(pending);
    }

    global.RoyalArmiesAchievements = {
        FIRST_TIMER_ID,
        FIRST_TIMER_DEFINITION,
        WHO_SLOW_DOWN_ID,
        WHO_SLOW_DOWN_DEFINITION,
        ACHIEVEMENT_DEFINITIONS,
        ACHIEVEMENT_DISPLAY_ORDER,
        JOIN_AGE_ATTEMPT_FLAG,
        JOIN_AGE_ATTEMPT_LOCAL_KEY,
        JOIN_AGE_QUERY_PARAM,
        PENDING_UNLOCKS_SESSION_KEY,
        sortAwardsByDisplayOrder,
        enrichAchievementRecords,
        resolveAchievementIconUrl,
        resolvePortalPublicAssetUrl,
        markJoinAgeAttemptForAchievement,
        consumeJoinAgeAttemptFlag,
        hasCommanderAchievement,
        grantAchievementById,
        grantFirstTimerAchievement,
        grantWhoaSlowDownAchievement,
        tryGrantWhoaSlowDownFromJoinAttempt,
        showAchievementUnlockPopup,
        showAchievementUnlockQueue,
        stashPendingAchievementUnlocks,
        consumePendingAchievementUnlocks,
        processLoginAchievementUnlocks,
        closeAchievementUnlockPopup,
        previewAchievementPopup,
        previewWhoaSlowDownPopup,
        syncAchievementToastStackPosition,
        isLocalAchievementDevToolsEnabled,
        maybeRunDevAchievementPopupFromQuery,
        maybeShowPendingLoginAchievementUnlocks
    };

    global.markJoinAgeAttemptForAchievement = markJoinAgeAttemptForAchievement;
    global.grantWhoaSlowDownAchievement = grantWhoaSlowDownAchievement;
    global.grantFirstTimerAchievement = grantFirstTimerAchievement;
    global.tryGrantWhoaSlowDownFromJoinAttempt = tryGrantWhoaSlowDownFromJoinAttempt;
    global.showAchievementUnlockPopup = showAchievementUnlockPopup;
    global.showAchievementUnlockQueue = showAchievementUnlockQueue;
    global.stashPendingAchievementUnlocks = stashPendingAchievementUnlocks;
    global.processLoginAchievementUnlocks = processLoginAchievementUnlocks;
    global.previewWhoaSlowDownAchievementPopup = previewWhoaSlowDownPopup;
    global.maybeRunDevAchievementPopupFromQuery = maybeRunDevAchievementPopupFromQuery;
    global.maybeShowPendingLoginAchievementUnlocks = maybeShowPendingLoginAchievementUnlocks;
    global.syncAchievementToastStackPosition = syncAchievementToastStackPosition;
    global.sortCommanderAwardsByDisplayOrder = sortAwardsByDisplayOrder;
    global.enrichAchievementRecords = enrichAchievementRecords;
    global.resolveAchievementIconUrl = resolveAchievementIconUrl;

    global.addEventListener('resize', syncAchievementToastStackPosition, { passive: true });
})(window);
