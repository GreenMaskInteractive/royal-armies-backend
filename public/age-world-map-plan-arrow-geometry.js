/**
 * RIFT — Curved nation-plan route geometry for world-map overlays.
 */
(function initAgeWorldMapPlanArrowGeometry(global) {
    'use strict';

    function trimEndpoints(from, to, trimPx) {
        const dx = to.x - from.x;
        const dy = to.y - from.y;
        const dist = Math.hypot(dx, dy);
        if (dist < 1) {
            return { start: { ...from }, end: { ...to }, dist: 0 };
        }

        const trim = Math.min(trimPx, dist * 0.42);
        const ux = dx / dist;
        const uy = dy / dist;
        return {
            start: { x: from.x + ux * trim, y: from.y + uy * trim },
            end: { x: to.x - ux * trim, y: to.y - uy * trim },
            dist: dist - trim * 2,
            ux,
            uy
        };
    }

    function buildCurvedRoutePath(fromPoint, toPoint, options) {
        const trimPx = Number(options?.trimPx) || 18;
        const bowScale = Number(options?.bowScale) || 0.22;
        const maxBow = Number(options?.maxBow) || 56;

        if (!fromPoint || !toPoint) return null;

        const trimmed = trimEndpoints(fromPoint, toPoint, trimPx);
        const { start, end, dist, ux, uy } = trimmed;

        const base = {
            startX: start.x,
            startY: start.y,
            endX: end.x,
            endY: end.y,
            labelX: (start.x + end.x) / 2,
            labelY: (start.y + end.y) / 2
        };

        if (dist < 8) {
            return {
                ...base,
                d: `M ${start.x.toFixed(1)} ${start.y.toFixed(1)} L ${end.x.toFixed(1)} ${end.y.toFixed(1)}`
            };
        }

        const bow = Math.min(maxBow, dist * bowScale);
        const cx = (start.x + end.x) / 2 + (-uy) * bow;
        const cy = (start.y + end.y) / 2 + (ux) * bow;
        const t = 0.5;
        const mt = 1 - t;

        return {
            ...base,
            d: `M ${start.x.toFixed(1)} ${start.y.toFixed(1)} `
                + `Q ${cx.toFixed(1)} ${cy.toFixed(1)} ${end.x.toFixed(1)} ${end.y.toFixed(1)}`,
            labelX: mt * mt * start.x + 2 * mt * t * cx + t * t * end.x,
            labelY: mt * mt * start.y + 2 * mt * t * cy + t * t * end.y
        };
    }

    global.RoyalArmiesAgeWorldMapPlanArrows = {
        buildCurvedRoutePath,
        trimEndpoints
    };
})(window);
