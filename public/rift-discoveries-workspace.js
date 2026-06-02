/**
 * RIFT — Commander discoveries journal (archives, letters, manuscripts).
 */
(function initRoyalArmiesDiscoveriesWorkspace(global) {
    'use strict';

    const STORAGE_PREFIX = 'royalArmies_discoveredLore_v1';

    const CATEGORIES = Object.freeze([
        {
            id: 'archives',
            label: 'Historical Archives',
            icon: 'images/historicalarchives.png'
        },
        {
            id: 'letters',
            label: 'Letters',
            icon: 'images/letters.png'
        },
        {
            id: 'manuscripts',
            label: 'Lost Manuscripts',
            icon: 'images/lostmanuscripts.png'
        }
    ]);

    const CATEGORY_BY_ID = CATEGORIES.reduce((map, entry) => {
        map[entry.id] = entry;
        return map;
    }, Object.create(null));

    /** @type {ReadonlyArray<{id:string,category:string,title:string,subtitle?:string,body:string}>} */
    const DISCOVERY_CATALOG = Object.freeze([
        {
            id: 'letter-to-lover',
            category: 'letters',
            title: 'Letter to Lover',
            subtitle: 'Folded parchment · Crescent Ridge',
            body: `
                <p>My dearest,</p>
                <p>If this reaches you before the snow closes the pass, know that I am alive — though the company marches east and the officers speak only of supply lines and oaths.</p>
                <p>I keep the locket you pressed into my palm the night the bells rang. When the drums start, I touch it and remember the orchard behind your father&apos;s house, and that we promised to meet again when the war forgets our names.</p>
                <p>Do not wait at the window. Wait in your heart. I will find you.</p>
                <p class="rift-discovery-signatory">— unsigned</p>
            `
        },
        {
            id: 'declaration-of-nobility',
            category: 'archives',
            title: 'Declaration of Nobility',
            subtitle: 'Sealed record · Royal Registry',
            body: `
                <p>By the authority vested in the Crown of the Age and witnessed before the High Scrivener, let it be entered into the Historical Archives that the bearer of this declaration has been affirmed in bloodline, title, and obligation to the realm.</p>
                <p>The house named herein shall hold its lands in fealty, furnish levies when called, and accept judgment by crown law in all matters of succession, taxation, and martial command.</p>
                <p>No grant herein may be sold, divided, or bequeathed without royal seal. False claim to nobility is punishable by forfeiture and exile.</p>
                <p class="rift-discovery-signatory">— Registry of Nobility, Seventh Seal</p>
            `
        },
        {
            id: 'song-of-triumph',
            category: 'manuscripts',
            title: 'Song of Triumph',
            subtitle: 'Recovered verse · battle canticle',
            body: `
                <p><em>Lift the banner high, let the valley hear our name —</em></p>
                <p><em>Iron boots on stone, fire in the rain.</em></p>
                <p><em>We broke the gate at dawn, we sang when night withdrew,</em></p>
                <p><em>Not for gold, not for throne, but for the few who saw us through.</em></p>
                <p>Fragments of the final stanza are burned away. Scholars believe the lost couplet named the fallen captains of the Third March.</p>
            `
        }
    ]);

    const CATALOG_BY_ID = DISCOVERY_CATALOG.reduce((map, entry) => {
        map[entry.id] = entry;
        return map;
    }, Object.create(null));

    let selectedDiscoveryId = null;
    let toastHideTimer = null;
    let menuBindingsReady = false;

    function getCommanderStorageKey() {
        let username = '';
        if (typeof global.getActiveCommanderUsername === 'function') {
            username = String(global.getActiveCommanderUsername() || '').trim();
        }
        if (!username) {
            const tag = global.document.getElementById('logged-user-tag');
            username = String(tag?.textContent || '').trim();
        }
        if (!username || username.toLowerCase() === 'loading...') {
            return `${STORAGE_PREFIX}:guest`;
        }
        return `${STORAGE_PREFIX}:${username.toLowerCase()}`;
    }

    function readDiscoveredIds() {
        try {
            const raw = global.localStorage.getItem(getCommanderStorageKey());
            if (!raw) return [];
            const parsed = JSON.parse(raw);
            if (!Array.isArray(parsed)) return [];
            return parsed.filter((id) => typeof id === 'string' && CATALOG_BY_ID[id]);
        } catch (_err) {
            return [];
        }
    }

    function writeDiscoveredIds(ids) {
        const unique = [...new Set(ids.filter((id) => CATALOG_BY_ID[id]))];
        try {
            global.localStorage.setItem(getCommanderStorageKey(), JSON.stringify(unique));
        } catch (_err) {
            /* ignore quota */
        }
        return unique;
    }

    function getCategoryMeta(categoryId) {
        return CATEGORY_BY_ID[categoryId] || CATEGORIES[0];
    }

    function escapeHtml(value) {
        return String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function ensureModalShell() {
        if (global.document.getElementById('rift-discoveries-workspace-modal')) return;

        const modal = global.document.createElement('div');
        modal.id = 'rift-discoveries-workspace-modal';
        modal.className = 'rift-discoveries-workspace-modal';
        modal.hidden = true;
        modal.setAttribute('aria-hidden', 'true');
        modal.innerHTML = `
            <div class="rift-discoveries-workspace-backdrop" id="rift-discoveries-workspace-backdrop" aria-hidden="true"></div>
            <div class="rift-discoveries-workspace-dialog" role="dialog" aria-modal="true" aria-labelledby="rift-discoveries-workspace-title">
                <header class="rift-discoveries-workspace-header">
                    <div class="rift-discoveries-workspace-heading-block">
                        <p class="rift-discoveries-workspace-eyebrow">Commander journal</p>
                        <h2 id="rift-discoveries-workspace-title" class="rift-discoveries-workspace-title">Discoveries</h2>
                    </div>
                    <button type="button" id="rift-discoveries-workspace-close" class="rift-discoveries-workspace-close" aria-label="Close discoveries">×</button>
                </header>
                <div class="rift-discoveries-workspace-body">
                    <nav class="rift-discoveries-workspace-nav" id="rift-discoveries-workspace-nav" aria-label="Discovery categories"></nav>
                    <div class="rift-discoveries-workspace-detail" id="rift-discoveries-workspace-detail">
                        <div class="rift-discoveries-workspace-empty">
                            <p>Select a discovery on the left to read it here.</p>
                        </div>
                    </div>
                </div>
            </div>
        `;
        global.document.body.appendChild(modal);

        const toast = global.document.createElement('div');
        toast.id = 'rift-discovery-toast';
        toast.className = 'rift-discovery-toast';
        toast.hidden = true;
        toast.setAttribute('role', 'status');
        toast.setAttribute('aria-live', 'polite');
        toast.innerHTML = `
            <div class="rift-discovery-toast-panel">
                <img class="rift-discovery-toast-icon" id="rift-discovery-toast-icon" src="" alt="" aria-hidden="true">
                <p class="rift-discovery-toast-kicker">You made a discovery!</p>
                <p class="rift-discovery-toast-title" id="rift-discovery-toast-title"></p>
                <button type="button" class="rift-discovery-toast-open-btn" id="rift-discovery-toast-open-btn">Open journal</button>
            </div>
        `;
        global.document.body.appendChild(toast);
    }

    function renderWorkspaceNav() {
        const nav = global.document.getElementById('rift-discoveries-workspace-nav');
        if (!nav) return;

        const discovered = readDiscoveredIds();
        if (!selectedDiscoveryId || !discovered.includes(selectedDiscoveryId)) {
            selectedDiscoveryId = discovered[0] || null;
        }

        const sections = CATEGORIES.map((category) => {
            const items = DISCOVERY_CATALOG.filter(
                (entry) => entry.category === category.id && discovered.includes(entry.id)
            );
            const tabs = items.length
                ? items.map((entry) => {
                    const isActive = entry.id === selectedDiscoveryId;
                    return `<button type="button" class="rift-discoveries-workspace-tab${isActive ? ' is-active' : ''}" data-discovery-id="${escapeHtml(entry.id)}">${escapeHtml(entry.title)}</button>`;
                }).join('')
                : '<p class="rift-discoveries-workspace-category-empty">No entries yet.</p>';

            return `
                <section class="rift-discoveries-workspace-category" data-category-id="${escapeHtml(category.id)}">
                    <header class="rift-discoveries-workspace-category-head">
                        <img class="rift-discoveries-workspace-category-icon" src="${escapeHtml(category.icon)}" alt="" aria-hidden="true">
                        <h3 class="rift-discoveries-workspace-category-title">${escapeHtml(category.label)}</h3>
                    </header>
                    <div class="rift-discoveries-workspace-tab-list">${tabs}</div>
                </section>
            `;
        }).join('');

        const emptyJournal = discovered.length === 0;
        nav.innerHTML = emptyJournal
            ? `<div class="rift-discoveries-workspace-nav-empty">
                    <p>You have not recorded any discoveries yet.</p>
                    <p class="rift-discoveries-workspace-nav-hint">Explore the Age map to uncover letters, archives, and lost manuscripts.</p>
               </div>${sections}`
            : sections;

        nav.querySelectorAll('.rift-discoveries-workspace-tab').forEach((btn) => {
            btn.addEventListener('click', () => {
                const id = btn.getAttribute('data-discovery-id');
                if (!id) return;
                selectedDiscoveryId = id;
                renderWorkspaceNav();
                renderWorkspaceDetail();
            });
        });
    }

    function renderWorkspaceDetail() {
        const detail = global.document.getElementById('rift-discoveries-workspace-detail');
        if (!detail) return;

        const entry = selectedDiscoveryId ? CATALOG_BY_ID[selectedDiscoveryId] : null;
        const discovered = readDiscoveredIds();

        if (!entry || !discovered.includes(entry.id)) {
            detail.innerHTML = `
                <div class="rift-discoveries-workspace-empty">
                    <p>Select a discovery on the left to read it here.</p>
                </div>
            `;
            return;
        }

        const category = getCategoryMeta(entry.category);
        detail.innerHTML = `
            <article class="rift-discoveries-workspace-article">
                <header class="rift-discoveries-workspace-article-head">
                    <img class="rift-discoveries-workspace-article-icon" src="${escapeHtml(category.icon)}" alt="" aria-hidden="true">
                    <div class="rift-discoveries-workspace-article-titles">
                        <p class="rift-discoveries-workspace-article-category">${escapeHtml(category.label)}</p>
                        <h3 class="rift-discoveries-workspace-article-title">${escapeHtml(entry.title)}</h3>
                        ${entry.subtitle ? `<p class="rift-discoveries-workspace-article-subtitle">${escapeHtml(entry.subtitle)}</p>` : ''}
                    </div>
                </header>
                <div class="rift-discoveries-workspace-article-body">${entry.body}</div>
            </article>
        `;
    }

    function showDiscoveryToast(discoveryId) {
        const entry = CATALOG_BY_ID[discoveryId];
        if (!entry) return;

        const toast = global.document.getElementById('rift-discovery-toast');
        const icon = global.document.getElementById('rift-discovery-toast-icon');
        const title = global.document.getElementById('rift-discovery-toast-title');
        if (!toast || !icon || !title) return;

        const category = getCategoryMeta(entry.category);
        icon.src = category.icon;
        title.textContent = entry.title;
        toast.hidden = false;
        toast.classList.add('is-visible');

        if (toastHideTimer) global.clearTimeout(toastHideTimer);
        toastHideTimer = global.setTimeout(() => {
            hideDiscoveryToast();
        }, 9000);
    }

    function hideDiscoveryToast() {
        const toast = global.document.getElementById('rift-discovery-toast');
        if (!toast) return;
        toast.classList.remove('is-visible');
        toast.hidden = true;
        if (toastHideTimer) {
            global.clearTimeout(toastHideTimer);
            toastHideTimer = null;
        }
    }

    function recordDiscovery(discoveryId, options) {
        const entry = CATALOG_BY_ID[discoveryId];
        if (!entry) return false;

        const opts = options || {};
        const discovered = readDiscoveredIds();
        const isNew = !discovered.includes(discoveryId);
        if (isNew) {
            writeDiscoveredIds([...discovered, discoveryId]);
        }

        if (isNew || opts.forceToast) {
            showDiscoveryToast(discoveryId);
        }

        if (isNew && typeof global.refreshDiscoveriesWorkspace === 'function') {
            global.refreshDiscoveriesWorkspace();
        }

        return isNew;
    }

    function openDiscoveriesWorkspace(event) {
        if (event) {
            event.preventDefault();
            event.stopPropagation();
        }
        if (typeof global.closePortalCommanderIdentityMenu === 'function') {
            global.closePortalCommanderIdentityMenu();
        }
        if (typeof global.playSelectSFX === 'function') {
            global.playSelectSFX();
        }

        ensureModalShell();
        const modal = global.document.getElementById('rift-discoveries-workspace-modal');
        if (!modal) return;

        renderWorkspaceNav();
        renderWorkspaceDetail();

        modal.hidden = false;
        modal.setAttribute('aria-hidden', 'false');
        global.document.body.classList.add('is-rift-discoveries-workspace-open');

        global.document.getElementById('rift-discoveries-workspace-close')?.focus();
    }

    function closeDiscoveriesWorkspace() {
        const modal = global.document.getElementById('rift-discoveries-workspace-modal');
        if (!modal) return;
        modal.hidden = true;
        modal.setAttribute('aria-hidden', 'true');
        global.document.body.classList.remove('is-rift-discoveries-workspace-open');
    }

    function injectDiscoveriesMenuItems() {
        global.document.querySelectorAll('#portal-desktop-commander-menu').forEach((menu) => {
            if (menu.querySelector('[data-commander-menu-action="discoveries"]')) return;

            const settingsBtn = [...menu.querySelectorAll('.dropdown-action-item')].find((btn) => (
                (btn.getAttribute('onclick') || '').includes("'settings'")
            ));
            if (!settingsBtn) return;

            const btn = global.document.createElement('button');
            btn.type = 'button';
            btn.className = 'dropdown-action-item dropdown-action-item-discoveries';
            btn.setAttribute('role', 'menuitem');
            btn.setAttribute('data-commander-menu-action', 'discoveries');
            btn.textContent = 'Discoveries';
            btn.addEventListener('click', (event) => {
                if (typeof global.portalDesktopCommanderMenuAction === 'function') {
                    global.portalDesktopCommanderMenuAction('discoveries', event);
                }
            });
            settingsBtn.insertAdjacentElement('afterend', btn);
        });

        const mobileInsert = (submenu, actionHandlerName) => {
            if (!submenu || submenu.querySelector('[data-commander-menu-action="discoveries"]')) return;
            const settingsBtn = [...submenu.querySelectorAll('.portal-mobile-submenu-item')].find((btn) => (
                (btn.getAttribute('onclick') || '').includes("'settings'")
            ));
            if (!settingsBtn) return;

            const btn = global.document.createElement('button');
            btn.type = 'button';
            btn.className = 'portal-mobile-submenu-item portal-mobile-submenu-item-discoveries';
            btn.setAttribute('data-commander-menu-action', 'discoveries');
            btn.textContent = 'Discoveries';
            btn.addEventListener('click', (event) => {
                if (typeof global[actionHandlerName] === 'function') {
                    global[actionHandlerName]('discoveries', event);
                }
            });
            settingsBtn.insertAdjacentElement('afterend', btn);
        };

        mobileInsert(global.document.getElementById('portal-mobile-commander-submenu'), 'portalMobileNavCommanderAction');
        mobileInsert(global.document.getElementById('game-mobile-commander-submenu'), 'gameMobileNavCommanderAction');
    }

    function bindHandlers() {
        if (menuBindingsReady) return;
        menuBindingsReady = true;

        ensureModalShell();
        injectDiscoveriesMenuItems();

        global.document.getElementById('rift-discoveries-workspace-close')
            ?.addEventListener('click', closeDiscoveriesWorkspace);
        global.document.getElementById('rift-discoveries-workspace-backdrop')
            ?.addEventListener('click', closeDiscoveriesWorkspace);
        global.document.getElementById('rift-discovery-toast-open-btn')
            ?.addEventListener('click', (event) => {
                hideDiscoveryToast();
                openDiscoveriesWorkspace(event);
            });

        global.document.addEventListener('keydown', (event) => {
            if (event.key !== 'Escape') return;
            const modal = global.document.getElementById('rift-discoveries-workspace-modal');
            if (modal && !modal.hidden) {
                closeDiscoveriesWorkspace();
                return;
            }
            hideDiscoveryToast();
        });
    }

    function refreshDiscoveriesWorkspace() {
        if (!global.document.getElementById('rift-discoveries-workspace-modal')
            || global.document.getElementById('rift-discoveries-workspace-modal').hidden) {
            return;
        }
        renderWorkspaceNav();
        renderWorkspaceDetail();
    }

    function initDiscoveriesWorkspace() {
        bindHandlers();
    }

    global.openDiscoveriesWorkspace = openDiscoveriesWorkspace;
    global.closeDiscoveriesWorkspace = closeDiscoveriesWorkspace;
    global.refreshDiscoveriesWorkspace = refreshDiscoveriesWorkspace;
    global.recordDiscovery = recordDiscovery;
    global.getDiscoveryCatalog = () => DISCOVERY_CATALOG.slice();
    global.RoyalArmiesDiscoveries = Object.freeze({
        open: openDiscoveriesWorkspace,
        close: closeDiscoveriesWorkspace,
        record: recordDiscovery,
        catalog: DISCOVERY_CATALOG,
        categories: CATEGORIES
    });

    if (global.document.readyState === 'loading') {
        global.document.addEventListener('DOMContentLoaded', initDiscoveriesWorkspace, { once: true });
    } else {
        initDiscoveriesWorkspace();
    }
})(window);
