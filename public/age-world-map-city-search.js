/**
 * RIFT — Amnek map city search: filter settlements, center camera, temporary highlight.
 */
(function initAgeWorldMapCitySearch(global) {
    'use strict';

    const MAX_SUGGESTIONS = 10;
    const MIN_QUERY_LEN = 1;

    let bound = false;
    let selectedCityId = '';
    let cityEntries = [];

    const els = {
        root: null,
        input: null,
        centerBtn: null,
        suggest: null
    };

    function mapApi() {
        return global.RoyalArmiesAgeWorldMap || null;
    }

    function rebuildCityEntries() {
        const catalog = mapApi()?.getCatalog?.();
        if (!catalog?.cities?.length) {
            cityEntries = [];
            return;
        }

        cityEntries = catalog.cities
            .map((city) => ({
                id: city.id,
                name: String(city.name || '').trim(),
                nationId: String(city.nationId || '').trim(),
                tier: String(city.settlementTier || 'city').trim().toLowerCase()
            }))
            .filter((entry) => entry.id && entry.name)
            .sort((left, right) => left.name.localeCompare(right.name, undefined, { sensitivity: 'base' }));
    }

    function scoreEntry(entry, query) {
        const q = String(query || '').trim().toLowerCase();
        if (!q) return 99;
        const name = entry.name.toLowerCase();
        const id = entry.id.toLowerCase();
        const shortId = id.replace(/^[^-]+-/, '');
        const slug = q.replace(/\s+/g, '-');
        if (name === q || id === q || shortId === q || shortId === slug) return 0;
        if (name.startsWith(q) || shortId.startsWith(slug)) return 1;
        if (name.includes(q) || id.includes(q) || shortId.includes(slug)) return 2;
        return 99;
    }

    function findMatches(query) {
        const q = String(query || '').trim();
        if (q.length < MIN_QUERY_LEN) return [];

        const ranked = cityEntries
            .map((entry) => ({ entry, score: scoreEntry(entry, q) }))
            .filter((row) => row.score < 99)
            .sort((left, right) => {
                if (left.score !== right.score) return left.score - right.score;
                return left.entry.name.localeCompare(right.entry.name, undefined, { sensitivity: 'base' });
            });

        return ranked.slice(0, MAX_SUGGESTIONS).map((row) => row.entry);
    }

    function resolveSelectedCity() {
        if (selectedCityId && mapApi()?.getCityById?.(selectedCityId)) {
            return mapApi().getCityById(selectedCityId);
        }
        const query = els.input?.value || '';
        return mapApi()?.resolveCityByQuery?.(query) || null;
    }

    function syncCenterButton() {
        if (!els.centerBtn) return;
        const city = resolveSelectedCity();
        const enabled = Boolean(city?.centroid);
        els.centerBtn.disabled = !enabled;
        els.centerBtn.setAttribute('aria-disabled', enabled ? 'false' : 'true');
    }

    function setSelectedCityId(cityId, label) {
        selectedCityId = String(cityId || '').trim();
        if (els.input && label) {
            els.input.value = label;
        }
        syncCenterButton();
    }

    function isPlanEditorOpen() {
        const frame = global.document.getElementById('age-world-map-frame');
        return Boolean(frame?.classList.contains('is-plan-editor-open'));
    }

    function hideSuggestions() {
        if (!els.suggest) return;
        els.suggest.hidden = true;
        els.suggest.innerHTML = '';
        els.input?.setAttribute('aria-expanded', 'false');
    }

    function dismissSearchUi() {
        hideSuggestions();
        if (els.input && global.document.activeElement === els.input) {
            els.input.blur();
        }
    }

    function renderSuggestions(matches) {
        if (!els.suggest) return;
        els.suggest.innerHTML = '';

        if (!matches.length) {
            hideSuggestions();
            return;
        }

        matches.forEach((entry) => {
            const item = global.document.createElement('li');
            item.className = 'age-world-map-city-search-suggest-item';
            item.setAttribute('role', 'option');
            item.dataset.cityId = entry.id;
            item.textContent = entry.name;
            item.addEventListener('mousedown', (event) => {
                event.preventDefault();
            });
            item.addEventListener('click', () => {
                setSelectedCityId(entry.id, entry.name);
                hideSuggestions();
            });
            els.suggest.appendChild(item);
        });

        els.suggest.hidden = false;
        els.input?.setAttribute('aria-expanded', 'true');
    }

    function refreshSuggestions() {
        const query = String(els.input?.value || '').trim();
        selectedCityId = '';
        if (query.length < MIN_QUERY_LEN) {
            hideSuggestions();
            syncCenterButton();
            return;
        }

        renderSuggestions(findMatches(query));
        syncCenterButton();
    }

    function centerOnSelection() {
        const city = resolveSelectedCity();
        if (!city?.id) {
            syncCenterButton();
            return false;
        }

        selectedCityId = city.id;
        const ok = mapApi()?.focusOnCity?.(city.id, { highlightMs: 3400 }) || false;
        if (!ok && typeof global.showPortalAlert === 'function') {
            void global.showPortalAlert('Could not center the map on that settlement.', 'Map');
        }
        return ok;
    }

    function bindEvents() {
        if (bound || !els.input || !els.centerBtn) return;
        bound = true;

        els.input.addEventListener('input', () => {
            refreshSuggestions();
        });

        els.input.addEventListener('focus', () => {
            refreshSuggestions();
        });

        els.input.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                const matches = findMatches(els.input.value);
                if (matches.length && !selectedCityId) {
                    setSelectedCityId(matches[0].id, matches[0].name);
                }
                hideSuggestions();
                centerOnSelection();
                return;
            }
            if (event.key === 'Escape') {
                hideSuggestions();
            }
        });

        els.centerBtn.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            centerOnSelection();
        });

        els.centerBtn.addEventListener('pointerdown', (event) => {
            event.stopPropagation();
        });

        els.input.addEventListener('pointerdown', (event) => {
            event.stopPropagation();
        });

        global.document.addEventListener('click', (event) => {
            if (!els.root || els.root.contains(event.target)) return;
            hideSuggestions();
        });
    }

    function cacheElements() {
        els.root = global.document.getElementById('age-world-map-city-search');
        els.input = global.document.getElementById('age-world-map-city-search-input');
        els.centerBtn = global.document.getElementById('age-world-map-city-search-center');
        els.suggest = global.document.getElementById('age-world-map-city-search-suggest');
    }

    function watchPlanEditorVisibility() {
        const frame = global.document.getElementById('age-world-map-frame');
        if (!frame || frame.dataset.citySearchPlanWatch === '1') return;
        frame.dataset.citySearchPlanWatch = '1';

        const observer = new MutationObserver(() => {
            if (isPlanEditorOpen()) {
                dismissSearchUi();
            }
        });
        observer.observe(frame, { attributes: true, attributeFilter: ['class'] });
    }

    function enable() {
        cacheElements();
        if (!els.root || !els.input || !els.centerBtn) return false;

        rebuildCityEntries();
        bindEvents();
        watchPlanEditorVisibility();
        syncCenterButton();
        return true;
    }

    global.RoyalArmiesAgeWorldMapCitySearch = {
        enable,
        refreshCatalog: rebuildCityEntries,
        centerSelection: centerOnSelection
    };
    global.enableAgeWorldMapCitySearch = enable;
})(window);
