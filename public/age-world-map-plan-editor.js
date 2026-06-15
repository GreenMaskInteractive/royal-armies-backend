/**
 * RIFT — In-map plan authoring tools (Add Plan dock on the world map screen).
 */
(function initAgeWorldMapPlanEditor(global) {
    'use strict';

    let bound = false;
    let addBtnBound = false;
    let sessionOpen = false;
    let routesOrbitOpen = false;
    let activeRouteType = '';
    let clearArrowMode = false;

    let addBtn = null;
    let dockEl = null;
    let orbitEl = null;
    let routesBtn = null;
    let clearArrowBtn = null;
    let frameEl = null;
    let hintEl = null;

    function isMapViewActive() {
        return global.document.getElementById('age-page-canvas')?.dataset?.ageView === 'map';
    }

    function setHint(message) {
        if (!hintEl) return;
        const text = String(message || '').trim();
        hintEl.textContent = text;
        hintEl.hidden = !text;
    }

    function defaultOpenHint() {
        const restored = global.RoyalArmiesAgeWorldMapPlanDraft?.hasPersistedDraft?.();
        if (restored) {
            return 'Draft restored. Click cities to continue your plan, or Post Plan when every route has an action.';
        }
        return 'Click a city to set the plan start, then click a bordering city to draw a route.';
    }

    function applyEditorChrome() {
        const mayAuthor = Boolean(global.RoyalArmiesAgeWorldMapPlanDraft?.canAuthorNationPlan?.());

        if (!mayAuthor && sessionOpen) {
            setEditorOpen(false);
        }

        const showOnMap = sessionOpen && isMapViewActive() && mayAuthor;

        if (addBtn) {
            addBtn.hidden = !mayAuthor;
            addBtn.setAttribute('aria-hidden', mayAuthor ? 'false' : 'true');
            addBtn.classList.toggle('is-active', sessionOpen && mayAuthor);
            addBtn.setAttribute('aria-pressed', sessionOpen && mayAuthor ? 'true' : 'false');
            addBtn.setAttribute('aria-expanded', sessionOpen && mayAuthor ? 'true' : 'false');
        }
        if (dockEl) {
            dockEl.hidden = !showOnMap;
            dockEl.setAttribute('aria-hidden', showOnMap ? 'false' : 'true');
        }
        frameEl?.classList.toggle('is-plan-editor-open', showOnMap);
        global.RoyalArmiesAgeWorldMapPlanDraft?.setUiVisible?.(showOnMap);
    }

    function setRoutesOrbitOpen(open) {
        routesOrbitOpen = Boolean(open);
        if (orbitEl) {
            orbitEl.hidden = !routesOrbitOpen;
            orbitEl.setAttribute('aria-hidden', routesOrbitOpen ? 'false' : 'true');
            orbitEl.classList.toggle('is-open', routesOrbitOpen);
        }
        if (routesBtn) {
            routesBtn.classList.toggle('is-active', routesOrbitOpen);
            routesBtn.setAttribute('aria-expanded', routesOrbitOpen ? 'true' : 'false');
        }
        if (!routesOrbitOpen) {
            activeRouteType = '';
            orbitEl?.querySelectorAll('.age-world-map-plan-tool-orbit-btn.is-active').forEach((btn) => {
                btn.classList.remove('is-active');
            });
        }
    }

    function setClearArrowMode(on) {
        clearArrowMode = Boolean(on);
        if (clearArrowBtn) {
            clearArrowBtn.classList.toggle('is-active', clearArrowMode);
            clearArrowBtn.setAttribute('aria-pressed', clearArrowMode ? 'true' : 'false');
        }
        if (clearArrowMode) {
            armRouteType('');
            setHint('Click a route arrow to remove it and every later route.');
        } else if (!activeRouteType) {
            setHint(sessionOpen ? defaultOpenHint() : '');
        }
        global.dispatchEvent(new CustomEvent('royalarmies:age-map-plan-route-armed', {
            detail: { routeType: clearArrowMode ? 'clear' : null }
        }));
    }

    function setEditorOpen(open) {
        const next = Boolean(open);
        if (next && !global.RoyalArmiesAgeWorldMapPlanDraft?.canAuthorNationPlan?.()) {
            setHint('Only nation leadership and planners can author a nation plan.');
            applyEditorChrome();
            return;
        }
        if (next === sessionOpen) {
            applyEditorChrome();
            return;
        }

        sessionOpen = next;

        if (sessionOpen) {
            global.RoyalArmiesAgeWorldMapPlanDraft?.setSessionActive?.(true);
            setRoutesOrbitOpen(false);
            setClearArrowMode(false);
            setHint(defaultOpenHint());
        } else {
            void global.RoyalArmiesAgeWorldMapPlanDraft?.flushPersistDraft?.();
            global.RoyalArmiesAgeWorldMapPlanDraft?.setSessionActive?.(false);
            setRoutesOrbitOpen(false);
            setClearArrowMode(false);
            activeRouteType = '';
            setHint('');
        }

        applyEditorChrome();
    }

    function focusPlannerLocation() {
        const focused = global.RoyalArmiesAgeWorldMap?.focusOnPlannerLocation?.({ zoomToMax: true });
        if (!focused) {
            console.warn('[RIFT] Plan editor could not focus planner location (city not resolved yet).');
        }
    }

    function armRouteType(routeType) {
        setClearArrowMode(false);
        activeRouteType = routeType === activeRouteType ? '' : routeType;
        orbitEl?.querySelectorAll('.age-world-map-plan-tool-orbit-btn').forEach((btn) => {
            const type = btn.getAttribute('data-route-type');
            btn.classList.toggle('is-active', Boolean(activeRouteType) && type === activeRouteType);
        });

        if (activeRouteType) {
            const labels = {
                sf: 'SF',
                mf: 'MF',
                move: 'Move',
                main: 'Main',
                rally: 'Rally'
            };
            setHint(`Click a gray route arrow to assign ${labels[activeRouteType] || activeRouteType}.`);
        } else {
            setHint(defaultOpenHint());
        }

        global.dispatchEvent(new CustomEvent('royalarmies:age-map-plan-route-armed', {
            detail: { routeType: activeRouteType || null }
        }));
    }

    function onDockClick(event) {
        const toolBtn = event.target.closest('[data-plan-tool]');
        if (!toolBtn || !dockEl?.contains(toolBtn)) return;

        event.preventDefault();
        event.stopPropagation();

        const tool = toolBtn.getAttribute('data-plan-tool');
        if (tool === 'locate') {
            setRoutesOrbitOpen(false);
            setClearArrowMode(false);
            focusPlannerLocation();
            return;
        }

        if (tool === 'routes') {
            setClearArrowMode(false);
            setRoutesOrbitOpen(!routesOrbitOpen);
            return;
        }

        if (tool === 'clear-arrow') {
            setRoutesOrbitOpen(false);
            setClearArrowMode(!clearArrowMode);
            return;
        }

        if (tool === 'clear-all') {
            setRoutesOrbitOpen(false);
            setClearArrowMode(false);
            armRouteType('');
            global.RoyalArmiesAgeWorldMapPlanDraft?.clearAll?.();
            setHint(defaultOpenHint());
        }
    }

    function onOrbitClick(event) {
        const routeBtn = event.target.closest('[data-route-type]');
        if (!routeBtn || !orbitEl?.contains(routeBtn)) return;

        event.preventDefault();
        event.stopPropagation();
        armRouteType(routeBtn.getAttribute('data-route-type') || '');
    }

    function onAddPlanToggle(event) {
        event.preventDefault();
        event.stopPropagation();
        if (!global.RoyalArmiesAgeWorldMapPlanDraft?.canAuthorNationPlan?.()) {
            setHint('Only nation leadership and planners can author a nation plan.');
            return;
        }
        setEditorOpen(!sessionOpen);
    }

    function bindAddPlanButton() {
        if (addBtnBound) return;
        addBtn = global.document.getElementById('age-world-map-plan-add');
        if (!addBtn) return;

        addBtnBound = true;
        addBtn.addEventListener('click', onAddPlanToggle);
        addBtn.addEventListener('pointerdown', (event) => {
            event.stopPropagation();
        });
        addBtn.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.stopPropagation();
            }
        });
    }

    function bindControls() {
        bindAddPlanButton();
        if (bound) return;

        dockEl = global.document.getElementById('age-world-map-plan-tool-dock');
        orbitEl = global.document.getElementById('age-world-map-plan-tool-orbit');
        routesBtn = dockEl?.querySelector('[data-plan-tool="routes"]') || null;
        clearArrowBtn = dockEl?.querySelector('[data-plan-tool="clear-arrow"]') || null;
        frameEl = global.document.querySelector('#age-world-map .age-world-map-frame');
        hintEl = global.document.getElementById('age-world-map-plan-editor-hint');

        if (!dockEl) return;
        bound = true;

        dockEl.addEventListener('click', onDockClick);
        dockEl.addEventListener('pointerdown', (event) => event.stopPropagation());
        orbitEl?.addEventListener('click', onOrbitClick);

        global.addEventListener('royalarmies:nation-plan-access-updated', () => {
            applyEditorChrome();
        });

        global.addEventListener('royalarmies:age-map-view-change', () => {
            applyEditorChrome();
        });

        global.addEventListener('royalarmies:age-map-plan-draft-blocked', (event) => {
            setHint(event.detail?.message || 'That plan action is not allowed.');
        });

        global.addEventListener('royalarmies:age-map-plan-anchor-set', (event) => {
            const cityName = String(event.detail?.cityName || 'city').trim() || 'city';
            setHint(`Plan start set at ${cityName}. Click a bordering city to draw a route.`);
        });

        global.addEventListener('royalarmies:age-map-plan-posted', () => {
            sessionOpen = false;
            setRoutesOrbitOpen(false);
            setClearArrowMode(false);
            activeRouteType = '';
            setHint('');
            global.RoyalArmiesAgeWorldMapPlanDraft?.setSessionActive?.(false);
            applyEditorChrome();
        });
    }

    function enableAgeWorldMapPlanEditor() {
        bindAddPlanButton();
        bindControls();
        global.RoyalArmiesAgeWorldMapPlanDraft?.enable?.();
        applyEditorChrome();
    }

    function bootPlanEditor() {
        if (global.document.readyState === 'loading') {
            global.document.addEventListener('DOMContentLoaded', enableAgeWorldMapPlanEditor, { once: true });
            return;
        }
        enableAgeWorldMapPlanEditor();
    }

    global.RoyalArmiesAgeWorldMapPlanEditor = {
        enable: enableAgeWorldMapPlanEditor,
        isEditorOpen: () => sessionOpen,
        getActiveRouteType: () => activeRouteType,
        isClearArrowMode: () => clearArrowMode,
        closeEditor: () => setEditorOpen(false)
    };
    global.enableAgeWorldMapPlanEditor = enableAgeWorldMapPlanEditor;
    bootPlanEditor();
})(window);
