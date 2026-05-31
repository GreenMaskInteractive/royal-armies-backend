/**
 * RIFT — Water crossing routes (animated march lines, border anchors, move costs).
 */
(function initAgeWorldWaterRoutes(global) {
    'use strict';

    const ROUTES_URL = 'data/age-world-water-routes.json?v=water-routes-phariis-anchor-1';
    const BORDER_PAD = 10;

    let routes = [];
    let routePairIndex = new Map();
    let loadPromise = null;

    function routePairKey(cityAId, cityBId) {
        return [String(cityAId || ''), String(cityBId || '')].sort().join('::');
    }

    function indexRoutes(nextRoutes) {
        routes = Array.isArray(nextRoutes) ? nextRoutes.slice() : [];
        routePairIndex = new Map();
        routes.forEach((route) => {
            const fromId = String(route.fromCityId || '').trim();
            const toId = String(route.toCityId || '').trim();
            if (!fromId || !toId) return;
            routePairIndex.set(routePairKey(fromId, toId), route);
            if (route.bidirectional !== false) {
                routePairIndex.set(routePairKey(toId, fromId), route);
            }
        });
    }

    function loadRoutes(force) {
        if (!force && routes.length) return Promise.resolve(routes);
        if (!force && loadPromise) return loadPromise;

        loadPromise = fetch(ROUTES_URL, { credentials: 'same-origin' })
            .then((res) => {
                if (!res.ok) throw new Error(`Failed to load ${ROUTES_URL}`);
                return res.json();
            })
            .then((payload) => {
                indexRoutes(payload?.routes || []);
                return routes;
            })
            .catch((err) => {
                console.warn('[RIFT] Water routes unavailable:', err.message);
                indexRoutes([]);
                return routes;
            });

        return loadPromise;
    }

    function getRoutes() {
        return routes.slice();
    }

    function findRoute(cityAId, cityBId) {
        return routePairIndex.get(routePairKey(cityAId, cityBId)) || null;
    }

    function areCatalogCitiesAdjacent(cityA, cityB) {
        if (!cityA || !cityB) return false;
        if (cityA.id === cityB.id) return true;
        const aToB = Array.isArray(cityA.neighbors) && cityA.neighbors.includes(cityB.id);
        const bToA = Array.isArray(cityB.neighbors) && cityB.neighbors.includes(cityA.id);
        return aToB || bToA;
    }

    function resolveCityConnection(cityA, cityB) {
        if (!cityA || !cityB || cityA.id === cityB.id) return null;
        if (areCatalogCitiesAdjacent(cityA, cityB)) {
            return { type: 'land', movePointCost: 1 };
        }
        const route = findRoute(cityA.id, cityB.id);
        if (!route) return null;
        const movePointCost = Math.max(1, Math.min(3, Math.floor(Number(route.movePointCost) || 1)));
        return {
            type: 'water',
            movePointCost,
            routeId: route.id,
            route
        };
    }

    function parseOutlinePoints(outlineD) {
        const tokens = String(outlineD || '').match(/[a-zA-Z]|-?\d*\.?\d+(?:e[-+]?\d+)?/g);
        if (!tokens || tokens.length < 3) return [];

        const points = [];
        let i = 0;
        let cmd = '';
        let cx = 0;
        let cy = 0;
        let sx = 0;
        let sy = 0;

        const readNum = () => Number(tokens[i++]);

        const pushPoint = (x, y) => {
            points.push({ x, y });
            cx = x;
            cy = y;
        };

        while (i < tokens.length) {
            const token = tokens[i];
            if (/^[a-zA-Z]$/.test(token)) {
                cmd = token;
                i += 1;
            } else if (!cmd) {
                i += 1;
                continue;
            }

            switch (cmd) {
                case 'M':
                case 'm': {
                    const x = readNum();
                    const y = readNum();
                    if (cmd === 'm') pushPoint(cx + x, cy + y);
                    else pushPoint(x, y);
                    sx = cx;
                    sy = cy;
                    cmd = cmd === 'm' ? 'l' : 'L';
                    break;
                }
                case 'L':
                case 'l': {
                    const x = readNum();
                    const y = readNum();
                    if (cmd === 'l') pushPoint(cx + x, cy + y);
                    else pushPoint(x, y);
                    break;
                }
                case 'H':
                case 'h': {
                    const x = readNum();
                    pushPoint(cmd === 'h' ? cx + x : x, cy);
                    break;
                }
                case 'V':
                case 'v': {
                    const y = readNum();
                    pushPoint(cx, cmd === 'v' ? cy + y : y);
                    break;
                }
                case 'Z':
                case 'z':
                    pushPoint(sx, sy);
                    cmd = '';
                    break;
                default:
                    i += 1;
                    cmd = '';
                    break;
            }
        }

        return points;
    }

    function resolveBorderAnchor(fromCity, toCity, padding) {
        const pad = Number.isFinite(padding) ? padding : BORDER_PAD;
        const fx = fromCity?.centroid?.x;
        const fy = fromCity?.centroid?.y;
        const tx = toCity?.centroid?.x;
        const ty = toCity?.centroid?.y;
        if (!Number.isFinite(fx) || !Number.isFinite(fy) || !Number.isFinite(tx) || !Number.isFinite(ty)) {
            return null;
        }

        const dx = tx - fx;
        const dy = ty - fy;
        const len = Math.hypot(dx, dy) || 1;
        const ux = dx / len;
        const uy = dy / len;

        const points = parseOutlinePoints(fromCity.outlinePath);
        let best = null;
        let bestScore = -Infinity;

        points.forEach((point) => {
            const vx = point.x - fx;
            const vy = point.y - fy;
            const proj = vx * ux + vy * vy;
            if (proj <= 0) return;

            const vlen = Math.hypot(vx, vy) || 1;
            const alignment = (vx / vlen) * ux + (vy / vlen) * uy;
            if (alignment < 0.4) return;

            const score = proj * alignment;
            if (score > bestScore) {
                bestScore = score;
                best = point;
            }
        });

        if (!best) {
            return { x: fx + ux * 18, y: fy + uy * 18 };
        }

        return {
            x: best.x + ux * pad,
            y: best.y + uy * pad
        };
    }

    function resolveRouteAnchor(cityId, fromCity, toCity, route) {
        const overrides = route?.anchors || {};
        const manual = overrides[cityId];
        if (manual && Number.isFinite(manual.x) && Number.isFinite(manual.y)) {
            return { x: manual.x, y: manual.y };
        }
        return resolveBorderAnchor(fromCity, toCity, route?.borderPadding);
    }

    function buildCurvedPath(fromAnchor, toAnchor, bend) {
        if (!fromAnchor || !toAnchor) return '';
        const mx = (fromAnchor.x + toAnchor.x) / 2;
        const my = (fromAnchor.y + toAnchor.y) / 2;
        const dx = toAnchor.x - fromAnchor.x;
        const dy = toAnchor.y - fromAnchor.y;
        const len = Math.hypot(dx, dy) || 1;
        const bendFactor = Number.isFinite(bend) ? bend : 0.18;
        const cx = mx - (dy / len) * len * bendFactor;
        const cy = my + (dx / len) * len * bendFactor;
        return `M ${fromAnchor.x.toFixed(2)} ${fromAnchor.y.toFixed(2)} Q ${cx.toFixed(2)} ${cy.toFixed(2)} ${toAnchor.x.toFixed(2)} ${toAnchor.y.toFixed(2)}`;
    }

    function resolveRouteGeometry(route, cityById) {
        const fromCity = cityById.get(route.fromCityId);
        const toCity = cityById.get(route.toCityId);
        if (!fromCity || !toCity) return null;

        const fromAnchor = resolveRouteAnchor(route.fromCityId, fromCity, toCity, route);
        const toAnchor = resolveRouteAnchor(route.toCityId, toCity, fromCity, route);
        const pathD = buildCurvedPath(fromAnchor, toAnchor, route.bend);
        if (!pathD) return null;

        const mx = (fromAnchor.x + toAnchor.x) / 2;
        const my = (fromAnchor.y + toAnchor.y) / 2;
        const dx = toAnchor.x - fromAnchor.x;
        const dy = toAnchor.y - fromAnchor.y;
        const len = Math.hypot(dx, dy) || 1;
        const bendFactor = Number.isFinite(route.bend) ? route.bend : 0.18;
        const labelX = mx - (dy / len) * len * bendFactor * 0.55;
        const labelY = my + (dx / len) * len * bendFactor * 0.55;

        return {
            pathD,
            fromAnchor,
            toAnchor,
            labelX,
            labelY,
            movePointCost: Math.max(1, Math.min(3, Math.floor(Number(route.movePointCost) || 1)))
        };
    }

    global.RoyalArmiesAgeWaterRoutes = {
        loadRoutes,
        getRoutes,
        findRoute,
        areCatalogCitiesAdjacent,
        resolveCityConnection,
        parseOutlinePoints,
        resolveBorderAnchor,
        buildCurvedPath,
        resolveRouteGeometry
    };
})(window);
