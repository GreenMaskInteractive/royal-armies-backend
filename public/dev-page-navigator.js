/**
 * Dev bypass navigator — page jumps + portal persona (ports 3000 & 5500).
 */
(function initDevPageNavigator(global) {
    'use strict';

    const DEV_NAV_PORTS = new Set(['3000', '5500']);
    const DEV_NAV_POSITION_STORAGE_KEY = 'royalArmies_devPageNavigatorPosition';

    const DEV_SITE_PAGE_GROUPS = [
        {
            label: 'Age of War · season preview',
            pages: [
                { id: 'season-hub', label: 'Season hub', path: '/season-age-of-war-preview', file: 'season-age-of-war-preview.html' },
                { id: 'ageofwarcinematic', label: 'Season · cinematic', path: '/ageofwarcinematic', file: 'ageofwarcinematic.html' },
                { id: 'ageofwar-trailer', label: 'Season · trailer (unlisted)', path: '/royalarmies-ageofwar-trailer', file: 'royalarmies-ageofwar-trailer.html' },
                { id: 'season-age', label: 'Season · Age HUD + music', path: '/season-age-of-war-age', file: 'season-age-of-war-age.html' },
                { id: 'season-game', label: 'Season · progression', path: '/season-age-of-war-game', file: 'season-age-of-war-game.html' }
            ]
        },
        {
            label: 'Production / compare',
            pages: [
                { id: 'main', label: 'Age Portal', path: '/main', file: 'main.html' },
                { id: 'game', label: 'Game (progression)', path: '/game', file: 'game.html' },
                { id: 'agealpha', label: 'Age Alpha (live session)', path: '/agealpha', file: 'agealpha.html' }
            ]
        }
    ];

    const DEV_SITE_PAGES = DEV_SITE_PAGE_GROUPS.flatMap((group) => group.pages);

    const DEV_SEASON_PREVIEW_FILES = new Set([
        'season-age-of-war-preview.html',
        'ageofwarcinematic.html',
        'royalarmies-ageofwar-trailer.html',
        'season-age-of-war-age.html',
        'season-age-of-war-game.html'
    ]);

    function isDevPageNavigatorEnabled() {
        return DEV_NAV_PORTS.has(String(global.location.port || ''));
    }

    function usesExtensionlessDevUrls() {
        if (typeof global.shouldUseHtmlPageExtensions === 'function') {
            return !global.shouldUseHtmlPageExtensions();
        }
        return false;
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
        return slug === 'main'
            || slug === 'game'
            || slug === 'agealpha'
            || slug === 'season-age-of-war-preview'
            || slug === 'ageofwarcinematic'
            || slug === 'royalarmies-ageofwar-trailer'
            || slug === 'season-age-of-war-age'
            || slug === 'season-age-of-war-game'
            || slug === '';
    }

    function resolveDevPageHref(page) {
        if (!page) {
            return typeof global.resolveRoyalArmiesPageUrl === 'function'
                ? global.resolveRoyalArmiesPageUrl('main')
                : '/main';
        }

        const fileName = page.file || 'main.html';
        const slug = fileName.replace(/\.html$/i, '');
        let href;

        if (DEV_SEASON_PREVIEW_FILES.has(fileName)) {
            const base = getPageDirectoryBase();
            href = base.endsWith('/') ? `${base}${fileName}` : `${base}/${fileName}`;
        } else {
            href = typeof global.resolveRoyalArmiesPageUrl === 'function'
                ? global.resolveRoyalArmiesPageUrl(slug)
                : (usesExtensionlessDevUrls()
                    ? (page.path && page.path.startsWith('/') ? page.path : `/${slug}`)
                    : (() => {
                        const base = getPageDirectoryBase();
                        return base.endsWith('/') ? `${base}${fileName}` : `${base}/${fileName}`;
                    })());
        }

        const url = new URL(href, global.location.href);

        if (page.id === 'game' || page.id === 'season-game' || fileName === 'game.html' || fileName === 'season-age-of-war-game.html') {
            url.searchParams.set('riftProgressionReset', '1');
        }

        if (page.id === 'agealpha' || page.id === 'season-age' || fileName === 'agealpha.html' || fileName === 'season-age-of-war-age.html') {
            url.searchParams.set('riftAgeDevBypass', '1');
        }

        return `${url.pathname}${url.search}`;
    }

    function findDevPageFromSelect(select) {
        if (!select) return null;
        const selectedOption = select.options[select.selectedIndex];
        const pageId = selectedOption && selectedOption.getAttribute('data-dev-page-id');
        if (pageId) {
            const byId = DEV_SITE_PAGES.find((entry) => entry.id === pageId);
            if (byId) return byId;
        }

        const optionPath = String(select.value || '').split('?')[0];
        return DEV_SITE_PAGES.find((entry) => {
            const entryPath = entry.path || '';
            const entryFile = entry.file || '';
            return entryPath === optionPath
                || entryFile === optionPath.replace(/^\//, '')
                || `/${entryFile}` === optionPath;
        }) || null;
    }

    function getCurrentPageId() {
        const slug = getPathSlug();
        const match = DEV_SITE_PAGES.find((page) => {
            const pageSlug = (page.path || '').replace(/^\//, '').replace(/\.html$/i, '').toLowerCase();
            const fileSlug = (page.file || '').replace(/\.html$/i, '').toLowerCase();
            return slug === pageSlug || slug === fileSlug;
        });
        return match ? match.id : '';
    }

    function navigateToDevPage(pageRef) {
        const page = typeof pageRef === 'string'
            ? DEV_SITE_PAGES.find((entry) => entry.file === pageRef || entry.path === pageRef)
            : pageRef;
        const href = resolveDevPageHref(page || DEV_SITE_PAGES[0]);
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
        const pageOptions = DEV_SITE_PAGE_GROUPS.map((group) => {
            const options = group.pages.map((page) => {
                const selected = page.id === currentId ? ' selected' : '';
                const value = resolveDevPageHref(page);
                return `<option value="${value}" data-dev-page-id="${page.id}"${selected}>${page.label}</option>`;
            }).join('');
            return `<optgroup label="${group.label}">${options}</optgroup>`;
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
            && (getCurrentPageId() === 'game' || getCurrentPageId() === 'season-game')
        )
            ? '<button type="button" id="dev-achievement-popup-test" class="dev-page-navigator-go dev-page-navigator-go--secondary" title="Preview the Whoa Slow Down achievement popup">Achievement</button>'
            : '';

        return `
            <div id="dev-page-navigator" class="dev-page-navigator" role="navigation" aria-label="Developer page bypass">
                <button
                    type="button"
                    id="dev-page-navigator-move-handle"
                    class="dev-page-navigator-move-handle dev-page-navigator-drag-handle"
                    aria-label="Drag dev bypass panel"
                    title="Drag to move">
                    <svg class="dev-page-navigator-move-icon" viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" focusable="false">
                        <path fill="currentColor" d="M10 9h4V6h3l-5-5-5 5h3v3zm-4 4h3v4H6l-5 5 5 5v-3h3v-4H6zm14 0v3h3l-5 5-5-5h3v-4h-4zm-4-9v3h-4V6H6l5-5 5 5h-3z"/>
                    </svg>
                </button>
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

    function readSavedDevNavPosition() {
        try {
            const raw = global.localStorage.getItem(DEV_NAV_POSITION_STORAGE_KEY);
            if (!raw) return null;
            const parsed = JSON.parse(raw);
            if (typeof parsed.x !== 'number' || typeof parsed.y !== 'number') return null;
            if (!Number.isFinite(parsed.x) || !Number.isFinite(parsed.y)) return null;
            return parsed;
        } catch (_err) {
            return null;
        }
    }

    function saveDevNavPosition(x, y) {
        try {
            global.localStorage.setItem(DEV_NAV_POSITION_STORAGE_KEY, JSON.stringify({ x, y }));
        } catch (_err) {
            /* ignore */
        }
    }

    function clampDevNavPosition(bar, x, y) {
        const width = bar.offsetWidth || bar.getBoundingClientRect().width;
        const height = bar.offsetHeight || bar.getBoundingClientRect().height;
        const maxX = Math.max(0, global.innerWidth - width);
        const maxY = Math.max(0, global.innerHeight - height);
        return {
            x: Math.max(0, Math.min(maxX, Math.round(x))),
            y: Math.max(0, Math.min(maxY, Math.round(y)))
        };
    }

    function applyDevNavPosition(bar, x, y) {
        const clamped = clampDevNavPosition(bar, x, y);
        bar.classList.add('is-drag-positioned');
        bar.style.setProperty('left', `${clamped.x}px`, 'important');
        bar.style.setProperty('top', `${clamped.y}px`, 'important');
        bar.style.setProperty('right', 'auto', 'important');
        bar.style.setProperty('bottom', 'auto', 'important');
        bar.style.setProperty('transform', 'none', 'important');
        return clamped;
    }

    function getDefaultDevNavPosition(bar) {
        const rect = bar.getBoundingClientRect();
        const bottomInset = 12;
        return {
            x: (global.innerWidth - rect.width) / 2,
            y: global.innerHeight - rect.height - bottomInset
        };
    }

    function initDevNavPosition(bar) {
        const saved = readSavedDevNavPosition();
        if (saved) {
            applyDevNavPosition(bar, saved.x, saved.y);
            return;
        }

        global.requestAnimationFrame(() => {
            const pos = getDefaultDevNavPosition(bar);
            applyDevNavPosition(bar, pos.x, pos.y);
        });
    }

    function isDevNavDragExcludedTarget(target) {
        return Boolean(target && target.closest('select, input, textarea, option, label'));
    }

    function bindDevNavDrag(bar) {
        if (!bar || bar.dataset.devNavDragBound === '1') return;
        bar.dataset.devNavDragBound = '1';

        let startX = 0;
        let startY = 0;
        let originX = 0;
        let originY = 0;
        let dragging = false;
        let activePointerId = null;
        let captureTarget = null;

        const onPointerMove = (event) => {
            if (!dragging || event.pointerId !== activePointerId) return;
            event.preventDefault();
            const next = applyDevNavPosition(
                bar,
                originX + (event.clientX - startX),
                originY + (event.clientY - startY)
            );
            saveDevNavPosition(next.x, next.y);
        };

        const endDrag = (event) => {
            if (!dragging) return;
            if (event && activePointerId !== null && event.pointerId !== activePointerId) return;

            dragging = false;
            activePointerId = null;
            bar.classList.remove('is-dragging');

            if (captureTarget && typeof captureTarget.releasePointerCapture === 'function') {
                try {
                    if (event && captureTarget.hasPointerCapture(event.pointerId)) {
                        captureTarget.releasePointerCapture(event.pointerId);
                    }
                } catch (_err) {
                    /* ignore */
                }
            }
            captureTarget = null;

            global.document.removeEventListener('pointermove', onPointerMove);
            global.document.removeEventListener('pointerup', endDrag);
            global.document.removeEventListener('pointercancel', endDrag);
        };

        const startDrag = (event, handleEl) => {
            if (event.button !== 0) return;
            if (!handleEl && isDevNavDragExcludedTarget(event.target)) return;
            if (handleEl && !bar.contains(handleEl)) return;

            event.preventDefault();
            event.stopPropagation();

            const rect = bar.getBoundingClientRect();
            originX = rect.left;
            originY = rect.top;
            startX = event.clientX;
            startY = event.clientY;
            dragging = true;
            activePointerId = event.pointerId;
            bar.classList.add('is-dragging');
            applyDevNavPosition(bar, originX, originY);

            captureTarget = handleEl || bar;
            if (captureTarget && typeof captureTarget.setPointerCapture === 'function') {
                captureTarget.setPointerCapture(event.pointerId);
            }

            global.document.addEventListener('pointermove', onPointerMove, { passive: false });
            global.document.addEventListener('pointerup', endDrag);
            global.document.addEventListener('pointercancel', endDrag);
        };

        const moveHandle = bar.querySelector('#dev-page-navigator-move-handle');
        if (moveHandle) {
            moveHandle.addEventListener('pointerdown', (event) => {
                startDrag(event, moveHandle);
            });
        }

        bar.addEventListener('pointerdown', (event) => {
            if (event.target.closest('#dev-page-navigator-move-handle')) return;
            if (event.target.closest('.dev-page-navigator-go, .dev-page-navigator-select, #dev-portal-persona-select')) {
                return;
            }
            startDrag(event, null);
        });

        global.addEventListener('resize', () => {
            if (!bar.classList.contains('is-drag-positioned')) return;
            const rect = bar.getBoundingClientRect();
            const next = applyDevNavPosition(bar, rect.left, rect.top);
            saveDevNavPosition(next.x, next.y);
        });
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
        initDevNavPosition(bar);
        bindDevNavDrag(bar);

        const select = global.document.getElementById('dev-page-navigator-select');
        const goBtn = global.document.getElementById('dev-page-navigator-go');
        const personaSelect = global.document.getElementById('dev-portal-persona-select');

        if (select) {
            select.addEventListener('change', () => {
                navigateToDevPage(findDevPageFromSelect(select) || select.value);
            });
        }

        if (goBtn && select) {
            goBtn.addEventListener('click', () => {
                navigateToDevPage(findDevPageFromSelect(select) || select.value);
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
        pageGroups: DEV_SITE_PAGE_GROUPS,
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
