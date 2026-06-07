/**
 * RIFT — Shared Age area page chrome (top HUD + bottom dock) for settlement, council room, etc.
 */
(function initRoyalArmiesAgeAreaShell(global) {
    'use strict';

    const TOP_FRAGMENT = 'age-area-top-bar.fragment.html';
    const BOTTOM_FRAGMENT = 'age-area-bottom-dock.fragment.html';

    let mountPromise = null;
    let gameTimeTimer = null;

    function isAreaShellPage() {
        return global.document.body?.dataset?.ageAreaShell === 'true';
    }

    function resolveActiveHubId() {
        return String(global.document.body?.dataset?.ageAreaActiveHub || '').trim().toLowerCase();
    }

    async function fetchFragment(path) {
        const response = await global.fetch(path, { cache: 'no-store' });
        if (!response.ok) {
            throw new Error(`Failed to load ${path} (${response.status})`);
        }
        return response.text();
    }

    function syncActiveNationHubItem() {
        const activeHub = resolveActiveHubId();
        if (!activeHub) return;

        const items = global.document.querySelectorAll('.age-nation-hub-menu-ladder .age-nation-hub-menu-item');
        items.forEach((item) => {
            const hubId = String(item.getAttribute('data-age-hub-item') || '').trim().toLowerCase();
            const isActive = hubId === activeHub;
            item.classList.toggle('is-active', isActive);
            if (isActive) {
                item.setAttribute('aria-current', 'true');
            } else {
                item.removeAttribute('aria-current');
            }
        });
    }

    function formatUniversalGameTimeClock(now = new Date()) {
        const hours = String(now.getUTCHours()).padStart(2, '0');
        const minutes = String(now.getUTCMinutes()).padStart(2, '0');
        const seconds = String(now.getUTCSeconds()).padStart(2, '0');
        return `${hours}:${minutes}:${seconds}`;
    }

    function initializeGameTimeClock() {
        const display = global.document.getElementById('portal-universal-game-time-display');
        if (!display) return;

        const tick = () => {
            display.textContent = formatUniversalGameTimeClock(new Date());
            display.setAttribute('aria-label', `Game time ${display.textContent}`);
        };

        tick();
        if (gameTimeTimer) {
            global.clearInterval(gameTimeTimer);
        }
        gameTimeTimer = global.setInterval(tick, 1000);
    }

    function refreshCommanderNavChrome() {
        const username = global.localStorage.getItem('activeCommanderUser')?.trim()
            || (typeof global.getActiveCommanderUsername === 'function'
                ? String(global.getActiveCommanderUsername() || '').trim()
                : '');

        const savedAvatar = global.localStorage.getItem('savedProfileAvatarUrl')?.trim()
            || 'images/avatars/commanderprofile01.png';

        [
            global.document.getElementById('logged-user-tag'),
            global.document.getElementById('game-mobile-nav-username')
        ].forEach((el) => {
            if (el) el.textContent = username || 'Loading...';
        });

        [
            global.document.getElementById('nav-embedded-avatar-crest'),
            global.document.getElementById('game-mobile-nav-avatar')
        ].forEach((el) => {
            if (el) el.src = savedAvatar;
        });
    }

    function enableSharedChromeBindings() {
        if (typeof global.bindPortalNewMessagesBarNavigation === 'function') {
            global.bindPortalNewMessagesBarNavigation();
        }
        if (typeof global.bindPortalCommanderIdentityMenu === 'function') {
            global.bindPortalCommanderIdentityMenu();
        }
        if (typeof global.enableAgeNationHub === 'function') {
            global.enableAgeNationHub();
        } else {
            global.RoyalArmiesAgeNationHub?.enable?.();
        }
        if (typeof global.mountGameChatToHosts === 'function') {
            global.mountGameChatToHosts(
                global.document.getElementById('age-map-bottom-chat-messages-host'),
                global.document.getElementById('age-map-bottom-chat-compose-host')
            );
        }
        if (typeof global.refreshNationTreasuryHud === 'function') {
            global.refreshNationTreasuryHud();
        }
    }

    async function mountAreaShellChrome() {
        if (!isAreaShellPage()) return;

        const topHost = global.document.querySelector('[data-age-area-shell-top]');
        const bottomHost = global.document.querySelector('[data-age-area-shell-bottom]');
        if (!topHost && !bottomHost) return;

        const [topHtml, bottomHtml] = await Promise.all([
            topHost ? fetchFragment(TOP_FRAGMENT) : Promise.resolve(''),
            bottomHost ? fetchFragment(BOTTOM_FRAGMENT) : Promise.resolve('')
        ]);

        if (topHost && topHtml) {
            topHost.innerHTML = topHtml;
        }
        if (bottomHost && bottomHtml) {
            bottomHost.innerHTML = bottomHtml;
        }

        syncActiveNationHubItem();
        initializeGameTimeClock();
        refreshCommanderNavChrome();
        enableSharedChromeBindings();
    }

    function ensureAreaShellMounted() {
        if (!isAreaShellPage()) {
            return Promise.resolve();
        }
        if (!mountPromise) {
            mountPromise = mountAreaShellChrome().catch((err) => {
                mountPromise = null;
                console.warn('[RIFT] Age area shell chrome failed to mount:', err);
            });
        }
        return mountPromise;
    }

    global.RoyalArmiesAgeAreaShell = {
        isAreaShellPage,
        ensureAreaShellMounted,
        syncActiveNationHubItem,
        refreshCommanderNavChrome,
        initializeGameTimeClock
    };
})(window);
