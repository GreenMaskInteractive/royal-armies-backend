/**
 * Commander achievements — local profile storage + unlock popup UI.
 */
(function initRoyalArmiesAchievementSystem(global) {
    'use strict';

    const WHO_SLOW_DOWN_ID = 'whoa_slow_down';
    const COMMANDER_AWARDS_STORAGE_KEY = 'savedCommanderAwards';
    const JOIN_AGE_ATTEMPT_FLAG = 'royalArmiesJoinAgeAttempt';

    const WHO_SLOW_DOWN_DEFINITION = Object.freeze({
        id: WHO_SLOW_DOWN_ID,
        label: "Whoa, slow down! We're not finished yet.",
        achievement: 'Attempt to JOIN AGE before the game engine has been developed.',
        iconUrl: 'images/whoa_slow_down_icon.png'
    });

    function escapeAchievementHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function resolveCommanderUsername() {
        if (typeof global.getActiveCommanderUsername === 'function') {
            const name = global.getActiveCommanderUsername();
            if (name && String(name).trim()) return String(name).trim();
        }
        const saved = global.localStorage.getItem('activeCommanderUser');
        return saved && saved.trim() ? saved.trim() : '';
    }

    function loadCommanderAwardsList() {
        let awards = [];
        if (typeof global.player !== 'undefined' && Array.isArray(global.player.awards)) {
            awards = global.player.awards.slice();
        }
        if (!awards.length) {
            try {
                const cached = global.localStorage.getItem(COMMANDER_AWARDS_STORAGE_KEY);
                if (cached) awards = JSON.parse(cached);
            } catch (_err) {
                awards = [];
            }
        }
        return Array.isArray(awards) ? awards : [];
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

    function ensureAchievementUnlockOverlay() {
        let overlay = global.document.getElementById('royal-armies-achievement-unlock-overlay');
        if (overlay) return overlay;

        overlay = global.document.createElement('div');
        overlay.id = 'royal-armies-achievement-unlock-overlay';
        overlay.className = 'achievement-unlock-overlay main-portal-modal-hidden';
        overlay.setAttribute('role', 'presentation');
        overlay.setAttribute('aria-hidden', 'true');
        overlay.style.setProperty('display', 'none', 'important');
        overlay.innerHTML = `
            <div class="achievement-unlock-dialog" role="dialog" aria-modal="true" aria-labelledby="achievement-unlock-eyebrow">
                <div class="achievement-unlock-banner-panel">
                    <img class="achievement-unlock-banner-art" src="images/achievementsbanner.png" alt="" aria-hidden="true">
                    <div class="achievement-unlock-banner-content">
                        <p id="achievement-unlock-eyebrow" class="achievement-unlock-eyebrow">Achievement Unlocked</p>
                        <div class="achievement-unlock-icon-ring">
                            <img id="achievement-unlock-icon" class="achievement-unlock-icon" src="" alt="">
                        </div>
                        <h2 id="achievement-unlock-title" class="achievement-unlock-title"></h2>
                        <p id="achievement-unlock-body" class="achievement-unlock-body"></p>
                        <button type="button" id="achievement-unlock-dismiss" class="achievement-unlock-dismiss-btn">Continue</button>
                    </div>
                </div>
            </div>
        `;

        global.document.body.appendChild(overlay);

        overlay.addEventListener('click', (event) => {
            if (event.target === overlay) closeAchievementUnlockPopup();
        });

        const dismissBtn = overlay.querySelector('#achievement-unlock-dismiss');
        if (dismissBtn) {
            dismissBtn.addEventListener('click', () => closeAchievementUnlockPopup());
        }

        global.document.addEventListener('keydown', (event) => {
            if (event.key !== 'Escape') return;
            if (!overlay.classList.contains('is-visible')) return;
            closeAchievementUnlockPopup();
        });

        return overlay;
    }

    function showAchievementUnlockPopup(award) {
        const record = award || WHO_SLOW_DOWN_DEFINITION;
        const overlay = ensureAchievementUnlockOverlay();
        const iconEl = overlay.querySelector('#achievement-unlock-icon');
        const titleEl = overlay.querySelector('#achievement-unlock-title');
        const bodyEl = overlay.querySelector('#achievement-unlock-body');

        if (iconEl) {
            iconEl.src = record.iconUrl || WHO_SLOW_DOWN_DEFINITION.iconUrl;
            iconEl.alt = record.label || WHO_SLOW_DOWN_DEFINITION.label;
        }
        if (titleEl) {
            titleEl.textContent = record.label || WHO_SLOW_DOWN_DEFINITION.label;
        }
        if (bodyEl) {
            bodyEl.textContent = record.achievement || record.description || WHO_SLOW_DOWN_DEFINITION.achievement;
        }

        overlay.classList.remove('main-portal-modal-hidden');
        overlay.classList.add('is-visible');
        overlay.style.setProperty('display', 'flex', 'important');
        overlay.setAttribute('aria-hidden', 'false');

        const dismissBtn = overlay.querySelector('#achievement-unlock-dismiss');
        if (dismissBtn) dismissBtn.focus();
    }

    function closeAchievementUnlockPopup() {
        const overlay = global.document.getElementById('royal-armies-achievement-unlock-overlay');
        if (!overlay) return;
        overlay.classList.remove('is-visible');
        overlay.classList.add('main-portal-modal-hidden');
        overlay.style.setProperty('display', 'none', 'important');
        overlay.setAttribute('aria-hidden', 'true');
    }

    function markJoinAgeAttemptForAchievement() {
        try {
            global.sessionStorage.setItem(JOIN_AGE_ATTEMPT_FLAG, '1');
        } catch (_err) {
            /* ignore */
        }
    }

    function consumeJoinAgeAttemptFlag() {
        try {
            const flag = global.sessionStorage.getItem(JOIN_AGE_ATTEMPT_FLAG) === '1';
            global.sessionStorage.removeItem(JOIN_AGE_ATTEMPT_FLAG);
            return flag;
        } catch (_err) {
            return false;
        }
    }

    function tryGrantWhoaSlowDownFromJoinAttempt(username) {
        if (!consumeJoinAgeAttemptFlag()) {
            return { granted: false, award: null, reason: 'no_join_attempt' };
        }
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
        markJoinAgeAttemptForAchievement,
        consumeJoinAgeAttemptFlag,
        hasCommanderAchievement,
        grantWhoaSlowDownAchievement,
        tryGrantWhoaSlowDownFromJoinAttempt,
        showAchievementUnlockPopup,
        closeAchievementUnlockPopup,
        previewWhoaSlowDownPopup,
        isLocalAchievementDevToolsEnabled,
        maybeRunDevAchievementPopupFromQuery
    };

    global.markJoinAgeAttemptForAchievement = markJoinAgeAttemptForAchievement;
    global.grantWhoaSlowDownAchievement = grantWhoaSlowDownAchievement;
    global.tryGrantWhoaSlowDownFromJoinAttempt = tryGrantWhoaSlowDownFromJoinAttempt;
    global.showAchievementUnlockPopup = showAchievementUnlockPopup;
    global.previewWhoaSlowDownAchievementPopup = previewWhoaSlowDownPopup;
})(window);
