/**
 * Commander achievements — local profile storage + fixed lower-right unlock toasts.
 */
(function initRoyalArmiesAchievementSystem(global) {
    'use strict';

    const WHO_SLOW_DOWN_ID = 'whoa_slow_down';
    const COMMANDER_AWARDS_STORAGE_KEY = 'savedCommanderAwards';
    const JOIN_AGE_ATTEMPT_FLAG = 'royalArmiesJoinAgeAttempt';
    const JOIN_AGE_ATTEMPT_LOCAL_KEY = 'royalArmiesJoinAgeAttemptLocal';
    const JOIN_AGE_ATTEMPT_LOCAL_TTL_MS = 5 * 60 * 1000;
    const JOIN_AGE_QUERY_PARAM = 'joinAge';
    const ACHIEVEMENT_TOAST_GROW_MS = 450;
    const ACHIEVEMENT_TOAST_HOLD_MS = 7000;
    const ACHIEVEMENT_TOAST_SHRINK_MS = 220;

    const WHO_SLOW_DOWN_DEFINITION = Object.freeze({
        id: WHO_SLOW_DOWN_ID,
        label: "Whoa, slow down! We're not finished yet.",
        achievement: 'Attempt to JOIN AGE before the game engine has been developed.',
        iconUrl: 'images/whoa_slow_down_icon.png'
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

    function loadCommanderAwardsList() {
        if (typeof global.player !== 'undefined' && Array.isArray(global.player.awards)) {
            return global.player.awards.slice();
        }

        try {
            const cached = global.localStorage.getItem(COMMANDER_AWARDS_STORAGE_KEY);
            if (cached) {
                const parsed = JSON.parse(cached);
                return Array.isArray(parsed) ? parsed : [];
            }
        } catch (_err) {
            /* ignore */
        }
        return [];
    }

    async function syncCommanderAwardsFromServer() {
        if (typeof global.fetchCommanderDossierFromServer === 'function') {
            await global.fetchCommanderDossierFromServer();
            return true;
        }
        return false;
    }

    function persistCommanderAwardsList(awards) {
        const list = Array.isArray(awards) ? awards : [];
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
        return {
            id: definition.id,
            label: definition.label,
            achievement: definition.achievement,
            description: definition.achievement,
            iconUrl: definition.iconUrl,
            username: subject,
            earnedAt: new Date().toISOString()
        };
    }

    function grantWhoaSlowDownAchievement(username) {
        const subject = String(username || resolveCommanderUsername() || '').trim();
        if (!subject) {
            return { granted: false, award: null, reason: 'no_username' };
        }
        if (hasCommanderAchievement(WHO_SLOW_DOWN_ID, subject)) {
            return { granted: false, award: null, reason: 'already_owned' };
        }

        const award = buildAwardRecord(WHO_SLOW_DOWN_DEFINITION, subject);
        const nextAwards = loadCommanderAwardsList().concat([award]);
        persistCommanderAwardsList(nextAwards);
        return { granted: true, award, reason: 'granted' };
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
        const record = award || WHO_SLOW_DOWN_DEFINITION;
        const label = record.label || WHO_SLOW_DOWN_DEFINITION.label;
        const iconUrl = record.iconUrl || WHO_SLOW_DOWN_DEFINITION.iconUrl;

        const toast = global.document.createElement('div');
        toast.className = 'achievement-unlock-toast';
        toast.setAttribute('role', 'status');
        toast.setAttribute('aria-live', 'polite');
        toast.innerHTML = `
            <div class="achievement-unlock-banner-panel">
                <div class="achievement-unlock-sparkles" aria-hidden="true">
                    <span class="achievement-sparkle achievement-sparkle--1"></span>
                    <span class="achievement-sparkle achievement-sparkle--2"></span>
                    <span class="achievement-sparkle achievement-sparkle--3"></span>
                    <span class="achievement-sparkle achievement-sparkle--4"></span>
                    <span class="achievement-sparkle achievement-sparkle--5"></span>
                    <span class="achievement-sparkle achievement-sparkle--6"></span>
                </div>
                <img class="achievement-unlock-banner-art" src="images/achievementsbanner.png" alt="" aria-hidden="true">
                <div class="achievement-unlock-banner-content">
                    <div class="achievement-unlock-left-rail">
                        <p class="achievement-unlock-eyebrow">Achievement Unlocked</p>
                        <div class="achievement-unlock-icon-ring">
                            <img class="achievement-unlock-icon" src="${iconUrl}" alt="">
                        </div>
                    </div>
                    <div class="achievement-unlock-copy-rail">
                        <h2 class="achievement-unlock-title"></h2>
                    </div>
                </div>
            </div>
        `;

        const iconEl = toast.querySelector('.achievement-unlock-icon');
        const titleEl = toast.querySelector('.achievement-unlock-title');
        if (iconEl) {
            iconEl.src = iconUrl;
            iconEl.alt = label;
        }
        if (titleEl) titleEl.textContent = label;

        return toast;
    }

    function runAchievementToastLifecycle(toast) {
        const panel = toast.querySelector('.achievement-unlock-banner-panel');
        clearAchievementToastTimers(toast);

        toast.classList.remove('is-held', 'is-exiting');
        toast.classList.add('is-growing');
        if (panel) panel.classList.remove('is-sparkle-active');

        void toast.offsetWidth;

        global.requestAnimationFrame(() => {
            if (panel) panel.classList.add('is-sparkle-active');
        });

        const timers = [];

        const growDoneTimer = global.setTimeout(() => {
            toast.classList.remove('is-growing');
            toast.classList.add('is-held');

            const holdDoneTimer = global.setTimeout(() => {
                toast.classList.remove('is-held');
                toast.classList.add('is-exiting');
                if (panel) panel.classList.remove('is-sparkle-active');

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

    function previewWhoaSlowDownPopup(options) {
        const opts = options && typeof options === 'object' ? options : {};
        if (opts.grantIfMissing) {
            const result = grantWhoaSlowDownAchievement(opts.username);
            if (result.granted && result.award) {
                showAchievementUnlockPopup(result.award);
                return result;
            }
        }

        const existing = loadCommanderAwardsList().find((entry) => String(entry?.id || '') === WHO_SLOW_DOWN_ID);
        showAchievementUnlockPopup(existing || buildAwardRecord(WHO_SLOW_DOWN_DEFINITION, opts.username));
        return { granted: false, award: existing || WHO_SLOW_DOWN_DEFINITION, reason: 'preview' };
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
        } catch (_err) {
            /* ignore */
        }
    }

    global.RoyalArmiesAchievements = {
        WHO_SLOW_DOWN_ID,
        WHO_SLOW_DOWN_DEFINITION,
        JOIN_AGE_ATTEMPT_FLAG,
        JOIN_AGE_ATTEMPT_LOCAL_KEY,
        JOIN_AGE_QUERY_PARAM,
        markJoinAgeAttemptForAchievement,
        consumeJoinAgeAttemptFlag,
        hasCommanderAchievement,
        grantWhoaSlowDownAchievement,
        tryGrantWhoaSlowDownFromJoinAttempt,
        showAchievementUnlockPopup,
        closeAchievementUnlockPopup,
        previewWhoaSlowDownPopup,
        syncAchievementToastStackPosition,
        isLocalAchievementDevToolsEnabled,
        maybeRunDevAchievementPopupFromQuery
    };

    global.markJoinAgeAttemptForAchievement = markJoinAgeAttemptForAchievement;
    global.grantWhoaSlowDownAchievement = grantWhoaSlowDownAchievement;
    global.tryGrantWhoaSlowDownFromJoinAttempt = tryGrantWhoaSlowDownFromJoinAttempt;
    global.showAchievementUnlockPopup = showAchievementUnlockPopup;
    global.previewWhoaSlowDownAchievementPopup = previewWhoaSlowDownPopup;
    global.maybeRunDevAchievementPopupFromQuery = maybeRunDevAchievementPopupFromQuery;
    global.syncAchievementToastStackPosition = syncAchievementToastStackPosition;

    global.addEventListener('resize', syncAchievementToastStackPosition, { passive: true });
})(window);
