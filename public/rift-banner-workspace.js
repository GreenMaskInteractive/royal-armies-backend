/**
 * RIFT — Church banner blessings and Banner skill-tree workspace (Game Hub).
 */
(function initRoyalArmiesBannerWorkspace(global) {
    'use strict';

    const STORAGE_KEY = 'royalarmies:age-banner-state';
    const LEGACY_BLESSING_KEY = 'royalarmies:age-banner-blessing-id';
    const IMAGE_BUST = 'church-banners-1';

    function createDefaultBannerState() {
        return {
            bannerId: '',
            swapUsed: false,
            perkPoints: 0,
            unlockedPerkIds: []
        };
    }

    const BANNER_CATALOG = Object.freeze([
        {
            id: 'true-war',
            title: 'True War Banner',
            image: `images/truewarbanner.png?v=${IMAGE_BUST}`,
            rune: 'Rune of Valiance',
            lore: 'A mark of unending victory and a strong, ferocious army. This banner is blessed with the Rune of Valiance.',
            perks: Object.freeze([
                {
                    id: 'true-war-double-strike',
                    title: 'Valiance Strike',
                    desc: '50% chance of injured INFANTRY units attacking twice during a battle at 50% of their base HP.'
                },
                {
                    id: 'true-war-infantry-attack',
                    title: 'Ferocious Line',
                    desc: '+7 Attack increase toward all infantry units.'
                },
                {
                    id: 'true-war-pvp-rank',
                    title: 'Higher Ground',
                    desc: '+3 Attack increase when facing armies of greater rank in PvP.'
                }
            ])
        },
        {
            id: 'sachiels-blessing',
            title: "Sachiel's Blessing Banner",
            image: `images/sachielsblessingbanner.png?v=${IMAGE_BUST}`,
            rune: 'Rune of Revitalization',
            lore: "Known to bring life back to many lost souls, this banner was blessed by an Angel through the Rune of Revitalization. It radiates a healing aura.",
            perks: Object.freeze([
                {
                    id: 'sachiels-revive',
                    title: 'Revitalization Surge',
                    desc: '30% chance of 50% of all injured units being revived after a battle.'
                },
                {
                    id: 'sachiels-hp-boost',
                    title: 'Restored Vigour',
                    desc: '5% chance of granting a temporary +50 HP boost to a portion of the army after a battle.'
                },
                {
                    id: 'sachiels-move-points',
                    title: 'Angelic March',
                    desc: 'Small chance of receiving 3 additional move points.'
                }
            ])
        },
        {
            id: 'emerald-barrier',
            title: 'Emerald Barrier Banner',
            image: `images/emeraldbarrierbanner.png?v=${IMAGE_BUST}`,
            rune: 'Rune of Fortification',
            lore: 'Reputed for maintaining an impenetrable wall of defense and causing stalemates. Blessed with the Rune of Fortification.',
            perks: Object.freeze([
                {
                    id: 'emerald-pvp-defense',
                    title: 'Impenetrable Wall',
                    desc: '15% HP and 25% Attack increase when defending against a PvP army of same rank or higher.'
                },
                {
                    id: 'emerald-fortified-city',
                    title: 'Fortified Bastion',
                    desc: 'When stationed on a fortified city or capital, instantly receive +250 DEFENSE HP.'
                },
                {
                    id: 'emerald-mountains',
                    title: 'Mountain Ward',
                    desc: '+2 bonus on Mountains terrain.'
                }
            ])
        },
        {
            id: 'fortunes-gratitude',
            title: "Fortune's Gratitude Banner",
            image: `images/fortunesgratitudebanner.png?v=${IMAGE_BUST}`,
            rune: 'Rune of Hinshuro',
            lore: 'Known as the Merchant Flag of Ultimate Trade, passed down through generations of tradesmen. Blessed with the Rune of Hinshuro to aid residential and commercial growth.',
            perks: Object.freeze([
                {
                    id: 'fortunes-tick-income',
                    title: 'Merchant Tithe',
                    desc: 'Receive a small amount of currency at every tick based on rank.'
                },
                {
                    id: 'fortunes-victory-currency',
                    title: 'Victory Dividend',
                    desc: 'Receive 50% more victory currency after any battle.'
                },
                {
                    id: 'fortunes-expense-reduction',
                    title: 'Hinshuro Ledger',
                    desc: '3% reduction cost toward all expenses.'
                }
            ])
        }
    ]);

    const BANNER_BY_ID = Object.freeze(
        BANNER_CATALOG.reduce((map, entry) => {
            map[entry.id] = entry;
            return map;
        }, {})
    );

    let selectedPerkId = null;
    let toastDismissResolver = null;
    let handlersBound = false;

    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function normalizeBannerState(raw) {
        const state = createDefaultBannerState();
        if (!raw || typeof raw !== 'object') return state;

        const bannerId = String(raw.bannerId || '').trim();
        if (bannerId && BANNER_BY_ID[bannerId]) {
            state.bannerId = bannerId;
        }

        state.swapUsed = Boolean(raw.swapUsed);
        state.perkPoints = Math.max(0, Math.floor(Number(raw.perkPoints) || 0));

        const unlocked = Array.isArray(raw.unlockedPerkIds) ? raw.unlockedPerkIds : [];
        state.unlockedPerkIds = [...new Set(unlocked.map((id) => String(id || '').trim()).filter(Boolean))];

        return state;
    }

    function readBannerState() {
        try {
            const raw = global.localStorage.getItem(STORAGE_KEY);
            if (raw) {
                return normalizeBannerState(JSON.parse(raw));
            }

            const legacyId = String(global.localStorage.getItem(LEGACY_BLESSING_KEY) || '').trim();
            if (legacyId && BANNER_BY_ID[legacyId]) {
                const migrated = normalizeBannerState({ bannerId: legacyId });
                writeBannerState(migrated);
                global.localStorage.removeItem(LEGACY_BLESSING_KEY);
                return migrated;
            }
        } catch (_error) {
            /* fall through */
        }
        return createDefaultBannerState();
    }

    function writeBannerState(state) {
        try {
            global.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizeBannerState(state)));
            return true;
        } catch (_error) {
            return false;
        }
    }

    function readChosenBannerId() {
        return readBannerState().bannerId;
    }

    function getChosenBanner() {
        const id = readChosenBannerId();
        return id ? BANNER_BY_ID[id] : null;
    }

    function canSwapBlessing() {
        const state = readBannerState();
        return Boolean(state.bannerId && !state.swapUsed);
    }

    function resetBannerPerkProgress(state) {
        const next = state || readBannerState();
        next.perkPoints = 0;
        next.unlockedPerkIds = [];
        return next;
    }

    async function confirmBannerSwap(fromBannerId, toBannerId) {
        const fromBanner = BANNER_BY_ID[fromBannerId];
        const toBanner = BANNER_BY_ID[toBannerId];
        if (!fromBanner || !toBanner) return false;

        const message = (
            `Renounce the ${fromBanner.title} and receive the ${toBanner.title}? `
            + 'You may swap your blessed banner only once throughout this Age. '
            + 'All banner perk points and unlocked perks will be reset—you must earn them again.'
        );

        if (typeof global.showPortalConfirm === 'function') {
            return global.showPortalConfirm(message, {
                title: 'Swap Blessed Banner',
                confirmLabel: 'Swap Blessing',
                cancelLabel: 'Keep Current Banner'
            });
        }

        return Boolean(global.confirm(message));
    }

    function playBlessingToastSfx() {
        if (typeof global.playDiscoverySwooshSfx === 'function') {
            global.playDiscoverySwooshSfx();
        }
        if (typeof global.scheduleDiscoveryChimeSfx === 'function') {
            global.scheduleDiscoveryChimeSfx();
        }
    }

    function ensureShell() {
        if (global.document.getElementById('rift-banner-workspace-modal')) return;

        const modal = global.document.createElement('div');
        modal.id = 'rift-banner-workspace-modal';
        modal.className = 'rift-banner-workspace-modal';
        modal.hidden = true;
        modal.setAttribute('aria-hidden', 'true');
        modal.innerHTML = `
            <div class="rift-banner-workspace-backdrop" id="rift-banner-workspace-backdrop" aria-hidden="true"></div>
            <div class="rift-banner-workspace-dialog" role="dialog" aria-modal="true" aria-labelledby="rift-banner-workspace-title">
                <header class="rift-banner-workspace-header">
                    <div class="rift-banner-workspace-heading-block">
                        <p class="rift-banner-workspace-eyebrow">Blessed heraldry</p>
                        <h2 id="rift-banner-workspace-title" class="rift-banner-workspace-title">Banner Perk Tree</h2>
                    </div>
                    <button type="button" id="rift-banner-workspace-close" class="rift-banner-workspace-close" aria-label="Close banner workspace">×</button>
                </header>
                <div class="rift-banner-workspace-body" id="rift-banner-workspace-body"></div>
            </div>
        `;
        global.document.body.appendChild(modal);

        const toast = global.document.createElement('div');
        toast.id = 'rift-banner-blessing-toast';
        toast.className = 'rift-banner-blessing-toast';
        toast.hidden = true;
        toast.setAttribute('role', 'status');
        toast.setAttribute('aria-live', 'polite');
        toast.innerHTML = `
            <div class="rift-banner-blessing-toast-scrim" id="rift-banner-blessing-toast-scrim" aria-hidden="true"></div>
            <div class="rift-banner-blessing-toast-stage" role="dialog" aria-modal="true" aria-labelledby="rift-banner-blessing-toast-title">
                <div class="rift-banner-blessing-toast-panel">
                    <div class="rift-banner-blessing-toast-glow" aria-hidden="true"></div>
                    <div class="rift-banner-blessing-toast-rays" aria-hidden="true"></div>
                    <button type="button" class="rift-banner-blessing-toast-dismiss" id="rift-banner-blessing-toast-dismiss" aria-label="Dismiss blessing notice">×</button>
                    <p class="rift-banner-blessing-toast-eyebrow">Blessing received</p>
                    <h2 id="rift-banner-blessing-toast-title" class="rift-banner-blessing-toast-kicker">You have chosen a blessing!</h2>
                    <div class="rift-banner-blessing-toast-divider" aria-hidden="true"></div>
                    <div class="rift-banner-blessing-toast-banner-visual" id="rift-banner-blessing-toast-banner-visual"></div>
                    <p class="rift-banner-blessing-toast-line" id="rift-banner-blessing-toast-line"></p>
                    <p class="rift-banner-blessing-toast-footnote">
                        Open your <button type="button" class="rift-banner-blessing-toast-link" id="rift-banner-blessing-toast-open-link">Banner</button> perk tree to review your gifts.
                    </p>
                </div>
            </div>
        `;
        global.document.body.appendChild(toast);
    }

    function renderBannerPerkTreeMarkup(banner, focusPerkId, bannerState) {
        if (!banner) {
            return `
                <div class="rift-banner-workspace-empty">
                    <p class="rift-banner-workspace-empty-title">No banner blessing yet</p>
                    <p class="rift-banner-workspace-empty-copy">Visit the Church at your settlement to receive a blessed banner and unlock your personal perk tree.</p>
                </div>
            `;
        }

        const state = bannerState || readBannerState();
        const unlockedPerkIds = new Set(state.unlockedPerkIds || []);
        const perks = banner.perks || [];
        if (!selectedPerkId || !perks.some((perk) => perk.id === selectedPerkId)) {
            selectedPerkId = focusPerkId && perks.some((perk) => perk.id === focusPerkId)
                ? focusPerkId
                : (perks[0]?.id || null);
        }

        const activePerk = perks.find((perk) => perk.id === selectedPerkId) || perks[0] || null;

        const treeNodes = perks.map((perk, index) => {
            const isActive = perk.id === activePerk?.id;
            const isUnlocked = unlockedPerkIds.has(perk.id);
            const isLast = index === perks.length - 1;
            return `
                <li class="rift-banner-skill-node${isActive ? ' is-active' : ''}${isUnlocked ? ' is-unlocked' : ' is-locked'}">
                    <button type="button" class="rift-banner-skill-node-btn" data-banner-perk-id="${escapeHtml(perk.id)}">
                        <span class="rift-banner-skill-node-orbit" aria-hidden="true"></span>
                        <span class="rift-banner-skill-node-label">${escapeHtml(perk.title)}</span>
                        <span class="rift-banner-skill-node-status">${isUnlocked ? 'Unlocked' : 'Locked'}</span>
                    </button>
                    ${isLast ? '' : '<span class="rift-banner-skill-connector" aria-hidden="true"></span>'}
                </li>
            `;
        }).join('');

        const swapNote = state.swapUsed
            ? 'Banner swap spent for this Age.'
            : 'One banner swap remains this Age. Swapping resets all perk points.';

        return `
            <div class="rift-banner-workspace-status" role="status">
                <p class="rift-banner-workspace-points">Banner perk points: <strong>${escapeHtml(state.perkPoints)}</strong></p>
                <p class="rift-banner-workspace-swap-note">${escapeHtml(swapNote)}</p>
            </div>
            <div class="rift-banner-workspace-layout">
                <aside class="rift-banner-workspace-tree" aria-label="Banner perk tree">
                    <div class="rift-banner-workspace-heraldry">
                        <div class="rift-banner-workspace-heraldry-rays" aria-hidden="true"></div>
                        <img class="rift-banner-workspace-heraldry-image" src="${escapeHtml(banner.image)}" alt="">
                        <p class="rift-banner-workspace-heraldry-title">${escapeHtml(banner.title)}</p>
                        <p class="rift-banner-workspace-heraldry-rune">${escapeHtml(banner.rune)}</p>
                    </div>
                    <ol class="rift-banner-skill-tree">${treeNodes}</ol>
                </aside>
                <section class="rift-banner-workspace-detail" aria-label="Selected perk details">
                    ${activePerk ? `
                        <h3 class="rift-banner-workspace-detail-title">${escapeHtml(activePerk.title)}</h3>
                        <p class="rift-banner-workspace-detail-copy">${escapeHtml(activePerk.desc)}</p>
                        <p class="rift-banner-workspace-detail-note">${unlockedPerkIds.has(activePerk.id)
                            ? 'This perk is unlocked on your banner tree.'
                            : 'Spend banner perk points to unlock this node.'}</p>
                    ` : `
                        <div class="rift-banner-workspace-empty">
                            <p>Select a perk node to read its blessing.</p>
                        </div>
                    `}
                </section>
            </div>
        `;
    }

    function renderBannerWorkspaceBody(focusPerkId) {
        const body = global.document.getElementById('rift-banner-workspace-body');
        if (!body) return;
        const banner = getChosenBanner();
        body.innerHTML = renderBannerPerkTreeMarkup(banner, focusPerkId);
    }

    function resolveBlessingToastDismissed() {
        if (!toastDismissResolver) return;
        const resolve = toastDismissResolver;
        toastDismissResolver = null;
        resolve();
    }

    function finalizeBlessingToastHide() {
        const toast = global.document.getElementById('rift-banner-blessing-toast');
        if (!toast) return;
        toast.classList.remove('is-visible', 'is-exiting');
        toast.hidden = true;
        global.document.body.classList.remove('is-rift-banner-blessing-toast-open');
        resolveBlessingToastDismissed();
    }

    function hideBannerBlessingToast() {
        const toast = global.document.getElementById('rift-banner-blessing-toast');
        if (!toast || toast.hidden) return;
        if (toast.classList.contains('is-exiting')) return;
        toast.classList.remove('is-visible');
        toast.classList.add('is-exiting');
        global.setTimeout(finalizeBlessingToastHide, 320);
    }

    function showBannerBlessingToast(bannerId, options = {}) {
        const banner = BANNER_BY_ID[String(bannerId || '').trim()];
        if (!banner) return Promise.resolve();
        const swapped = Boolean(options.swapped);

        ensureShell();

        const toast = global.document.getElementById('rift-banner-blessing-toast');
        const visual = global.document.getElementById('rift-banner-blessing-toast-banner-visual');
        const line = global.document.getElementById('rift-banner-blessing-toast-line');
        if (!toast || !visual || !line) return Promise.resolve();

        visual.innerHTML = `
            <div class="rift-banner-blessing-toast-banner-frame">
                <div class="rift-banner-blessing-toast-banner-rays" aria-hidden="true"></div>
                <img src="${escapeHtml(banner.image)}" alt="${escapeHtml(banner.title)}">
            </div>
            <p class="rift-banner-blessing-toast-banner-name">${escapeHtml(banner.title)}</p>
        `;
        const toastEyebrow = global.document.querySelector('#rift-banner-blessing-toast .rift-banner-blessing-toast-eyebrow');
        const toastKicker = global.document.getElementById('rift-banner-blessing-toast-title');
        if (toastEyebrow) {
            toastEyebrow.textContent = swapped ? 'Blessing exchanged' : 'Blessing received';
        }
        if (toastKicker) {
            toastKicker.textContent = swapped
                ? 'Your banner blessing has been exchanged!'
                : 'You have chosen a blessing!';
        }

        line.textContent = swapped
            ? `${banner.lore} Your banner perk tree has been reset—earn points again to unlock its gifts.`
            : `${banner.lore} Your banner perks are now available in the Game Hub.`;

        toast.hidden = false;
        toast.classList.remove('is-exiting');
        global.document.body.classList.add('is-rift-banner-blessing-toast-open');
        toast.classList.remove('is-visible');
        void toast.offsetWidth;
        toast.classList.add('is-visible');
        playBlessingToastSfx();

        return new Promise((resolve) => {
            toastDismissResolver = resolve;
        });
    }

    function openBannerWorkspace(event, focusPerkId) {
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

        hideBannerBlessingToast();
        ensureShell();
        renderBannerWorkspaceBody(focusPerkId);

        const modal = global.document.getElementById('rift-banner-workspace-modal');
        if (!modal) return;

        modal.hidden = false;
        modal.setAttribute('aria-hidden', 'false');
        global.document.body.classList.add('is-rift-banner-workspace-open');
        global.document.getElementById('rift-banner-workspace-close')?.focus();
    }

    function closeBannerWorkspace() {
        const modal = global.document.getElementById('rift-banner-workspace-modal');
        if (!modal) return;
        modal.hidden = true;
        modal.setAttribute('aria-hidden', 'true');
        global.document.body.classList.remove('is-rift-banner-workspace-open');
    }

    async function chooseBlessing(bannerId) {
        const id = String(bannerId || '').trim();
        const banner = BANNER_BY_ID[id];
        if (!banner) return false;

        const state = readBannerState();
        const existingId = state.bannerId;
        if (existingId === id) return false;

        let swapped = false;

        if (existingId) {
            if (state.swapUsed) return false;
            const confirmed = await confirmBannerSwap(existingId, id);
            if (!confirmed) return false;
            resetBannerPerkProgress(state);
            state.swapUsed = true;
            swapped = true;
        }

        state.bannerId = id;
        if (!writeBannerState(state)) return false;

        global.dispatchEvent(new CustomEvent('royalarmies:banner-blessing-chosen', {
            detail: { bannerId: id, banner, swapped, perkPoints: state.perkPoints }
        }));

        void showBannerBlessingToast(id, { swapped });

        const modal = global.document.getElementById('rift-banner-workspace-modal');
        if (modal && !modal.hidden) {
            renderBannerWorkspaceBody();
        }

        return true;
    }

    function resolveChurchBannerButton(chosenBannerId, bannerId, swapAvailable) {
        if (!chosenBannerId) {
            return { label: 'Choose Blessing', disabled: false, modifier: '' };
        }
        if (chosenBannerId === bannerId) {
            return { label: 'Blessing Chosen', disabled: true, modifier: 'is-chosen' };
        }
        if (swapAvailable) {
            return { label: 'Swap Blessing', disabled: false, modifier: 'is-swap' };
        }
        return { label: 'Swap Spent', disabled: true, modifier: 'is-locked' };
    }

    function renderChurchBannerCard(banner, chosenBannerId, swapAvailable) {
        const isChosen = chosenBannerId === banner.id;
        const button = resolveChurchBannerButton(chosenBannerId, banner.id, swapAvailable);

        const perkItems = (banner.perks || []).map((perk) => (
            `<li>${escapeHtml(perk.desc)}</li>`
        )).join('');

        return `
            <article class="age-church-banner-card${isChosen ? ' is-chosen' : ''}" data-banner-id="${escapeHtml(banner.id)}">
                <div class="age-church-banner-visual">
                    <div class="age-church-banner-rays" aria-hidden="true"></div>
                    <div class="age-church-banner-glow" aria-hidden="true"></div>
                    <img class="age-church-banner-image" src="${escapeHtml(banner.image)}" alt="${escapeHtml(banner.title)}">
                </div>
                <div class="age-church-banner-copy">
                    <div class="age-church-banner-details">
                        <h4 class="age-church-banner-title">${escapeHtml(banner.title)}</h4>
                        <p class="age-church-banner-rune">Blessed with the <strong>${escapeHtml(banner.rune)}</strong></p>
                        <p class="age-church-banner-lore">${escapeHtml(banner.lore)}</p>
                        <ul class="age-church-banner-perks">${perkItems}</ul>
                    </div>
                    <div class="age-church-banner-action">
                        <button type="button"
                            class="age-church-choose-blessing-btn ${button.modifier}"
                            data-church-choose-blessing="${escapeHtml(banner.id)}"
                            ${button.disabled ? 'disabled' : ''}>
                            ${escapeHtml(button.label)}
                        </button>
                    </div>
                </div>
            </article>
        `;
    }

    function buildChurchWorkspaceHtml() {
        const state = readBannerState();
        const chosenBannerId = state.bannerId;
        const chosenBanner = chosenBannerId ? BANNER_BY_ID[chosenBannerId] : null;
        const swapAvailable = canSwapBlessing();

        let sanctumNote = 'Kneel before the sanctum and choose one blessed banner. Its rune will shape your personal perk tree for the Age.';
        if (chosenBanner && swapAvailable) {
            sanctumNote = `Your soul is bound to the ${chosenBanner.title}. You may swap your blessing once this Age—doing so resets all banner perk points.`;
        } else if (chosenBanner) {
            sanctumNote = `Your soul is sealed to the ${chosenBanner.title} for the remainder of this Age. No further banner swaps remain.`;
        }

        const swapPolicyCopy = chosenBanner
            ? (swapAvailable
                ? 'One banner swap remains this Age. Exchanging your blessing wipes every banner perk point and unlocked node—you must earn them again.'
                : 'Your one Age swap has been spent. This banner and its perk progress are locked until the Age turns.')
            : 'Each banner carries a sacred rune and a trio of commander perks. You receive one blessing freely, and may swap it only once before the Age ends.';

        const cards = BANNER_CATALOG.map((banner) => renderChurchBannerCard(
            banner,
            chosenBannerId,
            swapAvailable
        )).join('');

        return (
            '<div class="age-church-workspace">'
            + '<div class="age-church-workspace-veil" aria-hidden="true"></div>'
            + '<div class="age-church-workspace-candles" aria-hidden="true"></div>'
            + '<div class="age-army-workspace-split age-church-split">'
            + '<section class="age-army-workspace-panel age-church-sanctum-panel">'
            + '<h3 class="age-army-workspace-panel-title">Sanctum of Blessings</h3>'
            + '<p class="age-church-sanctum-lead">Royal Armies Banners</p>'
            + `<p class="age-church-sanctum-note">${escapeHtml(sanctumNote)}</p>`
            + `<p class="age-church-sanctum-copy">${escapeHtml(swapPolicyCopy)}</p>`
            + (chosenBanner
                ? `<button type="button" class="age-church-open-tree-btn" data-church-open-banner-tree="1">Open Banner Perk Tree</button>`
                : '')
            + '</section>'
            + '<section class="age-army-workspace-panel age-church-banner-panel">'
            + '<h3 class="age-army-workspace-panel-title">Blessed Banners</h3>'
            + `<div class="age-church-banner-grid">${cards}</div>`
            + '</section>'
            + '</div>'
            + '</div>'
        );
    }

    function bindHandlers() {
        if (handlersBound) return;
        handlersBound = true;

        ensureShell();

        global.document.getElementById('rift-banner-workspace-close')
            ?.addEventListener('click', closeBannerWorkspace);
        global.document.getElementById('rift-banner-workspace-backdrop')
            ?.addEventListener('click', closeBannerWorkspace);
        global.document.getElementById('rift-banner-blessing-toast-dismiss')
            ?.addEventListener('click', hideBannerBlessingToast);
        global.document.getElementById('rift-banner-blessing-toast-open-link')
            ?.addEventListener('click', (event) => {
                hideBannerBlessingToast();
                openBannerWorkspace(event);
            });

        global.document.addEventListener('click', (event) => {
            const perkBtn = event.target.closest('[data-banner-perk-id]');
            if (perkBtn && global.document.getElementById('rift-banner-workspace-modal')?.contains(perkBtn)) {
                event.preventDefault();
                selectedPerkId = perkBtn.getAttribute('data-banner-perk-id');
                renderBannerWorkspaceBody(selectedPerkId);
                return;
            }

            const churchBlessingBtn = event.target.closest('[data-church-choose-blessing]');
            if (churchBlessingBtn && !churchBlessingBtn.disabled) {
                event.preventDefault();
                const bannerId = churchBlessingBtn.getAttribute('data-church-choose-blessing');
                void chooseBlessing(bannerId).then((chosen) => {
                    if (chosen) {
                        global.dispatchEvent(new CustomEvent('royalarmies:church-blessing-ui-refresh'));
                    }
                });
                return;
            }

            const openTreeBtn = event.target.closest('[data-church-open-banner-tree]');
            if (openTreeBtn) {
                event.preventDefault();
                openBannerWorkspace(event);
            }
        });

        global.addEventListener('royalarmies:church-blessing-ui-refresh', () => {
            const modal = global.document.getElementById('rift-banner-workspace-modal');
            if (modal && !modal.hidden) {
                renderBannerWorkspaceBody();
            }
        });

        global.document.addEventListener('keydown', (event) => {
            if (event.key !== 'Escape') return;

            const toast = global.document.getElementById('rift-banner-blessing-toast');
            if (toast && !toast.hidden && (toast.classList.contains('is-visible') || toast.classList.contains('is-exiting'))) {
                event.stopPropagation();
                hideBannerBlessingToast();
                return;
            }

            const modal = global.document.getElementById('rift-banner-workspace-modal');
            if (modal && !modal.hidden) {
                event.preventDefault();
                closeBannerWorkspace();
            }
        });
    }

    function initBannerWorkspace() {
        bindHandlers();
    }

    global.openBannerWorkspace = openBannerWorkspace;
    global.closeBannerWorkspace = closeBannerWorkspace;
    global.showBannerBlessingToast = showBannerBlessingToast;

    global.RoyalArmiesBanner = Object.freeze({
        catalog: BANNER_CATALOG,
        getBannerState: readBannerState,
        getChosenBannerId: readChosenBannerId,
        getChosenBanner,
        canSwapBlessing,
        chooseBlessing,
        buildChurchWorkspaceHtml,
        open: openBannerWorkspace,
        close: closeBannerWorkspace
    });

    if (global.document.readyState === 'loading') {
        global.document.addEventListener('DOMContentLoaded', initBannerWorkspace, { once: true });
    } else {
        initBannerWorkspace();
    }
})(window);
