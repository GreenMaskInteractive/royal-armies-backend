/**
 * RIFT — Official live-age page slug/path (extensionless /age[slug] URLs).
 * Pre-age production uses agealpha.html; later slugs mirror the active round number.
 */
(function initRiftOfficialAge(global) {
    'use strict';

    const PRE_AGE_SLUG = 'alpha';

    function getOfficialAgeSlug() {
        return PRE_AGE_SLUG;
    }

    function getOfficialAgePageFileName() {
        return `age${getOfficialAgeSlug()}.html`;
    }

    function getOfficialAgePagePath() {
        const slug = `age${getOfficialAgeSlug()}`;
        if (typeof global.resolveRoyalArmiesPageUrl === 'function') {
            return global.resolveRoyalArmiesPageUrl(slug);
        }
        return `/${slug}`;
    }

    function isOfficialAgePageActive() {
        const canvas = global.document.getElementById('age-page-canvas');
        return Boolean(canvas && canvas.classList.contains('age-page-canvas'));
    }

    /** Published nation terrain bonus table (false while Age Alpha is pre-release). */
    function isNationTerrainBonusDataLive() {
        const canvas = global.document.getElementById('age-page-canvas');
        const slug = String(canvas?.dataset?.ageSlug || getOfficialAgeSlug()).trim().toLowerCase();
        return slug !== PRE_AGE_SLUG;
    }

    global.RoyalArmiesOfficialAge = {
        getOfficialAgeSlug,
        getOfficialAgePageFileName,
        getOfficialAgePagePath,
        isOfficialAgePageActive,
        isNationTerrainBonusDataLive
    };

    global.getOfficialAgePagePath = getOfficialAgePagePath;
    global.isOfficialAgePageActive = isOfficialAgePageActive;
    global.isNationTerrainBonusDataLive = isNationTerrainBonusDataLive;
})(window);
