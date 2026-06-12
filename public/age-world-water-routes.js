/**
 * RIFT — Water crossing routes (animated march lines, border anchors, move costs).
 */
(function initAgeWorldWaterRoutes(global) {
    'use strict';

    const ROUTES_URL = 'data/age-world-water-routes.json?v=water-routes-phariis-anchor-1';
    const BORDER_PAD = 10;
    const CROSS_BORDER_ADJACENCY_PAD = 4;
    const ADJACENCY_PREFILTER_PAD = 2;
    const ADJACENCY_MAX_GAP = 4;
    const CURVE_SAMPLE_STEPS = 8;
    const FORCED_CITY_BORDER_PAIRS = new Set([
        'lyllis-faelengrove::trex-trellgar',
        'aethelgard-ghrenmyr::dravic-terragrim',
        'aethelgard-vaurnheim::dravic-crenellon',
        'aethelgard-ljundvarr::dravic-ballistrek',
        'saelthine-spaeskog::trex-vehrakhan',
        'saelthine-wyrdkrend::trex-vehrakhan',
        'lyllis-faelengrove::trex-scorvekh'
    ]);

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

    function cityBoxesTouch(bboxA, bboxB, pad) {
        const edgePad = Number.isFinite(pad) ? pad : CROSS_BORDER_ADJACENCY_PAD;
        if (!bboxA || !bboxB) return false;
        return !(
            bboxA.maxX + edgePad < bboxB.minX - edgePad
            || bboxB.maxX + edgePad < bboxA.minX - edgePad
            || bboxA.maxY + edgePad < bboxB.minY - edgePad
            || bboxB.maxY + edgePad < bboxA.minY - edgePad
        );
    }

    function pointSegmentDistance(px, py, ax, ay, bx, by) {
        const abx = bx - ax;
        const aby = by - ay;
        const denom = abx * abx + aby * aby;
        if (!denom) return Math.hypot(px - ax, py - ay);
        const t = Math.max(0, Math.min(1, ((px - ax) * abx + (py - ay) * aby) / denom));
        const cx = ax + t * abx;
        const cy = ay + t * aby;
        return Math.hypot(px - cx, py - cy);
    }

    function segmentSegmentDistance(a1, a2, b1, b2) {
        let best = Infinity;
        [a1, a2].forEach((point) => {
            best = Math.min(best, pointSegmentDistance(point.x, point.y, b1.x, b1.y, b2.x, b2.y));
        });
        [b1, b2].forEach((point) => {
            best = Math.min(best, pointSegmentDistance(point.x, point.y, a1.x, a1.y, a2.x, a2.y));
        });
        return best;
    }

    function cubicPoint(p0, p1, p2, p3, t) {
        const mt = 1 - t;
        const mt2 = mt * mt;
        const t2 = t * t;
        return {
            x: mt2 * mt * p0.x + 3 * mt2 * t * p1.x + 3 * mt * t2 * p2.x + t2 * t * p3.x,
            y: mt2 * mt * p0.y + 3 * mt2 * t * p1.y + 3 * mt * t2 * p2.y + t2 * t * p3.y
        };
    }

    function sampleCubic(p0, p1, p2, p3, steps) {
        const sampleSteps = Number.isFinite(steps) ? steps : CURVE_SAMPLE_STEPS;
        const points = [];
        for (let index = 0; index <= sampleSteps; index += 1) {
            points.push(cubicPoint(p0, p1, p2, p3, index / sampleSteps));
        }
        return points;
    }

    function outlinePathPolyline(outlineD) {
        const tokens = String(outlineD || '').match(/[a-zA-Z]|-?\d*\.?\d+(?:e[-+]?\d+)?/g);
        if (!tokens || tokens.length < 3) return [];

        const polyline = [];
        let i = 0;
        let cmd = '';
        let cx = 0;
        let cy = 0;
        let sx = 0;
        let sy = 0;
        let lastC2 = null;

        const readNum = () => Number(tokens[i++]);

        const appendPoint = (x, y) => {
            const point = { x, y };
            if (!polyline.length || polyline[polyline.length - 1].x !== point.x || polyline[polyline.length - 1].y !== point.y) {
                polyline.push(point);
            }
            cx = point.x;
            cy = point.y;
            return point;
        };

        const appendSegment = (points) => {
            points.forEach((point, index) => {
                if (index === 0 && polyline.length
                    && polyline[polyline.length - 1].x === point.x
                    && polyline[polyline.length - 1].y === point.y) {
                    return;
                }
                polyline.push(point);
            });
            if (points.length) {
                cx = points[points.length - 1].x;
                cy = points[points.length - 1].y;
            }
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
                    if (cmd === 'm') appendPoint(cx + x, cy + y);
                    else appendPoint(x, y);
                    sx = cx;
                    sy = cy;
                    lastC2 = null;
                    cmd = cmd === 'm' ? 'l' : 'L';
                    break;
                }
                case 'L':
                case 'l': {
                    const x = readNum();
                    const y = readNum();
                    if (cmd === 'l') appendPoint(cx + x, cy + y);
                    else appendPoint(x, y);
                    lastC2 = null;
                    break;
                }
                case 'H':
                case 'h': {
                    const x = readNum();
                    appendPoint(cmd === 'h' ? cx + x : x, cy);
                    lastC2 = null;
                    break;
                }
                case 'V':
                case 'v': {
                    const y = readNum();
                    appendPoint(cx, cmd === 'v' ? cy + y : y);
                    lastC2 = null;
                    break;
                }
                case 'C':
                case 'c': {
                    const c1x = readNum();
                    const c1y = readNum();
                    const c2x = readNum();
                    const c2y = readNum();
                    const x = readNum();
                    const y = readNum();
                    const p0 = { x: cx, y: cy };
                    const p1 = cmd === 'c'
                        ? { x: cx + c1x, y: cy + c1y }
                        : { x: c1x, y: c1y };
                    const p2 = cmd === 'c'
                        ? { x: cx + c2x, y: cy + c2y }
                        : { x: c2x, y: c2y };
                    const p3 = cmd === 'c'
                        ? { x: cx + x, y: cy + y }
                        : { x, y };
                    appendSegment(sampleCubic(p0, p1, p2, p3, CURVE_SAMPLE_STEPS));
                    lastC2 = p2;
                    break;
                }
                case 'S':
                case 's': {
                    const c2x = readNum();
                    const c2y = readNum();
                    const x = readNum();
                    const y = readNum();
                    const p0 = { x: cx, y: cy };
                    const p1 = lastC2
                        ? { x: 2 * cx - lastC2.x, y: 2 * cy - lastC2.y }
                        : { x: cx, y: cy };
                    const p2 = cmd === 's'
                        ? { x: cx + c2x, y: cy + c2y }
                        : { x: c2x, y: c2y };
                    const p3 = cmd === 's'
                        ? { x: cx + x, y: cy + y }
                        : { x, y };
                    appendSegment(sampleCubic(p0, p1, p2, p3, CURVE_SAMPLE_STEPS));
                    lastC2 = p2;
                    break;
                }
                case 'Z':
                case 'z':
                    if (polyline.length && (cx !== sx || cy !== sy)) {
                        appendSegment([{ x: cx, y: cy }, { x: sx, y: sy }]);
                    }
                    cx = sx;
                    cy = sy;
                    lastC2 = null;
                    cmd = '';
                    break;
                default:
                    i += 1;
                    cmd = '';
                    break;
            }
        }

        return polyline;
    }

    function minSegmentOutlineGap(outlineA, outlineB) {
        const pointsA = outlinePathPolyline(outlineA);
        const pointsB = outlinePathPolyline(outlineB);
        if (pointsA.length < 2 || pointsB.length < 2) return Infinity;

        let best = Infinity;
        for (let i = 0; i < pointsA.length - 1; i += 1) {
            for (let j = 0; j < pointsB.length - 1; j += 1) {
                const gap = segmentSegmentDistance(pointsA[i], pointsA[i + 1], pointsB[j], pointsB[j + 1]);
                if (gap < best) best = gap;
            }
        }
        return best;
    }

    function forcedBorderPairKey(cityAId, cityBId) {
        return [String(cityAId || ''), String(cityBId || '')].sort().join('::');
    }

    function isForcedCityBorder(cityAId, cityBId) {
        return FORCED_CITY_BORDER_PAIRS.has(forcedBorderPairKey(cityAId, cityBId));
    }

    function citiesShareBorder(cityA, cityB) {
        if (!cityA || !cityB || cityA.id === cityB.id) return false;
        if (isForcedCityBorder(cityA.id, cityB.id)) return true;
        if (!cityBoxesTouch(cityA.bbox, cityB.bbox, ADJACENCY_PREFILTER_PAD)) return false;
        return minSegmentOutlineGap(cityA.outlinePath, cityB.outlinePath) <= ADJACENCY_MAX_GAP;
    }

    function sanitizeCatalogNeighbors(cities) {
        if (!Array.isArray(cities) || !cities.length) return cities;
        const byId = new Map(cities.map((city) => [city.id, city]));

        cities.forEach((city) => {
            city.neighbors = (city.neighbors || []).filter((neighborId) => {
                const neighbor = byId.get(neighborId);
                if (!neighbor) return false;
                return citiesShareBorder(city, neighbor);
            });
        });

        return cities;
    }

    /** Strip bbox-only false positives, then add any missing true cross-nation land borders. */
    function augmentCrossBorderNeighbors(cities) {
        if (!Array.isArray(cities) || !cities.length) return cities;

        sanitizeCatalogNeighbors(cities);

        for (let i = 0; i < cities.length; i += 1) {
            for (let j = i + 1; j < cities.length; j += 1) {
                const cityA = cities[i];
                const cityB = cities[j];
                if (!cityA || !cityB || cityA.nationId === cityB.nationId) continue;
                if (!citiesShareBorder(cityA, cityB)) continue;

                if (!Array.isArray(cityA.neighbors)) cityA.neighbors = [];
                if (!Array.isArray(cityB.neighbors)) cityB.neighbors = [];
                if (!cityA.neighbors.includes(cityB.id)) cityA.neighbors.push(cityB.id);
                if (!cityB.neighbors.includes(cityA.id)) cityB.neighbors.push(cityA.id);
            }
        }

        return cities;
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
                case 'C':
                case 'c': {
                    readNum();
                    readNum();
                    readNum();
                    readNum();
                    const x = readNum();
                    const y = readNum();
                    if (cmd === 'c') pushPoint(cx + x, cy + y);
                    else pushPoint(x, y);
                    break;
                }
                case 'S':
                case 's': {
                    readNum();
                    readNum();
                    const x = readNum();
                    const y = readNum();
                    if (cmd === 's') pushPoint(cx + x, cy + y);
                    else pushPoint(x, y);
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
        augmentCrossBorderNeighbors,
        sanitizeCatalogNeighbors,
        citiesShareBorder,
        outlinePathPolyline,
        areCatalogCitiesAdjacent,
        resolveCityConnection,
        parseOutlinePoints,
        resolveBorderAnchor,
        buildCurvedPath,
        resolveRouteGeometry
    };
})(window);
