/**
 * RIFT — Commander discoveries journal (archives, letters, manuscripts, song manuscripts).
 */
(function initRoyalArmiesDiscoveriesWorkspace(global) {
    'use strict';

    const STORAGE_DISCOVERED = 'royalArmies_discoveredLore_v1';
    const STORAGE_UNREAD = 'royalArmies_unreadDiscoveries_v1';
    const PENDING_STARTER_SONGS_KEY = 'royalArmies_pendingStarterSongDiscoveries';
    const AGE_PAGE_ID = 'age-page-canvas';

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

    const LORE_DISCOVERY_CATALOG = [
        {
            id: 'letter-to-lover',
            category: 'letters',
            kind: 'letter',
            title: 'Letter to Lover',
            subtitle: 'Folded parchment · Crescent Ridge',
            discoveryLine: 'You discovered a letter: Letter to Lover',
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
            kind: 'archive',
            title: 'Declaration of Nobility',
            subtitle: 'Sealed record · Royal Registry',
            discoveryLine: 'You discovered a historical archive: Declaration of Nobility',
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
            kind: 'manuscript',
            title: 'Song of Triumph',
            subtitle: 'Recovered verse · battle canticle',
            discoveryLine: 'You discovered a lost manuscript: Song of Triumph',
            body: `
                <p><em>Lift the banner high, let the valley hear our name —</em></p>
                <p><em>Iron boots on stone, fire in the rain.</em></p>
                <p><em>We broke the gate at dawn, we sang when night withdrew,</em></p>
                <p><em>Not for gold, not for throne, but for the few who saw us through.</em></p>
                <p>Fragments of the final stanza are burned away. Scholars believe the lost couplet named the fallen captains of the Third March.</p>
            `
        }
    ];

    /** @type {Record<string, object>} */
    const CATALOG_BY_ID = Object.create(null);

    let selectedDiscoveryId = null;
    let toastHideTimer = null;
    let toastAdvanceTimer = null;
    let menuBindingsReady = false;
    /** @type {string[][]} batches of discovery ids for sequential toast display */
    const toastQueue = [];
    let toastQueueProcessing = false;
    /** @type {string[]} ids in the currently visible toast */
    let activeToastDiscoveryIds = [];
    let activeToastDiscoveryIndex = 0;

    LORE_DISCOVERY_CATALOG.forEach((entry) => {
        CATALOG_BY_ID[entry.id] = Object.freeze(entry);
    });

    function isAgePage() {
        return (global.document?.body?.id || '') === AGE_PAGE_ID;
    }

    function getCommanderStorageKey(suffix) {
        let username = '';
        if (typeof global.getActiveCommanderUsername === 'function') {
            username = String(global.getActiveCommanderUsername() || '').trim();
        }
        if (!username) {
            const tag = global.document.getElementById('logged-user-tag');
            username = String(tag?.textContent || '').trim();
        }
        if (!username || username.toLowerCase() === 'loading...') {
            return `${suffix}:guest`;
        }
        return `${suffix}:${username.toLowerCase()}`;
    }

    function readJsonStorage(suffix, fallback) {
        try {
            const raw = global.localStorage.getItem(getCommanderStorageKey(suffix));
            if (!raw) return fallback;
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed : fallback;
        } catch (_err) {
            return fallback;
        }
    }

    function writeJsonStorage(suffix, values) {
        try {
            global.localStorage.setItem(getCommanderStorageKey(suffix), JSON.stringify(values));
        } catch (_err) {
            /* ignore quota */
        }
    }

    function readDiscoveredIds() {
        return readJsonStorage(STORAGE_DISCOVERED, []).filter((id) => typeof id === 'string' && CATALOG_BY_ID[id]);
    }

    function readUnreadIds() {
        return readJsonStorage(STORAGE_UNREAD, []).filter((id) => typeof id === 'string' && CATALOG_BY_ID[id]);
    }

    function writeDiscoveredIds(ids) {
        const unique = [...new Set(ids.filter((id) => CATALOG_BY_ID[id]))];
        writeJsonStorage(STORAGE_DISCOVERED, unique);
        return unique;
    }

    function writeUnreadIds(ids) {
        const unique = [...new Set(ids.filter((id) => CATALOG_BY_ID[id]))];
        writeJsonStorage(STORAGE_UNREAD, unique);
        return unique;
    }

    function formatSongTitle(rawTitle) {
        return String(rawTitle || '')
            .replace(/\s+/g, ' ')
            .trim()
            .split(' ')
            .map((word) => {
                if (!word) return '';
                const lower = word.toLowerCase();
                return lower.charAt(0).toUpperCase() + lower.slice(1);
            })
            .join(' ');
    }

    function buildSongManuscriptEntryFromSpec(spec) {
        if (!spec?.trackId) return null;
        const displayTitle = formatSongTitle(spec.title || spec.trackId);
        const nation = String(spec.nation || '').trim() || 'Unknown';
        const id = `song-${spec.trackId}`;
        return Object.freeze({
            id,
            category: 'manuscripts',
            kind: 'song-manuscript',
            trackId: spec.trackId,
            title: displayTitle,
            subtitle: `Song manuscript · ${nation}`,
            discoveryLine: `You discovered a song manuscript: ${displayTitle}`,
            body: String(spec.body || '').trim() || `
                <p>A recovered musical manuscript titled <strong>${escapeHtml(displayTitle)}</strong> has been added to your journal.</p>
                <p>You may replay this melody from the <strong>Music</strong> tab in game chat whenever you are in the Age.</p>
            `
        });
    }

    function buildSongManuscriptEntry(track) {
        if (!track?.id) return null;
        const catalog = global.RoyalArmiesSongManuscriptCatalog;
        const spec = catalog?.getEntry?.(track.id);
        if (spec) {
            return buildSongManuscriptEntryFromSpec(spec);
        }
        return buildSongManuscriptEntryFromSpec({
            trackId: track.id,
            title: track.title,
            nation: 'Unknown',
            body: `
                <p>A recovered musical manuscript titled <strong>${escapeHtml(formatSongTitle(track.title))}</strong> has been added to your journal.</p>
                <p>You may replay this melody from the <strong>Music</strong> tab in game chat whenever you are in the Age.</p>
            `
        });
    }

    function registerCatalogEntry(entry) {
        if (!entry?.id) return;
        CATALOG_BY_ID[entry.id] = Object.freeze(entry);
    }

    function collectAllSoundtrackTrackIds() {
        const ids = new Set();

        const catalog = global.RoyalArmiesSongManuscriptCatalog;
        if (catalog?.allTrackIds) {
            catalog.allTrackIds.forEach((trackId) => ids.add(trackId));
        }

        const flow = global.RoyalArmiesMusicFlow;
        if (flow) {
            if (typeof flow.getAllAgeSoundtrackTrackIds === 'function') {
                flow.getAllAgeSoundtrackTrackIds().forEach((trackId) => ids.add(trackId));
            } else {
                if (typeof flow.getStarterPlaylistTrackIds === 'function') {
                    flow.getStarterPlaylistTrackIds().forEach((trackId) => ids.add(trackId));
                }
                if (typeof flow.getDiscoverableTracks === 'function') {
                    flow.getDiscoverableTracks().forEach((track) => ids.add(track.id));
                }
            }
        }

        return [...ids];
    }

    function registerMusicDiscoveryCatalog() {
        const catalog = global.RoyalArmiesSongManuscriptCatalog;
        const flow = global.RoyalArmiesMusicFlow;

        if (catalog?.entries) {
            catalog.entries.forEach((spec) => {
                registerCatalogEntry(buildSongManuscriptEntryFromSpec(spec));
            });
        }

        collectAllSoundtrackTrackIds().forEach((trackId) => {
            const catalogId = `song-${trackId}`;
            if (CATALOG_BY_ID[catalogId]) return;

            const track = flow?.getTrackDefinitionById?.(trackId) || { id: trackId, title: trackId };
            const entry = buildSongManuscriptEntry(track);
            if (entry) registerCatalogEntry(entry);
        });
    }

    function getCategoryMeta(categoryId) {
        return CATEGORY_BY_ID[categoryId] || CATEGORIES[0];
    }

    function getDiscoveryLine(entry) {
        if (entry.discoveryLine) return entry.discoveryLine;
        return `You discovered: ${entry.title}`;
    }

    function escapeHtml(value) {
        return String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function hasUnreadDiscoveries() {
        return readUnreadIds().length > 0;
    }

    function markDiscoveryRead(discoveryId) {
        const normalized = String(discoveryId || '').trim();
        if (!normalized) return;
        const unread = readUnreadIds().filter((id) => id !== normalized);
        writeUnreadIds(unread);
        syncUnreadIndicators();
    }

    function markAllDiscoveriesRead() {
        writeUnreadIds([]);
        syncUnreadIndicators();
    }

    function syncUnreadIndicators() {
        const unread = new Set(readUnreadIds());
        const menuUnread = hasUnreadDiscoveries();

        global.document.querySelectorAll('[data-commander-menu-action="discoveries"]').forEach((btn) => {
            btn.classList.toggle('has-discovery-unread', menuUnread);
        });

        global.document.querySelectorAll('.rift-discoveries-workspace-tab').forEach((tab) => {
            const id = tab.getAttribute('data-discovery-id');
            tab.classList.toggle('has-discovery-unread', Boolean(id && unread.has(id)));
        });
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
                <p class="rift-discovery-toast-kicker">You just made a discovery!</p>
                <div class="rift-discovery-toast-divider" aria-hidden="true"></div>
                <div class="rift-discovery-toast-icon-row" id="rift-discovery-toast-icon-row"></div>
                <p class="rift-discovery-toast-category" id="rift-discovery-toast-category"></p>
                <p class="rift-discovery-toast-line" id="rift-discovery-toast-line"></p>
                <p class="rift-discovery-toast-footnote">
                    Visit the <button type="button" class="rift-discovery-toast-link" id="rift-discovery-toast-open-link">Discoveries</button> page
                </p>
                <button type="button" class="rift-discovery-toast-dismiss" id="rift-discovery-toast-dismiss" aria-label="Dismiss discovery notice">×</button>
            </div>
        `;
        global.document.body.appendChild(toast);
    }

    function listCatalogEntries() {
        return Object.keys(CATALOG_BY_ID).map((id) => CATALOG_BY_ID[id]);
    }

    function buildWorkspaceTabMarkup(entry, isActive, isUnread) {
        return `
            <button type="button" class="rift-discoveries-workspace-tab${isActive ? ' is-active' : ''}${isUnread ? ' has-discovery-unread' : ''}" data-discovery-id="${escapeHtml(entry.id)}">
                <span class="rift-discovery-unread-dot" aria-hidden="true"></span>
                <span class="rift-discoveries-workspace-tab-label">${escapeHtml(entry.title)}</span>
            </button>
        `;
    }

    function renderWorkspaceNav() {
        const nav = global.document.getElementById('rift-discoveries-workspace-nav');
        if (!nav) return;

        const discovered = readDiscoveredIds();
        const unread = new Set(readUnreadIds());

        if (!selectedDiscoveryId || !discovered.includes(selectedDiscoveryId)) {
            selectedDiscoveryId = discovered[0] || null;
        }

        const sections = CATEGORIES.map((category) => {
            const items = listCatalogEntries()
                .filter((entry) => entry.category === category.id && discovered.includes(entry.id))
                .sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }));

            if (!items.length) {
                return '';
            }

            const tabs = items.map((entry) => buildWorkspaceTabMarkup(
                entry,
                entry.id === selectedDiscoveryId,
                unread.has(entry.id)
            )).join('');

            return `
                <section class="rift-discoveries-workspace-category" data-category-id="${escapeHtml(category.id)}">
                    <header class="rift-discoveries-workspace-category-head">
                        <img class="rift-discoveries-workspace-category-icon" src="${escapeHtml(category.icon)}" alt="" aria-hidden="true">
                        <h3 class="rift-discoveries-workspace-category-title">${escapeHtml(category.label)}</h3>
                    </header>
                    <div class="rift-discoveries-workspace-tab-list">${tabs}</div>
                </section>
            `;
        }).filter(Boolean).join('');

        const emptyJournal = discovered.length === 0;
        nav.innerHTML = emptyJournal
            ? `<div class="rift-discoveries-workspace-nav-empty">
                    <p>You have not recorded any discoveries yet.</p>
                    <p class="rift-discoveries-workspace-nav-hint">Explore the Age map to uncover letters, archives, manuscripts, and songs.</p>
               </div>${sections}`
            : sections;

        nav.querySelectorAll('.rift-discoveries-workspace-tab').forEach((btn) => {
            btn.addEventListener('click', () => {
                const id = btn.getAttribute('data-discovery-id');
                if (!id) return;
                selectedDiscoveryId = id;
                markDiscoveryRead(id);
                renderWorkspaceNav();
                renderWorkspaceDetail();
            });
        });

        syncUnreadIndicators();
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
                <p class="rift-discoveries-workspace-article-discovery-line">${escapeHtml(getDiscoveryLine(entry))}</p>
                <div class="rift-discoveries-workspace-article-body">${entry.body}</div>
            </article>
        `;
    }

    function renderToastDiscoveryIndex(index) {
        const entry = CATALOG_BY_ID[activeToastDiscoveryIds[index]];
        if (!entry) return;

        const category = getCategoryMeta(entry.category);
        const categoryEl = global.document.getElementById('rift-discovery-toast-category');
        const lineEl = global.document.getElementById('rift-discovery-toast-line');
        const iconRow = global.document.getElementById('rift-discovery-toast-icon-row');

        if (categoryEl) categoryEl.textContent = category.label;
        if (lineEl) lineEl.textContent = getDiscoveryLine(entry);

        iconRow?.querySelectorAll('.rift-discovery-toast-icon-btn').forEach((btn, btnIndex) => {
            btn.classList.toggle('is-active', btnIndex === index);
        });
    }

    function showDiscoveryToastForIds(discoveryIds) {
        const ids = discoveryIds.filter((id) => CATALOG_BY_ID[id]);
        if (!ids.length) return Promise.resolve();

        ensureModalShell();

        const toast = global.document.getElementById('rift-discovery-toast');
        const iconRow = global.document.getElementById('rift-discovery-toast-icon-row');
        if (!toast || !iconRow) return Promise.resolve();

        activeToastDiscoveryIds = ids;
        activeToastDiscoveryIndex = 0;

        iconRow.innerHTML = ids.map((id, index) => {
            const entry = CATALOG_BY_ID[id];
            const category = getCategoryMeta(entry.category);
            return `
                <button type="button" class="rift-discovery-toast-icon-btn${index === 0 ? ' is-active' : ''}" data-toast-discovery-index="${index}" title="${escapeHtml(entry.title)}">
                    <img src="${escapeHtml(category.icon)}" alt="" aria-hidden="true">
                </button>
            `;
        }).join('');

        iconRow.querySelectorAll('.rift-discovery-toast-icon-btn').forEach((btn) => {
            btn.addEventListener('click', () => {
                const index = Number.parseInt(btn.getAttribute('data-toast-discovery-index'), 10);
                if (!Number.isFinite(index)) return;
                activeToastDiscoveryIndex = index;
                renderToastDiscoveryIndex(index);
            });
        });

        renderToastDiscoveryIndex(0);

        toast.hidden = false;
        toast.classList.add('is-visible');

        if (toastHideTimer) global.clearTimeout(toastHideTimer);
        if (toastAdvanceTimer) global.clearTimeout(toastAdvanceTimer);

        return new Promise((resolve) => {
            toastAdvanceTimer = global.setTimeout(() => {
                hideDiscoveryToast();
                resolve();
            }, ids.length > 1 ? 14000 : 11000);
        });
    }

    function hideDiscoveryToast() {
        const toast = global.document.getElementById('rift-discovery-toast');
        if (!toast) return;
        toast.classList.remove('is-visible');
        toast.hidden = true;
        activeToastDiscoveryIds = [];
        activeToastDiscoveryIndex = 0;
        if (toastHideTimer) {
            global.clearTimeout(toastHideTimer);
            toastHideTimer = null;
        }
        if (toastAdvanceTimer) {
            global.clearTimeout(toastAdvanceTimer);
            toastAdvanceTimer = null;
        }
    }

    async function processToastQueue() {
        if (toastQueueProcessing) return;
        toastQueueProcessing = true;

        while (toastQueue.length) {
            const batch = toastQueue.shift();
            if (!batch?.length) continue;
            await showDiscoveryToastForIds(batch);
            await new Promise((resolve) => {
                global.setTimeout(resolve, 350);
            });
        }

        toastQueueProcessing = false;
    }

    function enqueueDiscoveryToast(discoveryIds, options) {
        const opts = options || {};
        const ids = discoveryIds.filter((id) => CATALOG_BY_ID[id]);
        if (!ids.length || opts.silentToast) return;

        if (opts.sequential) {
            ids.forEach((id) => toastQueue.push([id]));
        } else {
            toastQueue.push(ids);
        }

        processToastQueue();
    }

    function recordDiscovery(discoveryId, options) {
        const entry = CATALOG_BY_ID[discoveryId];
        if (!entry) return false;

        const opts = options || {};
        const discovered = readDiscoveredIds();
        const isNew = !discovered.includes(discoveryId);

        if (isNew) {
            writeDiscoveredIds([...discovered, discoveryId]);
            const unread = readUnreadIds();
            if (!unread.includes(discoveryId)) {
                writeUnreadIds([...unread, discoveryId]);
            }
        } else if (opts.markUnread) {
            const unread = readUnreadIds();
            if (!unread.includes(discoveryId)) {
                writeUnreadIds([...unread, discoveryId]);
            }
        }

        syncUnreadIndicators();

        if (!opts.silentToast) {
            if (opts.sequentialQueue) {
                enqueueDiscoveryToast([discoveryId], { sequential: true });
            } else if (Array.isArray(opts.batchWith) && opts.batchWith.length) {
                enqueueDiscoveryToast([discoveryId, ...opts.batchWith]);
            } else {
                enqueueDiscoveryToast([discoveryId]);
            }
        }

        if (typeof global.refreshDiscoveriesWorkspace === 'function') {
            global.refreshDiscoveriesWorkspace();
        }

        return isNew;
    }

    function recordSongDiscovery(trackId, options) {
        registerMusicDiscoveryCatalog();
        const normalized = String(trackId || '').trim().toLowerCase();
        return recordDiscovery(`song-${normalized}`, options);
    }

    function readPendingStarterSongs() {
        try {
            return global.sessionStorage.getItem(PENDING_STARTER_SONGS_KEY) === '1';
        } catch (_err) {
            return false;
        }
    }

    function clearPendingStarterSongs() {
        try {
            global.sessionStorage.removeItem(PENDING_STARTER_SONGS_KEY);
        } catch (_err) {
            /* ignore */
        }
    }

    function runPendingStarterSongDiscoveries() {
        if (!isAgePage() || !readPendingStarterSongs()) return;

        clearPendingStarterSongs();
        registerMusicDiscoveryCatalog();

        const flow = global.RoyalArmiesMusicFlow;
        const starterIds = flow && typeof flow.getStarterPlaylistTrackIds === 'function'
            ? flow.getStarterPlaylistTrackIds()
            : [];

        const discoveryIds = starterIds
            .map((trackId) => `song-${trackId}`)
            .filter((id) => CATALOG_BY_ID[id]);

        discoveryIds.forEach((id) => {
            recordDiscovery(id, { silentToast: true });
        });

        discoveryIds.forEach((id) => {
            enqueueDiscoveryToast([id], { sequential: true });
        });
    }

    function openDiscoveriesWorkspace(event, focusDiscoveryId) {
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

        hideDiscoveryToast();
        ensureModalShell();

        if (focusDiscoveryId && CATALOG_BY_ID[focusDiscoveryId]) {
            selectedDiscoveryId = focusDiscoveryId;
        }

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

    function buildDiscoveriesMenuInnerHtml(labelClass) {
        const labelCls = labelClass || 'dropdown-action-item-label';
        return `
            <span class="commander-menu-side-slot commander-menu-side-slot--lead" aria-hidden="true">
                <span class="rift-discovery-unread-dot" aria-hidden="true"></span>
            </span>
            <span class="${labelCls}">Discoveries</span>
            <span class="commander-menu-side-slot commander-menu-side-slot--trail" aria-hidden="true"></span>
        `.trim();
    }

    function upgradeDiscoveriesMenuButtons() {
        global.document.querySelectorAll('[data-commander-menu-action="discoveries"]').forEach((btn) => {
            if (btn.querySelector('.commander-menu-side-slot--trail')) return;
            btn.innerHTML = buildDiscoveriesMenuInnerHtml();
        });
    }

    function injectDiscoveriesMenuItems() {
        const buildDesktopBtn = () => {
            const btn = global.document.createElement('button');
            btn.type = 'button';
            btn.className = 'dropdown-action-item dropdown-action-item-discoveries';
            btn.setAttribute('role', 'menuitem');
            btn.setAttribute('data-commander-menu-action', 'discoveries');
            btn.innerHTML = buildDiscoveriesMenuInnerHtml();
            btn.addEventListener('click', (event) => {
                if (typeof global.portalDesktopCommanderMenuAction === 'function') {
                    global.portalDesktopCommanderMenuAction('discoveries', event);
                }
            });
            return btn;
        };

        global.document.querySelectorAll('#portal-desktop-commander-menu').forEach((menu) => {
            const existing = menu.querySelector('[data-commander-menu-action="discoveries"]');
            if (existing) {
                upgradeDiscoveriesMenuButtons();
                return;
            }

            const settingsBtn = [...menu.querySelectorAll('.dropdown-action-item')].find((btn) => (
                (btn.getAttribute('onclick') || '').includes("'settings'")
            ));
            if (!settingsBtn) return;

            settingsBtn.insertAdjacentElement('afterend', buildDesktopBtn());
        });

        const mobileInsert = (submenu, actionHandlerName) => {
            const existing = submenu?.querySelector('[data-commander-menu-action="discoveries"]');
            if (existing) {
                upgradeDiscoveriesMenuButtons();
                return;
            }
            if (!submenu) return;
            const settingsBtn = [...submenu.querySelectorAll('.portal-mobile-submenu-item')].find((btn) => (
                (btn.getAttribute('onclick') || '').includes("'settings'")
            ));
            if (!settingsBtn) return;

            const btn = global.document.createElement('button');
            btn.type = 'button';
            btn.className = 'portal-mobile-submenu-item portal-mobile-submenu-item-discoveries';
            btn.setAttribute('data-commander-menu-action', 'discoveries');
            btn.innerHTML = buildDiscoveriesMenuInnerHtml('portal-mobile-submenu-label');
            btn.addEventListener('click', (event) => {
                if (typeof global[actionHandlerName] === 'function') {
                    global[actionHandlerName]('discoveries', event);
                }
            });
            settingsBtn.insertAdjacentElement('afterend', btn);
        };

        mobileInsert(global.document.getElementById('portal-mobile-commander-submenu'), 'portalMobileNavCommanderAction');
        mobileInsert(global.document.getElementById('game-mobile-commander-submenu'), 'gameMobileNavCommanderAction');

        upgradeDiscoveriesMenuButtons();
        syncUnreadIndicators();
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
        global.document.getElementById('rift-discovery-toast-open-link')
            ?.addEventListener('click', (event) => {
                const focusId = activeToastDiscoveryIds[activeToastDiscoveryIndex] || null;
                hideDiscoveryToast();
                openDiscoveriesWorkspace(event, focusId);
            });
        global.document.getElementById('rift-discovery-toast-dismiss')
            ?.addEventListener('click', hideDiscoveryToast);

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
        const modal = global.document.getElementById('rift-discoveries-workspace-modal');
        if (!modal || modal.hidden) {
            syncUnreadIndicators();
            return;
        }
        renderWorkspaceNav();
        renderWorkspaceDetail();
    }

    function initDiscoveriesWorkspace() {
        registerMusicDiscoveryCatalog();
        bindHandlers();
        syncUnreadIndicators();
    }

    global.openDiscoveriesWorkspace = openDiscoveriesWorkspace;
    global.closeDiscoveriesWorkspace = closeDiscoveriesWorkspace;
    global.refreshDiscoveriesWorkspace = refreshDiscoveriesWorkspace;
    global.recordDiscovery = recordDiscovery;
    global.recordSongDiscovery = recordSongDiscovery;
    global.markDiscoveryRead = markDiscoveryRead;
    global.getDiscoveryCatalog = () => Object.keys(CATALOG_BY_ID).map((id) => CATALOG_BY_ID[id]);

    global.RoyalArmiesDiscoveries = Object.freeze({
        open: openDiscoveriesWorkspace,
        close: closeDiscoveriesWorkspace,
        record: recordDiscovery,
        recordSong: recordSongDiscovery,
        runPendingStarterSongDiscoveries,
        registerMusicCatalog: registerMusicDiscoveryCatalog,
        categories: CATEGORIES
    });

    global.addEventListener('royalarmies:music-flow-ready', registerMusicDiscoveryCatalog);

    if (global.document.readyState === 'loading') {
        global.document.addEventListener('DOMContentLoaded', initDiscoveriesWorkspace, { once: true });
    } else {
        initDiscoveriesWorkspace();
    }
})(window);
