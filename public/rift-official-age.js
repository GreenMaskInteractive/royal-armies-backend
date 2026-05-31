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
        return `/age${getOfficialAgeSlug()}`;
    }

    function isOfficialAgePageActive() {
        const canvas = global.document.getElementById('age-page-canvas');
        return Boolean(canvas && canvas.classList.contains('age-page-canvas'));
    }

    global.RoyalArmiesOfficialAge = {
        getOfficialAgeSlug,
        getOfficialAgePageFileName,
        getOfficialAgePagePath,
        isOfficialAgePageActive
    };

    global.getOfficialAgePagePath = getOfficialAgePagePath;
    global.isOfficialAgePageActive = isOfficialAgePageActive;
})(window);
