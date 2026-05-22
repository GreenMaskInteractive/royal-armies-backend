/**
 * Dev bypass navigator — page jumps + portal persona (ports 3000 & 5500).
 */
(function initDevPageNavigator(global) {
    'use strict';

    const DEV_NAV_PORTS = new Set(['3000', '5500']);

    const DEV_SITE_PAGES = [
        { id: 'index', label: 'Landing (redirect → main)', file: 'index.html' },
        { id: 'main', label: 'Age Portal', file: 'main.html' },
        { id: 'game', label: 'Game (WIP shell)', file: 'game.html' },
        { id: 'ageportal', label: 'Age Portal (legacy redirect)', file: 'ageportal.html' },
        { id: 'reset-password', label: 'Reset Password', file: 'reset-password.html' }
    ];

    function isDevPageNavigatorEnabled() {
        return DEV_NAV_PORTS.has(String(global.location.port || ''));
    }

    function isMainPortalPage() {
        const file = (global.location.pathname || '').split('/').pop() || '';
        return file === 'main.html' || file === '';
    }

    function getPageDirectoryBase() {
        const path = global.location.pathname || '/';
        const lastSlash = path.lastIndexOf('/');
        return lastSlash >= 0 ? path.slice(0, lastSlash + 1) : '/';
    }

    function resolveDevPageHref(fileName) {
        const base = getPageDirectoryBase();
        if (base.endsWith('/')) {
            return `${base}${fileName}`;
        }
        return `${base}/${fileName}`;
    }

    function getCurrentPageId() {
        const file = (global.location.pathname || '').split('/').pop() || '';
        const match = DEV_SITE_PAGES.find((page) => page.file === file);
        return match ? match.id : '';
    }

    function navigateToDevPage(fileName) {
        if (!fileName) return;
        global.location.assign(resolveDevPageHref(fileName));
    }

    function getCurrentDevViewMode() {
        if (typeof global.getLocalDevViewMode === 'function') {
            return global.getLocalDevViewMode();
        }
        return 'owner';
    }

    function applyDevViewMode(mode) {
        if (typeof global.setLocalDevViewMode === 'function') {
            global.setLocalDevViewMode(mode);
        }
        if (typeof global.portalAuthRestorePromise !== 'undefined') {
            global.portalAuthRestorePromise = null;
        }
        global.location.reload();
    }

    function buildDevPageNavigatorMarkup() {
        const currentId = getCurrentPageId();
        const pageOptions = DEV_SITE_PAGES.map((page) => {
            const selected = page.id === currentId ? ' selected' : '';
            return `<option value="${page.file}"${selected}>${page.label}</option>`;
        }).join('');

        const viewMode = getCurrentDevViewMode();
        const personaBlock = isMainPortalPage()
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

        const achievementTestBtn = (typeof global.isLocalDevelopmentHost === 'function' && global.isLocalDevelopmentHost())
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
                navigateToDevPage(select.value);
            });
        }

        if (goBtn && select) {
            goBtn.addEventListener('click', () => {
                navigateToDevPage(select.value);
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
                if (typeof global.previewWhoaSlowDownAchievementPopup === 'function') {
                    global.previewWhoaSlowDownAchievementPopup({ grantIfMissing: false });
                    return;
                }
                if (global.RoyalArmiesAchievements && typeof global.RoyalArmiesAchievements.previewWhoaSlowDownPopup === 'function') {
                    global.RoyalArmiesAchievements.previewWhoaSlowDownPopup({ grantIfMissing: false });
                }
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
