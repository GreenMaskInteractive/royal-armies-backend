/**
 * RIFT — Shared nation-plan route rendering (ribbon, gems, pennant heads).
 */
(function initAgeWorldMapPlanRouteStyle(global) {
    'use strict';

    const SVG_NS = 'http://www.w3.org/2000/svg';

    const DRAFT_ROUTE_STYLES = {
        draft: {
            filterId: 'age-world-plan-glow-draft',
            marker: 'age-world-plan-draft-head-draft',
            stroke: 'url(#age-world-plan-stroke-draft)',
            ribbon: 'rgba(201, 168, 64, 0.42)',
            track: 'rgba(184, 144, 48, 0.22)',
            rim: '#c9a84c',
            gemStart: '#e8e0cc',
            gemEnd: '#b8a878'
        },
        sf: {
            filterId: 'age-world-plan-glow-sf',
            marker: 'age-world-plan-draft-head-sf',
            stroke: 'url(#age-world-plan-stroke-sf)',
            ribbon: 'rgba(232, 88, 48, 0.48)',
            track: 'rgba(200, 72, 40, 0.32)',
            rim: '#ffb878',
            gemStart: '#e8a85a',
            gemEnd: '#ff6a40'
        },
        mf: {
            filterId: 'age-world-plan-glow-mf',
            marker: 'age-world-plan-draft-head-mf',
            stroke: 'url(#age-world-plan-stroke-mf)',
            ribbon: 'rgba(120, 20, 20, 0.52)',
            track: 'rgba(90, 16, 16, 0.36)',
            rim: '#c44a4a',
            gemStart: '#d86a6a',
            gemEnd: '#8b1818'
        },
        move: {
            filterId: 'age-world-plan-glow-move',
            marker: 'age-world-plan-draft-head-move',
            stroke: 'url(#age-world-plan-stroke-move)',
            ribbon: 'rgba(72, 180, 120, 0.45)',
            track: 'rgba(48, 140, 96, 0.28)',
            rim: '#8ee8b0',
            gemStart: '#7ec49a',
            gemEnd: '#3a9870'
        },
        'temp-main': {
            filterId: 'age-world-plan-glow-temp-main',
            marker: 'age-world-plan-draft-head-temp-main',
            stroke: 'url(#age-world-plan-stroke-temp-main)',
            ribbon: 'rgba(168, 120, 255, 0.42)',
            track: 'rgba(120, 88, 168, 0.3)',
            rim: '#dcc8ff',
            gemStart: '#c8b0ff',
            gemEnd: '#9070e8'
        },
        rally: {
            filterId: 'age-world-plan-glow-rally',
            marker: 'age-world-plan-draft-head-rally',
            stroke: 'url(#age-world-plan-stroke-rally)',
            ribbon: 'rgba(255, 200, 72, 0.52)',
            track: 'rgba(220, 168, 48, 0.34)',
            rim: '#ffe8a0',
            gemStart: '#ffd978',
            gemEnd: '#ffb830'
        }
    };

    const PUBLISHED_ROUTE_STYLES = {
        sf: {
            filterId: 'age-world-plan-glow-sf-pub',
            marker: 'age-world-plan-head-sf',
            stroke: 'url(#age-world-plan-stroke-sf-pub)',
            ribbon: 'rgba(232, 88, 48, 0.48)',
            track: 'rgba(200, 72, 40, 0.32)',
            rim: '#ffb878',
            gemStart: '#e8a85a',
            gemEnd: '#ff6a40'
        },
        mf: {
            filterId: 'age-world-plan-glow-mf-pub',
            marker: 'age-world-plan-head-mf',
            stroke: 'url(#age-world-plan-stroke-mf-pub)',
            ribbon: 'rgba(120, 20, 20, 0.52)',
            track: 'rgba(90, 16, 16, 0.36)',
            rim: '#c44a4a',
            gemStart: '#d86a6a',
            gemEnd: '#8b1818'
        },
        move: {
            filterId: 'age-world-plan-glow-move-pub',
            marker: 'age-world-plan-head-move',
            stroke: 'url(#age-world-plan-stroke-move-pub)',
            ribbon: 'rgba(72, 180, 120, 0.45)',
            track: 'rgba(48, 140, 96, 0.28)',
            rim: '#8ee8b0',
            gemStart: '#7ec49a',
            gemEnd: '#3a9870'
        },
        taxi: {
            filterId: 'age-world-plan-glow-rally-pub',
            marker: 'age-world-plan-head-taxi',
            stroke: 'url(#age-world-plan-stroke-taxi-pub)',
            ribbon: 'rgba(255, 200, 72, 0.52)',
            track: 'rgba(220, 168, 48, 0.34)',
            rim: '#ffe8a0',
            gemStart: '#ffd978',
            gemEnd: '#ffb830'
        },
        'temp-main': {
            filterId: 'age-world-plan-glow-temp-pub',
            marker: 'age-world-plan-head-temp-main',
            stroke: 'url(#age-world-plan-stroke-temp-main-pub)',
            ribbon: 'rgba(168, 120, 255, 0.42)',
            track: 'rgba(120, 88, 168, 0.3)',
            rim: '#dcc8ff',
            gemStart: '#c8b0ff',
            gemEnd: '#9070e8'
        }
    };

    function appendPath(parent, geometry, className, stroke, strokeWidth, extra) {
        const path = global.document.createElementNS(SVG_NS, 'path');
        path.setAttribute('d', geometry.d);
        path.setAttribute('class', className);
        path.setAttribute('fill', 'none');
        path.setAttribute('stroke', stroke);
        path.setAttribute('stroke-width', String(strokeWidth));
        path.setAttribute('stroke-linecap', 'round');
        path.setAttribute('stroke-linejoin', 'round');
        if (extra) {
            Object.keys(extra).forEach((key) => path.setAttribute(key, extra[key]));
        }
        parent.appendChild(path);
        return path;
    }

    function appendTerminalGem(group, x, y, role, uiType, visuals) {
        if (!Number.isFinite(x) || !Number.isFinite(y)) return;

        const gemGroup = global.document.createElementNS(SVG_NS, 'g');
        gemGroup.setAttribute(
            'class',
            `age-world-map-plan-route-gem age-world-map-plan-route-gem--${role} age-world-map-plan-route-gem--${uiType}`
        );

        const ring = global.document.createElementNS(SVG_NS, 'circle');
        ring.setAttribute('cx', x.toFixed(1));
        ring.setAttribute('cy', y.toFixed(1));
        ring.setAttribute('class', 'age-world-map-plan-route-gem__ring');
        ring.setAttribute('r', role === 'end' ? '9' : '7');
        ring.setAttribute('fill', 'none');
        ring.setAttribute('stroke', visuals.rim);
        ring.setAttribute('stroke-width', '2');
        gemGroup.appendChild(ring);

        if (role === 'end' && (uiType === 'rally' || uiType === 'taxi')) {
            const diamond = global.document.createElementNS(SVG_NS, 'polygon');
            diamond.setAttribute(
                'points',
                `${x.toFixed(1)},${(y - 8).toFixed(1)} ${(x + 6).toFixed(1)},${y.toFixed(1)} `
                    + `${x.toFixed(1)},${(y + 8).toFixed(1)} ${(x - 6).toFixed(1)},${y.toFixed(1)}`
            );
            diamond.setAttribute('class', 'age-world-map-plan-route-gem__core');
            diamond.setAttribute('fill', visuals.gemEnd);
            diamond.setAttribute('stroke', '#0a0804');
            diamond.setAttribute('stroke-width', '1.4');
            gemGroup.appendChild(diamond);
        } else {
            const core = global.document.createElementNS(SVG_NS, 'circle');
            core.setAttribute('cx', x.toFixed(1));
            core.setAttribute('cy', y.toFixed(1));
            core.setAttribute('class', 'age-world-map-plan-route-gem__core');
            core.setAttribute('r', role === 'end' ? '5.5' : '4');
            core.setAttribute('fill', role === 'end' ? visuals.gemEnd : visuals.gemStart);
            core.setAttribute('stroke', '#0a0804');
            core.setAttribute('stroke-width', '1.4');
            gemGroup.appendChild(core);
        }

        group.appendChild(gemGroup);
    }

    function appendPlanRoute(layer, geometry, uiType, stylesMap, options) {
        if (!geometry?.d || !layer) return null;

        const visuals = stylesMap[uiType] || stylesMap.draft || stylesMap.sf;
        const group = global.document.createElementNS(SVG_NS, 'g');
        group.setAttribute('class', `age-world-map-plan-route age-world-map-plan-route-v2 age-world-map-plan-route--${uiType}`);
        group.setAttribute('filter', `url(#${visuals.filterId})`);

        const ribbon = appendPath(
            group,
            geometry,
            `age-world-map-plan-arrow-ribbon age-world-map-plan-arrow-ribbon--${uiType}`,
            visuals.ribbon,
            20
        );
        appendPath(group, geometry, `age-world-map-plan-arrow-track age-world-map-plan-arrow-track--${uiType}`, visuals.track, 13);
        appendPath(group, geometry, `age-world-map-plan-arrow-halo age-world-map-plan-arrow-halo--${uiType}`, '#0a0804', 7.5);

        const rimExtra = uiType !== 'draft' && !options?.isDraft
            ? { 'stroke-dasharray': '7 5' }
            : null;
        appendPath(
            group,
            geometry,
            `age-world-map-plan-arrow-rim age-world-map-plan-arrow-rim--${uiType}`,
            visuals.rim,
            4.2,
            rimExtra
        );

        const path = appendPath(
            group,
            geometry,
            `age-world-map-plan-arrow age-world-map-plan-arrow--${uiType}`,
            visuals.stroke,
            4.5
        );
        path.setAttribute('marker-end', `url(#${visuals.marker})`);
        if (options?.arrowId) {
            path.setAttribute('data-draft-arrow-id', options.arrowId);
        }
        if (options?.isDraft) {
            path.classList.add('is-draft');
        }
        if (options?.march) {
            ribbon.classList.add('is-marching');
            path.classList.add('is-marching');
        }

        appendPath(
            group,
            geometry,
            `age-world-map-plan-arrow-sheen age-world-map-plan-arrow-sheen--${uiType}`,
            'rgba(255, 248, 220, 0.55)',
            1.4
        );

        appendTerminalGem(group, geometry.startX, geometry.startY, 'start', uiType, visuals);
        appendTerminalGem(group, geometry.endX, geometry.endY, 'end', uiType, visuals);

        layer.appendChild(group);

        if (options?.arrowId) {
            const hitPath = global.document.createElementNS(SVG_NS, 'path');
            hitPath.setAttribute('d', geometry.d);
            hitPath.setAttribute('class', `age-world-map-plan-arrow-hit age-world-map-plan-arrow-hit--${uiType}`);
            hitPath.setAttribute('data-draft-arrow-id', options.arrowId);
            hitPath.setAttribute('fill', 'none');
            hitPath.setAttribute('stroke', 'rgba(0, 0, 0, 0.001)');
            hitPath.setAttribute('stroke-width', '18');
            hitPath.setAttribute('stroke-linecap', 'round');
            layer.appendChild(hitPath);
        }

        return path;
    }

    global.RoyalArmiesAgeWorldMapPlanRouteStyle = {
        appendDraftRoute(layer, geometry, uiType, options) {
            return appendPlanRoute(layer, geometry, uiType, DRAFT_ROUTE_STYLES, {
                march: true,
                ...(options || {})
            });
        },
        appendPublishedRoute(layer, geometry, routeType) {
            return appendPlanRoute(layer, geometry, routeType, PUBLISHED_ROUTE_STYLES, {});
        }
    };
})(typeof window !== 'undefined' ? window : globalThis);
