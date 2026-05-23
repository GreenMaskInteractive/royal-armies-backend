/**
 * Commander dossier sync — account-bound portal data persisted to the server ledger.
 * localStorage remains a per-device cache; the server is the source of truth when available.
 */
(function initRoyalArmiesCommanderDossierSync(global) {
    'use strict';

    const DOSSIER_CACHE_PREFIX = 'royalArmiesCommanderDossier:';
    const LEGACY_KEYS = {
        bio: 'savedCommanderBio',
        privacy: 'savedCommanderPrivacy',
        avatarUrl: 'savedProfileAvatarUrl',
        ageHistory: 'savedCommanderAgeHistory',
        awards: 'savedCommanderAwards',
        medals: 'savedCommanderMedals',
        membershipTitle: 'savedCommanderMembershipTitle',
        premiumMember: 'savedChroniclePremiumMember',
        chronicleXp: 'savedChronicleMeritProgress',
        ageResetUsage: 'savedCommanderAgeResetUsage'
    };

    let pendingPatch = {};
    let saveTimer = null;
    let saveInFlight = null;

    function resolveCommanderUsername() {
        if (typeof global.getMailboxApiUsername === 'function') {
            const apiUser = global.getMailboxApiUsername();
            if (apiUser) return apiUser;
        }
        if (typeof global.getActiveCommanderUsername === 'function') {
            const active = String(global.getActiveCommanderUsername() || '').trim();
            if (active && active.toLowerCase() !== 'testaccount') return active;
        }
        return '';
    }

    function getDossierCacheKey(username) {
        const user = String(username || resolveCommanderUsername() || 'guest').trim();
        return `${DOSSIER_CACHE_PREFIX}${user || 'guest'}`;
    }

    function readDossierCache(username) {
        try {
            const raw = global.localStorage.getItem(getDossierCacheKey(username));
            if (!raw) return null;
            const parsed = JSON.parse(raw);
            return parsed && typeof parsed === 'object' ? parsed : null;
        } catch (_err) {
            return null;
        }
    }

    function writeDossierCache(dossier, username) {
        if (!dossier || typeof dossier !== 'object') return;
        try {
            global.localStorage.setItem(getDossierCacheKey(username), JSON.stringify(dossier));
        } catch (err) {
            console.warn('Dossier cache save skipped:', err.message);
        }
    }

    function mirrorLegacyLocalStorage(dossier) {
        if (!dossier || typeof dossier !== 'object') return;
        try {
            if (dossier.bio != null) global.localStorage.setItem(LEGACY_KEYS.bio, String(dossier.bio));
            if (dossier.privacy) global.localStorage.setItem(LEGACY_KEYS.privacy, dossier.privacy);
            if (dossier.avatarUrl) global.localStorage.setItem(LEGACY_KEYS.avatarUrl, dossier.avatarUrl);
            if (Array.isArray(dossier.ageHistory)) {
                global.localStorage.setItem(LEGACY_KEYS.ageHistory, JSON.stringify(dossier.ageHistory));
            }
            if (Array.isArray(dossier.awards)) {
                global.localStorage.setItem(LEGACY_KEYS.awards, JSON.stringify(dossier.awards));
            }
            if (Array.isArray(dossier.medals)) {
                global.localStorage.setItem(LEGACY_KEYS.medals, JSON.stringify(dossier.medals));
            }
            if (dossier.membershipTitle) {
                global.localStorage.setItem(LEGACY_KEYS.membershipTitle, dossier.membershipTitle);
            }
            if (dossier.premiumMember) {
                global.localStorage.setItem(LEGACY_KEYS.premiumMember, 'true');
            } else if (dossier.premiumMember === false) {
                global.localStorage.removeItem(LEGACY_KEYS.premiumMember);
            }
            if (dossier.chronicleXp) {
                global.localStorage.setItem(LEGACY_KEYS.chronicleXp, JSON.stringify(dossier.chronicleXp));
            }
            if (dossier.ageResetUsage) {
                global.localStorage.setItem(LEGACY_KEYS.ageResetUsage, JSON.stringify(dossier.ageResetUsage));
            }
            if (dossier.preferences && typeof dossier.preferences === 'object') {
                mirrorPreferencesToLegacyStorage(dossier.preferences);
            }
        } catch (err) {
            console.warn('Legacy dossier mirror skipped:', err.message);
        }
    }

    function mirrorPreferencesToLegacyStorage(preferences) {
        const prefs = preferences || {};
        const setNum = (key, value) => {
            if (Number.isFinite(Number(value))) global.localStorage.setItem(key, String(value));
        };
        setNum('savedUIScale', prefs.uiScale);
        setNum('savedTextScale', prefs.textScale);
        global.localStorage.setItem('savedHighContrast', prefs.highContrast ? 'true' : 'false');
        setNum('savedMasterVol', prefs.masterVol);
        setNum('savedMusicVol', prefs.musicVol);
        setNum('savedNarrationVol', prefs.narrationVol);
        setNum('savedSfxVol', prefs.sfxVol);
        if (prefs.verbosity) global.localStorage.setItem('savedVerbosity', prefs.verbosity);
        if (prefs.pings) global.localStorage.setItem('savedPings', prefs.pings);
        if (prefs.safetyLock) global.localStorage.setItem('savedSafetyLock', prefs.safetyLock);
        global.localStorage.setItem('savedDyslexiaFont', prefs.dyslexiaFont ? 'true' : 'false');
        setNum('savedPortalMasterVol', prefs.portalMasterVol);
        setNum('savedPortalMusicVol', prefs.portalMusicVol);
        setNum('savedPortalNarrationVol', prefs.portalNarrationVol);
        setNum('savedPortalSfxVol', prefs.portalSfxVol);
    }

    function readLegacyDossierFallback() {
        const dossier = {};
        try {
            const bio = global.localStorage.getItem(LEGACY_KEYS.bio);
            if (bio !== null) dossier.bio = bio;
            const privacy = global.localStorage.getItem(LEGACY_KEYS.privacy);
            if (privacy === 'Public' || privacy === 'Private') dossier.privacy = privacy;
            const avatarUrl = global.localStorage.getItem(LEGACY_KEYS.avatarUrl);
            if (avatarUrl) dossier.avatarUrl = avatarUrl;
            const ageHistory = global.localStorage.getItem(LEGACY_KEYS.ageHistory);
            if (ageHistory) dossier.ageHistory = JSON.parse(ageHistory);
            const awards = global.localStorage.getItem(LEGACY_KEYS.awards);
            if (awards) dossier.awards = JSON.parse(awards);
            const medals = global.localStorage.getItem(LEGACY_KEYS.medals);
            if (medals) dossier.medals = JSON.parse(medals);
            const membershipTitle = global.localStorage.getItem(LEGACY_KEYS.membershipTitle);
            if (membershipTitle) dossier.membershipTitle = membershipTitle;
            dossier.premiumMember = global.localStorage.getItem(LEGACY_KEYS.premiumMember) === 'true';
            const chronicleXp = global.localStorage.getItem(LEGACY_KEYS.chronicleXp);
            if (chronicleXp) dossier.chronicleXp = JSON.parse(chronicleXp);
            const ageResetUsage = global.localStorage.getItem(LEGACY_KEYS.ageResetUsage);
            if (ageResetUsage) dossier.ageResetUsage = JSON.parse(ageResetUsage);
            dossier.preferences = {
                uiScale: parseFloat(global.localStorage.getItem('savedUIScale')) || 1,
                textScale: parseFloat(global.localStorage.getItem('savedTextScale')) || 1,
                highContrast: global.localStorage.getItem('savedHighContrast') === 'true',
                masterVol: parseFloat(global.localStorage.getItem('savedMasterVol')) || 1,
                musicVol: parseFloat(global.localStorage.getItem('savedMusicVol')) || 0.5,
                narrationVol: parseFloat(global.localStorage.getItem('savedNarrationVol')) || 1,
                sfxVol: parseFloat(global.localStorage.getItem('savedSfxVol')) || 0.2,
                verbosity: global.localStorage.getItem('savedVerbosity') || 'Detailed',
                pings: global.localStorage.getItem('savedPings') || 'Enabled',
                safetyLock: global.localStorage.getItem('savedSafetyLock') || 'Double-Click',
                dyslexiaFont: global.localStorage.getItem('savedDyslexiaFont') === 'true',
                portalMasterVol: parseFloat(global.localStorage.getItem('savedPortalMasterVol')) || 1,
                portalMusicVol: parseFloat(global.localStorage.getItem('savedPortalMusicVol')) || 0.5,
                portalNarrationVol: parseFloat(global.localStorage.getItem('savedPortalNarrationVol')) || 1,
                portalSfxVol: parseFloat(global.localStorage.getItem('savedPortalSfxVol')) || 0.2
            };
        } catch (_err) {
            /* ignore malformed legacy cache */
        }
        return dossier;
    }

    function applyPreferencesToRuntime(preferences) {
        if (!preferences || typeof preferences !== 'object') return;

        if (typeof global.confirmedScale !== 'undefined') {
            global.confirmedScale = Number(preferences.uiScale) || global.confirmedScale;
            global.stagedScale = global.confirmedScale;
            global.document.documentElement.style.setProperty('--ui-scale', global.confirmedScale);
        }
        if (typeof global.confirmedTextScale !== 'undefined') {
            global.confirmedTextScale = Number(preferences.textScale) || global.confirmedTextScale;
            global.stagedTextScale = global.confirmedTextScale;
            if (typeof global.applyTextScaleToDocument === 'function') {
                global.applyTextScaleToDocument(global.confirmedTextScale, { silent: true });
            }
        }
        if (typeof global.confirmedMasterVol !== 'undefined') {
            global.confirmedMasterVol = Number(preferences.masterVol) || global.confirmedMasterVol;
            global.stagedMasterVol = global.confirmedMasterVol;
        }
        if (typeof global.confirmedMusicVol !== 'undefined') {
            global.confirmedMusicVol = Number(preferences.musicVol) || global.confirmedMusicVol;
            global.stagedMusicVol = global.confirmedMusicVol;
        }
        if (typeof global.confirmedNarrationVol !== 'undefined') {
            global.confirmedNarrationVol = Number(preferences.narrationVol) || global.confirmedNarrationVol;
            global.stagedNarrationVol = global.confirmedNarrationVol;
        }
        if (typeof global.confirmedSfxVol !== 'undefined') {
            global.confirmedSfxVol = Number(preferences.sfxVol) || global.confirmedSfxVol;
            global.stagedSfxVol = global.confirmedSfxVol;
        }
        if (typeof global.confirmedVerbosity !== 'undefined' && preferences.verbosity) {
            global.confirmedVerbosity = preferences.verbosity;
            global.stagedVerbosity = preferences.verbosity;
        }
        if (typeof global.confirmedPings !== 'undefined' && preferences.pings) {
            global.confirmedPings = preferences.pings;
            global.stagedPings = preferences.pings;
        }
        if (typeof global.confirmedSafetyLock !== 'undefined' && preferences.safetyLock) {
            global.confirmedSafetyLock = preferences.safetyLock;
            global.stagedSafetyLock = preferences.safetyLock;
        }

        global.document.body.classList.toggle('high-contrast-mode', !!preferences.highContrast);
        if (typeof global.setDyslexiaFontEnabled === 'function') {
            global.setDyslexiaFontEnabled(!!preferences.dyslexiaFont);
        }

        if (typeof global.currentPortalMasterVol !== 'undefined' && Number.isFinite(Number(preferences.portalMasterVol))) {
            global.currentPortalMasterVol = Number(preferences.portalMasterVol);
        }
        if (typeof global.currentPortalMusicVol !== 'undefined' && Number.isFinite(Number(preferences.portalMusicVol))) {
            global.currentPortalMusicVol = Number(preferences.portalMusicVol);
        }
        if (typeof global.applyPortalBackgroundMusicVolume === 'function') {
            global.applyPortalBackgroundMusicVolume();
        }
    }

    function applyCommanderDossierToClient(dossier) {
        if (!dossier || typeof dossier !== 'object') return;

        if (typeof global.player !== 'undefined') {
            if (dossier.bio != null) global.player.description = String(dossier.bio);
            if (dossier.privacy === 'Public' || dossier.privacy === 'Private') {
                global.player.privacy = dossier.privacy;
            }
            if (dossier.avatarUrl) global.player.avatarUrl = dossier.avatarUrl;
            if (Array.isArray(dossier.ageHistory)) global.player.ageHistory = dossier.ageHistory.slice();
            if (Array.isArray(dossier.awards)) global.player.awards = dossier.awards.slice();
            if (Array.isArray(dossier.medals)) global.player.medals = dossier.medals.slice();
            if (dossier.membershipTitle) global.player.membershipTitle = dossier.membershipTitle;
        }

        mirrorLegacyLocalStorage(dossier);
        writeDossierCache(dossier);
        applyPreferencesToRuntime(dossier.preferences);

        if (typeof global.hydrateCommanderMembershipFromStorage === 'function') {
            global.hydrateCommanderMembershipFromStorage();
        }
        if (typeof global.refreshChronicleRewardsTrackPanels === 'function') {
            global.refreshChronicleRewardsTrackPanels();
        }
        if (typeof global.refreshProfileCommanderNameDisplay === 'function') {
            global.refreshProfileCommanderNameDisplay();
        }
    }

    function collectPreferencesFromRuntime() {
        return {
            uiScale: typeof global.confirmedScale !== 'undefined' ? global.confirmedScale : 1,
            textScale: typeof global.confirmedTextScale !== 'undefined' ? global.confirmedTextScale : 1,
            highContrast: global.document.body.classList.contains('high-contrast-mode'),
            masterVol: typeof global.confirmedMasterVol !== 'undefined' ? global.confirmedMasterVol : 1,
            musicVol: typeof global.confirmedMusicVol !== 'undefined' ? global.confirmedMusicVol : 0.5,
            narrationVol: typeof global.confirmedNarrationVol !== 'undefined' ? global.confirmedNarrationVol : 1,
            sfxVol: typeof global.confirmedSfxVol !== 'undefined' ? global.confirmedSfxVol : 0.2,
            verbosity: typeof global.confirmedVerbosity !== 'undefined' ? global.confirmedVerbosity : 'Detailed',
            pings: typeof global.confirmedPings !== 'undefined' ? global.confirmedPings : 'Enabled',
            safetyLock: typeof global.confirmedSafetyLock !== 'undefined' ? global.confirmedSafetyLock : 'Double-Click',
            dyslexiaFont: typeof global.isDyslexiaFontEnabled === 'function'
                ? global.isDyslexiaFontEnabled()
                : global.localStorage.getItem('savedDyslexiaFont') === 'true',
            portalMasterVol: Number(global.localStorage.getItem('savedPortalMasterVol')) || 1,
            portalMusicVol: Number(global.localStorage.getItem('savedPortalMusicVol')) || 0.5,
            portalNarrationVol: Number(global.localStorage.getItem('savedPortalNarrationVol')) || 1,
            portalSfxVol: Number(global.localStorage.getItem('savedPortalSfxVol')) || 0.2
        };
    }

    function collectCommanderDossierFromClient() {
        const dossier = {};
        if (typeof global.player !== 'undefined') {
            dossier.bio = String(global.player.description ?? '').trim();
            dossier.privacy = global.player.privacy === 'Private' ? 'Private' : 'Public';
            dossier.avatarUrl = String(global.player.avatarUrl || '').trim();
            dossier.ageHistory = Array.isArray(global.player.ageHistory) ? global.player.ageHistory : [];
            dossier.awards = Array.isArray(global.player.awards) ? global.player.awards : [];
            dossier.medals = Array.isArray(global.player.medals) ? global.player.medals : [];
            dossier.membershipTitle = String(global.player.membershipTitle || 'Basic');
            dossier.premiumMember = global.localStorage.getItem(LEGACY_KEYS.premiumMember) === 'true';
        }
        try {
            const chronicleRaw = global.localStorage.getItem(LEGACY_KEYS.chronicleXp);
            if (chronicleRaw) dossier.chronicleXp = JSON.parse(chronicleRaw);
            const ageResetRaw = global.localStorage.getItem(LEGACY_KEYS.ageResetUsage);
            if (ageResetRaw) dossier.ageResetUsage = JSON.parse(ageResetRaw);
        } catch (_err) {
            /* ignore */
        }
        dossier.preferences = collectPreferencesFromRuntime();
        return dossier;
    }

    function hydrateCommanderDossierFromLocalCache() {
        const cached = readDossierCache() || readLegacyDossierFallback();
        if (cached && Object.keys(cached).length) {
            applyCommanderDossierToClient(cached);
            return true;
        }
        return false;
    }

    async function fetchCommanderDossierFromServer() {
        const username = resolveCommanderUsername();
        if (!username || typeof global.isMailboxApiAvailable !== 'function' || !global.isMailboxApiAvailable()) {
            return false;
        }

        try {
            const response = await global.fetch(
                `/api/portal/account/dossier?username=${encodeURIComponent(username)}`,
                { cache: 'no-store' }
            );
            const payload = await response.json();
            if (!response.ok || payload.status !== 'ok') return false;
            applyCommanderDossierToClient(payload);
            return true;
        } catch (err) {
            console.warn('Dossier sync failed:', err.message);
            return false;
        }
    }

    async function flushCommanderDossierSave() {
        const username = resolveCommanderUsername();
        if (!username || typeof global.isMailboxApiAvailable !== 'function' || !global.isMailboxApiAvailable()) {
            pendingPatch = {};
            return null;
        }
        if (!Object.keys(pendingPatch).length) return true;

        const patch = { ...pendingPatch };
        pendingPatch = {};

        try {
            const response = await global.fetch('/api/portal/account/dossier', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, patch })
            });
            const payload = await response.json();
            if (!response.ok || payload.status !== 'ok') return false;
            applyCommanderDossierToClient(payload);
            return true;
        } catch (err) {
            pendingPatch = { ...patch, ...pendingPatch };
            console.warn('Dossier save failed:', err.message);
            return false;
        }
    }

    function scheduleCommanderDossierSave(patch, options) {
        const opts = options && typeof options === 'object' ? options : {};
        if (patch && typeof patch === 'object') {
            pendingPatch = { ...pendingPatch, ...patch };
            const merged = { ...readDossierCache(), ...patch };
            mirrorLegacyLocalStorage(merged);
            writeDossierCache(merged);
        }

        if (saveTimer) global.clearTimeout(saveTimer);

        if (opts.immediate) {
            saveInFlight = flushCommanderDossierSave();
            return saveInFlight;
        }

        saveTimer = global.setTimeout(() => {
            saveInFlight = flushCommanderDossierSave();
        }, opts.debounceMs || 900);
        return saveInFlight;
    }

    async function saveFullCommanderDossierToServer() {
        const patch = collectCommanderDossierFromClient();
        pendingPatch = { ...pendingPatch, ...patch };
        return flushCommanderDossierSave();
    }

    global.RoyalArmiesCommanderDossier = {
        resolveCommanderUsername,
        hydrateCommanderDossierFromLocalCache,
        fetchCommanderDossierFromServer,
        scheduleCommanderDossierSave,
        saveFullCommanderDossierToServer,
        applyCommanderDossierToClient,
        collectCommanderDossierFromClient,
        collectPreferencesFromRuntime
    };

    global.hydrateCommanderDossierFromLocalCache = hydrateCommanderDossierFromLocalCache;
    global.fetchCommanderDossierFromServer = fetchCommanderDossierFromServer;
    global.scheduleCommanderDossierSave = scheduleCommanderDossierSave;
    global.saveFullCommanderDossierToServer = saveFullCommanderDossierToServer;
})(window);
