/**
 * RIFT — Church banner blessings and Banner skill-tree workspace (Game Hub).
 */
(function initRoyalArmiesBannerWorkspace(global) {
    'use strict';

    const STORAGE_KEY = 'royalarmies:age-banner-state';
    const LEGACY_BLESSING_KEY = 'royalarmies:age-banner-blessing-id';
    const IMAGE_BUST = 'church-banners-3';

    function resolveBannerImageUrl(relativePath) {
        const raw = String(relativePath || '').trim();
        if (!raw) return '';
        if (/^https?:\/\//i.test(raw) || raw.startsWith('data:')) return raw;

        const queryIndex = raw.indexOf('?');
        const pathPart = queryIndex >= 0 ? raw.slice(0, queryIndex) : raw;
        const query = queryIndex >= 0 ? raw.slice(queryIndex) : `?v=${IMAGE_BUST}`;
        const fileName = pathPart.replace(/^.*\//, '');
        if (!fileName) return raw;

        const publicPath = `/images/${fileName}${query}`;

        try {
            const href = String(global.location.href || '');
            const inPublicFolder = /\/public\//i.test(href);
            if (inPublicFolder) {
                return new URL(`images/${fileName}${query}`, href).href;
            }
            return new URL(publicPath, global.location.origin).href;
        } catch (_error) {
            return publicPath;
        }
    }

    const TWENTY_FIVE_NODE_BANNERS = new Set(['emerald-barrier']);
    const ROOT_AUTO_NODE_IDS = Object.freeze({
        'emerald-barrier': 'eb-01'
    });

    function createDefaultBannerState() {
        return {
            bannerId: '',
            swapUsed: false,
            perkPoints: 0,
            unlockedPerkIds: [],
            unlockedNodeIds: [],
            armyAdvisor: null
        };
    }

    function refreshBannerArmyAdvisor() {
        const advisorApi = global.RoyalArmiesBannerAdvisor;
        if (!advisorApi?.refreshAndPersist) return Promise.resolve(null);
        return advisorApi.refreshAndPersist(writeBannerState, readBannerState);
    }

    const BANNER_CATALOG = Object.freeze([
        {
            id: 'true-war',
            title: 'True War Banner',
            image: `/images/truewarbanner.png?v=${IMAGE_BUST}`,
            rune: 'Rune of Valiance',
            skillIdentity: 'Aggressive valiance — press fights, break lines, and dominate ranked PvP.',
            branchPaths: Object.freeze([
                Object.freeze({ name: 'Ferocious Line', playstyle: 'Infantry assault' }),
                Object.freeze({ name: 'Higher Ground', playstyle: 'Ranked PvP aggression' }),
                Object.freeze({ name: 'Relentless Valiance', playstyle: 'Strike pressure' })
            ]),
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
            ]),
            skillTree: Object.freeze({
                keystoneId: 'true-war-double-strike',
                branches: Object.freeze([
                    { id: 'ferocious-line', label: 'Ferocious Line', perkId: 'true-war-infantry-attack' },
                    { id: 'higher-ground', label: 'Higher Ground', perkId: 'true-war-pvp-rank' }
                ])
            })
        },
        {
            id: 'sachiels-blessing',
            title: "Sachiel's Blessing Banner",
            image: `/images/sachielsblessingbanner.png?v=${IMAGE_BUST}`,
            rune: 'Rune of Revitalization',
            skillIdentity: 'Restoration & army sustain — revive losses and recover after every fight.',
            branchPaths: Object.freeze([
                Object.freeze({ name: 'Revitalization Surge', playstyle: 'Battle revival' }),
                Object.freeze({ name: 'Restored Vigour', playstyle: 'Post-battle recovery' }),
                Object.freeze({ name: 'Angelic March', playstyle: 'Mobility sustain' })
            ]),
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
            ]),
            skillTree: Object.freeze({
                keystoneId: 'sachiels-revive',
                branches: Object.freeze([
                    { id: 'restored-vigour', label: 'Restored Vigour', perkId: 'sachiels-hp-boost' },
                    { id: 'angelic-march', label: 'Angelic March', perkId: 'sachiels-move-points' }
                ])
            })
        },
        {
            id: 'emerald-barrier',
            title: 'Emerald Barrier Banner',
            image: `/images/emeraldbarrierbanner.png?v=${IMAGE_BUST}`,
            rune: 'Rune of Fortification',
            branchPaths: Object.freeze([
                Object.freeze({ name: 'Phalanx Hold', playstyle: 'Battlefield bulwark' }),
                Object.freeze({ name: 'Rampart Reserve', playstyle: 'Campaign sustain' }),
                Object.freeze({ name: 'Sentinel Screen', playstyle: 'Scout & shield' })
            ]),
            lore: 'Reputed for holding the line through personal discipline and defensive mastery. Blessed with the Rune of Fortification.',
            perks: Object.freeze([
                {
                    id: 'emerald-pvp-defense',
                    title: 'Impenetrable Wall',
                    desc: '15% HP and 25% Attack increase when defending against a PvP army of same rank or higher.'
                },
                {
                    id: 'emerald-fortified-city',
                    title: 'Bulwark Stance',
                    desc: 'When your army defends in PvP battle, gain +250 effective HP at battle start.'
                },
                {
                    id: 'emerald-mountains',
                    title: 'Mountain Ward',
                    desc: '+2 bonus on Mountains terrain.'
                }
            ]),
            skillTree: Object.freeze({
                keystoneId: 'emerald-pvp-defense',
                branches: Object.freeze([
                    { id: 'fortified-bastion', label: 'Bulwark Stance', perkId: 'emerald-fortified-city' },
                    { id: 'mountain-ward', label: 'Mountain Ward', perkId: 'emerald-mountains' }
                ])
            })
        },
        {
            id: 'fortunes-gratitude',
            title: "Fortune's Gratitude Banner",
            image: `/images/fortunesgratitudebanner.png?v=${IMAGE_BUST}`,
            rune: 'Rune of Hinshuro',
            skillIdentity: 'Economic prosperity & trade — merchant growth, tick income, and war dividends.',
            branchPaths: Object.freeze([
                Object.freeze({ name: 'Merchant Tithe', playstyle: 'Passive income' }),
                Object.freeze({ name: 'Victory Dividend', playstyle: 'War spoils' }),
                Object.freeze({ name: 'Hinshuro Ledger', playstyle: 'Expense mastery' })
            ]),
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
            ]),
            skillTree: Object.freeze({
                keystoneId: 'fortunes-tick-income',
                branches: Object.freeze([
                    { id: 'victory-dividend', label: 'Victory Dividend', perkId: 'fortunes-victory-currency' },
                    { id: 'hinshuro-ledger', label: 'Hinshuro Ledger', perkId: 'fortunes-expense-reduction' }
                ])
            })
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

    function getBannerPerkById(banner, perkId) {
        const id = String(perkId || '').trim();
        if (!id || !banner) return null;
        return (banner.perks || []).find((perk) => perk.id === id) || null;
    }

    function getBannerSkillBranches(banner) {
        const tree = banner?.skillTree;
        if (!tree) return [];

        return (tree.branches || []).map((branch) => ({
            id: branch.id,
            label: branch.label,
            perkId: branch.perkId,
            perk: getBannerPerkById(banner, branch.perkId)
        })).filter((branch) => branch.perk);
    }

    function getBannerKeystonePerk(banner) {
        return getBannerPerkById(banner, banner?.skillTree?.keystoneId);
    }

    function resolvePerkPathLabel(banner, perkId) {
        const id = String(perkId || '').trim();
        if (!id || !banner?.skillTree) return '';

        if (banner.skillTree.keystoneId === id) {
            return 'Keystone';
        }

        const branch = (banner.skillTree.branches || []).find((entry) => entry.perkId === id);
        return branch ? String(branch.label || '').trim() : '';
    }

    function resolvePerkTierLabel(banner, perkId) {
        const id = String(perkId || '').trim();
        if (!id || !banner?.skillTree) return '';

        if (banner.skillTree.keystoneId === id) return 'I';
        if ((banner.skillTree.branches || []).some((entry) => entry.perkId === id)) return 'II';
        return '';
    }

    function renderSkillNodeMarkup(perk, unlockedPerkIds, activePerkId, tierLabel) {
        if (!perk) return '';

        const isActive = perk.id === activePerkId;
        const isUnlocked = unlockedPerkIds.has(perk.id);

        return `
            <div class="rift-banner-skill-node${isActive ? ' is-active' : ''}${isUnlocked ? ' is-unlocked' : ' is-locked'}">
                <button type="button"
                    class="rift-banner-skill-node-btn"
                    data-banner-perk-id="${escapeHtml(perk.id)}"
                    aria-label="${escapeHtml(perk.title)}${isUnlocked ? ' (unlocked)' : ' (locked)'}">
                    <span class="rift-banner-skill-node-ring" aria-hidden="true"></span>
                    <span class="rift-banner-skill-node-tier">${escapeHtml(tierLabel)}</span>
                    <span class="rift-banner-skill-node-lock" aria-hidden="true">${isUnlocked ? '' : '🔒'}</span>
                </button>
                <span class="rift-banner-skill-node-label">${escapeHtml(perk.title)}</span>
            </div>
        `;
    }

    function renderBranchedSkillTreeMarkup(banner, unlockedPerkIds, activePerkId) {
        const keystone = getBannerKeystonePerk(banner);
        const branches = getBannerSkillBranches(banner);
        if (!keystone || !branches.length) return '';

        const branchCount = branches.length;
        const branchMarkup = branches.map((branch, index) => `
            <div class="rift-banner-skill-path${index === 0 ? ' is-upper' : ''}${index === branchCount - 1 ? ' is-lower' : ''}">
                <span class="rift-banner-skill-path-tag">${escapeHtml(branch.label)}</span>
                <span class="rift-banner-skill-path-connector" aria-hidden="true"></span>
                ${renderSkillNodeMarkup(branch.perk, unlockedPerkIds, activePerkId, 'II')}
            </div>
        `).join('');

        return `
            <div class="rift-banner-skill-tree-track rift-banner-skill-tree-track--branching" style="--branch-count:${branchCount}">
                <div class="rift-banner-skill-tree-origin">
                    <div class="rift-banner-skill-tree-origin-rays" aria-hidden="true"></div>
                    <div class="rift-banner-skill-tree-origin-frame">
                        <img class="rift-banner-skill-tree-origin-banner"
                            src="${escapeHtml(resolveBannerImageUrl(banner.image))}"
                            alt="${escapeHtml(banner.title)}">
                    </div>
                    <p class="rift-banner-skill-tree-origin-title">${escapeHtml(banner.title)}</p>
                    <p class="rift-banner-skill-tree-origin-rune">${escapeHtml(banner.rune)}</p>
                </div>
                <span class="rift-banner-skill-tree-connector-h rift-banner-skill-tree-connector-h--origin" aria-hidden="true"></span>
                <div class="rift-banner-skill-tree-keystone-wrap">
                    <span class="rift-banner-skill-tree-keystone-tag">Keystone</span>
                    ${renderSkillNodeMarkup(keystone, unlockedPerkIds, activePerkId, 'I')}
                </div>
                <div class="rift-banner-skill-tree-fork-rail" aria-hidden="true">
                    <span class="rift-banner-skill-tree-fork-in"></span>
                    <span class="rift-banner-skill-tree-fork-stem"></span>
                    ${branches.map((_, index) => `<span class="rift-banner-skill-tree-fork-branch rift-banner-skill-tree-fork-branch--${index + 1}"></span>`).join('')}
                </div>
                <div class="rift-banner-skill-tree-branches">${branchMarkup}</div>
            </div>
        `;
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

        const unlockedPerks = Array.isArray(raw.unlockedPerkIds) ? raw.unlockedPerkIds : [];
        state.unlockedPerkIds = [...new Set(unlockedPerks.map((id) => String(id || '').trim()).filter(Boolean))];

        const unlockedNodes = Array.isArray(raw.unlockedNodeIds) ? raw.unlockedNodeIds : [];
        state.unlockedNodeIds = [...new Set(unlockedNodes.map((id) => String(id || '').trim()).filter(Boolean))];

        const rootNodeId = ROOT_AUTO_NODE_IDS[state.bannerId];
        if (rootNodeId && !state.unlockedNodeIds.includes(rootNodeId)) {
            state.unlockedNodeIds.unshift(rootNodeId);
        }

        if (raw.armyAdvisor && typeof raw.armyAdvisor === 'object') {
            state.armyAdvisor = raw.armyAdvisor;
        }

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
        next.unlockedNodeIds = [];
        const rootNodeId = ROOT_AUTO_NODE_IDS[next.bannerId];
        if (rootNodeId) {
            next.unlockedNodeIds = [rootNodeId];
        }
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
                        <p class="rift-banner-workspace-eyebrow">Commander talents</p>
                        <h2 id="rift-banner-workspace-title" class="rift-banner-workspace-title">Banner Skill Tree</h2>
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
                        Open your <button type="button" class="rift-banner-blessing-toast-link" id="rift-banner-blessing-toast-open-link">Banner Skill Tree</button> to review your gifts.
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
                    <p class="rift-banner-workspace-empty-copy">Visit the Church at your settlement to receive a blessed banner and unlock your Banner Skill Tree.</p>
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

        const keystone = getBannerKeystonePerk(banner);
        const defaultPerkId = keystone?.id || perks[0]?.id || null;
        const activePerk = perks.find((perk) => perk.id === selectedPerkId)
            || (defaultPerkId ? getBannerPerkById(banner, defaultPerkId) : null);
        const activeTierLabel = activePerk ? resolvePerkTierLabel(banner, activePerk.id) : '';
        const activePathLabel = activePerk ? resolvePerkPathLabel(banner, activePerk.id) : '';
        const branchedTreeMarkup = renderBranchedSkillTreeMarkup(banner, unlockedPerkIds, activePerk?.id || null);

        const swapNote = state.swapUsed
            ? 'Banner swap spent for this Age.'
            : 'One banner swap remains this Age. Swapping resets all skill points.';

        return `
            <div class="rift-banner-workspace-status" role="status">
                <p class="rift-banner-workspace-points">Banner skill points: <strong>${escapeHtml(state.perkPoints)}</strong></p>
                <p class="rift-banner-workspace-swap-note">${escapeHtml(swapNote)}</p>
            </div>
            <div class="rift-banner-skill-tree-layout">
                <div class="rift-banner-skill-tree-canvas" aria-label="Banner Skill Tree">
                    <div class="rift-banner-skill-tree-grid" aria-hidden="true"></div>
                    ${branchedTreeMarkup}
                </div>
                <section class="rift-banner-workspace-detail rift-banner-skill-tree-detail" aria-label="Selected skill details">
                    ${activePerk ? `
                        <div class="rift-banner-skill-tree-detail-head">
                            <p class="rift-banner-skill-tree-detail-tier">Tier ${escapeHtml(activeTierLabel || '—')}</p>
                            ${activePathLabel
                                ? `<p class="rift-banner-skill-tree-detail-path">${escapeHtml(activePathLabel)} path</p>`
                                : ''}
                            <h3 class="rift-banner-workspace-detail-title">${escapeHtml(activePerk.title)}</h3>
                            <span class="rift-banner-skill-tree-detail-state${unlockedPerkIds.has(activePerk.id) ? ' is-unlocked' : ' is-locked'}">${unlockedPerkIds.has(activePerk.id) ? 'Unlocked' : 'Locked'}</span>
                        </div>
                        <p class="rift-banner-workspace-detail-copy">${escapeHtml(activePerk.desc)}</p>
                        <p class="rift-banner-workspace-detail-note">${unlockedPerkIds.has(activePerk.id)
                            ? 'This skill is active on your banner tree.'
                            : 'Spend banner skill points to unlock this node on its skill path.'}</p>
                    ` : `
                        <div class="rift-banner-workspace-empty">
                            <p>Select a skill node to read its blessing.</p>
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
                <img src="${escapeHtml(resolveBannerImageUrl(banner.image))}" alt="${escapeHtml(banner.title)}">
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
            ? `${banner.lore} Your Banner Skill Tree has been reset—earn points again to unlock its gifts.`
            : `${banner.lore} Your banner skills are now available in the Game Hub.`;

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

    function openBannerWorkspaceLegacy(event, focusPerkId) {
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

    function openBannerWorkspace(event, focusPerkId) {
        if (event) {
            event.preventDefault();
            event.stopPropagation();
        }
        if (typeof global.closePortalCommanderIdentityMenu === 'function') {
            global.closePortalCommanderIdentityMenu();
        }

        const chosenId = readChosenBannerId();
        if (TWENTY_FIVE_NODE_BANNERS.has(chosenId) && typeof global.openBlessedBannersModal === 'function') {
            hideBannerBlessingToast();
            void global.openBlessedBannersModal(event, chosenId);
            return;
        }

        openBannerWorkspaceLegacy(event, focusPerkId);
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
        const rootNodeId = ROOT_AUTO_NODE_IDS[id];
        if (rootNodeId) {
            state.unlockedNodeIds = [rootNodeId];
        }
        if (!writeBannerState(state)) return false;
        await refreshBannerArmyAdvisor();

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

    function renderChurchBannerCard(banner, chosenBannerId, swapAvailable, recommendedBannerId) {
        const isChosen = chosenBannerId === banner.id;
        const isRecommended = !chosenBannerId && recommendedBannerId === banner.id;
        const button = resolveChurchBannerButton(chosenBannerId, banner.id, swapAvailable);

        const skillIdentity = String(banner.skillIdentity || banner.skillCategory || '').trim();
        const branchPaths = Array.isArray(banner.branchPaths) ? banner.branchPaths : [];
        const branchSummary = branchPaths
            .map((path) => String(path?.name || '').trim())
            .filter(Boolean)
            .join(' · ');

        return `
            <article class="age-church-banner-card${isChosen ? ' is-chosen' : ''}${isRecommended ? ' is-recommended' : ''}" data-banner-id="${escapeHtml(banner.id)}">
                ${isRecommended ? '<span class="age-church-banner-recommended-tag">Recommended for your army</span>' : ''}
                <div class="age-church-banner-visual">
                    <div class="age-church-banner-rays" aria-hidden="true"></div>
                    <div class="age-church-banner-glow" aria-hidden="true"></div>
                    <img class="age-church-banner-image" src="${escapeHtml(resolveBannerImageUrl(banner.image))}" alt="${escapeHtml(banner.title)}" loading="eager" decoding="async">
                </div>
                <div class="age-church-banner-copy">
                    <div class="age-church-banner-details">
                        <h4 class="age-church-banner-title">${escapeHtml(banner.title)}</h4>
                        <p class="age-church-banner-rune">Blessed with the <strong>${escapeHtml(banner.rune)}</strong></p>
                        <p class="age-church-banner-lore">${escapeHtml(banner.lore)}</p>
                        ${skillIdentity
                            ? `<p class="age-church-banner-skill-category"><span class="age-church-banner-skill-category-label">Banner identity</span> ${escapeHtml(skillIdentity)}${branchSummary
                                ? `<span class="age-church-banner-skill-category-note">Paths: ${escapeHtml(branchSummary)}</span>`
                                : '<span class="age-church-banner-skill-category-note">Branches into multiple skill paths</span>'}</p>`
                            : ''}
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

        let sanctumNote = 'Kneel before the sanctum and choose one blessed banner. Its rune will shape a branching Banner Skill Tree for the Age.';
        if (chosenBanner && swapAvailable) {
            sanctumNote = `Your soul is bound to the ${chosenBanner.title}. You may swap your blessing once this Age—doing so resets all banner perk points.`;
        } else if (chosenBanner) {
            sanctumNote = `Your soul is sealed to the ${chosenBanner.title} for the remainder of this Age. No further banner swaps remain.`;
        }

        const swapPolicyCopy = chosenBanner
            ? (swapAvailable
                ? 'One banner swap remains this Age. Exchanging your blessing wipes every banner perk point and unlocked node—you must earn them again.'
                : 'Your one Age swap has been spent. This banner and its perk progress are locked until the Age turns.')
            : 'Each banner carries a sacred rune and a skill discipline that branches into multiple paths. You receive one blessing freely, and may swap it only once before the Age ends.';

        const recommendedBannerId = state.armyAdvisor?.recommendedBannerId || '';
        const advisorReason = String(state.armyAdvisor?.recommendedBannerReason || '').trim();
        const advisorProfile = String(state.armyAdvisor?.profileSummary || '').trim();

        const cards = BANNER_CATALOG.map((banner) => renderChurchBannerCard(
            banner,
            chosenBannerId,
            swapAvailable,
            recommendedBannerId
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
            + (!chosenBanner && (advisorProfile || advisorReason)
                ? `<div class="age-church-advisor-note">`
                    + (advisorProfile
                        ? `<p class="age-church-advisor-profile">Based on: ${escapeHtml(advisorProfile)}</p>`
                        : '')
                    + (advisorReason
                        ? `<p class="age-church-advisor-reason">${escapeHtml(advisorReason)}</p>`
                        : '')
                    + `</div>`
                : '')
            + (chosenBanner
                ? `<button type="button" class="age-church-open-tree-btn" data-church-open-banner-tree="1">Open Banner Skill Tree</button>`
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

        global.addEventListener('royalarmies:banner-advisor-updated', () => {
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

            const blessedModal = global.document.getElementById('blessed-banners-modal');
            if (blessedModal && !blessedModal.hidden) {
                if (typeof global.closeBlessedBannersModal === 'function') {
                    global.closeBlessedBannersModal();
                }
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
        void refreshBannerArmyAdvisor();
    }

    global.openBannerWorkspace = openBannerWorkspace;
    global.openBannerWorkspaceLegacy = openBannerWorkspaceLegacy;
    global.closeBannerWorkspace = closeBannerWorkspace;
    global.showBannerBlessingToast = showBannerBlessingToast;

    global.RoyalArmiesBanner = Object.freeze({
        catalog: BANNER_CATALOG,
        getBannerState: readBannerState,
        writeBannerState,
        getChosenBannerId: readChosenBannerId,
        getChosenBanner,
        canSwapBlessing,
        chooseBlessing,
        buildChurchWorkspaceHtml,
        refreshArmyAdvisor: refreshBannerArmyAdvisor,
        open: openBannerWorkspace,
        close: closeBannerWorkspace,
        supportsTwentyFiveNodeTree: (bannerId) => TWENTY_FIVE_NODE_BANNERS.has(String(bannerId || '').trim())
    });

    if (global.document.readyState === 'loading') {
        global.document.addEventListener('DOMContentLoaded', initBannerWorkspace, { once: true });
    } else {
        initBannerWorkspace();
    }
})(window);
