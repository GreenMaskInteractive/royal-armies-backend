/**
 * RIFT — Unit purchase catalog (barracks recruitment database).
 */
(function initRoyalArmiesUnitPurchaseCatalog(global) {
    'use strict';

    const PROMOTION_LABELS = {
        app: 'Apprentice',
        std: 'Standard',
        vet: 'Veteran',
        mst: 'Master',
        leg: 'Legendary',
        elite: 'Elite'
    };

    const DEFAULT_PLACEHOLDER = 'images/units/unit-portrait-placeholder.svg';

    const FOUR_TIER_UNLOCK_RANKS = [1, 7, 14, 18];
    const EXTENDED_UNLOCK_RANKS = [1, 7, 14, 18, 20, 21, 22];

    const CLASS_BY_PATH = {
        Physical: 'battlemaster',
        Magic: 'archmage'
    };

    const PATH_BY_CLASS = {
        battlemaster: 'Physical',
        archmage: 'Magic'
    };

    let catalogPromise = null;
    let catalogCache = null;

    function resolveApiUrl(path) {
        if (typeof global.resolveApiUrl === 'function') {
            return global.resolveApiUrl(path);
        }
        const origin = global.location?.origin || '';
        if (String(path || '').startsWith('http')) return path;
        if (String(path || '').startsWith('/')) return `${origin}${path}`;
        return `${origin}/${path}`;
    }

    function normalizeCommanderPath(rawPath) {
        const path = String(rawPath || '').trim().toUpperCase();
        if (path === 'MAG' || path === 'MAGIC') return 'MAG';
        if (path === 'PHYS' || path === 'PHYSICAL') return 'PHYS';
        return path;
    }

    function resolveCommanderClassId(rawPath) {
        return normalizeCommanderPath(rawPath) === 'MAG' ? 'archmage' : 'battlemaster';
    }

    function resolveCommanderRecruitmentContext() {
        const player = typeof global.player !== 'undefined' ? global.player : null;
        const path = normalizeCommanderPath(player?.path);
        const rank = Math.max(1, Math.floor(Number(player?.rank) || 1));
        const classId = resolveCommanderClassId(path);

        return {
            rank,
            path,
            classId,
            classLabel: classId === 'archmage' ? 'Archmage' : 'Battlemaster'
        };
    }

    function getCategoryMaxTier(catalog, categoryId) {
        const id = String(categoryId || '').trim();
        return (catalog?.units || [])
            .filter((unit) => unit.categoryId === id)
            .reduce((max, unit) => Math.max(max, Number(unit.tier) || 0), 0);
    }

    function resolveUnlockRankForTier(catalog, tier, categoryId) {
        const rules = catalog?.meta?.tierUnlockRules;
        const fourTier = Array.isArray(rules?.fourTierUnlockRanks)
            ? rules.fourTierUnlockRanks
            : FOUR_TIER_UNLOCK_RANKS;
        const extended = Array.isArray(rules?.extendedUnlockRanks)
            ? rules.extendedUnlockRanks
            : EXTENDED_UNLOCK_RANKS;

        const gameTier = Math.max(1, Math.floor(Number(tier) || 1));
        const maxTier = getCategoryMaxTier(catalog, categoryId);
        const table = maxTier > 4 ? extended : fourTier;
        const index = Math.max(0, Math.min(table.length - 1, gameTier - 1));
        return table[index];
    }

    function enrichCatalogUnit(catalog, unit) {
        if (!unit || typeof unit !== 'object') return unit;

        const category = (catalog?.categories || []).find((entry) => entry.id === unit.categoryId);
        const path = category?.path || 'Physical';
        const requiredClass = unit.requiredClass || CLASS_BY_PATH[path] || 'battlemaster';
        const unlockRank = Number.isFinite(Number(unit.unlockRank))
            ? Number(unit.unlockRank)
            : resolveUnlockRankForTier(catalog, unit.tier, unit.categoryId);

        return {
            ...unit,
            requiredClass,
            unlockRank,
            roleLabel: unit.roleLabel || formatUnitRoleLabel(unit.unitRole)
        };
    }

    function enrichCatalog(catalog) {
        if (!catalog || typeof catalog !== 'object') return catalog;

        const units = (catalog.units || []).map((unit) => enrichCatalogUnit(catalog, unit));
        return { ...catalog, units };
    }

    async function loadCatalog() {
        if (catalogCache) return catalogCache;
        if (catalogPromise) return catalogPromise;

        catalogPromise = (async () => {
            const response = await global.fetch(
                resolveApiUrl('data/unit-purchase-catalog.json?v=unit-catalog-3'),
                { cache: 'no-store' }
            );
            if (!response.ok) {
                throw new Error(`Unit catalog load failed (${response.status})`);
            }
            catalogCache = enrichCatalog(await response.json());
            return catalogCache;
        })();

        return catalogPromise;
    }

    function getCachedCatalog() {
        return catalogCache;
    }

    function getCategories(catalog, options = {}) {
        const commander = options.commander || resolveCommanderRecruitmentContext();
        const allowedPath = PATH_BY_CLASS[commander.classId] || 'Physical';

        return (catalog?.categories || [])
            .filter((category) => !options.filterByClass || category.path === allowedPath)
            .slice()
            .sort((left, right) => (left.sortOrder || 0) - (right.sortOrder || 0));
    }

    function getUnitsForCategory(catalog, categoryId, options = {}) {
        const id = String(categoryId || '').trim();
        const commander = options.commander || resolveCommanderRecruitmentContext();

        return (catalog?.units || [])
            .filter((unit) => unit.categoryId === id)
            .map((unit) => enrichCatalogUnit(catalog, unit))
            .filter((unit) => !options.filterByClass || unit.requiredClass === commander.classId)
            .sort((left, right) => (left.tier || 0) - (right.tier || 0));
    }

    function getUnitById(catalog, unitId) {
        const id = String(unitId || '').trim();
        const unit = (catalog?.units || []).find((entry) => entry.id === id) || null;
        return unit ? enrichCatalogUnit(catalog, unit) : null;
    }

    function formatUnitRoleLabel(unitRole) {
        if (unitRole === 'pvp') return 'PvP';
        if (unitRole === 'both') return 'Rank / PvP';
        return 'Rank';
    }

    function evaluateUnitPurchaseAccess(unit, commander) {
        const ctx = commander || resolveCommanderRecruitmentContext();
        const enriched = unit?.unlockRank != null ? unit : enrichCatalogUnit(getCachedCatalog(), unit);

        if (!enriched) {
            return {
                allowed: false,
                reason: 'Unit not found.',
                unlockRank: null,
                requiredClass: null
            };
        }

        if (enriched.requiredClass && enriched.requiredClass !== ctx.classId) {
            const requiredLabel = enriched.requiredClass === 'archmage' ? 'Archmage' : 'Battlemaster';
            return {
                allowed: false,
                reason: `${requiredLabel} class only.`,
                unlockRank: enriched.unlockRank,
                requiredClass: enriched.requiredClass,
                unitRole: enriched.unitRole,
                roleLabel: enriched.roleLabel
            };
        }

        const unlockRank = Math.max(1, Math.floor(Number(enriched.unlockRank) || 1));
        if (ctx.rank < unlockRank) {
            return {
                allowed: false,
                reason: `Unlocks at Commander Rank ${unlockRank}.`,
                unlockRank,
                requiredClass: enriched.requiredClass,
                unitRole: enriched.unitRole,
                roleLabel: enriched.roleLabel
            };
        }

        return {
            allowed: true,
            reason: '',
            unlockRank,
            requiredClass: enriched.requiredClass,
            unitRole: enriched.unitRole,
            roleLabel: enriched.roleLabel
        };
    }

    function resolveUnitPortraitUrl(unit, catalog) {
        if (!unit) return DEFAULT_PLACEHOLDER;
        if (unit.portraitPlaceholder) {
            return catalog?.meta?.placeholderPortrait || DEFAULT_PLACEHOLDER;
        }
        return unit.portraitSrc || DEFAULT_PLACEHOLDER;
    }

    function formatGold(value) {
        const numeric = Number(value);
        if (!Number.isFinite(numeric)) return '—';
        return `${numeric.toLocaleString('en-US')}g`;
    }

    function formatPromotionLabel(key) {
        return PROMOTION_LABELS[key] || String(key || '').toUpperCase();
    }

    function unitHasRangedStats(unit) {
        return Boolean(unit?.categoryId?.includes('artillery'));
    }

    global.RoyalArmiesUnitPurchaseCatalog = {
        loadCatalog,
        getCachedCatalog,
        getCategories,
        getUnitsForCategory,
        getUnitById,
        resolveCommanderRecruitmentContext,
        resolveUnlockRankForTier,
        evaluateUnitPurchaseAccess,
        formatUnitRoleLabel,
        resolveUnitPortraitUrl,
        formatGold,
        formatPromotionLabel,
        unitHasRangedStats,
        PROMOTION_LABELS,
        FOUR_TIER_UNLOCK_RANKS,
        EXTENDED_UNLOCK_RANKS
    };
})(window);
