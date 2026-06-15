/**
 * RIFT — Starting location picker: region then nation on one map (no view slide).
 */
(function initGameRegionsMap(global) {
    'use strict';

    const NATION_CREST = {
        Vaelior: 'images/vaeliorcrest.png',
        Aesthene: 'images/aesthenecrest.png',
        Khaerant: 'images/khaerantcrest.png',
        Aethelgard: 'images/aethelgardcrest.png',
        Krall: 'images/krallcrest.png',
        Gorz: 'images/gorzcrest.png',
        Thruun: 'images/thruuncrest.png',
        Skaros: 'images/skaroscrest.png',
        Lyllis: 'images/lylliscrest.png',
        Saelthine: 'images/saelthinecrest.png',
        Vaerenth: 'images/vaerenthcrest.png',
        Trex: 'images/trexcrest.png',
        Mynor: 'images/mynorcrest.png',
        Zevros: 'images/zevroscrest.png',
        Dravic: 'images/draviccrest.png'
    };

    const NATION_ACCENT = {
        Vaelior: '#5a7a9a',
        Aesthene: '#6a9eb8',
        Khaerant: '#9a7a4a',
        Aethelgard: '#6b8a6b',
        Krall: '#8a4a4a',
        Gorz: '#6a3050',
        Thruun: '#9a6a3a',
        Skaros: '#4a3a6a',
        Lyllis: '#c5b878',
        Saelthine: '#7a8a9a',
        Vaerenth: '#5a8a7a',
        Trex: '#8a6a4a',
        Mynor: '#7a7a8a',
        Zevros: '#4a5a8a',
        Dravic: '#5a6a7a'
    };

    const REGIONS = [
        {
            id: 'region-1',
            name: 'Caldera Highlands',
            summary: 'Volcanic craters, obsidian ridges, and sulfur pools—home to the fallen Ash-Born Aidoriians.',
            detail: 'The Caldera Highlands are a stark and brutal territory born from ancient, violent volcanic eruptions. This region is heavily dominated by high-altitude volcanic craters and steep, jagged mountain ridges of black obsidian stone. The surrounding terrain is filled with active sulfur pools, sheer cliffs, and alpine ash plains where plumes of steam still rise continuously from the earth. Long before newer civilizations scaled these heights, the region was home to the Ash-Born Aidoriians, a fire-resistant breed of the first civilization who carved grand, subterranean halls directly into the active crater walls. Tragically, most of this breed perished when their mountain strongholds were besieged during the early cataclysmic wars, or when they were systematically hunted down by the aggressive, magma-worshipping clans that later poured into the highlands. Today, the heavily fortified stone strongholds along the crater rims stand as silent, soot-stained monuments to a dead Aidoriian lineage, now occupied by the brutal tribes who usurped them.',
            terrain: 'High-altitude volcanic craters, black obsidian ridges, active sulfur pools, sheer cliffs, and alpine ash plains with continuous geothermal steam vents.',
            terrainTypes: ['Snow', 'Plains', 'Mountains'],
            regionNations: [
                { id: 'trex', name: 'Trex', epithet: 'The Stoic & Resilient Nation' },
                { id: 'gorz', name: 'Gorz', epithet: 'The Unorthodox & Immoral Nation' },
                { id: 'lyllis', name: 'Lyllis', epithet: 'The Ritualistic & Ascetic Nation' }
            ]
        },
        {
            id: 'region-2',
            name: 'North-Gale Woodlands',
            summary: 'Dark pine forests under freezing gales, where Frost-Veined Aidoriian culture faded into the wild.',
            detail: 'The North-Gale Woodlands are a dark and forbidding wilderness battered by perpetual, freezing winds rushing down from the far north. Massive, ancient pine and spruce forests hold complete dominance here, casting deep shadows over a forest floor broken up by moss-covered ravines, frozen peat bogs, and rocky foothills. The trees themselves have grown thick, twisted, and incredibly resilient over the centuries to survive the brutal weather. In the dawn of Amnek, this region was the domain of the Frost-Veined Aidoriians, a tall, pale breed closely attuned to the bitter cold. Over centuries, large factions of this breed broke away from traditional Aidoriian laws, abandoning their grand cities to merge with the primitive, winter-hardened human tribes migrating into the woods. This cultural corruption caused the pure frost-breed to gradually disappear through generations of interbreeding. The labyrinthine forest floor is still littered with hidden trail markers, frozen burial mounds, and ruined wooden shrines that mark where the ancient Aidoriians once walked before their culture dissolved into the wilderness.',
            terrain: 'Ancient pine and spruce forests, moss-covered ravines, frozen peat bogs, rocky foothills, and wind-scoured northern gales.',
            terrainTypes: ['Mountains', 'Marshlands', 'Forest'],
            regionNations: [
                { id: 'aethelgard', name: 'Aethelgard', epithet: 'The Secret & Research-heavy Nation' },
                { id: 'krall', name: 'Krall', epithet: 'The Barbaric & Relentless Nation' },
                { id: 'saelthine', name: 'Saelthine', epithet: 'The Prophetic & Mystic Nation' }
            ]
        },
        {
            id: 'region-3',
            name: 'Crescent Ridge',
            summary: 'A sweeping limestone escarpment of chalk cliffs, ruined Sky-Watcher towers, and contested trade routes.',
            detail: 'The Crescent Ridge is defined by a massive, sweeping limestone and sandstone escarpment that curves across the landscape like a crescent moon. This dominant ridge rises sharply out of the surrounding terrain, carving out windswept stone arches, deep canyons, chalky white cliffs, and dry scrubland. Because of its unique structure, the ridge has historically functioned as both a high-altitude highway and an impenetrable defensive wall. The original masters of this high ground were the Sky-Watcher Aidoriians, a highly spiritual breed who constructed monolithic stargazing towers along the highest peaks to map the cosmos. During the great collapse of the first civilization, a massive civil war tore through the ridge, resulting in the outright murder of the Aidoriian astronomers. The survivors vanished entirely into the deep canyons below, leaving their white stone towers abandoned. In the centuries that followed, military factions, rogue mercenaries, and outlaw cartels poured into the region, retrofitting the hollowed-out Aidoriian ruins into heavily contested fortresses to control the trade routes moving between the lowlands.',
            terrain: 'Sweeping limestone and sandstone escarpments, chalk-white cliffs, windswept arches, deep canyons, and dry scrub highlands.',
            terrainTypes: ['Desert', 'Mountains'],
            regionNations: [
                { id: 'dravic', name: 'Dravic', epithet: 'The Fortified & Unyielding Nation' },
                { id: 'aesthene', name: 'Aesthene', epithet: 'The Magocratic & Apotropaic Nation' },
                { id: 'vaerenth', name: 'Vaerenth', epithet: 'The Monastic & Serene Nation' }
            ]
        },
        {
            id: 'region-4',
            name: 'Verdant Basin',
            summary: 'Lush river valleys and floodplains—the agricultural heartland built over Earth-Weaver ruins.',
            detail: 'The Verdant Basin is a lush, low-lying river valley that serves as the agricultural heartland of Amnek. Fed by a complex network of glacial meltwater streams, the dominant floodplains are rich with dark, fertile soil, rolling out into dense wetlands, winding river deltas, and thick broadleaf forests. In the realm\'s infancy, this fertile paradise was cultivated by the Earth-Weaver Aidoriians, a peaceful breed renowned for their ability to guide the growth of nature through ancient customs. Their golden age ended abruptly when rival, expansionist civilizations discovered the Basin\'s immense wealth and launched a series of brutal, bloody invasions. The peaceful Earth-Weavers were largely slaughtered in these wars, while the few survivors were subjugated, their culture completely corrupted and erased by the newer farming societies. Sprawling trade hubs and prosperous agricultural communities have thrived here for hundreds of years on top of these blood-soaked fields, though the seasonal flooding of the river deltas frequently unearths the deeply buried, elegant stone foundations of the lost Aidoriian farms.',
            terrain: 'Glacial meltwater rivers, fertile floodplains, dense wetlands, winding deltas, and thick broadleaf forest belts.',
            terrainTypes: ['Marshlands', 'Forest', 'Plains'],
            regionNations: [
                { id: 'thruun', name: 'Thruun', epithet: 'The Ignorant & Corrupt Nation' },
                { id: 'zevros', name: 'Zevros', epithet: 'The Militaristic & Hierarchical Nation' }
            ]
        },
        {
            id: 'region-5',
            name: 'Wyrmtooth Gulf',
            summary: 'Tooth-like sea rocks, treacherous reefs, and cliff fjords haunted by Deep-Shore Aidoriian ruins.',
            detail: 'The Wyrmtooth Gulf is a volatile maritime region named for the sharp, tooth-like rock formations that jut dangerously out of the water. The dominant terrain consists of sheer, rocky coastlines and open, wind-whipped saltwater bays, flanked by hidden sea caves, salt marshes, and treacherous coral reefs. For centuries, this unforgiving coastline was ruled by the Deep-Shore Aidoriians, an amphibious, webbed-fingered breed of the first civilization who built coral-gilded palaces within the cliffside fjords. Their civilization abruptly ended when a massive, supernatural catastrophe caused the majority of the Deep-Shore breed to mysteriously disappear overnight, leaving their coastal shrines empty. The few who remained along the shore were eventually hunted to extinction or driven out by the savage pirate fleets and naval empires that later flooded the gulf. Early naval empires learned to exploit the jagged geography, building their own crude wooden ports inside the deep, hidden fjords right alongside the eroding, beautiful stone carvings left behind by the vanished sea-breed.',
            terrain: 'Tooth-like sea rocks, sheer coastlines, wind-whipped bays, hidden sea caves, salt marshes, and treacherous coral reefs.',
            terrainTypes: ['Marshlands', 'Mountains'],
            regionNations: [
                { id: 'vaelior', name: 'Vaelior', epithet: 'The Ancient & Elegant Nation' },
                { id: 'skaros', name: 'Skaros', epithet: 'The Cultic & Anti-Spiritual Nation' }
            ]
        },
        {
            id: 'region-6',
            name: 'Dreadforge Reach',
            summary: 'A divided island of green plains, central peaks, and underground foundries over lost Iron-Skin sanctuaries.',
            detail: 'The Dreadforge Reach is a vibrant and diverse island region split squarely in two by a stark, towering wall of jagged, snow-capped mountains. The dominant terrain consists of this massive, central mountain spine, which is flanked by wide, sweeping green plains and healthy grasslands to the north. Dense, scattered forests cluster near the northern and western coasts, while the eastern edge tapers into low-lying, watery marshlands, and the far southern tip rises again into rougher, weathered peaks. In the dawn of Amnek, this fertile and varied paradise was home to the Iron-Skin Aidoriians, a resilient breed who lived in perfect harmony with the island\'s ecosystems, using the central mountain wall as a sacred, impenetrable shield for their hidden sanctuaries. Their downfall came when greedy, resource-hungry civilizations discovered the island and used the flat, open northern lowlands and accessible eastern marshes to easily deploy their invading armies. The Iron-Skin breed was cornered against the central peaks and systematically wiped out. The newer civilizations did not ruin the surface landscape, choosing instead to tunnel deep into the roots of the mountains to establish their massive underground foundries and vaults—leaving the hillsides remarkably green while the subterranean depths echo with the continuous hammering of iron.',
            terrain: 'A central snow-capped mountain spine, northern grasslands, coastal forests, eastern marshlands, and deep subterranean foundry vaults.',
            terrainTypes: ['Snow', 'Marshlands', 'Forest', 'Plains', 'Mountains'],
            regionNations: [
                { id: 'mynor', name: 'Mynor', epithet: 'The Engineered & Precise Nation' },
                { id: 'khaerant', name: 'Khaerant', epithet: 'The Strict & Polished Nation' }
            ]
        }
    ];

    const NATION_SVG_SLUG = {
        aesthene: 'aesthine'
    };

    const NATION_REGION_FOLDER = {
        trex: 'caldera-highlands',
        gorz: 'caldera-highlands',
        lyllis: 'caldera-highlands',
        aethelgard: 'north-gale-woodlands',
        krall: 'north-gale-woodlands',
        saelthine: 'north-gale-woodlands',
        dravic: 'crescent-ridge',
        aesthene: 'crescent-ridge',
        vaerenth: 'crescent-ridge',
        thruun: 'verdant-basin',
        zevros: 'verdant-basin',
        vaelior: 'wyrmtooth-gulf',
        skaros: 'wyrmtooth-gulf',
        mynor: 'dreadforge-reach',
        khaerant: 'dreadforge-reach'
    };

    /** Fallback until NEXUS onboarding-config loads (sync with nexus-onboarding.js). */
    const ONBOARDING_CONFIG_FALLBACK = Object.freeze({
        nationIds: Object.freeze([
            'aesthene', 'lyllis', 'dravic', 'vaerenth', 'trex',
            'gorz', 'krall', 'aethelgard', 'saelthine', 'thruun',
            'zevros', 'skaros', 'vaelior', 'mynor', 'khaerant'
        ]),
        regionIds: Object.freeze([
            'region-1', 'region-2', 'region-3', 'region-4', 'region-5', 'region-6'
        ])
    });

    let onboardingOpenConfig = {
        nationIds: ONBOARDING_CONFIG_FALLBACK.nationIds,
        regionIds: ONBOARDING_CONFIG_FALLBACK.regionIds
    };

    async function refreshOnboardingOpenConfig() {
        try {
            const response = await global.fetch(resolveApiUrl('/api/portal/game/onboarding-config'));
            const payload = await response.json().catch(() => ({}));
            if (!response.ok || payload?.status !== 'ok' || !payload?.config) return;

            const nationIds = Array.isArray(payload.config.nationIds)
                ? payload.config.nationIds.map((id) => String(id || '').trim().toLowerCase()).filter(Boolean)
                : [];
            const regionIds = Array.isArray(payload.config.regionIds)
                ? payload.config.regionIds.map((id) => String(id || '').trim()).filter(Boolean)
                : [];

            if (nationIds.length) {
                onboardingOpenConfig = {
                    nationIds,
                    regionIds: regionIds.length ? regionIds : ONBOARDING_CONFIG_FALLBACK.regionIds
                };
            }
        } catch (_error) {
            /* keep fallback */
        }
    }

    function isOnboardingNationAllowed(nationId) {
        const id = String(nationId || '').trim().toLowerCase();
        return onboardingOpenConfig.nationIds.includes(id);
    }

    function isOnboardingRegionAllowed(regionId) {
        const id = String(regionId || '').trim();
        return onboardingOpenConfig.regionIds.includes(id);
    }

    function filterOnboardingNations(nations) {
        return (Array.isArray(nations) ? nations : []).filter((nation) => (
            isOnboardingNationAllowed(nation.id)
        ));
    }

    function resolveApiUrl(path) {
        if (typeof global.resolveRoyalArmiesApiUrl === 'function') {
            return global.resolveRoyalArmiesApiUrl(path);
        }
        return path;
    }

    function resolveOnboardingUsername() {
        const saved = global.localStorage.getItem('activeCommanderUser');
        if (saved && saved.trim()) return saved.trim();
        if (typeof global.getActiveCommanderUsername === 'function') {
            return String(global.getActiveCommanderUsername() || '').trim();
        }
        return '';
    }

    async function persistOnboardingNationSelection(nationId, regionId) {
        const username = resolveOnboardingUsername();
        if (!username || !isOnboardingNationAllowed(nationId) || !isOnboardingRegionAllowed(regionId)) {
            return false;
        }

        try {
            const response = await global.fetch(resolveApiUrl('/api/portal/game/onboarding-nation'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, nationId, regionId })
            });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) {
                if (typeof global.showRiftError === 'function' && payload.code) {
                    global.showRiftError(payload.code, payload.message);
                }
                return false;
            }

            if (global.player && typeof global.player === 'object') {
                global.player.gameNation = String(payload.gameNation || nationId).trim();
            }

            if (typeof global.RoyalArmiesCommanderDossier?.applyCommanderDossierToClient === 'function' && payload.dossier) {
                global.RoyalArmiesCommanderDossier.applyCommanderDossierToClient(payload.dossier);
            } else if (typeof global.applyCommanderDossierToClient === 'function' && payload.dossier) {
                global.applyCommanderDossierToClient(payload.dossier);
            }

            if (payload.movement && typeof global.RoyalArmiesAgeMovement?.applyStatePayload === 'function') {
                global.RoyalArmiesAgeMovement.applyStatePayload(payload.movement, {
                    eventSource: 'onboarding-nation'
                });
            }

            global.dispatchEvent(new CustomEvent('royalarmies:onboarding-nation-saved', {
                detail: {
                    nationId: payload.gameNation || nationId,
                    regionId: payload.regionId || regionId,
                    movement: payload.movement || null
                }
            }));

            return true;
        } catch (err) {
            console.error('[RIFT] Onboarding nation save failed', err);
            return false;
        }
    }

    function applyOnboardingRegionListRestrictions() {
        getListButtons().forEach((btn) => {
            const regionId = btn.getAttribute('data-region-id');
            const allowed = isOnboardingRegionAllowed(regionId);
            const row = btn.closest('li');
            btn.disabled = !allowed;
            btn.setAttribute('aria-disabled', allowed ? 'false' : 'true');
            if (row) row.hidden = !allowed;
        });
    }

    const DETAIL_TABS = ['description', 'terrain', 'nations'];
    let activeDetailTab = 'description';
    let locationPhase = 'region';
    let lockedRegionId = null;
    let hoveredRegionId = null;
    let selectedRegionId = null;
    let hoveredNationId = null;
    let selectedNationId = null;
    let revealedRegionNationId = null;
    let nationPathsReady = false;
    const nationPathCache = new Map();

    function getMapFrame() {
        return global.document.querySelector('.game-region-map-frame');
    }

    function isRegionViewActive() {
        const regionView = global.document.querySelector('.game-page-view--region');
        return Boolean(regionView && !regionView.hidden && regionView.classList.contains('is-active'));
    }

    function measureClusterCssPx(cluster, customProperty, fallback) {
        if (!cluster) return fallback;
        const raw = global.getComputedStyle(cluster).getPropertyValue(customProperty).trim();
        if (!raw) return fallback;
        const probe = global.document.createElement('div');
        probe.style.width = raw;
        probe.style.position = 'absolute';
        probe.style.visibility = 'hidden';
        global.document.body.appendChild(probe);
        const width = probe.getBoundingClientRect().width;
        probe.remove();
        return width || fallback;
    }

    function readClusterSignedPx(cluster, customProperty, fallback) {
        if (!cluster) return fallback;
        const raw = global.getComputedStyle(cluster).getPropertyValue(customProperty).trim();
        if (!raw) return fallback;
        const parsed = parseFloat(raw);
        return Number.isFinite(parsed) ? parsed : fallback;
    }

    function getDetailFlankCoords(cluster, frameRect) {
        const listMapGapPx = measureClusterCssPx(cluster, '--game-region-list-map-gap', 12);
        const listOffsetPx = measureClusterCssPx(cluster, '--game-region-list-offset-x', 0);
        const detailOffsetPx = measureClusterCssPx(
            cluster,
            '--game-region-detail-offset-x',
            Math.max(0, -listOffsetPx)
        );
        const nudgeX = readClusterSignedPx(cluster, '--game-region-detail-nudge-x', 0);
        const nudgeY = readClusterSignedPx(cluster, '--game-region-detail-nudge-y', 0);

        return {
            left: frameRect.right + listMapGapPx + nudgeX,
            top: frameRect.top + nudgeY,
            offsetX: detailOffsetPx
        };
    }

    function applyFlankPanelCoords(panel, left, top, maxHeightPx, offsetX) {
        if (!panel) return;
        panel.style.setProperty('position', 'fixed', 'important');
        panel.style.setProperty('left', `${Math.round(left)}px`, 'important');
        panel.style.setProperty('top', `${Math.round(top)}px`, 'important');
        panel.style.setProperty('right', 'auto', 'important');
        panel.style.setProperty('bottom', 'auto', 'important');
        panel.style.setProperty('margin', '0', 'important');
        panel.style.setProperty('margin-top', '0', 'important');
        panel.style.setProperty('margin-right', '0', 'important');
        panel.style.setProperty('margin-bottom', '0', 'important');
        panel.style.setProperty('margin-left', '0', 'important');
        panel.style.setProperty(
            'transform',
            `translateX(${Math.round(Number(offsetX) || 0)}px)`,
            'important'
        );
        panel.style.setProperty('z-index', '999999900', 'important');
        if (maxHeightPx > 0) {
            panel.style.setProperty('--game-region-flank-max-height', `${Math.round(maxHeightPx)}px`);
        }
    }

    function syncRegionFlankLayout() {
        if (typeof global.isGameOnboardingViewAnimating === 'function' && global.isGameOnboardingViewAnimating()) {
            return;
        }

        const cluster = global.document.querySelector('.game-region-map-cluster');

        if (!isRegionViewActive()) {
            if (cluster) cluster.style.removeProperty('transform');
            return;
        }

        const frame = getMapFrame();
        const listPanel = getListPanel();
        const detailPanel = getActiveDetailPanel();
        if (!frame || !listPanel || !detailPanel) return;

        if (cluster) cluster.style.removeProperty('transform');

        const frameRect = frame.getBoundingClientRect();
        if (frameRect.width <= 0 || frameRect.height <= 0) return;

        const mapHeightPx = frameRect.height;
        const viewportCenterX = global.innerWidth / 2;
        const mapCenterX = frameRect.left + (frameRect.width / 2);
        const mapCenterShiftX = viewportCenterX - mapCenterX;

        listPanel.style.setProperty('--game-region-flank-max-height', `${Math.round(mapHeightPx)}px`);
        listPanel.style.removeProperty('left');
        listPanel.style.removeProperty('top');

        if (cluster && Math.abs(mapCenterShiftX) > 0.5) {
            cluster.style.setProperty('transform', `translateX(${Math.round(mapCenterShiftX)}px)`);
        }

        const shiftedFrameRect = frame.getBoundingClientRect();
        const detailCoords = getDetailFlankCoords(cluster, shiftedFrameRect);

        applyFlankPanelCoords(
            detailPanel,
            detailCoords.left,
            detailCoords.top,
            mapHeightPx,
            detailCoords.offsetX
        );
    }

    function scheduleRegionFlankLayout() {
        if (typeof global.RoyalArmiesViewportMetrics?.schedule === 'function') {
            global.RoyalArmiesViewportMetrics.schedule();
        }
        global.requestAnimationFrame(() => {
            syncRegionFlankLayout();
            global.requestAnimationFrame(syncRegionFlankLayout);
        });
    }

    function bindRegionLayoutSync() {
        const frame = getMapFrame();
        if (!frame || frame.dataset.riftLayoutBound === '1') return;
        frame.dataset.riftLayoutBound = '1';

        const detailPanels = [getDetailPanel(), getNationDetailPanel()].filter(Boolean);

        if (global.ResizeObserver) {
            const layoutObserver = new global.ResizeObserver(() => syncRegionFlankLayout());
            layoutObserver.observe(frame);
            const mapRoot = getMapRoot();
            if (mapRoot) layoutObserver.observe(mapRoot);
            detailPanels.forEach((detailPanel) => {
                layoutObserver.observe(detailPanel);
                const detailInner = detailPanel.querySelector('.game-region-detail-panel-inner');
                if (detailInner) layoutObserver.observe(detailInner);
            });
        }

        global.addEventListener('resize', syncRegionFlankLayout, { passive: true });
        global.addEventListener('orientationchange', syncRegionFlankLayout, { passive: true });
        global.addEventListener('royalarmies:viewport-metrics-updated', scheduleRegionFlankLayout, { passive: true });
        if (global.visualViewport) {
            global.visualViewport.addEventListener('resize', scheduleRegionFlankLayout, { passive: true });
        }

        detailPanels.forEach((detailPanel) => {
            detailPanel.addEventListener('transitionend', (event) => {
                if (event.propertyName === 'width' || event.propertyName === 'max-width') {
                    syncRegionFlankLayout();
                }
            });
        });
    }

    function getMapRoot() {
        return global.document.getElementById('game-region-map');
    }

    function getVisualLayer() {
        return global.document.getElementById('game-region-map-visual');
    }

    function getNationLayer() {
        return global.document.getElementById('game-region-map-nations');
    }

    function getListPanel() {
        return global.document.getElementById('game-region-list-panel');
    }

    function getRegionListWrap() {
        return global.document.getElementById('game-location-region-list-wrap');
    }

    function getNationListWrap() {
        return global.document.getElementById('game-location-nation-list-wrap');
    }

    function getNationListRoot() {
        return global.document.getElementById('game-location-nation-list');
    }

    function getListHeading() {
        return global.document.getElementById('game-location-list-heading');
    }

    function getDetailPanel() {
        return global.document.getElementById('game-region-detail-panel');
    }

    function getNationDetailPanel() {
        return global.document.getElementById('game-location-nation-detail-panel');
    }

    function getActiveDetailPanel() {
        return locationPhase === 'nation' ? getNationDetailPanel() : getDetailPanel();
    }

    function getDetailTitle() {
        return global.document.getElementById('game-region-detail-title');
    }

    function getDetailCopy() {
        return global.document.getElementById('game-region-detail-copy');
    }

    function getTerrainList() {
        return global.document.getElementById('game-region-terrain-list');
    }

    function renderTerrainList(meta) {
        const list = getTerrainList();
        if (!list) return;

        list.textContent = '';
        const terrainTypes = Array.isArray(meta?.terrainTypes)
            ? meta.terrainTypes.slice().reverse()
            : [];
        if (!terrainTypes.length) {
            const empty = global.document.createElement('li');
            empty.className = 'game-region-terrain-item game-region-terrain-item--empty';
            empty.textContent = 'Terrain data unavailable.';
            list.appendChild(empty);
            return;
        }

        terrainTypes.forEach((terrainName, index) => {
            const item = global.document.createElement('li');
            const isMostAbundant = index === 0;
            item.className = isMostAbundant
                ? 'game-region-terrain-item game-region-terrain-item--most-abundant'
                : 'game-region-terrain-item';
            item.setAttribute('role', 'listitem');

            const icon = global.document.createElement('span');
            icon.className = 'game-region-terrain-icon';
            icon.setAttribute('aria-hidden', 'true');

            const label = global.document.createElement('span');
            label.className = 'game-region-terrain-name';
            label.textContent = terrainName;

            item.appendChild(icon);
            item.appendChild(label);
            list.appendChild(item);
        });
    }

    function getNationsGrid() {
        return global.document.getElementById('game-region-nations-grid');
    }

    function getNationReveal() {
        return global.document.getElementById('game-region-nation-reveal');
    }

    function clearNationReveal() {
        revealedRegionNationId = null;
        const reveal = getNationReveal();
        if (!reveal) return;
        reveal.textContent = '';
        reveal.hidden = true;
        reveal.removeAttribute('data-nation-id');
    }

    function setSelectedNationCrest(nationId) {
        const grid = getNationsGrid();
        if (!grid) return;
        grid.querySelectorAll('.game-region-nation-crest-btn').forEach((btn) => {
            const isSelected = btn.getAttribute('data-nation-id') === nationId;
            btn.classList.toggle('is-selected', isSelected);
            btn.setAttribute('aria-pressed', isSelected ? 'true' : 'false');
        });
    }

    function revealNationName(nation) {
        const reveal = getNationReveal();
        if (!reveal || !nation) return;
        revealedRegionNationId = nation.id;
        reveal.textContent = nation.name;
        reveal.hidden = false;
        reveal.setAttribute('data-nation-id', nation.id);
        const accent = NATION_ACCENT[nation.name] || '#ffd700';
        reveal.style.setProperty('--game-region-nation-accent', accent);
        setSelectedNationCrest(nation.id);
    }

    function onNationCrestClick(event) {
        const btn = event.currentTarget;
        if (!btn) return;
        const nationId = btn.getAttribute('data-nation-id');
        const nationName = btn.getAttribute('data-nation-name');
        if (!nationId || !nationName) return;

        if (revealedRegionNationId === nationId) {
            clearNationReveal();
            setSelectedNationCrest(null);
            return;
        }

        revealNationName({ id: nationId, name: nationName });
    }

    function renderNationsList(meta) {
        const grid = getNationsGrid();
        if (!grid) return;

        clearNationReveal();
        setSelectedNationCrest(null);
        grid.textContent = '';

        const regionNations = filterOnboardingNations(meta?.regionNations);
        if (!regionNations.length) {
            const empty = global.document.createElement('li');
            empty.className = 'game-region-nations-item game-region-nations-item--empty';
            empty.textContent = 'Nation data unavailable.';
            grid.appendChild(empty);
            return;
        }

        regionNations.forEach((nation) => {
            const crestSrc = resolveNationCrestSrc(nation.name);
            const accent = NATION_ACCENT[nation.name] || '#ffd700';
            const item = global.document.createElement('li');
            item.className = 'game-region-nations-item';
            item.setAttribute('role', 'listitem');

            const btn = global.document.createElement('button');
            btn.type = 'button';
            btn.className = 'game-region-nation-crest-btn';
            btn.setAttribute('data-nation-id', nation.id);
            btn.setAttribute('data-nation-name', nation.name);
            btn.setAttribute('aria-pressed', 'false');
            btn.style.setProperty('--game-region-nation-accent', accent);
            if (nation.epithet) {
                btn.setAttribute('title', nation.epithet);
                btn.setAttribute('aria-label', `${nation.name} — ${nation.epithet}`);
            } else {
                btn.setAttribute('aria-label', nation.name);
            }

            const sigil = global.document.createElement('span');
            sigil.className = 'game-region-nation-crest-sigil';
            sigil.setAttribute('aria-hidden', 'true');

            if (crestSrc) {
                const img = global.document.createElement('img');
                img.className = 'game-region-nation-crest-img';
                img.src = crestSrc;
                img.alt = '';
                img.loading = 'lazy';
                img.decoding = 'async';
                sigil.appendChild(img);
            }

            btn.appendChild(sigil);
            btn.addEventListener('click', onNationCrestClick);
            item.appendChild(btn);
            grid.appendChild(item);
        });
    }

    function resolveNationCrestSrc(nationName) {
        const crestPath = NATION_CREST[nationName];
        if (!crestPath) return '';
        try {
            return new URL(crestPath, global.location.href).href;
        } catch (err) {
            return crestPath;
        }
    }

    function resolveNationSvgUrl(nationId) {
        const slug = NATION_SVG_SLUG[nationId] || nationId;
        return `season-0/regions/nations/mapof${slug}.svg`;
    }

    function normalizeFillHex(fill) {
        if (!fill) return '';
        const trimmed = String(fill).trim().toLowerCase();
        const hexMatch = trimmed.match(/^#([0-9a-f]{3,8})$/i);
        if (!hexMatch) return '';
        let hex = hexMatch[1];
        if (hex.length === 3) {
            hex = hex.split('').map((ch) => ch + ch).join('');
        }
        return hex.slice(0, 6);
    }

    function isTerritoryFill(fill) {
        if (!fill) return false;
        const value = String(fill).trim().toLowerCase();
        return Boolean(value && value !== 'none' && value !== 'transparent');
    }

    function parseNationSvgPaths(svgText, nationId) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(svgText, 'image/svg+xml');
        const paths = Array.from(doc.querySelectorAll('path'));
        const territoryPaths = paths.filter((pathEl) => isTerritoryFill(pathEl.getAttribute('fill')));
        return territoryPaths.map((pathEl, index) => ({
            d: pathEl.getAttribute('d') || '',
            fill: pathEl.getAttribute('fill') || '#ffc802',
            index
        })).filter((entry) => entry.d);
    }

    async function fetchNationSvgPaths(nationId) {
        if (nationPathCache.has(nationId)) {
            return nationPathCache.get(nationId);
        }
        const url = resolveNationSvgUrl(nationId);
        const response = await global.fetch(url, { cache: 'force-cache' });
        if (!response.ok) {
            throw new Error(`Failed to load nation map: ${url}`);
        }
        const svgText = await response.text();
        const paths = parseNationSvgPaths(svgText, nationId);
        nationPathCache.set(nationId, paths);
        return paths;
    }

    function clearNationLayer() {
        const layer = getNationLayer();
        if (!layer) return;
        layer.textContent = '';
        layer.setAttribute('aria-hidden', 'true');
        nationPathsReady = false;
    }

    function injectNationPaths(regionId) {
        const layer = getNationLayer();
        const meta = getRegionMeta(regionId);
        if (!layer || !meta) return Promise.resolve();

        clearNationLayer();
        const nations = Array.isArray(meta.regionNations) ? meta.regionNations : [];
        if (!nations.length) return Promise.resolve();

        return Promise.all(nations.map((nation) => fetchNationSvgPaths(nation.id)))
            .then((pathGroups) => {
                pathGroups.forEach((paths, nationIndex) => {
                    const nation = nations[nationIndex];
                    const accent = NATION_ACCENT[nation.name] || '#ffd700';
                    paths.forEach((pathData, pathIndex) => {
                        const pathEl = global.document.createElementNS('http://www.w3.org/2000/svg', 'path');
                        pathEl.setAttribute('class', 'game-nation-zone game-nation-visual');
                        pathEl.setAttribute('data-nation-id', nation.id);
                        pathEl.setAttribute('data-path-index', String(pathIndex));
                        pathEl.setAttribute('fill', pathData.fill);
                        pathEl.setAttribute('d', pathData.d);
                        pathEl.style.setProperty('--game-nation-accent', accent);
                        layer.appendChild(pathEl);
                    });
                });
                layer.removeAttribute('aria-hidden');
                nationPathsReady = true;
            })
            .catch((err) => {
                console.error('[RIFT] Nation map paths failed to load', err);
            });
    }

    function getNationMeta(nationId) {
        for (const region of REGIONS) {
            const nations = Array.isArray(region.regionNations) ? region.regionNations : [];
            const match = nations.find((nation) => nation.id === nationId);
            if (match) return { ...match, regionId: region.id, regionName: region.name };
        }
        return null;
    }

    function getVisualPathsForNation(nationId) {
        const layer = getNationLayer();
        if (!layer || !nationId) return [];
        return Array.from(layer.querySelectorAll(`path[data-nation-id="${CSS.escape(nationId)}"]`));
    }

    function setNationMapHighlight(nationId, isActive) {
        getVisualPathsForNation(nationId).forEach((pathEl) => {
            pathEl.classList.toggle('is-hovered', isActive);
        });
    }

    function setNationMapSelected(nationId, isSelected) {
        getVisualPathsForNation(nationId).forEach((pathEl) => {
            pathEl.classList.toggle('is-selected', isSelected);
        });
    }

    function clearNationMapStates() {
        const layer = getNationLayer();
        if (!layer) return;
        Array.from(layer.querySelectorAll('path.is-hovered, path.is-selected')).forEach((pathEl) => {
            pathEl.classList.remove('is-hovered', 'is-selected');
        });
    }

    function getNationListButtons() {
        const root = getNationListRoot();
        if (!root) return [];
        return Array.from(root.querySelectorAll('.game-region-list-btn'));
    }

    function updateNationListButtonStates() {
        getNationListButtons().forEach((btn) => {
            const nationId = btn.getAttribute('data-nation-id');
            const isSelected = Boolean(selectedNationId && nationId === selectedNationId);
            const isHovered = Boolean(hoveredNationId && nationId === hoveredNationId && !isSelected);
            btn.classList.toggle('is-selected', isSelected);
            btn.classList.toggle('is-hovered', isHovered);
            btn.setAttribute('aria-selected', isSelected ? 'true' : 'false');
        });
    }

    function renderNationList(regionId) {
        const root = getNationListRoot();
        const meta = getRegionMeta(regionId);
        if (!root || !meta) return;

        root.textContent = '';
        const nations = filterOnboardingNations(meta.regionNations);
        if (!nations.length) {
            const empty = global.document.createElement('li');
            empty.className = 'game-region-list-item game-region-list-item--empty';
            empty.textContent = 'No nations available in this region yet.';
            root.appendChild(empty);
            return;
        }

        nations.forEach((nation) => {
            const item = global.document.createElement('li');
            item.setAttribute('role', 'presentation');

            const btn = global.document.createElement('button');
            btn.type = 'button';
            btn.className = 'game-region-list-btn';
            btn.setAttribute('data-nation-id', nation.id);
            btn.setAttribute('role', 'option');
            btn.setAttribute('aria-selected', 'false');
            if (nation.epithet) {
                btn.setAttribute('title', nation.epithet);
            }

            const label = global.document.createElement('span');
            label.className = 'game-region-list-btn-label';
            label.textContent = nation.name;
            btn.appendChild(label);
            item.appendChild(btn);
            root.appendChild(item);
        });
    }

    function hideNationDetailPanel() {
        const panel = getNationDetailPanel();
        if (!panel) return;
        panel.hidden = true;
        panel.classList.remove('is-active');
    }

    function showNationDetailPanel(nationId) {
        const panel = getNationDetailPanel();
        const nation = getNationMeta(nationId);
        const title = global.document.getElementById('game-location-nation-detail-title');
        const epithet = global.document.getElementById('game-location-nation-detail-epithet');
        const hint = global.document.getElementById('game-location-nation-detail-hint');
        const crest = global.document.getElementById('game-location-nation-detail-crest');
        if (!panel || !nation || !title) return;

        title.textContent = nation.name;
        if (epithet) {
            epithet.textContent = nation.epithet || '';
            epithet.hidden = !nation.epithet;
        }
        if (hint) {
            hint.hidden = true;
        }
        if (crest) {
            crest.textContent = '';
            const crestSrc = resolveNationCrestSrc(nation.name);
            const accent = NATION_ACCENT[nation.name] || '#ffd700';
            crest.style.setProperty('--game-location-nation-accent', accent);
            if (crestSrc) {
                const img = global.document.createElement('img');
                img.className = 'game-location-nation-detail-crest-img';
                img.src = crestSrc;
                img.alt = '';
                img.loading = 'lazy';
                img.decoding = 'async';
                crest.appendChild(img);
            }
        }

        panel.hidden = false;
        panel.classList.add('is-active');
        scheduleRegionFlankLayout();
    }

    function applyHoveredNation(nationId) {
        if (hoveredNationId && hoveredNationId !== selectedNationId) {
            setNationMapHighlight(hoveredNationId, false);
        }
        hoveredNationId = nationId || null;
        if (hoveredNationId && hoveredNationId !== selectedNationId) {
            setNationMapHighlight(hoveredNationId, true);
        }
        updateNationListButtonStates();
    }

    function applySelectedNation(nationId) {
        const nextNationId = nationId || null;
        if (nextNationId && !isOnboardingNationAllowed(nextNationId)) {
            return;
        }
        clearNationMapStates();
        selectedNationId = nextNationId;

        if (selectedNationId) {
            setNationMapHighlight(selectedNationId, false);
            setNationMapSelected(selectedNationId, true);
            showNationDetailPanel(selectedNationId);
        } else {
            hideNationDetailPanel();
        }

        if (hoveredNationId && hoveredNationId !== selectedNationId) {
            setNationMapHighlight(hoveredNationId, true);
        }

        updateNationListButtonStates();
        updateConfirmButtonVisibility();

        global.dispatchEvent(new CustomEvent('royalarmies:nation-selected', {
            detail: { nationId: selectedNationId, regionId: lockedRegionId }
        }));
    }

    function enterNationPhase() {
        if (!selectedRegionId || locationPhase === 'nation') return;

        lockedRegionId = selectedRegionId;
        locationPhase = 'nation';
        hoveredNationId = null;
        selectedNationId = null;

        const regionWrap = getRegionListWrap();
        const nationWrap = getNationListWrap();
        if (regionWrap) regionWrap.hidden = true;
        if (nationWrap) nationWrap.hidden = false;

        const regionDetail = getDetailPanel();
        if (regionDetail) {
            regionDetail.hidden = true;
            regionDetail.classList.remove('is-active');
        }
        hideNationDetailPanel();

        renderNationList(lockedRegionId);
        injectNationPaths(lockedRegionId);
        updateConfirmButtonVisibility();

        const meta = getRegionMeta(lockedRegionId);
        const openNations = filterOnboardingNations(meta?.regionNations);
        if (openNations.length === 1) {
            applySelectedNation(openNations[0].id);
        }

        scheduleRegionFlankLayout();
    }

    function exitNationPhase() {
        locationPhase = 'region';
        lockedRegionId = null;
        hoveredNationId = null;
        selectedNationId = null;

        const regionWrap = getRegionListWrap();
        const nationWrap = getNationListWrap();
        if (regionWrap) regionWrap.hidden = false;
        if (nationWrap) nationWrap.hidden = true;

        clearNationLayer();
        hideNationDetailPanel();

        if (selectedRegionId) {
            showDetailPanel(selectedRegionId);
        }

        updateConfirmButtonVisibility();
        scheduleRegionFlankLayout();
    }

    function resetLocationPicker() {
        exitNationPhase();
        applySelectedRegion(null);
    }

    function getDetailSubtabs() {
        const panel = getDetailPanel();
        if (!panel) return [];
        return Array.from(panel.querySelectorAll('.game-region-detail-subtab'));
    }

    function getDetailTabPanel(tabId) {
        return global.document.getElementById(`game-region-tab-${tabId}`);
    }

    function applyDetailTab(tabId) {
        const nextTab = DETAIL_TABS.includes(tabId) ? tabId : 'description';
        activeDetailTab = nextTab;

        getDetailSubtabs().forEach((btn) => {
            const isActive = btn.getAttribute('data-region-detail-tab') === nextTab;
            btn.classList.toggle('is-active', isActive);
            btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
            btn.setAttribute('tabindex', isActive ? '0' : '-1');
        });

        DETAIL_TABS.forEach((id) => {
            const panel = getDetailTabPanel(id);
            if (!panel) return;
            const isActive = id === nextTab;
            panel.classList.toggle('is-active', isActive);
            panel.hidden = !isActive;
        });

        scheduleRegionFlankLayout();
    }

    function populateDetailPanelContent(meta) {
        const title = getDetailTitle();
        const description = getDetailCopy();
        if (!meta || !title || !description) return;

        title.textContent = meta.name;
        description.textContent = meta.detail || '';
        renderTerrainList(meta);
        renderNationsList(meta);
    }

    function getRegionConfirmButton() {
        return global.document.getElementById('game-region-confirm-btn');
    }

    function getPanelActionsWrap() {
        return global.document.getElementById('game-location-panel-actions');
    }

    function getBackRegionButton() {
        return global.document.getElementById('game-location-back-region-btn');
    }

    function getConfirmNationButton() {
        return global.document.getElementById('game-location-confirm-nation-btn');
    }

    function setPanelButtonState(btn, show) {
        if (!btn) return;
        btn.hidden = !show;
        btn.disabled = !show;
        btn.setAttribute('aria-disabled', show ? 'false' : 'true');
    }

    function updateConfirmButtonVisibility() {
        const regionConfirmBtn = getRegionConfirmButton();
        const panelActions = getPanelActionsWrap();
        const backBtn = getBackRegionButton();
        const nationConfirmBtn = getConfirmNationButton();
        const inNationPhase = locationPhase === 'nation';
        const hasRegion = Boolean(selectedRegionId || lockedRegionId);
        const hasNation = Boolean(selectedNationId);
        const showRegionConfirm = !inNationPhase && Boolean(selectedRegionId);
        const showPanelActions = showRegionConfirm || inNationPhase;

        if (regionConfirmBtn) {
            setPanelButtonState(regionConfirmBtn, showRegionConfirm);
        }

        if (panelActions) {
            panelActions.hidden = !showPanelActions;
        }

        if (backBtn) {
            setPanelButtonState(backBtn, inNationPhase && hasRegion);
        }

        if (nationConfirmBtn) {
            setPanelButtonState(nationConfirmBtn, inNationPhase && hasNation);
        }

        scheduleRegionFlankLayout();
    }

    function onRegionConfirmClick(event) {
        if (event) event.preventDefault();
        if (locationPhase !== 'region' || !selectedRegionId) return;
        if (!isOnboardingRegionAllowed(selectedRegionId)) return;
        enterNationPhase();
    }

    function onBackRegionClick(event) {
        if (event) event.preventDefault();
        if (locationPhase !== 'nation') return;
        exitNationPhase();
    }

    async function onNationConfirmClick(event) {
        if (event) event.preventDefault();
        if (locationPhase !== 'nation' || !selectedNationId) return;
        if (!isOnboardingNationAllowed(selectedNationId) || !isOnboardingRegionAllowed(lockedRegionId)) {
            return;
        }

        const nationConfirmBtn = getConfirmNationButton();
        if (nationConfirmBtn) nationConfirmBtn.disabled = true;

        const saved = await persistOnboardingNationSelection(selectedNationId, lockedRegionId);
        updateConfirmButtonVisibility();

        const allowLocalPreviewAdvance = typeof global.shouldAllowLocalGameProgressionPreview === 'function'
            && global.shouldAllowLocalGameProgressionPreview();

        if (!saved && !allowLocalPreviewAdvance) {
            if (nationConfirmBtn) nationConfirmBtn.disabled = false;
            return;
        }

        if (typeof global.advanceGameOnboarding === 'function') {
            global.advanceGameOnboarding();
        }
    }

    function getListButtons() {
        const panel = getListPanel();
        if (!panel) return [];
        return Array.from(panel.querySelectorAll('.game-region-list-btn'));
    }

    function getRegionMeta(regionId) {
        return REGIONS.find((region) => region.id === regionId) || null;
    }

    function getVisualPathsForRegion(regionId) {
        const layer = getVisualLayer();
        if (!layer || !regionId) return [];
        return Array.from(layer.querySelectorAll(`path[data-region-id="${CSS.escape(regionId)}"]`));
    }

    function setRegionMapHighlight(regionId, isActive) {
        getVisualPathsForRegion(regionId).forEach((pathEl) => {
            pathEl.classList.toggle('is-hovered', isActive);
        });
    }

    function setRegionMapSelected(regionId, isSelected) {
        getVisualPathsForRegion(regionId).forEach((pathEl) => {
            pathEl.classList.toggle('is-selected', isSelected);
        });
    }

    function clearMapHighlights() {
        const layer = getVisualLayer();
        if (!layer) return;
        Array.from(layer.querySelectorAll('path.is-hovered')).forEach((pathEl) => {
            pathEl.classList.remove('is-hovered');
        });
    }

    function withoutMapPathTransition(pathEls, fn) {
        if (!pathEls.length) {
            fn();
            return;
        }
        pathEls.forEach((pathEl) => {
            pathEl.style.setProperty('transition', 'none');
        });
        fn();
        void pathEls[0].getBoundingClientRect();
        pathEls.forEach((pathEl) => {
            pathEl.style.removeProperty('transition');
        });
    }

    function clearAllMapRegionStates() {
        const layer = getVisualLayer();
        if (!layer) return;
        const activePaths = Array.from(layer.querySelectorAll('path.is-hovered, path.is-selected'));
        if (!activePaths.length) return;
        withoutMapPathTransition(activePaths, () => {
            activePaths.forEach((pathEl) => {
                pathEl.classList.remove('is-hovered', 'is-selected');
            });
        });
    }

    function updateListButtonStates() {
        getListButtons().forEach((btn) => {
            const regionId = btn.getAttribute('data-region-id');
            const isSelected = Boolean(selectedRegionId && regionId === selectedRegionId);
            const isHovered = Boolean(hoveredRegionId && regionId === hoveredRegionId && !isSelected);
            btn.classList.toggle('is-selected', isSelected);
            btn.classList.toggle('is-hovered', isHovered);
            btn.setAttribute('aria-selected', isSelected ? 'true' : 'false');
        });
    }

    function showDetailPanel(regionId) {
        const panel = getDetailPanel();
        const meta = getRegionMeta(regionId);
        if (!panel || !meta) return;

        populateDetailPanelContent(meta);
        applyDetailTab('description');
        panel.hidden = false;
        panel.classList.add('is-active');
        scheduleRegionFlankLayout();
    }

    function hideDetailPanel() {
        const panel = getDetailPanel();
        if (!panel) return;
        panel.hidden = true;
        panel.classList.remove('is-active');
        scheduleRegionFlankLayout();
    }

    function applyHoveredRegion(regionId) {
        if (hoveredRegionId && hoveredRegionId !== selectedRegionId) {
            setRegionMapHighlight(hoveredRegionId, false);
        }
        hoveredRegionId = regionId || null;
        if (hoveredRegionId && hoveredRegionId !== selectedRegionId) {
            setRegionMapHighlight(hoveredRegionId, true);
        }
        updateListButtonStates();
    }

    function applySelectedRegion(regionId) {
        if (locationPhase === 'nation') {
            return;
        }

        const nextRegionId = regionId || null;
        if (nextRegionId && !isOnboardingRegionAllowed(nextRegionId)) {
            return;
        }

        if (!nextRegionId && lockedRegionId) {
            exitNationPhase();
        }

        clearAllMapRegionStates();

        selectedRegionId = nextRegionId;

        if (selectedRegionId) {
            setRegionMapHighlight(selectedRegionId, false);
            setRegionMapSelected(selectedRegionId, true);
            showDetailPanel(selectedRegionId);
        } else {
            hideDetailPanel();
        }

        if (hoveredRegionId && hoveredRegionId !== selectedRegionId) {
            setRegionMapHighlight(hoveredRegionId, true);
        }

        updateListButtonStates();
        updateConfirmButtonVisibility();

        global.dispatchEvent(new CustomEvent('royalarmies:region-selected', {
            detail: { regionId: selectedRegionId }
        }));
    }

    function onListPointerOver(event) {
        const btn = event.target.closest('.game-region-list-btn');
        if (!btn) return;

        if (locationPhase === 'nation') {
            applyHoveredNation(btn.getAttribute('data-nation-id'));
            return;
        }

        applyHoveredRegion(btn.getAttribute('data-region-id'));
    }

    function onListPointerOut(event) {
        const btn = event.target.closest('.game-region-list-btn');
        if (!btn) return;
        const related = event.relatedTarget;
        if (related && btn.contains(related)) return;

        if (locationPhase === 'nation') {
            applyHoveredNation(null);
            return;
        }

        applyHoveredRegion(null);
    }

    function onListClick(event) {
        const btn = event.target.closest('.game-region-list-btn');
        if (!btn) return;
        event.preventDefault();

        if (locationPhase === 'nation') {
            applySelectedNation(btn.getAttribute('data-nation-id'));
            return;
        }

        applySelectedRegion(btn.getAttribute('data-region-id'));
    }

    function onDetailSubtabClick(event) {
        const tabBtn = event.target.closest('.game-region-detail-subtab');
        if (!tabBtn) return;
        event.preventDefault();
        event.stopPropagation();
        applyDetailTab(tabBtn.getAttribute('data-region-detail-tab'));
    }

    function onDetailSubtabKeydown(event) {
        const tabBtn = event.target.closest('.game-region-detail-subtab');
        if (!tabBtn) return;

        const tabs = getDetailSubtabs();
        const currentIndex = tabs.indexOf(tabBtn);
        if (currentIndex < 0) return;

        let nextIndex = currentIndex;
        if (event.key === 'ArrowRight') {
            nextIndex = (currentIndex + 1) % tabs.length;
        } else if (event.key === 'ArrowLeft') {
            nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
        } else if (event.key === 'Home') {
            nextIndex = 0;
        } else if (event.key === 'End') {
            nextIndex = tabs.length - 1;
        } else if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            applyDetailTab(tabBtn.getAttribute('data-region-detail-tab'));
            return;
        } else {
            return;
        }

        event.preventDefault();
        tabs[nextIndex].focus();
        applyDetailTab(tabs[nextIndex].getAttribute('data-region-detail-tab'));
    }

    function onListKeydown(event) {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        const btn = event.target.closest('.game-region-list-btn');
        if (!btn) return;
        event.preventDefault();

        if (locationPhase === 'nation') {
            applySelectedNation(btn.getAttribute('data-nation-id'));
            return;
        }

        applySelectedRegion(btn.getAttribute('data-region-id'));
    }

    function bindRegionPicker() {
        const listPanel = getListPanel();
        if (!listPanel || listPanel.dataset.riftBound === '1') return;
        listPanel.dataset.riftBound = '1';

        listPanel.addEventListener('pointerover', onListPointerOver);
        listPanel.addEventListener('pointerout', onListPointerOut);
        listPanel.addEventListener('click', onListClick);
        listPanel.addEventListener('keydown', onListKeydown);

        const regionConfirmBtn = getRegionConfirmButton();
        if (regionConfirmBtn && regionConfirmBtn.dataset.riftBound !== '1') {
            regionConfirmBtn.dataset.riftBound = '1';
            regionConfirmBtn.addEventListener('click', onRegionConfirmClick);
        }

        const backBtn = getBackRegionButton();
        if (backBtn && backBtn.dataset.riftBound !== '1') {
            backBtn.dataset.riftBound = '1';
            backBtn.addEventListener('click', onBackRegionClick);
        }

        const nationConfirmBtn = getConfirmNationButton();
        if (nationConfirmBtn && nationConfirmBtn.dataset.riftBound !== '1') {
            nationConfirmBtn.dataset.riftBound = '1';
            nationConfirmBtn.addEventListener('click', onNationConfirmClick);
        }

        const detailPanel = getDetailPanel();
        if (detailPanel && detailPanel.dataset.riftDetailTabsBound !== '1') {
            detailPanel.dataset.riftDetailTabsBound = '1';
            detailPanel.addEventListener('click', onDetailSubtabClick);
            detailPanel.addEventListener('keydown', onDetailSubtabKeydown);
        }
    }

    async function init() {
        if (!getMapRoot() || !getVisualLayer() || !getListPanel()) return;
        await refreshOnboardingOpenConfig();
        bindRegionPicker();
        bindRegionLayoutSync();
        applyOnboardingRegionListRestrictions();
        clearMapHighlights();
        clearNationLayer();
        hideDetailPanel();
        hideNationDetailPanel();
        const nationWrap = getNationListWrap();
        if (nationWrap) nationWrap.hidden = true;
        updateConfirmButtonVisibility();
        if (onboardingOpenConfig.regionIds.length === 1 && locationPhase === 'region') {
            applySelectedRegion(onboardingOpenConfig.regionIds[0]);
        }
        scheduleRegionFlankLayout();
    }

    global.RoyalArmiesGameRegionsMap = {
        init,
        syncFlankLayout: syncRegionFlankLayout,
        scheduleFlankLayout: scheduleRegionFlankLayout,
        getRegions: () => REGIONS.map((region) => ({ ...region })),
        getSelectedRegionId: () => selectedRegionId,
        getSelectedNationId: () => selectedNationId,
        getLocationPhase: () => locationPhase,
        setSelectedRegionId(regionId) {
            if (!regionId) {
                resetLocationPicker();
                return;
            }
            if (locationPhase === 'nation') {
                return;
            }
            applySelectedRegion(regionId);
        },
        setSelectedNationId: applySelectedNation,
        resetLocationPicker,
        refreshZoneBindings: init,
        persistOnboardingNationSelection,
        isOnboardingNationAllowed,
        isOnboardingRegionAllowed
    };

    if (global.document.readyState === 'loading') {
        global.document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})(window);
