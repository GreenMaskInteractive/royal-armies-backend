/**
 * RIFT — Blessed Banners 25-node asymmetrical skill tree modal.
 */
(function initRoyalArmiesBlessedBannersModal(global) {
    'use strict';

    const SCHEMA_STATIC_URL = 'blessed-banners-schema.json?v=banner-no-skill-identity-1';
    const SCHEMA_API_URL = '/api/portal/age/blessed-banners/schema';
    const SCHEMA_FETCH_TIMEOUT_MS = 1800;
    const TWENTY_FIVE_NODE_BANNERS = new Set(['emerald-barrier']);
    const ROOT_AUTO_NODES = Object.freeze({
        'emerald-barrier': 'eb-01'
    });

    const RADIAL_TREE_CONFIG = Object.freeze({
        'emerald-barrier': Object.freeze({
            centerX: 520,
            centerY: 460,
            ringStep: 196,
            pad: 120,
            trunkAngle: Math.PI / 2,
            branchAngles: Object.freeze({
                A: Math.PI / 5,
                B: (4 * Math.PI) / 5,
                C: (-4 * Math.PI) / 5
            }),
            defaultZoom: 0.72
        })
    });

    const TREE_ZOOM_MIN = 0.65;
    const TREE_ZOOM_MAX = 1.85;
    const TREE_ZOOM_STEP = 0.1;
    const TREE_FOCUS_ZOOM = TREE_ZOOM_MAX;

    let schemaCache = null;
    let schemaFetchPromise = null;
    let activeBannerId = '';
    let shellReady = false;
    let handlersBound = false;
    let treeZoom = 1;
    let treePanState = null;
    let supportsCssZoomCache = null;
    let selectedNodeId = '';

    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function getBannerApi() {
        return global.RoyalArmiesBanner || null;
    }

    function readState() {
        const api = getBannerApi();
        return api?.getBannerState?.() || {
            bannerId: '',
            perkPoints: 0,
            unlockedNodeIds: [],
            unlockedPerkIds: []
        };
    }

    function writeState(next) {
        const api = getBannerApi();
        if (api?.writeBannerState) {
            return api.writeBannerState(next);
        }
        try {
            global.localStorage.setItem('royalarmies:age-banner-state', JSON.stringify(next));
            return true;
        } catch (_error) {
            return false;
        }
    }

    function normalizeUnlockedSet(state, bannerId) {
        const raw = Array.isArray(state?.unlockedNodeIds)
            ? state.unlockedNodeIds
            : (Array.isArray(state?.unlockedPerkIds) ? state.unlockedPerkIds : []);
        const unlocked = new Set(raw.map((id) => String(id || '').trim()).filter(Boolean));
        const rootId = ROOT_AUTO_NODES[bannerId];
        if (rootId) unlocked.add(rootId);
        return unlocked;
    }

    async function fetchSchemaUrl(url, timeoutMs = SCHEMA_FETCH_TIMEOUT_MS) {
        const controller = new AbortController();
        const timer = global.setTimeout(() => controller.abort(), timeoutMs);
        try {
            const response = await global.fetch(url, {
                credentials: 'same-origin',
                signal: controller.signal
            });
            if (!response.ok) return null;
            const payload = await response.json();
            if (payload?.banners && typeof payload.banners === 'object') {
                return payload;
            }
        } catch (_error) {
            /* timeout or network error */
        } finally {
            global.clearTimeout(timer);
        }
        return null;
    }

    async function loadSchemaFromNetwork() {
        const staticSchema = await fetchSchemaUrl(SCHEMA_STATIC_URL, 1200);
        if (staticSchema) {
            schemaCache = staticSchema;
            void fetchSchemaUrl(SCHEMA_API_URL, SCHEMA_FETCH_TIMEOUT_MS).then((apiSchema) => {
                if (apiSchema) schemaCache = apiSchema;
            });
            return schemaCache;
        }

        const apiSchema = await fetchSchemaUrl(SCHEMA_API_URL, SCHEMA_FETCH_TIMEOUT_MS);
        if (apiSchema) {
            schemaCache = apiSchema;
            return schemaCache;
        }

        return { banners: {} };
    }

    function fetchSchema() {
        if (schemaCache) return Promise.resolve(schemaCache);
        if (!schemaFetchPromise) {
            schemaFetchPromise = loadSchemaFromNetwork().finally(() => {
                schemaFetchPromise = null;
            });
        }
        return schemaFetchPromise;
    }

    function preloadSchema() {
        void fetchSchema();
    }

    function resolveBannerSchema(schema, bannerId) {
        return schema?.banners?.[bannerId] || null;
    }

    function countPaidUnlocks(unlocked, bannerSchema) {
        const autoIds = new Set(
            (bannerSchema?.nodes || []).filter((entry) => entry.autoUnlock).map((entry) => entry.id)
        );
        let count = 0;
        unlocked.forEach((id) => {
            if (!autoIds.has(id)) count += 1;
        });
        return count;
    }

    function serializeUnlockedSet(unlocked) {
        return [...unlocked].sort().join(',');
    }

    function canUnlockNodeGate(nodeId, unlocked, bannerSchema) {
        const doc = bannerSchema;
        const node = (doc.nodes || []).find((entry) => entry.id === nodeId);
        if (!node) return { ok: false, reason: 'Unknown node.' };
        if (unlocked.has(nodeId)) return { ok: false, reason: 'Already unlocked.' };

        const allNodes = doc.nodes || [];
        const parent = allNodes.find((entry) => (entry.linksTo || []).includes(nodeId));
        if (node.id !== ROOT_AUTO_NODES[doc.id]) {
            if (!parent || !unlocked.has(parent.id)) {
                const capstoneParent = (doc.pinnacleParents || []).find((id) => {
                    const cap = allNodes.find((n) => n.id === id);
                    return (cap?.linksTo || []).includes(nodeId);
                });
                if (!capstoneParent || !unlocked.has(capstoneParent)) {
                    return { ok: false, reason: 'Parent node not unlocked.' };
                }
            }
        }

        if (node.requiresAnyOf?.length) {
            const hasCap = node.requiresAnyOf.some((id) => unlocked.has(id));
            if (!hasCap) return { ok: false, reason: 'Requires a capstone branch.' };
        }

        const exclusivity = doc.branchExclusivity;
        if (exclusivity) {
            const branchBlock = resolveBranchExclusivityBlock(nodeId, allNodes, exclusivity, unlocked, doc);
            if (branchBlock) return branchBlock;
        }

        return { ok: true, node };
    }

    function resolveUnlockStateWhenNodeAvailable(nodeId, unlocked, bannerSchema) {
        if (unlocked.has(nodeId)) return unlocked;
        if (canUnlockNodeGate(nodeId, unlocked, bannerSchema).ok) return unlocked;

        const nodes = bannerSchema?.nodes || [];
        const queue = [unlocked];
        const seen = new Set([serializeUnlockedSet(unlocked)]);
        let iterations = 0;

        while (queue.length && iterations < 5000) {
            iterations += 1;
            const current = queue.shift();
            let progressed = false;

            for (const candidate of nodes) {
                if (candidate.autoUnlock || current.has(candidate.id)) continue;
                const gate = canUnlockNodeGate(candidate.id, current, bannerSchema);
                if (!gate.ok) continue;

                const next = new Set(current);
                next.add(candidate.id);
                const key = serializeUnlockedSet(next);
                if (seen.has(key)) continue;
                seen.add(key);

                if (canUnlockNodeGate(nodeId, next, bannerSchema).ok) {
                    return next;
                }

                queue.push(next);
                progressed = true;
            }

            if (!progressed) break;
        }

        return unlocked;
    }

    function resolveNodeUnlockCost(node, unlocked, bannerSchema) {
        if (!node || node.autoUnlock) return 0;
        if (unlocked.has(node.id)) return 0;

        const readySet = resolveUnlockStateWhenNodeAvailable(node.id, unlocked, bannerSchema);
        return countPaidUnlocks(readySet, bannerSchema) + 1;
    }

    function canUnlockNode(nodeId, unlocked, bannerSchema) {
        const gate = canUnlockNodeGate(nodeId, unlocked, bannerSchema);
        if (!gate.ok) return gate;

        return {
            ok: true,
            node: gate.node,
            cost: resolveNodeUnlockCost(gate.node, unlocked, bannerSchema)
        };
    }

    function resolveBranchPathCatalog(bannerSchema) {
        if (Array.isArray(bannerSchema?.branchPaths) && bannerSchema.branchPaths.length) {
            return bannerSchema.branchPaths;
        }

        const roots = bannerSchema?.branchExclusivity?.branchRoots || [];
        const labels = bannerSchema?.branchExclusivity?.branchLabels || {};
        return roots.map((rootId) => ({
            rootId,
            name: labels[rootId] || rootId,
            playstyle: '',
            summary: ''
        }));
    }

    function resolveBranchPathByRoot(bannerSchema, rootId) {
        return resolveBranchPathCatalog(bannerSchema).find((entry) => entry.rootId === rootId) || null;
    }

    function resolveBranchPathByLetter(bannerSchema, branchLetter) {
        return resolveBranchPathCatalog(bannerSchema).find((entry) => entry.branch === branchLetter) || null;
    }

    function resolvePickedBranchRoot(exclusivity, unlocked) {
        if (!exclusivity) return null;
        if (Array.isArray(exclusivity.branchRoots) && exclusivity.branchRoots.length) {
            return exclusivity.branchRoots.find((id) => unlocked.has(id)) || null;
        }
        if (exclusivity.leftRoots?.some((id) => unlocked.has(id))) return 'left';
        if (exclusivity.rightRoots?.some((id) => unlocked.has(id))) return 'right';
        return null;
    }

    function isNodeExcludedByBranch(nodeId, node, allNodes, exclusivity, unlocked) {
        const picked = resolvePickedBranchRoot(exclusivity, unlocked);
        if (!picked) return false;

        if (Array.isArray(exclusivity.branchRoots) && exclusivity.branchRoots.length) {
            if (exclusivity.branchRoots.includes(nodeId)) return nodeId !== picked;
            const branch = node?.branch || allNodes.find((entry) => entry.id === nodeId)?.branch;
            if (!branch || branch === 'root' || branch === 'trunk' || branch === 'pinnacle') return false;
            const pickedBranch = allNodes.find((entry) => entry.id === picked)?.branch;
            return Boolean(pickedBranch && branch !== pickedBranch);
        }

        const isLeft = exclusivity.leftRoots.includes(nodeId) || node?.branch === 'A';
        const isRight = exclusivity.rightRoots.includes(nodeId) || node?.branch === 'B';
        return (picked === 'left' && isRight) || (picked === 'right' && isLeft);
    }

    function resolveBranchExclusivityBlock(nodeId, allNodes, exclusivity, unlocked, bannerSchema) {
        if (!isNodeExcludedByBranch(nodeId, allNodes.find((entry) => entry.id === nodeId), allNodes, exclusivity, unlocked)) {
            return null;
        }

        if (Array.isArray(exclusivity.branchRoots) && exclusivity.branchRoots.length) {
            const picked = resolvePickedBranchRoot(exclusivity, unlocked);
            const pickedPath = resolveBranchPathByRoot(bannerSchema, picked);
            const pickedLabel = pickedPath?.name || exclusivity.branchLabels?.[picked] || 'Another path';
            return { ok: false, reason: `${pickedLabel} already chosen.` };
        }

        const picked = resolvePickedBranchRoot(exclusivity, unlocked);
        if (picked === 'left') return { ok: false, reason: 'Branch A already chosen.' };
        if (picked === 'right') return { ok: false, reason: 'Branch B already chosen.' };
        return { ok: false, reason: 'Another branch already chosen.' };
    }

    function isNodeExcluded(node, unlocked, bannerSchema) {
        const exclusivity = bannerSchema?.branchExclusivity;
        if (!exclusivity || !node) return false;
        const allNodes = bannerSchema?.nodes || [];
        return isNodeExcludedByBranch(node.id, node, allNodes, exclusivity, unlocked);
    }

    function resolveNodeAvailability(node, unlocked, bannerSchema, perkPoints) {
        if (!node) return 'locked';
        if (unlocked.has(node.id)) return 'unlocked';
        if (isNodeExcluded(node, unlocked, bannerSchema)) return 'excluded';

        const gate = canUnlockNode(node.id, unlocked, bannerSchema);
        if (!gate.ok) return 'locked';

        if (perkPoints < gate.cost) return 'locked';
        return 'available';
    }

    function ensureShell() {
        if (shellReady && global.document.getElementById('blessed-banners-modal')) return;

        const modal = global.document.createElement('div');
        modal.id = 'blessed-banners-modal';
        modal.className = 'blessed-banners-modal';
        modal.hidden = true;
        modal.setAttribute('aria-hidden', 'true');
        modal.innerHTML = `
            <div class="blessed-banners-backdrop" id="blessed-banners-backdrop" aria-hidden="true"></div>
            <div class="blessed-banners-dialog" role="dialog" aria-modal="true" aria-labelledby="blessed-banners-title">
                <header class="blessed-banners-header">
                    <div>
                        <p class="blessed-banners-eyebrow" id="blessed-banners-eyebrow">Blessed Banner</p>
                        <h2 id="blessed-banners-title" class="blessed-banners-title">Skill Tree</h2>
                        <p class="blessed-banners-points" id="blessed-banners-points"></p>
                    </div>
                    <button type="button" id="blessed-banners-close" class="blessed-banners-close" aria-label="Close skill tree">×</button>
                </header>
                <div class="blessed-banners-body" id="blessed-banners-body"></div>
            </div>
            <div class="blessed-banners-tooltip" id="blessed-banners-tooltip" hidden></div>
        `;
        global.document.body.appendChild(modal);
        shellReady = true;
    }

    function hideTooltip() {
        const tooltip = global.document.getElementById('blessed-banners-tooltip');
        if (!tooltip) return;
        tooltip.hidden = true;
        tooltip.innerHTML = '';
    }

    function showTooltip(node, bannerSchema, unlocked, event) {
        const tooltip = global.document.getElementById('blessed-banners-tooltip');
        if (!tooltip || !node) return;

        const cost = resolveNodeUnlockCost(node, unlocked, bannerSchema);
        tooltip.innerHTML = `
            <p class="blessed-banners-tooltip-title">${escapeHtml(node.name)}</p>
            <p class="blessed-banners-tooltip-copy">${escapeHtml(resolveNodeEffectLine(node))}</p>
            <p class="blessed-banners-tooltip-cost">Cost: ${escapeHtml(cost)} banner point${cost === 1 ? '' : 's'}</p>
        `;
        tooltip.hidden = false;

        const pad = 14;
        const rect = tooltip.getBoundingClientRect();
        let left = event.clientX + pad;
        let top = event.clientY + pad;
        if (left + rect.width > global.innerWidth - 8) {
            left = event.clientX - rect.width - pad;
        }
        if (top + rect.height > global.innerHeight - 8) {
            top = event.clientY - rect.height - pad;
        }
        tooltip.style.left = `${Math.max(8, left)}px`;
        tooltip.style.top = `${Math.max(8, top)}px`;
    }

    function clampTreeZoom(value) {
        const zoom = Number(value);
        if (!Number.isFinite(zoom)) return 1;
        return Math.max(TREE_ZOOM_MIN, Math.min(TREE_ZOOM_MAX, Math.round(zoom * 100) / 100));
    }

    function formatTreeZoomLabel(zoom) {
        return `${Math.round(clampTreeZoom(zoom) * 100)}%`;
    }

    function supportsCssZoom() {
        if (supportsCssZoomCache !== null) return supportsCssZoomCache;
        try {
            supportsCssZoomCache = 'zoom' in global.document.documentElement.style;
        } catch (_err) {
            supportsCssZoomCache = false;
        }
        return supportsCssZoomCache;
    }

    function applyTreeZoom(nextZoom) {
        const zoom = clampTreeZoom(nextZoom);
        treeZoom = zoom;

        const host = global.document.getElementById('blessed-banners-tree-zoom-host');
        const canvas = global.document.getElementById('blessed-banners-tree-canvas');
        const label = global.document.getElementById('blessed-banners-zoom-value');
        if (!host || !canvas) return;

        const baseW = Number(canvas.dataset.baseWidth) || 0;
        const baseH = Number(canvas.dataset.baseHeight) || 0;
        if (!baseW || !baseH) return;

        const scaledW = Math.ceil(baseW * zoom);
        const scaledH = Math.ceil(baseH * zoom);

        host.style.width = `${scaledW}px`;
        host.style.height = `${scaledH}px`;

        if (supportsCssZoom()) {
            canvas.style.zoom = String(zoom);
            canvas.style.removeProperty('transform');
        } else {
            canvas.style.removeProperty('zoom');
            canvas.style.transform = `scale(${zoom})`;
            canvas.style.transformOrigin = '0 0';
        }

        if (label) label.textContent = formatTreeZoomLabel(zoom);

        const zoomOut = global.document.getElementById('blessed-banners-zoom-out');
        const zoomIn = global.document.getElementById('blessed-banners-zoom-in');
        if (zoomOut) zoomOut.disabled = zoom <= TREE_ZOOM_MIN + 0.001;
        if (zoomIn) zoomIn.disabled = zoom >= TREE_ZOOM_MAX - 0.001;
    }

    function adjustTreeZoom(delta, anchorEvent) {
        const viewport = global.document.getElementById('blessed-banners-scroll-viewport');
        const canvas = global.document.getElementById('blessed-banners-tree-canvas');
        if (!viewport || !canvas) {
            applyTreeZoom(treeZoom + delta);
            return;
        }

        const oldZoom = treeZoom;
        const nextZoom = clampTreeZoom(oldZoom + delta);
        if (nextZoom === oldZoom) return;

        const rect = viewport.getBoundingClientRect();
        const anchorX = anchorEvent ? (anchorEvent.clientX - rect.left) : (viewport.clientWidth / 2);
        const anchorY = anchorEvent ? (anchorEvent.clientY - rect.top) : (viewport.clientHeight / 2);
        const ratio = nextZoom / oldZoom;
        const nextScrollLeft = (viewport.scrollLeft + anchorX) * ratio - anchorX;
        const nextScrollTop = (viewport.scrollTop + anchorY) * ratio - anchorY;

        applyTreeZoom(nextZoom);

        viewport.scrollLeft = Math.max(0, nextScrollLeft);
        viewport.scrollTop = Math.max(0, nextScrollTop);
    }

    function resetTreeZoom() {
        const canvas = global.document.getElementById('blessed-banners-tree-canvas');
        const defaultZoom = Number(canvas?.dataset.defaultZoom) || 1;
        treeZoom = defaultZoom;
        applyTreeZoom(treeZoom);
        if (canvas?.classList.contains('is-radial')) {
            centerTreeViewport({
                mode: 'radial',
                centerX: Number(canvas.dataset.centerX || 0),
                centerY: Number(canvas.dataset.centerY || 0)
            });
            return;
        }
        const viewport = global.document.getElementById('blessed-banners-scroll-viewport');
        if (viewport) {
            viewport.scrollLeft = 0;
            viewport.scrollTop = 0;
        }
    }

    function computeTreeDepths(bannerSchema, rootId) {
        const depths = new Map();
        const nodes = bannerSchema?.nodes || [];
        const byId = new Map(nodes.map((node) => [node.id, node]));
        const root = String(rootId || '').trim();
        if (!root || !byId.has(root)) return depths;

        depths.set(root, 0);
        const queue = [root];
        while (queue.length) {
            const id = queue.shift();
            const node = byId.get(id);
            const depth = depths.get(id) || 0;
            (node?.linksTo || []).forEach((childId) => {
                if (!byId.has(childId) || depths.has(childId)) return;
                depths.set(childId, depth + 1);
                queue.push(childId);
            });
        }

        const pinnacle = bannerSchema?.pinnacleNode;
        if (pinnacle && byId.has(pinnacle)) {
            const parentDepths = (bannerSchema.pinnacleParents || [])
                .map((parentId) => depths.get(parentId))
                .filter((depth) => Number.isFinite(depth));
            const nextDepth = parentDepths.length ? Math.max(...parentDepths) + 1 : 6;
            depths.set(pinnacle, Math.max(depths.get(pinnacle) || 0, nextDepth));
        }

        return depths;
    }

    function resolveParentNodeIds(nodeId, bannerSchema) {
        const nodes = bannerSchema?.nodes || [];
        const pinnacle = bannerSchema?.pinnacleNode;
        if (nodeId === pinnacle) {
            return (bannerSchema.pinnacleParents || []).filter((id) => nodes.some((entry) => entry.id === id));
        }
        return nodes
            .filter((entry) => (entry.linksTo || []).includes(nodeId))
            .map((entry) => entry.id);
    }

    function resolveTreeVisibleNodeIds(bannerSchema, unlocked) {
        const nodes = bannerSchema?.nodes || [];
        const rootId = ROOT_AUTO_NODES[bannerSchema?.id] || nodes[0]?.id;
        const byId = new Map(nodes.map((node) => [node.id, node]));
        const visible = new Set();
        const exclusivity = bannerSchema?.branchExclusivity;
        const picked = resolvePickedBranchRoot(exclusivity, unlocked);
        const root = byId.get(rootId);
        const hubStarterIds = new Set(root?.linksTo || []);

        if (rootId) visible.add(rootId);

        function isBranchVisible(node) {
            if (!node) return false;
            if (node.branch === 'root') return true;
            if (!picked) return hubStarterIds.has(node.id);
            return !isNodeExcludedByBranch(node.id, node, nodes, exclusivity, unlocked);
        }

        function hasUnlockedParent(nodeId) {
            if (nodeId === rootId) return true;
            const parents = resolveParentNodeIds(nodeId, bannerSchema);
            if (!parents.length) return false;
            return parents.some((parentId) => unlocked.has(parentId));
        }

        nodes.forEach((node) => {
            if (!isBranchVisible(node)) return;
            if (unlocked.has(node.id) || hasUnlockedParent(node.id)) {
                visible.add(node.id);
            }
        });

        return visible;
    }

    function fanChildAngle(parentAngle, childIndex, childCount, spread = 0.62) {
        if (childCount <= 1) return parentAngle;
        const step = spread / (childCount - 1);
        return parentAngle + ((childIndex - (childCount - 1) / 2) * step);
    }

    function assignRadialPositions(bannerId, bannerSchema, config) {
        const nodes = bannerSchema.nodes || [];
        const byId = new Map(nodes.map((node) => [node.id, node]));
        const rootId = ROOT_AUTO_NODES[bannerId] || nodes[0]?.id;
        const positions = {};
        const placed = new Set();
        const cx = config.centerX;
        const cy = config.centerY;

        function polar(ring, angle, pinnacle = false) {
            const radius = config.ringStep * (pinnacle ? ring + 0.35 : ring);
            return {
                x: cx + radius * Math.cos(angle),
                y: cy - radius * Math.sin(angle),
                angle,
                ring
            };
        }

        function placeNode(nodeId, ring, angle, pinnacle = false) {
            if (!byId.has(nodeId) || placed.has(nodeId)) return;
            placed.add(nodeId);
            positions[nodeId] = polar(ring, angle, pinnacle);
        }

        function walk(parentId, parentRing, parentAngle) {
            const parent = byId.get(parentId);
            const children = (parent?.linksTo || []).filter((childId) => byId.has(childId));
            children.forEach((childId, index) => {
                const child = byId.get(childId);
                const ring = parentRing + 1;
                let angle = parentAngle;

                if (parent?.branch === 'root' || parentId === rootId) {
                    angle = config.branchAngles?.[child.branch] ?? parentAngle;
                } else if (children.length > 1) {
                    angle = fanChildAngle(parentAngle, index, children.length);
                }

                placeNode(childId, ring, angle, Boolean(child.isPinnacle));
                walk(childId, ring, angle);
            });
        }

        placeNode(rootId, 0, config.trunkAngle);
        walk(rootId, 0, config.trunkAngle);

        const pinnacle = bannerSchema?.pinnacleNode;
        if (pinnacle && byId.has(pinnacle) && positions[pinnacle]) {
            const depth = Math.max(6, (positions[pinnacle].ring || 6));
            positions[pinnacle] = polar(depth, config.trunkAngle, true);
        }

        return positions;
    }

    function buildRadialTreeLayout(bannerId, bannerSchema) {
        const config = RADIAL_TREE_CONFIG[String(bannerId || '').trim()];
        if (!config || !bannerSchema) return null;

        const nodes = bannerSchema.nodes || [];
        const positions = assignRadialPositions(bannerId, bannerSchema, config);
        const pad = config.pad || 80;
        let minX = config.centerX;
        let maxX = config.centerX;
        let minY = config.centerY;
        let maxY = config.centerY;

        nodes.forEach((node) => {
            const pos = positions[node.id];
            if (!pos) return;
            const halfW = resolveNodeHalfWidth(node) + 36;
            const halfH = resolveNodeHalfHeight(node) + 28;
            minX = Math.min(minX, pos.x - halfW);
            maxX = Math.max(maxX, pos.x + halfW);
            minY = Math.min(minY, pos.y - halfH);
            maxY = Math.max(maxY, pos.y + halfH);
        });

        const width = Math.max(1040, maxX - minX + pad * 2);
        const height = Math.max(820, maxY - minY + pad * 2);
        const offsetX = pad - minX;
        const offsetY = pad - minY;

        Object.keys(positions).forEach((nodeId) => {
            positions[nodeId] = {
                ...positions[nodeId],
                x: positions[nodeId].x + offsetX,
                y: positions[nodeId].y + offsetY
            };
        });

        const ringRadii = [1, 2, 3, 4, 5, 6].map((ring) => config.ringStep * ring);

        return {
            mode: 'radial',
            centerX: config.centerX + offsetX,
            centerY: config.centerY + offsetY,
            branchAngles: config.branchAngles,
            ringRadii,
            maxRadius: config.ringStep * 5.5,
            positions,
            width,
            height,
            padX: pad,
            padY: pad,
            defaultZoom: config.defaultZoom || 1
        };
    }

    function resolveTreeLayout(bannerId, bannerSchema) {
        const id = String(bannerId || '').trim();
        if (RADIAL_TREE_CONFIG[id]) {
            return buildRadialTreeLayout(id, bannerSchema);
        }
        return null;
    }

    function resolveNodeCoords(node, layout) {
        if (layout?.mode === 'radial') {
            const pos = layout.positions?.[node.id];
            return {
                col: Math.round((pos?.x || 0) / 100),
                row: Math.round((pos?.y || 0) / 100)
            };
        }
        return {
            col: Math.max(0, Math.floor(Number(node.grid?.col) || 0)),
            row: Math.max(0, Math.floor(Number(node.grid?.row) || 0))
        };
    }

    function resolveCanvasMetrics(layout, nodes) {
        if (layout?.mode === 'radial') {
            return {
                width: layout.width,
                height: layout.height,
                cellW: 100,
                cellH: 62,
                padX: layout.padX,
                padY: layout.padY,
                maxCol: 0,
                maxRow: 0,
                centerX: layout.centerX,
                centerY: layout.centerY
            };
        }

        const cellW = layout?.cellW || 148;
        const cellH = layout?.cellH || 78;
        const padX = layout?.padX || 72;
        const padY = layout?.padY || 52;
        return {
            width: 1200,
            height: 900,
            cellW,
            cellH,
            padX,
            padY,
            maxCol: 0,
            maxRow: 0
        };
    }

    function resolveNodePixelPosition(node, layout, metrics) {
        if (layout?.mode === 'radial') {
            const pos = layout.positions?.[node.id];
            return {
                x: pos?.x ?? metrics.centerX ?? 0,
                y: pos?.y ?? metrics.centerY ?? 0
            };
        }
        const { col, row } = resolveNodeCoords(node, layout);
        return {
            x: metrics.padX + col * metrics.cellW + metrics.cellW / 2,
            y: metrics.padY + row * metrics.cellH + metrics.cellH / 2
        };
    }

    function centerTreeViewport(layout) {
        const viewport = global.document.getElementById('blessed-banners-scroll-viewport');
        const canvas = global.document.getElementById('blessed-banners-tree-canvas');
        if (!viewport || !canvas || layout?.mode !== 'radial') return;

        const centerX = Number(canvas.dataset.centerX || layout.centerX || 0);
        const centerY = Number(canvas.dataset.centerY || layout.centerY || 0);
        const zoom = treeZoom || 1;
        viewport.scrollLeft = Math.max(0, (centerX * zoom) - (viewport.clientWidth / 2));
        viewport.scrollTop = Math.max(0, (centerY * zoom) - (viewport.clientHeight / 2));
    }

    function resolveLatestUnlockedNodeId(bannerSchema, state) {
        const bannerId = bannerSchema?.id;
        const unlocked = normalizeUnlockedSet(state, bannerId);
        const raw = Array.isArray(state?.unlockedNodeIds)
            ? state.unlockedNodeIds
            : (Array.isArray(state?.unlockedPerkIds) ? state.unlockedPerkIds : []);
        const ordered = [...raw].reverse();
        for (const entry of ordered) {
            const id = String(entry || '').trim();
            if (id && unlocked.has(id)) return id;
        }
        const rootId = ROOT_AUTO_NODES[bannerId];
        if (rootId && unlocked.has(rootId)) return rootId;
        return ordered[0] || rootId || '';
    }

    function focusTreeViewportOnNode(nodeId, bannerSchema, layout) {
        const viewport = global.document.getElementById('blessed-banners-scroll-viewport');
        const canvas = global.document.getElementById('blessed-banners-tree-canvas');
        if (!viewport || !canvas || !nodeId || !bannerSchema || !layout) return;

        const node = (bannerSchema.nodes || []).find((entry) => entry.id === nodeId);
        if (!node) return;

        const nodes = bannerSchema.nodes || [];
        const metrics = resolveCanvasMetrics(layout, nodes);
        const pos = resolveNodePixelPosition(node, layout, metrics);

        applyTreeZoom(TREE_FOCUS_ZOOM);

        const applyScroll = () => {
            const zoom = treeZoom || 1;
            const targetX = pos.x * zoom;
            const targetY = pos.y * zoom;
            const maxScrollLeft = Math.max(0, viewport.scrollWidth - viewport.clientWidth);
            const maxScrollTop = Math.max(0, viewport.scrollHeight - viewport.clientHeight);

            viewport.scrollLeft = Math.min(maxScrollLeft, Math.max(0, targetX - (viewport.clientWidth / 2)));
            viewport.scrollTop = Math.min(maxScrollTop, Math.max(0, targetY - (viewport.clientHeight / 2)));
        };

        applyScroll();
        global.requestAnimationFrame(applyScroll);
    }

    function truncateLabel(text, maxLen) {
        const raw = String(text || '').trim();
        if (raw.length <= maxLen) return raw;
        return `${raw.slice(0, maxLen - 1)}…`;
    }

    function resolveNodeEffectLine(node) {
        return String(node?.description || '').trim();
    }

    function collectEdges(bannerSchema) {
        const edges = [];
        const nodes = bannerSchema.nodes || [];
        const byId = new Map(nodes.map((node) => [node.id, node]));

        nodes.forEach((node) => {
            (node.linksTo || []).forEach((childId) => {
                if (byId.has(childId)) {
                    edges.push({ from: node.id, to: childId });
                }
            });
        });

        const pinnacle = bannerSchema.pinnacleNode;
        (bannerSchema.pinnacleParents || []).forEach((parentId) => {
            if (pinnacle && byId.has(parentId) && byId.has(pinnacle)) {
                edges.push({ from: parentId, to: pinnacle, isPinnacle: true });
            }
        });

        return edges;
    }

    function renderRingGuides(layout) {
        if (layout?.mode !== 'radial') return '';
        const rings = (layout.ringRadii || []).slice(0, 5);
        const { centerX, centerY } = layout;

        return `
            <svg class="blessed-banners-ring-svg" aria-hidden="true" width="${layout.width}" height="${layout.height}">
                <circle class="blessed-banners-center-glow" cx="${centerX}" cy="${centerY}" r="42"></circle>
                ${rings.map((radius) => `
                    <circle class="blessed-banners-ring-guide" cx="${centerX}" cy="${centerY}" r="${radius}"></circle>
                `).join('')}
            </svg>
        `;
    }

    function resolveRecommendedNode(bannerSchema, unlocked, perkPoints, armyAdvisor) {
        const pathPlan = armyAdvisor?.emerald;
        const path = Array.isArray(pathPlan?.path) ? pathPlan.path : [];
        if (!path.length || bannerSchema?.id !== 'emerald-barrier') {
            return null;
        }

        for (const nodeId of path) {
            if (unlocked.has(nodeId)) continue;
            const node = (bannerSchema.nodes || []).find((entry) => entry.id === nodeId);
            if (!node || isNodeExcluded(node, unlocked, bannerSchema)) continue;

            const gate = canUnlockNode(nodeId, unlocked, bannerSchema);
            const cost = Math.max(0, Math.floor(Number(gate.cost) || 0));
            const points = Math.max(0, Math.floor(Number(perkPoints) || 0));
            return {
                nodeId,
                canAfford: gate.ok && points >= cost,
                canUnlock: gate.ok,
                cost
            };
        }

        return null;
    }

    function resolveNodeCostLabel(node, status, unlocked, bannerSchema) {
        if (status === 'unlocked') return 'Owned';
        const cost = resolveNodeUnlockCost(node, unlocked, bannerSchema);
        if (cost === 0) return 'Free';
        return `${cost} pt`;
    }

    function clearSelectedSkillNode() {
        selectedNodeId = '';
    }

    function updateSkillNodeSelection() {
        const canvas = global.document.getElementById('blessed-banners-tree-canvas');
        if (!canvas) return;

        canvas.querySelectorAll('[data-blessed-node-host]').forEach((host) => {
            const nodeId = host.getAttribute('data-blessed-node-host');
            const isSelected = nodeId === selectedNodeId;
            const nodeBtn = host.querySelector('[data-blessed-node-id]');
            let selectBtn = host.querySelector('[data-blessed-node-select]');

            host.classList.toggle('is-selected', isSelected);
            if (nodeBtn) nodeBtn.classList.toggle('is-selected', isSelected);

            if (!isSelected) {
                if (selectBtn) selectBtn.remove();
                return;
            }

            if (!selectBtn && nodeBtn?.classList.contains('is-available')) {
                selectBtn = global.document.createElement('button');
                selectBtn.type = 'button';
                selectBtn.className = 'blessed-banners-node-select-btn';
                selectBtn.setAttribute('data-blessed-node-select', nodeId);
                selectBtn.textContent = 'Select';
                host.appendChild(selectBtn);
            }
        });
    }

    function selectSkillNode(nodeId, bannerSchema) {
        const normalizedId = String(nodeId || '').trim();
        if (!normalizedId || !bannerSchema) return;

        const state = readState();
        const unlocked = normalizeUnlockedSet(state, bannerSchema.id);
        if (unlocked.has(normalizedId)) {
            clearSelectedSkillNode();
            updateSkillNodeSelection();
            return;
        }

        const node = (bannerSchema.nodes || []).find((entry) => entry.id === normalizedId);
        if (!node) return;

        const status = resolveNodeAvailability(node, unlocked, bannerSchema, state.perkPoints);
        if (status !== 'available') return;

        selectedNodeId = selectedNodeId === normalizedId ? '' : normalizedId;
        updateSkillNodeSelection();
    }

    function renderTreeMarkup(bannerSchema, unlocked, perkPoints, armyAdvisor) {
        const theme = bannerSchema.themeColor || '#6ecf8a';
        const layout = resolveTreeLayout(bannerSchema.id, bannerSchema);
        const visibleIds = resolveTreeVisibleNodeIds(bannerSchema, unlocked);
        const nodes = [...(bannerSchema.nodes || [])]
            .filter((node) => visibleIds.has(node.id))
            .sort((a, b) => (a.number || 0) - (b.number || 0));
        const metrics = resolveCanvasMetrics(layout, nodes);
        const recommended = resolveRecommendedNode(bannerSchema, unlocked, perkPoints, armyAdvisor);
        const branchChosen = Boolean(resolvePickedBranchRoot(bannerSchema?.branchExclusivity, unlocked));
        const hubHint = branchChosen
            ? 'Next skills appear as you unlock the one before them'
            : 'Pick one category from the free keystone — three first upgrades show until you commit';

        const nodeButtons = nodes.map((node) => {
            const status = resolveNodeAvailability(node, unlocked, bannerSchema, perkPoints);
            const isRecommended = recommended?.nodeId === node.id;
            const classes = [
                'blessed-banners-node',
                status === 'unlocked' ? 'is-unlocked' : '',
                status === 'available' ? 'is-available' : '',
                status === 'excluded' ? 'is-excluded' : '',
                isRecommended ? 'is-recommended' : '',
                isRecommended && recommended?.canAfford ? 'is-recommended-ready' : '',
                node.isCapstone ? 'is-capstone' : '',
                node.isPinnacle ? 'is-pinnacle' : '',
                node.isShortEnd ? 'is-short-end' : ''
            ].filter(Boolean).join(' ');

            const disabled = status !== 'available' && status !== 'unlocked';
            const pos = resolveNodePixelPosition(node, layout, metrics);
            const capTag = node.isCapstone ? '<span class="blessed-banners-node-tag">Cap</span>' : '';
            const pinTag = node.isPinnacle ? '<span class="blessed-banners-node-tag">Apex</span>' : '';
            const recommendedLabel = isRecommended
                ? '<span class="blessed-banners-node-recommended-label">Recommended</span>'
                : '';
            const costLabel = resolveNodeCostLabel(node, status, unlocked, bannerSchema);
            const effectLine = resolveNodeEffectLine(node);
            const isSelected = selectedNodeId === node.id;
            const hostClasses = [
                'blessed-banners-node-host',
                isSelected ? 'is-selected' : ''
            ].filter(Boolean).join(' ');
            const nodeClasses = [
                classes,
                isSelected ? 'is-selected' : ''
            ].filter(Boolean).join(' ');
            const selectBtn = (status === 'available' && isSelected)
                ? `<button type="button" class="blessed-banners-node-select-btn" data-blessed-node-select="${escapeHtml(node.id)}">Select</button>`
                : '';

            return `
                <div class="${hostClasses}" data-blessed-node-host="${escapeHtml(node.id)}" style="left:${pos.x}px;top:${pos.y}px;">
                    <button type="button"
                        class="${nodeClasses}"
                        data-blessed-node-id="${escapeHtml(node.id)}"
                        aria-label="${escapeHtml(node.name)}${isRecommended ? ' (recommended)' : ''}"
                        ${disabled ? 'disabled' : ''}>
                        ${recommendedLabel}
                        <span class="blessed-banners-node-slot">
                            ${capTag}${pinTag}
                            <span class="blessed-banners-node-slot-head">
                                <span class="blessed-banners-node-title">${escapeHtml(node.name || '')}</span>
                            </span>
                            ${effectLine ? `<span class="blessed-banners-node-info">${escapeHtml(effectLine)}</span>` : ''}
                            <span class="blessed-banners-node-cost">${escapeHtml(costLabel)}</span>
                        </span>
                    </button>
                    ${selectBtn}
                </div>
            `;
        }).join('');

        return `
            <div class="blessed-banners-tree-chrome">
                <div class="blessed-banners-tree-meta">
                    <div class="blessed-banners-tree-meta-row">
                    <div class="blessed-banners-legend" aria-hidden="true">
                        <span class="blessed-banners-legend-item"><span class="blessed-banners-legend-swatch is-unlocked"></span>Unlocked</span>
                        <span class="blessed-banners-legend-item"><span class="blessed-banners-legend-swatch is-available"></span>Available</span>
                        <span class="blessed-banners-legend-item"><span class="blessed-banners-legend-swatch is-locked"></span>Locked</span>
                    </div>
                    <div class="blessed-banners-tree-toolbar" id="blessed-banners-tree-toolbar" aria-label="Skill tree zoom controls">
                        <span class="blessed-banners-tree-toolbar-label">Zoom</span>
                        <button type="button" id="blessed-banners-zoom-out" class="blessed-banners-zoom-btn" aria-label="Zoom out">−</button>
                        <span id="blessed-banners-zoom-value" class="blessed-banners-zoom-value" aria-live="polite">${formatTreeZoomLabel(treeZoom)}</span>
                        <button type="button" id="blessed-banners-zoom-in" class="blessed-banners-zoom-btn" aria-label="Zoom in">+</button>
                        <button type="button" id="blessed-banners-zoom-reset" class="blessed-banners-zoom-btn blessed-banners-zoom-btn--reset" aria-label="Reset zoom">Reset</button>
                    </div>
                    </div>
                </div>
                <p class="blessed-banners-scroll-hint">${escapeHtml(hubHint)} · Mouse wheel zoom · Drag to pan</p>
                <div class="blessed-banners-scroll-viewport" id="blessed-banners-scroll-viewport" tabindex="0" aria-label="Skill tree canvas. Keystone at center with branches outward. Mouse wheel zooms. Drag to pan.">
                    <div class="blessed-banners-tree-zoom-host" id="blessed-banners-tree-zoom-host">
                        <div class="blessed-banners-tree-canvas${layout?.mode === 'radial' ? ' is-radial' : ''}"
                            id="blessed-banners-tree-canvas"
                            data-base-width="${metrics.width}"
                            data-base-height="${metrics.height}"
                            data-center-x="${layout?.centerX ?? metrics.centerX ?? 0}"
                            data-center-y="${layout?.centerY ?? metrics.centerY ?? 0}"
                            data-default-zoom="${layout?.defaultZoom ?? 1}"
                            style="--blessed-banner-theme:${escapeHtml(theme)};width:${metrics.width}px;height:${metrics.height}px;min-width:${metrics.width}px;">
                            ${renderRingGuides(layout)}
                            <svg class="blessed-banners-tree-svg" id="blessed-banners-tree-svg" aria-hidden="true"
                                width="${metrics.width}" height="${metrics.height}"></svg>
                            ${nodeButtons}
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    function estimateNodeTextLines(node) {
        const wrap = 34;
        const titleLines = Math.max(1, Math.ceil(String(node?.name || '').length / wrap));
        const infoLines = Math.max(1, Math.ceil(String(node?.description || '').length / wrap));
        return titleLines + infoLines + 1;
    }

    function resolveNodeHalfWidth(node) {
        if (node?.isPinnacle) return 122;
        if (node?.isCapstone) return 118;
        return 114;
    }

    function resolveNodeHalfHeight(node) {
        const lines = estimateNodeTextLines(node);
        const linePx = 7.4;
        const padding = 18;
        let height = padding + (lines * linePx);
        if (node?.isPinnacle) height += 8;
        if (node?.isCapstone) height += 6;
        return Math.max(44, Math.min(104, height));
    }

    function resolveColumnGutterX(col, metrics) {
        return metrics.padX + (col + 1) * metrics.cellW - metrics.cellW * 0.08;
    }

    function resolveNodeObstacleRect(node, layout, metrics) {
        const pos = resolveNodePixelPosition(node, layout, metrics);
        const clearance = 5;
        const halfW = resolveNodeHalfWidth(node) + clearance;
        const halfH = resolveNodeHalfHeight(node) + clearance;

        return {
            id: node.id,
            left: pos.x - halfW,
            right: pos.x + halfW,
            top: pos.y - halfH,
            bottom: pos.y + halfH
        };
    }

    function segmentIntersectsRect(xa, ya, xb, yb, rect) {
        if (ya === yb) {
            const minX = Math.min(xa, xb);
            const maxX = Math.max(xa, xb);
            if (ya < rect.top || ya > rect.bottom) return false;
            return maxX > rect.left && minX < rect.right;
        }

        if (xa === xb) {
            const minY = Math.min(ya, yb);
            const maxY = Math.max(ya, yb);
            if (xa < rect.left || xa > rect.right) return false;
            return maxY > rect.top && minY < rect.bottom;
        }

        return false;
    }

    function segmentIntersectsAny(xa, ya, xb, yb, rects, ignoreIds) {
        const ignored = new Set(ignoreIds || []);
        return rects.some((rect) => !ignored.has(rect.id)
            && segmentIntersectsRect(xa, ya, xb, yb, rect));
    }

    function pathPointsAreClear(points, rects, ignoreIds) {
        for (let i = 1; i < points.length; i += 1) {
            const [xa, ya] = points[i - 1];
            const [xb, yb] = points[i];
            if (segmentIntersectsAny(xa, ya, xb, yb, rects, ignoreIds)) {
                return false;
            }
        }
        return true;
    }

    function pointsToSvgPath(points) {
        if (!points.length) return '';
        const [startX, startY] = points[0];
        const tail = points.slice(1).map(([x, y]) => `L ${x} ${y}`).join(' ');
        return `M ${startX} ${startY}${tail ? ` ${tail}` : ''}`;
    }

    function resolveRectBorderPoint(cx, cy, halfW, halfH, targetX, targetY) {
        const dx = targetX - cx;
        const dy = targetY - cy;
        if (Math.abs(dx) < 0.001 && Math.abs(dy) < 0.001) {
            return [cx, cy];
        }
        const scale = Math.min(halfW / Math.abs(dx), halfH / Math.abs(dy));
        return [cx + (dx * scale), cy + (dy * scale)];
    }

    function resolveNodeCanvasBounds(nodeId, canvas) {
        if (!canvas || !nodeId) return null;
        const btn = canvas.querySelector(`[data-blessed-node-id="${nodeId}"]`);
        if (!btn) return null;

        const zoom = treeZoom || 1;
        const canvasRect = canvas.getBoundingClientRect();
        const btnRect = btn.getBoundingClientRect();
        if (!canvasRect.width || !canvasRect.height) return null;

        return {
            x: ((btnRect.left + (btnRect.width / 2)) - canvasRect.left) / zoom,
            y: ((btnRect.top + (btnRect.height / 2)) - canvasRect.top) / zoom,
            halfW: btnRect.width / (2 * zoom),
            halfH: btnRect.height / (2 * zoom)
        };
    }

    function resolveNodeLinkBounds(node, nodeId, layout, metrics, canvas) {
        const measured = resolveNodeCanvasBounds(nodeId, canvas);
        if (measured) return measured;

        const pos = resolveNodePixelPosition(node, layout, metrics);
        return {
            x: pos.x,
            y: pos.y,
            halfW: resolveNodeHalfWidth(node),
            halfH: resolveNodeHalfHeight(node)
        };
    }

    function pickCorridorY(y1, y2, minX, maxX, rects, ignoreIds, metrics) {
        const candidates = new Set([
            y1,
            y2,
            (y1 + y2) / 2,
            metrics.padY - 14,
            metrics.padY + (metrics.maxRow + 1) * metrics.cellH + 14
        ]);

        for (let row = 0; row <= metrics.maxRow; row += 1) {
            candidates.add(metrics.padY + row * metrics.cellH + metrics.cellH * 0.06);
            candidates.add(metrics.padY + row * metrics.cellH + metrics.cellH * 0.94);
        }

        const ordered = [...candidates].sort((a, b) => {
            const mid = (y1 + y2) / 2;
            return Math.abs(a - mid) - Math.abs(b - mid);
        });

        for (const y of ordered) {
            if (!segmentIntersectsAny(minX, y, maxX, y, rects, ignoreIds)) {
                return y;
            }
        }

        return (y1 + y2) / 2;
    }

    function buildRadialLinkPath(fromNode, toNode, layout, metrics, linkBounds) {
        const centerX = layout?.centerX ?? metrics.centerX ?? 0;
        const centerY = layout?.centerY ?? metrics.centerY ?? 0;
        const fromBounds = linkBounds?.from || {
            ...resolveNodePixelPosition(fromNode, layout, metrics),
            halfW: resolveNodeHalfWidth(fromNode),
            halfH: resolveNodeHalfHeight(fromNode)
        };
        const toBounds = linkBounds?.to || {
            ...resolveNodePixelPosition(toNode, layout, metrics),
            halfW: resolveNodeHalfWidth(toNode),
            halfH: resolveNodeHalfHeight(toNode)
        };

        const [x1, y1] = resolveRectBorderPoint(
            fromBounds.x,
            fromBounds.y,
            fromBounds.halfW,
            fromBounds.halfH,
            toBounds.x,
            toBounds.y
        );
        const [x2, y2] = resolveRectBorderPoint(
            toBounds.x,
            toBounds.y,
            toBounds.halfW,
            toBounds.halfH,
            fromBounds.x,
            fromBounds.y
        );

        const midX = (fromBounds.x + toBounds.x) / 2;
        const midY = (fromBounds.y + toBounds.y) / 2;
        const spanDx = toBounds.x - fromBounds.x;
        const spanDy = toBounds.y - fromBounds.y;
        const span = Math.hypot(spanDx, spanDy) || 1;
        const radialDx = midX - centerX;
        const radialDy = midY - centerY;
        const radialLen = Math.hypot(radialDx, radialDy);
        const bulge = Math.max(36, span * 0.22);

        let pushDx = spanDx / span;
        let pushDy = spanDy / span;
        if (radialLen > 48) {
            pushDx = radialDx / radialLen;
            pushDy = radialDy / radialLen;
        }

        const ctrlX = midX + (pushDx * bulge);
        const ctrlY = midY + (pushDy * bulge);

        return `M ${x1} ${y1} Q ${ctrlX} ${ctrlY} ${x2} ${y2}`;
    }

    function buildRoutedLinkPath(fromNode, toNode, layout, metrics, obstacleRects, linkBounds) {
        if (layout?.mode === 'radial') {
            return buildRadialLinkPath(fromNode, toNode, layout, metrics, linkBounds);
        }

        const fromCoords = resolveNodeCoords(fromNode, layout);
        const toCoords = resolveNodeCoords(toNode, layout);
        const fromPos = resolveNodePixelPosition(fromNode, layout, metrics);
        const toPos = resolveNodePixelPosition(toNode, layout, metrics);
        const ignoreIds = [fromNode.id, toNode.id];

        const x1 = fromPos.x + resolveNodeHalfWidth(fromNode);
        const y1 = fromPos.y;
        const x2 = toPos.x - resolveNodeHalfWidth(toNode);
        const y2 = toPos.y;

        if (toCoords.col <= fromCoords.col) {
            const gutterX = resolveColumnGutterX(fromCoords.col, metrics);
            const points = [[x1, y1], [gutterX, y1], [gutterX, y2], [x2, y2]];
            return pointsToSvgPath(points);
        }

        const gutters = [];
        for (let col = fromCoords.col; col < toCoords.col; col += 1) {
            gutters.push(resolveColumnGutterX(col, metrics));
        }

        const routeCandidates = [];

        if (gutters.length === 1) {
            routeCandidates.push([
                [x1, y1],
                [gutters[0], y1],
                [gutters[0], y2],
                [x2, y2]
            ]);
        } else {
            const corridorY = pickCorridorY(
                y1,
                y2,
                gutters[0],
                gutters[gutters.length - 1],
                obstacleRects,
                ignoreIds,
                metrics
            );
            const stepped = [[x1, y1], [gutters[0], y1], [gutters[0], corridorY]];
            for (let i = 1; i < gutters.length; i += 1) {
                stepped.push([gutters[i], corridorY]);
            }
            stepped.push([gutters[gutters.length - 1], y2], [x2, y2]);
            routeCandidates.push(stepped);
        }

        for (let offset = 0; offset <= metrics.maxRow + 2; offset += 1) {
            const rowBand = metrics.padY + offset * metrics.cellH + metrics.cellH * 0.04;
            routeCandidates.push([
                [x1, y1],
                [gutters[0], y1],
                [gutters[0], rowBand],
                [gutters[gutters.length - 1], rowBand],
                [gutters[gutters.length - 1], y2],
                [x2, y2]
            ]);
        }

        const clearRoute = routeCandidates.find((points) => pathPointsAreClear(points, obstacleRects, ignoreIds));
        if (clearRoute) {
            return pointsToSvgPath(clearRoute);
        }

        return pointsToSvgPath(routeCandidates[0]);
    }

    function drawTreeLinks(bannerSchema, unlocked) {
        const canvas = global.document.getElementById('blessed-banners-tree-canvas');
        const svg = global.document.getElementById('blessed-banners-tree-svg');
        if (!canvas || !svg) return;

        const layout = resolveTreeLayout(bannerSchema.id, bannerSchema);
        const visibleIds = resolveTreeVisibleNodeIds(bannerSchema, unlocked);
        const nodes = (bannerSchema.nodes || []).filter((node) => visibleIds.has(node.id));
        const metrics = resolveCanvasMetrics(layout, nodes);
        const theme = bannerSchema.themeColor || '#6ecf8a';
        const edges = collectEdges(bannerSchema).filter((edge) => visibleIds.has(edge.from) && visibleIds.has(edge.to));
        const nodeById = new Map(nodes.map((node) => [node.id, node]));
        const obstacleRects = nodes.map((node) => resolveNodeObstacleRect(node, layout, metrics));

        const paths = edges.map((edge) => {
            const fromNode = nodeById.get(edge.from);
            const toNode = nodeById.get(edge.to);
            if (!fromNode || !toNode) return '';

            const active = unlocked.has(edge.from);
            const classes = [
                active ? 'is-active' : '',
                edge.isPinnacle ? 'is-pinnacle-link' : ''
            ].filter(Boolean).join(' ');

            const linkBounds = {
                from: resolveNodeLinkBounds(fromNode, edge.from, layout, metrics, canvas),
                to: resolveNodeLinkBounds(toNode, edge.to, layout, metrics, canvas)
            };
            const pathD = buildRoutedLinkPath(fromNode, toNode, layout, metrics, obstacleRects, linkBounds);
            return `<path d="${pathD}" class="${classes}" data-edge-from="${escapeHtml(edge.from)}" data-edge-to="${escapeHtml(edge.to)}"></path>`;
        }).join('');

        svg.innerHTML = paths;

        svg.querySelectorAll('path.is-active').forEach((path) => {
            path.style.stroke = theme;
        });
    }

    function renderModalBody(bannerId, bannerSchema, options = {}) {
        const state = readState();
        const unlocked = normalizeUnlockedSet(state, bannerId);
        const shouldAutoFocus = Boolean(options.autoFocusLatest || options.focusNodeId);
        const armyAdvisor = state.armyAdvisor;
        const body = global.document.getElementById('blessed-banners-body');
        const title = global.document.getElementById('blessed-banners-title');
        const eyebrow = global.document.getElementById('blessed-banners-eyebrow');
        const points = global.document.getElementById('blessed-banners-points');
        const dialog = global.document.querySelector('.blessed-banners-dialog');

        if (!body || !bannerSchema) return;

        if (title) title.textContent = bannerSchema.title || 'Blessed Banner';
        if (eyebrow) {
            const identity = String(bannerSchema.skillIdentity || '').trim();
            eyebrow.textContent = identity
                ? `${bannerSchema.rune || 'Blessed Banner'} — ${identity}`
                : (bannerSchema.rune || 'Blessed Banner');
        }
        if (points) {
            const pts = Math.max(0, Math.floor(Number(state.perkPoints) || 0));
            points.innerHTML = `Banner skill points: <strong>${pts}</strong> — click a skill, then Select to unlock`;
        }
        if (dialog) {
            dialog.style.borderColor = `${bannerSchema.themeColor || '#6ecf8a'}73`;
        }

        body.innerHTML = renderTreeMarkup(bannerSchema, unlocked, state.perkPoints, armyAdvisor);
        global.requestAnimationFrame(() => {
            const layout = resolveTreeLayout(bannerSchema.id, bannerSchema);
            const paintTreeLinks = () => drawTreeLinks(bannerSchema, unlocked);
            paintTreeLinks();
            global.requestAnimationFrame(paintTreeLinks);

            if (shouldAutoFocus && layout) {
                const focusNodeId = String(options.focusNodeId || '').trim()
                    || resolveLatestUnlockedNodeId(bannerSchema, state);
                focusTreeViewportOnNode(focusNodeId, bannerSchema, layout);
                return;
            }

            if (layout?.defaultZoom && treeZoom === 1) {
                treeZoom = layout.defaultZoom;
            }
            applyTreeZoom(treeZoom);
            if (layout?.mode === 'radial') {
                centerTreeViewport(layout);
            } else if (treeZoom === 1) {
                const viewport = global.document.getElementById('blessed-banners-scroll-viewport');
                if (viewport) {
                    viewport.scrollLeft = 0;
                    viewport.scrollTop = 0;
                }
            }
        });
    }

    function tryUnlockNode(nodeId, bannerSchema) {
        const state = readState();
        if (state.bannerId !== bannerSchema.id) return false;

        const unlocked = normalizeUnlockedSet(state, bannerSchema.id);
        const gate = canUnlockNode(nodeId, unlocked, bannerSchema);
        if (!gate.ok) return false;

        const cost = gate.cost;
        const points = Math.max(0, Math.floor(Number(state.perkPoints) || 0));
        if (points < cost) return false;

        const nextIds = [...unlocked, nodeId];
        const next = {
            ...state,
            perkPoints: points - cost,
            unlockedNodeIds: nextIds
        };

        if (!writeState(next)) return false;

        clearSelectedSkillNode();

        global.dispatchEvent(new CustomEvent('royalarmies:banner-node-unlocked', {
            detail: { bannerId: bannerSchema.id, nodeId, state: next }
        }));

        renderModalBody(bannerSchema.id, bannerSchema, {
            focusNodeId: nodeId,
            autoFocusLatest: true
        });
        return true;
    }

    function supportsTwentyFiveNodeTree(bannerId) {
        return TWENTY_FIVE_NODE_BANNERS.has(String(bannerId || '').trim());
    }

    function showModalShell() {
        const modal = global.document.getElementById('blessed-banners-modal');
        if (!modal) return;
        modal.hidden = false;
        modal.setAttribute('aria-hidden', 'false');
        global.document.body.classList.add('is-blessed-banners-modal-open');
    }

    function renderLoadingBody() {
        const body = global.document.getElementById('blessed-banners-body');
        if (!body) return;
        body.innerHTML = '<p class="blessed-banners-loading" role="status">Loading skill tree…</p>';
    }

    function renderModalForBanner(resolvedId, schema) {
        const bannerSchema = resolveBannerSchema(schema, resolvedId);
        const body = global.document.getElementById('blessed-banners-body');
        if (!body) return false;

        if (!bannerSchema || !(bannerSchema.nodes || []).length) {
            body.innerHTML = '<p class="blessed-banners-load-error">Banner skill tree data could not be loaded. Refresh the page and try again.</p>';
            return false;
        }

        renderModalBody(resolvedId, bannerSchema, { autoFocusLatest: true });
        return true;
    }

    async function openBlessedBannersModal(event, bannerId) {
        if (event) {
            event.preventDefault();
            event.stopPropagation();
        }

        const state = readState();
        const resolvedId = String(bannerId || state.bannerId || '').trim();
        if (!resolvedId || !supportsTwentyFiveNodeTree(resolvedId)) {
            if (typeof global.openBannerWorkspaceLegacy === 'function') {
                global.openBannerWorkspaceLegacy(event);
            }
            return;
        }

        if (typeof global.playSelectSFX === 'function') {
            global.playSelectSFX();
        }

        ensureShell();
        clearSelectedSkillNode();
        activeBannerId = resolvedId;
        const radialConfig = RADIAL_TREE_CONFIG[resolvedId];
        treeZoom = radialConfig?.defaultZoom || 1;
        showModalShell();

        if (global.RoyalArmiesBanner?.refreshArmyAdvisor) {
            void global.RoyalArmiesBanner.refreshArmyAdvisor();
        }

        if (schemaCache) {
            renderModalForBanner(resolvedId, schemaCache);
            global.document.getElementById('blessed-banners-close')?.focus();
            return;
        }

        renderLoadingBody();
        global.document.getElementById('blessed-banners-close')?.focus();

        const schema = await fetchSchema();
        if (activeBannerId !== resolvedId) return;
        renderModalForBanner(resolvedId, schema);
    }

    function closeBlessedBannersModal() {
        hideTooltip();
        clearSelectedSkillNode();
        const modal = global.document.getElementById('blessed-banners-modal');
        if (!modal) return;
        modal.hidden = true;
        modal.setAttribute('aria-hidden', 'true');
        global.document.body.classList.remove('is-blessed-banners-modal-open');
        activeBannerId = '';
    }

    function bindHandlers() {
        if (handlersBound) return;
        handlersBound = true;

        ensureShell();

        global.document.getElementById('blessed-banners-close')
            ?.addEventListener('click', closeBlessedBannersModal);
        global.document.getElementById('blessed-banners-backdrop')
            ?.addEventListener('click', closeBlessedBannersModal);

        global.document.addEventListener('mouseover', (event) => {
            const nodeBtn = event.target.closest('[data-blessed-node-id]');
            const modal = global.document.getElementById('blessed-banners-modal');
            if (!nodeBtn || !modal || modal.hidden) return;

            const nodeId = nodeBtn.getAttribute('data-blessed-node-id');
            const bannerSchema = resolveBannerSchema(schemaCache, activeBannerId);
            const node = bannerSchema?.nodes?.find((entry) => entry.id === nodeId);
            if (node) {
                const state = readState();
                const unlocked = normalizeUnlockedSet(state, activeBannerId);
                showTooltip(node, bannerSchema, unlocked, event);
            }
        });

        global.document.addEventListener('mouseout', (event) => {
            const nodeBtn = event.target.closest('[data-blessed-node-id]');
            if (!nodeBtn) return;
            const related = event.relatedTarget;
            if (related && nodeBtn.contains(related)) return;
            hideTooltip();
        });

        global.document.addEventListener('click', (event) => {
            const modal = global.document.getElementById('blessed-banners-modal');
            if (!modal || modal.hidden) return;

            if (event.target.closest('#blessed-banners-zoom-in')) {
                event.preventDefault();
                adjustTreeZoom(TREE_ZOOM_STEP, null);
                return;
            }
            if (event.target.closest('#blessed-banners-zoom-out')) {
                event.preventDefault();
                adjustTreeZoom(-TREE_ZOOM_STEP, null);
                return;
            }
            if (event.target.closest('#blessed-banners-zoom-reset')) {
                event.preventDefault();
                resetTreeZoom();
                return;
            }
        });

        global.document.addEventListener('wheel', (event) => {
            const viewport = event.target.closest('#blessed-banners-scroll-viewport');
            const modal = global.document.getElementById('blessed-banners-modal');
            if (!viewport || !modal || modal.hidden) return;

            event.preventDefault();
            event.stopPropagation();
            const direction = event.deltaY > 0 ? -1 : 1;
            adjustTreeZoom(direction * TREE_ZOOM_STEP, event);
        }, { passive: false });

        global.document.addEventListener('mousedown', (event) => {
            const viewport = event.target.closest('#blessed-banners-scroll-viewport');
            const modal = global.document.getElementById('blessed-banners-modal');
            if (!viewport || !modal || modal.hidden) return;
            if (event.button !== 0) return;
            if (event.target.closest('[data-blessed-node-id]')) return;
            if (event.target.closest('[data-blessed-node-select]')) return;
            if (event.target.closest('.blessed-banners-zoom-btn')) return;

            treePanState = {
                viewport,
                startX: event.clientX,
                startY: event.clientY,
                scrollLeft: viewport.scrollLeft,
                scrollTop: viewport.scrollTop,
                moved: false
            };
            viewport.classList.add('is-panning');
            event.preventDefault();
        });

        global.document.addEventListener('mousemove', (event) => {
            if (!treePanState) return;
            const dx = event.clientX - treePanState.startX;
            const dy = event.clientY - treePanState.startY;
            if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
                treePanState.moved = true;
            }
            treePanState.viewport.scrollLeft = treePanState.scrollLeft - dx;
            treePanState.viewport.scrollTop = treePanState.scrollTop - dy;
        });

        global.document.addEventListener('mouseup', () => {
            if (!treePanState) return;
            treePanState.viewport.classList.remove('is-panning');
            treePanState = null;
        });

        global.document.addEventListener('click', async (event) => {
            const modal = global.document.getElementById('blessed-banners-modal');
            if (!modal || modal.hidden) return;

            const schema = schemaCache || await fetchSchema();
            const bannerSchema = resolveBannerSchema(schema, activeBannerId);
            if (!bannerSchema) return;

            const selectBtn = event.target.closest('[data-blessed-node-select]');
            if (selectBtn) {
                event.preventDefault();
                event.stopPropagation();
                const nodeId = selectBtn.getAttribute('data-blessed-node-select');
                if (nodeId) tryUnlockNode(nodeId, bannerSchema);
                return;
            }

            const nodeBtn = event.target.closest('[data-blessed-node-id]');
            if (nodeBtn) {
                event.preventDefault();
                const nodeId = nodeBtn.getAttribute('data-blessed-node-id');
                if (!nodeId) return;
                selectSkillNode(nodeId, bannerSchema);
                return;
            }

            if (event.target.closest('#blessed-banners-body') && selectedNodeId) {
                clearSelectedSkillNode();
                updateSkillNodeSelection();
            }
        });

        global.addEventListener('resize', () => {
            const modal = global.document.getElementById('blessed-banners-modal');
            if (!modal || modal.hidden || !schemaCache || !activeBannerId) return;
            const bannerSchema = resolveBannerSchema(schemaCache, activeBannerId);
            const unlocked = normalizeUnlockedSet(readState(), activeBannerId);
            drawTreeLinks(bannerSchema, unlocked);
        });

        global.document.addEventListener('keydown', (event) => {
            const modal = global.document.getElementById('blessed-banners-modal');
            if (!modal || modal.hidden) return;

            if (event.key === 'Escape') {
                event.preventDefault();
                closeBlessedBannersModal();
                return;
            }

            if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
                return;
            }

            if (event.key === '+' || event.key === '=') {
                event.preventDefault();
                adjustTreeZoom(TREE_ZOOM_STEP, null);
            } else if (event.key === '-' || event.key === '_') {
                event.preventDefault();
                adjustTreeZoom(-TREE_ZOOM_STEP, null);
            } else if (event.key === '0') {
                event.preventDefault();
                resetTreeZoom();
            }
        });
    }

    function initBlessedBannersModal() {
        ensureShell();
        bindHandlers();
        preloadSchema();
        global.addEventListener('royalarmies:banner-blessing-chosen', preloadSchema);
        global.addEventListener('royalarmies:banner-advisor-updated', () => {
            const modal = global.document.getElementById('blessed-banners-modal');
            if (!modal || modal.hidden || !schemaCache || !activeBannerId) return;
            const bannerSchema = resolveBannerSchema(schemaCache, activeBannerId);
            if (bannerSchema) renderModalBody(activeBannerId, bannerSchema);
        });
        global.addEventListener('royalarmies:banner-node-unlocked', (event) => {
            const modal = global.document.getElementById('blessed-banners-modal');
            if (!modal || modal.hidden || !schemaCache || !activeBannerId) return;
            const bannerSchema = resolveBannerSchema(schemaCache, activeBannerId);
            if (!bannerSchema) return;
            const focusNodeId = String(event?.detail?.nodeId || '').trim();
            renderModalBody(activeBannerId, bannerSchema, {
                focusNodeId,
                autoFocusLatest: true
            });
        });
    }

    global.openBlessedBannersModal = openBlessedBannersModal;
    global.closeBlessedBannersModal = closeBlessedBannersModal;

    global.RoyalArmiesBlessedBannersModal = Object.freeze({
        supportsTwentyFiveNodeTree,
        open: openBlessedBannersModal,
        close: closeBlessedBannersModal,
        fetchSchema,
        canUnlockNode
    });

    if (global.document.readyState === 'loading') {
        global.document.addEventListener('DOMContentLoaded', initBlessedBannersModal, { once: true });
    } else {
        initBlessedBannersModal();
    }
})(window);
