/**
 * RIFT — Church banner blessings and Banner skill-tree workspace (Game Hub).
 */
(function initRoyalArmiesBannerWorkspace(global) {
    'use strict';

    const STORAGE_KEY = 'royalarmies:age-banner-blessing-id';
    const IMAGE_BUST = 'church-banners-1';

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

    function readChosenBannerId() {
        try {
            const raw = global.localStorage.getItem(STORAGE_KEY);
            const id = String(raw || '').trim();
            return BANNER_BY_ID[id] ? id : '';
        } catch (_error) {
            return '';
        }
    }

    function writeChosenBannerId(bannerId) {
        const id = String(bannerId || '').trim();
        if (!BANNER_BY_ID[id]) return false;
        try {
            global.localStorage.setItem(STORAGE_KEY, id);
            return true;
        } catch (_error) {
            return false;
        }
    }

    function getChosenBanner() {
        const id = readChosenBannerId();
        return id ? BANNER_BY_ID[id] : null;
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

    function renderBannerPerkTreeMarkup(banner, focusPerkId) {
        if (!banner) {
            return `
                <div class="rift-banner-workspace-empty">
                    <p class="rift-banner-workspace-empty-title">No banner blessing yet</p>
                    <p class="rift-banner-workspace-empty-copy">Visit the Church at your settlement to receive a blessed banner and unlock your personal perk tree.</p>
                </div>
            `;
        }

        const perks = banner.perks || [];
        if (!selectedPerkId || !perks.some((perk) => perk.id === selectedPerkId)) {
            selectedPerkId = focusPerkId && perks.some((perk) => perk.id === focusPerkId)
                ? focusPerkId
                : (perks[0]?.id || null);
        }

        const activePerk = perks.find((perk) => perk.id === selectedPerkId) || perks[0] || null;

        const treeNodes = perks.map((perk, index) => {
            const isActive = perk.id === activePerk?.id;
            const isLast = index === perks.length - 1;
            return `
                <li class="rift-banner-skill-node${isActive ? ' is-active' : ''}">
                    <button type="button" class="rift-banner-skill-node-btn" data-banner-perk-id="${escapeHtml(perk.id)}">
                        <span class="rift-banner-skill-node-orbit" aria-hidden="true"></span>
                        <span class="rift-banner-skill-node-label">${escapeHtml(perk.title)}</span>
                    </button>
                    ${isLast ? '' : '<span class="rift-banner-skill-connector" aria-hidden="true"></span>'}
                </li>
            `;
        }).join('');

        return `
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
                        <p class="rift-banner-workspace-detail-note">Perk effects activate once your blessed banner is fielded with your army.</p>
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

    function showBannerBlessingToast(bannerId) {
        const banner = BANNER_BY_ID[String(bannerId || '').trim()];
        if (!banner) return Promise.resolve();

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
        line.textContent = `${banner.lore} Your banner perks are now available in the Game Hub.`;

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

    function chooseBlessing(bannerId) {
        const id = String(bannerId || '').trim();
        const banner = BANNER_BY_ID[id];
        if (!banner) return false;

        const existingId = readChosenBannerId();
        if (existingId === id) return false;

        if (!writeChosenBannerId(id)) return false;

        global.dispatchEvent(new CustomEvent('royalarmies:banner-blessing-chosen', {
            detail: { bannerId: id, banner }
        }));

        void showBannerBlessingToast(id);
        return true;
    }

    function renderChurchBannerCard(banner, chosenBannerId) {
        const isChosen = chosenBannerId === banner.id;
        const hasOtherBlessing = Boolean(chosenBannerId && chosenBannerId !== banner.id);
        const buttonLabel = isChosen ? 'Blessing Chosen' : 'Choose Blessing';
        const buttonDisabled = isChosen || hasOtherBlessing;

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
                    <h4 class="age-church-banner-title">${escapeHtml(banner.title)}</h4>
                    <p class="age-church-banner-rune">Blessed with the <strong>${escapeHtml(banner.rune)}</strong></p>
                    <p class="age-church-banner-lore">${escapeHtml(banner.lore)}</p>
                    <ul class="age-church-banner-perks">${perkItems}</ul>
                    <button type="button"
                        class="age-church-choose-blessing-btn"
                        data-church-choose-blessing="${escapeHtml(banner.id)}"
                        ${buttonDisabled ? 'disabled' : ''}>
                        ${escapeHtml(buttonLabel)}
                    </button>
                </div>
            </article>
        `;
    }

    function buildChurchWorkspaceHtml() {
        const chosenBannerId = readChosenBannerId();
        const chosenBanner = chosenBannerId ? BANNER_BY_ID[chosenBannerId] : null;
        const sanctumNote = chosenBanner
            ? `Your soul is bound to the ${chosenBanner.title}. Its gifts await in the Banner perk tree.`
            : 'Kneel before the sanctum and choose one blessed banner. Its rune will shape your personal perk tree for the Age.';

        const cards = BANNER_CATALOG.map((banner) => renderChurchBannerCard(banner, chosenBannerId)).join('');

        return (
            '<div class="age-church-workspace">'
            + '<div class="age-church-workspace-veil" aria-hidden="true"></div>'
            + '<div class="age-church-workspace-candles" aria-hidden="true"></div>'
            + '<div class="age-army-workspace-split age-church-split">'
            + '<section class="age-army-workspace-panel age-church-sanctum-panel">'
            + '<h3 class="age-army-workspace-panel-title">Sanctum of Blessings</h3>'
            + '<p class="age-church-sanctum-lead">Royal Armies Banners</p>'
            + `<p class="age-church-sanctum-note">${escapeHtml(sanctumNote)}</p>`
            + '<p class="age-church-sanctum-copy">Each banner carries a sacred rune and a trio of commander perks. You may receive only one blessing per Age—choose the heraldry that will march beside your name.</p>'
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
                if (chooseBlessing(bannerId)) {
                    global.dispatchEvent(new CustomEvent('royalarmies:church-blessing-ui-refresh'));
                }
                return;
            }

            const openTreeBtn = event.target.closest('[data-church-open-banner-tree]');
            if (openTreeBtn) {
                event.preventDefault();
                openBannerWorkspace(event);
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
        getChosenBannerId: readChosenBannerId,
        getChosenBanner,
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
