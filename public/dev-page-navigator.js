/**
 * Dev bypass navigator — page jumps + portal persona (ports 3000 & 5500).
 */
(function initDevPageNavigator(global) {
    'use strict';

    const DEV_NAV_PORTS = new Set(['3000', '5500']);

    const DEV_SITE_PAGES = [
        { id: 'index', label: 'Landing (redirect → main)', path: '/main', file: 'index.html' },
        { id: 'main', label: 'Age Portal', path: '/main', file: 'main.html' },
        { id: 'game', label: 'Game (WIP shell)', path: '/game', file: 'game.html' },
        { id: 'how-did-you-get-here', label: 'Join Age placeholder', path: '/how-did-you-get-here', file: 'how-did-you-get-here.html' },
        { id: 'ageportal', label: 'Age Portal (legacy redirect)', path: '/main', file: 'ageportal.html' },
        { id: 'reset-password', label: 'Reset Password', path: '/reset-password', file: 'reset-password.html' }
    ];

    function isDevPageNavigatorEnabled() {
        return DEV_NAV_PORTS.has(String(global.location.port || ''));
    }

    function usesExtensionlessDevUrls() {
        return String(global.location.port || '') === '3000';
    }

    function getPageDirectoryBase() {
        const path = global.location.pathname || '/';
        const lastSlash = path.lastIndexOf('/');
        return lastSlash >= 0 ? path.slice(0, lastSlash + 1) : '/';
    }

    function getPathSlug() {
        const segment = (global.location.pathname || '').split('/').filter(Boolean).pop() || '';
        return segment.replace(/\.html$/i, '').toLowerCase();
    }

    function isDevPortalPersonaPage() {
        const slug = getPathSlug();
        return slug === 'main' || slug === 'game' || slug === 'how-did-you-get-here' || slug === '';
    }

    function resolveDevPageHref(page) {
        if (!page) return '/';
        if (usesExtensionlessDevUrls()) {
            return page.path || '/main';
        }
        const fileName = page.file || 'main.html';
        const base = getPageDirectoryBase();
        if (base.endsWith('/')) {
            return `${base}${fileName}`;
        }
        return `${base}/${fileName}`;
    }

    function getCurrentPageId() {
        const slug = getPathSlug();
        const match = DEV_SITE_PAGES.find((page) => {
            const pageSlug = (page.path || '').replace(/^\//, '').toLowerCase();
            const fileSlug = (page.file || '').replace(/\.html$/i, '').toLowerCase();
            return slug === pageSlug || slug === fileSlug;
        });
        return match ? match.id : '';
    }

    function navigateToDevPage(pageRef) {
        const page = typeof pageRef === 'string'
            ? DEV_SITE_PAGES.find((entry) => entry.file === pageRef || entry.path === pageRef)
            : pageRef;
        const href = resolveDevPageHref(page || DEV_SITE_PAGES[1]);
        if (!href) return;
        global.location.assign(href);
    }

    function getCurrentDevViewMode() {
        if (typeof global.getLocalDevViewMode === 'function') {
            return global.getLocalDevViewMode();
        }
        return 'owner';
    }

    function resolveDevAuthLogoutUrl() {
        if (typeof global.resolveRoyalArmiesApiUrl === 'function') {
            return global.resolveRoyalArmiesApiUrl('/api/auth/logout');
        }
        return '/api/auth/logout';
    }

    async function clearDevPortalAuthSession() {
        if (typeof global.clearPortalAuthStorage === 'function') {
            global.clearPortalAuthStorage();
        }
        try {
            await global.fetch(resolveDevAuthLogoutUrl(), {
                method: 'POST',
                credentials: 'include',
                cache: 'no-store'
            });
        } catch (_err) {
            /* local preview may not have a session cookie */
        }
    }

    async function applyDevViewMode(mode) {
        if (typeof global.setLocalDevViewMode === 'function') {
            global.setLocalDevViewMode(mode);
        }

        await clearDevPortalAuthSession();

        global.location.reload();
    }

    function buildDevPageNavigatorMarkup() {
        const currentId = getCurrentPageId();
        const pageOptions = DEV_SITE_PAGES.map((page) => {
            const selected = page.id === currentId ? ' selected' : '';
            const value = usesExtensionlessDevUrls() ? (page.path || '/main') : (page.file || 'main.html');
            return `<option value="${value}"${selected}>${page.label}</option>`;
        }).join('');

        const viewMode = getCurrentDevViewMode();
        const personaBlock = isDevPortalPersonaPage()
            ? `
                <label class="dev-page-navigator-label dev-page-navigator-label--persona" for="dev-portal-persona-select">
                    <span class="dev-page-navigator-eyebrow">Portal view</span>
                    <select id="dev-portal-persona-select" class="dev-page-navigator-select dev-page-navigator-select--persona" title="Simulate owner, regular player, or guest">
                        <option value="owner"${viewMode === 'owner' ? ' selected' : ''}>Owner · caleb_admin</option>
                        <option value="player"${viewMode === 'player' ? ' selected' : ''}>Player · all pages</option>
                        <option value="guest"${viewMode === 'guest' ? ' selected' : ''}>Guest · logged out</option>
                    </select>
                </label>
            `
            : '';

        const achievementTestBtn = (
            typeof global.isLocalDevelopmentHost === 'function'
            && global.isLocalDevelopmentHost()
            && getCurrentPageId() === 'how-did-you-get-here'
        )
            ? '<button type="button" id="dev-achievement-popup-test" class="dev-page-navigator-go dev-page-navigator-go--secondary" title="Preview the Whoa Slow Down achievement popup">Achievement</button>'
            : '';

        return `
            <div id="dev-page-navigator" class="dev-page-navigator" role="navigation" aria-label="Developer page bypass">
                <label class="dev-page-navigator-label" for="dev-page-navigator-select">
                    <span class="dev-page-navigator-eyebrow">Dev bypass · :${global.location.port}</span>
                    <select id="dev-page-navigator-select" class="dev-page-navigator-select" title="Jump to another page">
                        ${pageOptions}
                    </select>
                </label>
                ${personaBlock}
                <button type="button" id="dev-page-navigator-go" class="dev-page-navigator-go">Go</button>
                ${achievementTestBtn}
            </div>
        `;
    }

    function mountDevPageNavigator() {
        if (!isDevPageNavigatorEnabled() || global.document.getElementById('dev-page-navigator')) {
            return;
        }

        const wrapper = global.document.createElement('div');
        wrapper.innerHTML = buildDevPageNavigatorMarkup().trim();
        const bar = wrapper.firstElementChild;
        if (!bar) return;

        global.document.body.appendChild(bar);

        const select = global.document.getElementById('dev-page-navigator-select');
        const goBtn = global.document.getElementById('dev-page-navigator-go');
        const personaSelect = global.document.getElementById('dev-portal-persona-select');

        if (select) {
            select.addEventListener('change', () => {
                global.location.assign(select.value);
            });
        }

        if (goBtn && select) {
            goBtn.addEventListener('click', () => {
                global.location.assign(select.value);
            });
        }

        if (personaSelect) {
            personaSelect.addEventListener('change', () => {
                const nextMode = personaSelect.value;
                if (nextMode === getCurrentDevViewMode()) return;
                applyDevViewMode(nextMode);
            });
        }

        const achievementBtn = global.document.getElementById('dev-achievement-popup-test');
        if (achievementBtn) {
            achievementBtn.addEventListener('click', () => {
                const preview = typeof global.previewWhoaSlowDownAchievementPopup === 'function'
                    ? global.previewWhoaSlowDownAchievementPopup
                    : (global.RoyalArmiesAchievements && typeof global.RoyalArmiesAchievements.previewWhoaSlowDownPopup === 'function'
                        ? global.RoyalArmiesAchievements.previewWhoaSlowDownPopup.bind(global.RoyalArmiesAchievements)
                        : null);
                if (!preview) {
                    global.alert('Achievement preview is unavailable — reload with achievement-system.js loaded.');
                    return;
                }
                preview({ grantIfMissing: true });
            });
        }
    }

    function bootDevPageNavigator() {
        if (!isDevPageNavigatorEnabled()) return;
        mountDevPageNavigator();
    }

    global.isDevPageNavigatorEnabled = isDevPageNavigatorEnabled;
    global.RoyalArmiesDevPageNavigator = {
        enabled: isDevPageNavigatorEnabled,
        pages: DEV_SITE_PAGES,
        navigateTo: navigateToDevPage,
        applyDevViewMode,
        remount: mountDevPageNavigator
    };

    if (global.document.readyState === 'loading') {
        global.document.addEventListener('DOMContentLoaded', bootDevPageNavigator);
    } else {
        bootDevPageNavigator();
    }
})(window);
