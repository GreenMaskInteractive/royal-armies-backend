/**
 * Dev bypass navigator — dropdown of site pages, visible only on port 3000 or 5500.
 */
(function initDevPageNavigator(global) {
    'use strict';

    const DEV_NAV_PORTS = new Set(['3000', '5500']);

    const DEV_SITE_PAGES = [
        { id: 'index', label: 'Landing (redirect → main)', file: 'index.html' },
        { id: 'main', label: 'Age Portal', file: 'main.html' },
        { id: 'ageportal', label: 'Age Portal (legacy redirect)', file: 'ageportal.html' },
        { id: 'reset-password', label: 'Reset Password', file: 'reset-password.html' }
    ];

    function isDevPageNavigatorEnabled() {
        return DEV_NAV_PORTS.has(String(global.location.port || ''));
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

    function buildDevPageNavigatorMarkup() {
        const currentId = getCurrentPageId();
        const options = DEV_SITE_PAGES.map((page) => {
            const selected = page.id === currentId ? ' selected' : '';
            return `<option value="${page.file}"${selected}>${page.label}</option>`;
        }).join('');

        return `
            <div id="dev-page-navigator" class="dev-page-navigator" role="navigation" aria-label="Developer page bypass">
                <label class="dev-page-navigator-label" for="dev-page-navigator-select">
                    <span class="dev-page-navigator-eyebrow">Dev bypass · :${global.location.port}</span>
                    <select id="dev-page-navigator-select" class="dev-page-navigator-select" title="Jump to another page">
                        ${options}
                    </select>
                </label>
                <button type="button" id="dev-page-navigator-go" class="dev-page-navigator-go">Go</button>
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
        remount: mountDevPageNavigator
    };

    if (global.document.readyState === 'loading') {
        global.document.addEventListener('DOMContentLoaded', bootDevPageNavigator);
    } else {
        bootDevPageNavigator();
    }
})(window);
