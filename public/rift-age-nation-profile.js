/**
 * RIFT — Public nation profile modal (Records, rankings, and intel surfaces).
 */
(function initAgeNationProfile(global) {
    'use strict';

    const PLACEHOLDER = '—';

    const NATION_CREST_BY_ID = {
        dravic: 'images/draviccrest.png',
        aesthene: 'images/aesthenecrest.png',
        vaerenth: 'images/vaerenthcrest.png',
        lyllis: 'images/lylliscrest.png',
        thruun: 'images/thruuncrest.png',
        aethelgard: 'images/aethelgardcrest.png',
        krall: 'images/krallcrest.png',
        saelthine: 'images/saelthinecrest.png',
        trex: 'images/trexcrest.png',
        gorz: 'images/gorzcrest.png',
        zevros: 'images/zevroscrest.png',
        skaros: 'images/skaroscrest.png',
        vaelior: 'images/vaeliorcrest.png',
        mynor: 'images/mynorcrest.png',
        khaerant: 'images/khaerantcrest.png'
    };

    let bound = false;
    let escapeHandler = null;

    function resolveApiUrl(path) {
        if (typeof global.resolveRoyalArmiesApiUrl === 'function') {
            return global.resolveRoyalArmiesApiUrl(path);
        }
        const origin = global.location?.origin || '';
        if (String(path || '').startsWith('http')) return path;
        if (String(path || '').startsWith('/')) return `${origin}${path}`;
        return `${origin}/${path}`;
    }

    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function resolveNationCrestUrl(nationId) {
        const key = String(nationId || '').trim().toLowerCase();
        if (NATION_CREST_BY_ID[key]) return NATION_CREST_BY_ID[key];
        if (key) return `images/${key}crest.png`;
        return '';
    }

    function formatSignedBonus(value) {
        const amount = Number(value) || 0;
        if (amount > 0) return `+${amount}`;
        return String(amount);
    }

    function resolveTerrainBonuses(nationId) {
        const terrain = global.RoyalArmiesNationTerrainBonuses;
        if (terrain?.getBonusesForNationId) {
            return terrain.getBonusesForNationId(nationId);
        }
        return {};
    }

    function isTerrainBonusDataLive() {
        const terrain = global.RoyalArmiesNationTerrainBonuses;
        if (terrain?.isLive) return terrain.isLive() === true;
        return false;
    }

    function terrainBonusStateClass(value) {
        const amount = Number(value) || 0;
        if (amount > 0) return 'is-positive';
        if (amount < 0) return 'is-negative';
        return 'is-neutral';
    }

    function buildTerrainRowsHtml(nationId) {
        const terrainApi = global.RoyalArmiesNationTerrainBonuses;
        const terrains = Array.isArray(terrainApi?.terrainTypes) && terrainApi.terrainTypes.length
            ? terrainApi.terrainTypes
            : ['Mountains', 'Marshlands', 'Forest', 'Plains', 'Desert'];
        const swatchMap = terrainApi?.terrainSwatchClass || {
            Mountains: 'mountains',
            Marshlands: 'marshlands',
            Forest: 'forest',
            Plains: 'plains',
            Desert: 'desert'
        };

        if (!isTerrainBonusDataLive()) {
            return '<li class="age-nation-profile-terrain-empty" role="status">No data to display</li>';
        }

        const bonuses = resolveTerrainBonuses(nationId);
        return terrains.map((terrain) => {
            const value = Number(bonuses[terrain] || 0);
            const stateClass = terrainBonusStateClass(value);
            const swatchClass = swatchMap[terrain] || 'plains';
            return (
                `<li class="age-nation-profile-terrain-tile ${stateClass}">`
                + `<span class="age-nation-profile-terrain-swatch age-nation-profile-terrain-swatch--${escapeHtml(swatchClass)}" aria-hidden="true"></span>`
                + `<span class="age-nation-profile-terrain-label">${escapeHtml(terrain)}</span>`
                + `<span class="age-nation-profile-terrain-value">${escapeHtml(formatSignedBonus(value))}</span>`
                + '</li>'
            );
        }).join('');
    }

    function renderLeaderRow(label, member) {
        if (!member?.username) {
            return (
                `<div class="age-nation-profile-leader-row">`
                + `<span class="age-nation-profile-leader-role">${escapeHtml(label)}</span>`
                + `<span class="age-nation-profile-leader-name is-empty">${escapeHtml('None')}</span>`
                + '</div>'
            );
        }

        const displayName = member.name || member.username;
        return (
            `<div class="age-nation-profile-leader-row">`
            + `<span class="age-nation-profile-leader-role">${escapeHtml(label)}</span>`
            + `<button type="button" class="age-nation-profile-commander-link" data-age-nation-profile-commander="${escapeHtml(member.username)}">${escapeHtml(displayName)}</button>`
            + '</div>'
        );
    }

    function renderCouncilList(members) {
        const rows = Array.isArray(members) ? members : [];
        if (!rows.length) {
            return '<li class="age-nation-profile-council-empty">No council members listed.</li>';
        }

        return rows.map((member) => {
            const displayName = member?.name || member?.username || PLACEHOLDER;
            if (!member?.username) {
                return `<li class="age-nation-profile-council-item is-empty">${escapeHtml(displayName)}</li>`;
            }
            return (
                `<li class="age-nation-profile-council-item">`
                + `<button type="button" class="age-nation-profile-commander-link" data-age-nation-profile-commander="${escapeHtml(member.username)}">${escapeHtml(displayName)}</button>`
                + '</li>'
            );
        }).join('');
    }

    function renderProfileContent(profile) {
        const crestUrl = resolveNationCrestUrl(profile.nationId);
        const rankingLive = profile.recordsRankingLive === true;
        const rankLabel = rankingLive && profile.globalRanking != null
            ? Number(profile.globalRanking).toLocaleString('en-US')
            : PLACEHOLDER;
        const pointsLabel = Number(profile.points || 0).toLocaleString('en-US');

        return (
            '<header class="age-nation-profile-header">'
            + `<div class="age-nation-profile-crest-ring">`
            + (crestUrl
                ? `<img class="age-nation-profile-crest" src="${escapeHtml(crestUrl)}" alt="" loading="lazy" decoding="async">`
                : '')
            + '</div>'
            + '<div class="age-nation-profile-copy">'
            + '<p class="age-nation-profile-eyebrow">Nation profile</p>'
            + `<h2 id="age-nation-profile-title" class="age-nation-profile-name">${escapeHtml(profile.nationName || profile.nationId)}</h2>`
            + '<div class="age-nation-profile-meta-row">'
            + `<span><strong>Global Rank:</strong> ${escapeHtml(rankLabel)}</span>`
            + `<span><strong>Points:</strong> ${escapeHtml(pointsLabel)}</span>`
            + '</div>'
            + '</div>'
            + '</header>'
            + '<div class="age-nation-profile-body">'
            + '<section class="age-nation-profile-section" aria-labelledby="age-nation-profile-terrain-title">'
            + '<h3 id="age-nation-profile-terrain-title" class="age-nation-profile-section-title">Terrain Bonuses</h3>'
            + `<ul class="age-nation-profile-terrain-list">${buildTerrainRowsHtml(profile.nationId)}</ul>`
            + '</section>'
            + '<section class="age-nation-profile-section" aria-labelledby="age-nation-profile-leadership-title">'
            + '<h3 id="age-nation-profile-leadership-title" class="age-nation-profile-section-title">Leadership</h3>'
            + '<div class="age-nation-profile-leadership-grid">'
            + renderLeaderRow('Leader', profile.leader)
            + renderLeaderRow('Co-Leader', profile.viceLeader)
            + '</div>'
            + '<div class="age-nation-profile-council-block">'
            + '<h4 class="age-nation-profile-council-label">Council</h4>'
            + `<ul class="age-nation-profile-council-list">${renderCouncilList(profile.councilMembers)}</ul>`
            + '</div>'
            + '</section>'
            + '</div>'
            + '<footer class="age-nation-profile-actions">'
            + '<button type="button" class="age-nation-profile-dismiss-btn" data-age-nation-profile-close>Close</button>'
            + '</footer>'
        );
    }

    async function fetchNationPublicProfile(nationId) {
        const key = String(nationId || '').trim();
        if (!key) return null;

        try {
            const response = await global.fetch(
                resolveApiUrl(`/api/portal/age/nations/${encodeURIComponent(key)}/public-profile`),
                { cache: 'no-store' }
            );
            if (!response.ok) return null;
            const payload = await response.json();
            return payload?.profile || null;
        } catch (error) {
            console.warn('[RIFT] Nation public profile fetch failed:', error);
            return null;
        }
    }

    async function ensureCommanderHubReady() {
        if (typeof global.openPublicCommanderProfileCard === 'function') return;
        if (typeof global.ensureAgeCommanderNametagHub === 'function') {
            await global.ensureAgeCommanderNametagHub();
        }
    }

    async function openCommanderProfileFromNationModal(username, event) {
        if (event) {
            event.preventDefault();
            event.stopPropagation();
        }
        const target = String(username || '').trim();
        if (!target) return;

        await ensureCommanderHubReady();
        closeNationProfileModal();
        if (typeof global.openPublicCommanderProfileCard === 'function') {
            await global.openPublicCommanderProfileCard(event, target);
        }
    }

    function setNationProfileOpen(open) {
        const overlay = global.document.getElementById('age-nation-profile-overlay');
        if (!overlay) return;

        const nextOpen = Boolean(open);
        overlay.hidden = !nextOpen;
        overlay.setAttribute('aria-hidden', nextOpen ? 'false' : 'true');
        overlay.classList.toggle('is-visible', nextOpen);
        global.document.body.classList.toggle('age-nation-profile-open', nextOpen);

        if (!nextOpen) {
            const mount = global.document.getElementById('age-nation-profile-mount');
            if (mount) mount.innerHTML = '';
            if (escapeHandler) {
                global.document.removeEventListener('keydown', escapeHandler);
                escapeHandler = null;
            }
            return;
        }

        if (!escapeHandler) {
            escapeHandler = (event) => {
                if (event.key === 'Escape') {
                    closeNationProfileModal();
                }
            };
            global.document.addEventListener('keydown', escapeHandler);
        }
    }

    async function openNationProfileModal(nationId, event) {
        if (event) {
            event.preventDefault();
            event.stopPropagation();
        }

        const key = String(nationId || '').trim();
        if (!key) return;

        const overlay = global.document.getElementById('age-nation-profile-overlay');
        const mount = global.document.getElementById('age-nation-profile-mount');
        if (!overlay || !mount) return;

        mount.innerHTML = '<p class="age-nation-profile-loading">Loading nation profile…</p>';
        setNationProfileOpen(true);

        const profile = await fetchNationPublicProfile(key);
        if (!profile) {
            mount.innerHTML = '<p class="age-nation-profile-loading">Nation profile is unavailable.</p>';
            return;
        }

        mount.innerHTML = renderProfileContent(profile);
    }

    function closeNationProfileModal(event) {
        if (event) {
            event.preventDefault();
            event.stopPropagation();
        }
        setNationProfileOpen(false);
    }

    function bindNationProfileModal() {
        if (bound) return;
        bound = true;

        global.document.addEventListener('click', (event) => {
            const commanderTrigger = event.target.closest('[data-age-nation-profile-commander]');
            if (commanderTrigger) {
                void openCommanderProfileFromNationModal(
                    commanderTrigger.getAttribute('data-age-nation-profile-commander'),
                    event
                );
                return;
            }

            if (event.target.closest('[data-age-nation-profile-close]')
                || event.target.closest('.age-nation-profile-close-btn')
                || (event.target.id === 'age-nation-profile-overlay' && !event.target.closest('.age-nation-profile-dialog'))) {
                closeNationProfileModal(event);
            }
        });
    }

    bindNationProfileModal();

    global.RoyalArmiesAgeNationProfile = {
        open: openNationProfileModal,
        close: closeNationProfileModal
    };
    global.openAgeNationProfileModal = openNationProfileModal;
    global.closeAgeNationProfileModal = closeNationProfileModal;
})(window);
