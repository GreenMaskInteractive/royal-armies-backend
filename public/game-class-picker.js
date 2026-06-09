/**
 * Choose-class — portrait fade swap and side info panels.
 */
(function initGameClassPicker(global) {
    'use strict';

    const GAME_CLASS_OPTIONS = {
        battlemaster: {
            id: 'battlemaster',
            label: 'Battlemaster',
            side: 'left',
            panelId: 'game-class-panel-battlemaster',
            pathCode: 'PHYS'
        },
        battlemage: {
            id: 'battlemage',
            label: 'Battlemage',
            side: 'right',
            panelId: 'game-class-panel-battlemage',
            pathCode: 'MAG'
        }
    };

    const CLASS_SWAP_MS_FALLBACK = 900;
    const LAYOUT_SYNC_DELAYS_MS = [0, 50, 180, 420];
    const DESKTOP_LAYOUT_MQ = '(min-width: 900px)';

    let displayedClassId = 'battlemaster';
    let activeClassId = null;
    const perk1BranchByClass = {
        battlemaster: null,
        battlemage: null
    };
    let isClassSwapAnimating = false;
    let layoutObserver = null;
    let layoutSyncToken = 0;
    let cachedBattlemasterPanelHeight = 0;

    function getPickerRoot() {
        return global.document.getElementById('game-class-picker');
    }

    function getPickerStage() {
        return global.document.querySelector('.game-class-picker-stage');
    }

    function getShowcaseRoot() {
        return global.document.querySelector('.game-class-showcase');
    }

    function getPortraitStage() {
        return global.document.querySelector('.game-class-portrait-stage');
    }

    function getClassSwapMs() {
        const canvas = global.document.getElementById('game-page-canvas')
            || global.document.querySelector('.game-page-canvas');
        if (!canvas) return CLASS_SWAP_MS_FALLBACK;

        const raw = global.getComputedStyle(canvas).getPropertyValue('--game-class-swap-ms').trim();
        const parsed = Number.parseInt(raw, 10);
        return Number.isFinite(parsed) && parsed > 0 ? parsed : CLASS_SWAP_MS_FALLBACK;
    }

    function setShowcaseAccentClass(classId) {
        const showcase = getShowcaseRoot();
        if (showcase && GAME_CLASS_OPTIONS[classId]) {
            showcase.dataset.accentClass = classId;
        }
    }

    function getClassOptions() {
        const root = getPickerRoot();
        if (!root) return [];
        return Array.from(root.querySelectorAll('.game-class-portrait-card'));
    }

    function getClassPanels() {
        const root = getPickerRoot();
        if (!root) return [];
        return Array.from(root.querySelectorAll('.game-class-side-panel'));
    }

    function getShowcaseLabelEl() {
        return global.document.getElementById('game-class-showcase-label');
    }

    function usesDocumentFlowLayout() {
        return global.matchMedia(DESKTOP_LAYOUT_MQ).matches;
    }

    function prefersReducedMotion() {
        return global.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }

    function getOtherClassId(classId) {
        return classId === 'battlemaster' ? 'battlemage' : 'battlemaster';
    }

    function clearPanelInlineCoords(panel) {
        if (!panel) return;
        [
            '--game-class-panel-x',
            '--game-class-panel-y',
            'position',
            'left',
            'top',
            'right',
            'bottom',
            'margin',
            'z-index',
            'visibility'
        ].forEach((prop) => panel.style.removeProperty(prop));
    }

    function measureBattlemasterPanelHeight() {
        if (cachedBattlemasterPanelHeight > 0) {
            return cachedBattlemasterPanelHeight;
        }

        const bmPanel = global.document.getElementById('game-class-panel-battlemaster');
        if (!bmPanel) return 0;

        const wasActive = bmPanel.classList.contains('is-active');
        const prevVisibility = bmPanel.style.visibility;
        const prevPointerEvents = bmPanel.style.pointerEvents;
        const prevPosition = bmPanel.style.position;
        const prevLeft = bmPanel.style.left;
        const prevOpacity = bmPanel.style.opacity;
        const hadFadingOut = bmPanel.classList.contains('is-fading-out');
        const hadFadingIn = bmPanel.classList.contains('is-fading-in');

        bmPanel.hidden = false;
        bmPanel.classList.remove('is-fading-out', 'is-fading-in');
        bmPanel.classList.add('is-active');
        bmPanel.style.setProperty('visibility', 'hidden', 'important');
        bmPanel.style.setProperty('pointer-events', 'none', 'important');
        bmPanel.style.setProperty('position', 'absolute', 'important');
        bmPanel.style.setProperty('left', '-10000px', 'important');
        bmPanel.style.setProperty('opacity', '0', 'important');

        const height = Math.ceil(bmPanel.getBoundingClientRect().height);

        bmPanel.style.visibility = prevVisibility;
        bmPanel.style.pointerEvents = prevPointerEvents;
        bmPanel.style.position = prevPosition;
        bmPanel.style.left = prevLeft;
        bmPanel.style.opacity = prevOpacity;
        bmPanel.classList.toggle('is-fading-out', hadFadingOut);
        bmPanel.classList.toggle('is-fading-in', hadFadingIn);
        if (!wasActive) {
            bmPanel.classList.remove('is-active');
        }

        if (height > 0) {
            cachedBattlemasterPanelHeight = height;
        }

        return height;
    }

    function syncBattlemagePanelHeight(forceMeasure) {
        const root = getPickerRoot();
        if (!root) return;

        const panelClassId = activeClassId || displayedClassId;
        if (panelClassId !== 'battlemage' && !forceMeasure) return;

        const bmHeight = measureBattlemasterPanelHeight();
        if (bmHeight > 0) {
            root.style.setProperty('--game-class-bm-panel-height', `${bmHeight}px`);
        }
    }

    function syncStageActiveSide() {
        const stage = getPickerStage();
        if (!stage) return;

        stage.classList.remove('has-active-panel-left', 'has-active-panel-right');
        if (activeClassId || displayedClassId) {
            stage.classList.add('has-active-panel-left');
        }
    }

    function updateShowcaseLabelForClass(classId) {
        const labelEl = getShowcaseLabelEl();
        const meta = GAME_CLASS_OPTIONS[classId];
        if (!labelEl || !meta) return;
        labelEl.textContent = meta.label;
    }

    function syncPortraitStackState() {
        const showcase = getShowcaseRoot();
        const backClassId = getOtherClassId(displayedClassId);

        if (showcase) {
            showcase.dataset.displayedClass = displayedClassId;
            setShowcaseAccentClass(displayedClassId);
        }

        getClassOptions().forEach((card) => {
            const classId = card.dataset.classId;
            const isFront = classId === displayedClassId;
            const isBack = classId === backClassId;

            card.classList.toggle('is-front', isFront);
            card.classList.toggle('is-back', isBack);
            card.classList.remove('is-hovered');
            card.tabIndex = isFront ? 0 : -1;
        });

        updateShowcaseLabelForClass(displayedClassId);
    }

    function setPanelVisibilityState(panel, { isActive, isFadingOut, isFadingIn }) {
        panel.hidden = false;
        panel.classList.toggle('is-active', Boolean(isActive));
        panel.classList.toggle('is-fading-out', Boolean(isFadingOut));
        panel.classList.toggle('is-fading-in', Boolean(isFadingIn));
        panel.setAttribute(
            'aria-hidden',
            (isActive || isFadingIn) && !isFadingOut ? 'false' : 'true'
        );
    }

    function refreshPanelState() {
        const root = getPickerRoot();
        const pickerStage = getPickerStage();
        if (!root || pickerStage?.classList.contains('is-swapping')) return;

        const panelClassId = activeClassId || displayedClassId;
        root.dataset.activePanel = panelClassId;
        root.classList.toggle('has-active-panel', Boolean(panelClassId));
        syncStageActiveSide();

        getClassPanels().forEach((panel) => {
            const panelClassIdAttr = panel.dataset.classPanel;
            const isActive = panelClassIdAttr === panelClassId;

            setPanelVisibilityState(panel, {
                isActive,
                isFadingOut: false,
                isFadingIn: false
            });

            if (isActive) {
                resetPanelPerkDetail(panel);
            } else {
                clearPanelInlineCoords(panel);
            }
        });

        syncBattlemagePanelHeight();
    }

    function beginPanelSwap(fromClassId, targetClassId) {
        const pickerStage = getPickerStage();
        if (!pickerStage || fromClassId === targetClassId) return;

        if (!usesDocumentFlowLayout() || prefersReducedMotion()) {
            activeClassId = targetClassId;
            refreshPanelState();
            return;
        }

        pickerStage.classList.add('is-swapping');
        activeClassId = targetClassId;

        getClassPanels().forEach((panel) => {
            const panelClassId = panel.dataset.classPanel;

            if (panelClassId === fromClassId) {
                setPanelVisibilityState(panel, {
                    isActive: true,
                    isFadingOut: false,
                    isFadingIn: false
                });
                return;
            }

            if (panelClassId === targetClassId) {
                setPanelVisibilityState(panel, {
                    isActive: false,
                    isFadingOut: false,
                    isFadingIn: false
                });
                resetPanelPerkDetail(panel);
                return;
            }

            setPanelVisibilityState(panel, {
                isActive: false,
                isFadingOut: false,
                isFadingIn: false
            });
        });

        void pickerStage.offsetHeight;

        getClassPanels().forEach((panel) => {
            const panelClassId = panel.dataset.classPanel;

            if (panelClassId === fromClassId) {
                panel.classList.add('is-fading-out');
                panel.setAttribute('aria-hidden', 'true');
                return;
            }

            if (panelClassId === targetClassId) {
                panel.classList.add('is-fading-in');
                panel.setAttribute('aria-hidden', 'false');
            }
        });
    }

    function finalizePanelSwap() {
        const root = getPickerRoot();
        const pickerStage = getPickerStage();
        const panelClassId = displayedClassId;

        if (root) {
            root.dataset.activePanel = panelClassId;
            root.classList.toggle('has-active-panel', Boolean(panelClassId));
        }

        getClassPanels().forEach((panel) => {
            const isActive = panel.dataset.classPanel === panelClassId;
            setPanelVisibilityState(panel, {
                isActive,
                isFadingOut: false,
                isFadingIn: false
            });

            if (!isActive) {
                clearPanelInlineCoords(panel);
            }
        });

        if (pickerStage) {
            pickerStage.classList.remove('is-swapping');
        }

        syncStageActiveSide();
        syncBattlemagePanelHeight();
    }

    function refreshSelectionState() {
        const root = getPickerRoot();
        if (!root) return;

        syncPortraitStackState();
        root.classList.toggle('has-selection', Boolean(activeClassId));

        getClassOptions().forEach((option) => {
            const classId = option.dataset.classId;
            const isSelected = classId === activeClassId;
            option.classList.toggle('is-selected', isSelected);
            option.classList.toggle('is-active', isSelected);
            option.setAttribute('aria-pressed', isSelected ? 'true' : 'false');
        });

        refreshPanelState();
        syncClassConfirmButtonState();
        scheduleLayoutSync();
    }

    function selectClass(classId) {
        if (!GAME_CLASS_OPTIONS[classId]) return;
        if (classId !== displayedClassId) return;
        activeClassId = classId;
        refreshSelectionState();
    }

    function finishClassSwap() {
        const portraitStage = getPortraitStage();
        const showcase = getShowcaseRoot();

        getClassOptions().forEach((card) => {
            card.classList.remove('is-fading-out', 'is-fading-in');
        });

        if (portraitStage) {
            portraitStage.classList.remove('is-swapping');
        }
        if (showcase) {
            showcase.classList.remove('is-swapping');
        }

        activeClassId = displayedClassId;
        isClassSwapAnimating = false;
        finalizePanelSwap();
        refreshSelectionState();
    }

    function openPanelForClass(classId) {
        if (!GAME_CLASS_OPTIONS[classId]) return;
        activeClassId = classId;
        refreshPanelState();
    }

    function swapDisplayedClass() {
        if (isClassSwapAnimating) return;

        const portraitStage = getPortraitStage();
        const showcase = getShowcaseRoot();
        if (!portraitStage) return;

        const targetClassId = getOtherClassId(displayedClassId);
        const swapMs = getClassSwapMs();

        if (prefersReducedMotion()) {
            displayedClassId = targetClassId;
            setShowcaseAccentClass(targetClassId);
            updateShowcaseLabelForClass(targetClassId);
            openPanelForClass(targetClassId);
            refreshSelectionState();
            return;
        }

        isClassSwapAnimating = true;
        portraitStage.classList.add('is-swapping');
        if (showcase) {
            showcase.classList.add('is-swapping');
        }
        setShowcaseAccentClass(targetClassId);
        updateShowcaseLabelForClass(targetClassId);
        beginPanelSwap(displayedClassId, targetClassId);

        getClassOptions().forEach((card) => {
            const classId = card.dataset.classId;
            card.classList.toggle('is-fading-out', classId === displayedClassId);
            card.classList.toggle('is-fading-in', classId === targetClassId);
        });

        global.setTimeout(() => {
            displayedClassId = targetClassId;
            finishClassSwap();
        }, swapMs);
    }

    function resetPanelPerkDetail(_panel) {
        /* Interactive perk layout — branch state persists on the class object. */
    }

    function getPerk1BranchForClass(classId) {
        return perk1BranchByClass[classId] || null;
    }

    function setPerk1BranchForClass(classId, branch) {
        if (!GAME_CLASS_OPTIONS[classId]) return;
        const normalized = String(branch || '').trim().toUpperCase();
        perk1BranchByClass[classId] = normalized === 'A' || normalized === 'B' ? normalized : null;
        global.RoyalArmiesClassPerkCatalog?.mountClassPerkPanel?.(classId, perk1BranchByClass[classId]);
        syncClassConfirmButtonState();
        scheduleLayoutSync();
    }

    function hydrateClassPerkPanels() {
        if (!global.RoyalArmiesClassPerkCatalog?.mountAllClassPerkPanels) return;
        global.RoyalArmiesClassPerkCatalog.mountAllClassPerkPanels(perk1BranchByClass);
    }

    function applySavedClassChoicesFromCommander(commander) {
        if (!commander || typeof commander !== 'object') return;

        const path = String(commander.path || '').trim().toUpperCase();
        const classId = path === 'MAG' || path === 'MAGIC' ? 'battlemage' : (path === 'PHYS' ? 'battlemaster' : null);
        const perk1 = String(
            commander?.ageClassPerkChoices?.perk1
            || commander?.ageClassPerk1Branch
            || ''
        ).trim().toUpperCase();

        if (perk1 === 'A' || perk1 === 'B') {
            if (classId) perk1BranchByClass[classId] = perk1;
            else {
                perk1BranchByClass.battlemaster = perk1;
                perk1BranchByClass.battlemage = perk1;
            }
        }

        if (classId) {
            displayedClassId = classId;
            activeClassId = classId;
            setShowcaseAccentClass(classId);
        }

        hydrateClassPerkPanels();
        refreshSelectionState();
    }

    function syncClassConfirmButtonState() {
        const confirmBtn = global.document.getElementById('game-class-confirm-btn');
        if (!confirmBtn) return;

        const classId = activeClassId || displayedClassId;
        const hasClass = Boolean(classId && GAME_CLASS_OPTIONS[classId]);
        const hasPerk = Boolean(getPerk1BranchForClass(classId));
        const ready = hasClass && hasPerk;

        confirmBtn.disabled = !ready;
        confirmBtn.setAttribute('aria-disabled', ready ? 'false' : 'true');
        confirmBtn.title = ready
            ? 'Confirm class and lock Perk 1'
            : 'Select your class portrait and choose Perk 1 Option A or B';
    }

    function confirmClassSelection(classId) {
        if (!GAME_CLASS_OPTIONS[classId]) return;

        const perk1Branch = getPerk1BranchForClass(classId);
        if (!perk1Branch) {
            if (typeof global.showPortalAlert === 'function') {
                void global.showPortalAlert('Choose Perk 1 Option A or B before confirming your class.', 'Choose a Class');
            }
            return;
        }

        activeClassId = classId;
        displayedClassId = classId;
        setShowcaseAccentClass(classId);
        refreshSelectionState();
        global.dispatchEvent(new CustomEvent('royalarmies:class-confirmed', {
            detail: {
                classId,
                pathCode: GAME_CLASS_OPTIONS[classId].pathCode,
                perk1Branch
            }
        }));
    }

    function scheduleLayoutSync() {
        const token = ++layoutSyncToken;

        if (typeof global.RoyalArmiesViewportMetrics?.schedule === 'function') {
            global.RoyalArmiesViewportMetrics.schedule();
        }

        LAYOUT_SYNC_DELAYS_MS.forEach((delay) => {
            global.setTimeout(() => {
                if (token !== layoutSyncToken) return;
                if (typeof global.RoyalArmiesViewportMetrics?.sync === 'function') {
                    global.RoyalArmiesViewportMetrics.sync();
                }
                syncBattlemagePanelHeight();
            }, delay);
        });

        global.requestAnimationFrame(() => {
            if (token !== layoutSyncToken) return;
            syncBattlemagePanelHeight();
        });
    }

    function bindPortraitImageLoads() {
        getClassOptions().forEach((option) => {
            option.querySelectorAll('img').forEach((img) => {
                if (img.complete) return;
                img.addEventListener('load', scheduleLayoutSync, { once: true });
                img.addEventListener('error', scheduleLayoutSync, { once: true });
            });
        });

        const titleImg = global.document.querySelector('.game-class-picker-title');
        if (titleImg && !titleImg.complete) {
            titleImg.addEventListener('load', scheduleLayoutSync, { once: true });
        }
    }

    function bindClassConfirmButton() {
        const confirmBtn = global.document.getElementById('game-class-confirm-btn');
        if (!confirmBtn || confirmBtn.dataset.bound === 'true') return;

        confirmBtn.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            confirmClassSelection(displayedClassId);
        });
        confirmBtn.dataset.bound = 'true';
    }

    function bindClassPerkBranchControls() {
        const root = getPickerRoot();
        if (!root || root.dataset.perkBranchBound === 'true') return;

        root.addEventListener('click', (event) => {
            const button = event.target.closest('[data-perk1-branch][data-class-perk-branch]');
            if (!button) return;
            event.preventDefault();
            event.stopPropagation();
            const classId = button.getAttribute('data-class-perk-branch');
            const branch = button.getAttribute('data-perk1-branch');
            setPerk1BranchForClass(classId, branch);
        });

        root.dataset.perkBranchBound = 'true';
    }

    function bindClassPanel(_panel) {
        /* Perk branch buttons are delegated from the picker root. */
    }

    function bindClassOption(option) {
        const classId = option.dataset.classId;
        if (!classId || !GAME_CLASS_OPTIONS[classId]) return;

        option.addEventListener('mouseenter', () => {
            if (classId === displayedClassId) {
                option.classList.add('is-hovered');
            }
        });

        option.addEventListener('mouseleave', () => {
            option.classList.remove('is-hovered');
        });

        option.addEventListener('click', (event) => {
            event.preventDefault();
            if (classId !== displayedClassId) return;
            selectClass(classId);
        });

        option.addEventListener('keydown', (event) => {
            if (event.key !== 'Enter' && event.key !== ' ') return;
            event.preventDefault();
            if (classId !== displayedClassId) return;
            selectClass(classId);
        });
    }

    function bindClassSwapControls() {
        const prevBtn = global.document.querySelector('.game-class-showcase-arrow--prev');
        const nextBtn = global.document.querySelector('.game-class-showcase-arrow--next');

        if (prevBtn) {
            prevBtn.addEventListener('click', (event) => {
                event.preventDefault();
                event.stopPropagation();
                swapDisplayedClass();
            });
        }

        if (nextBtn) {
            nextBtn.addEventListener('click', (event) => {
                event.preventDefault();
                event.stopPropagation();
                swapDisplayedClass();
            });
        }
    }

    function bindClassPickerLayout() {
        global.addEventListener('resize', scheduleLayoutSync, { passive: true });
        if (global.visualViewport) {
            global.visualViewport.addEventListener('resize', scheduleLayoutSync, { passive: true });
        }

        const desktopMq = global.matchMedia(DESKTOP_LAYOUT_MQ);
        if (typeof desktopMq.addEventListener === 'function') {
            desktopMq.addEventListener('change', scheduleLayoutSync);
        } else if (typeof desktopMq.addListener === 'function') {
            desktopMq.addListener(scheduleLayoutSync);
        }

        if (global.document.fonts && typeof global.document.fonts.ready?.then === 'function') {
            global.document.fonts.ready.then(scheduleLayoutSync).catch(() => {});
        }

        const stage = getPickerStage();
        const root = getPickerRoot();
        if (stage && typeof global.ResizeObserver === 'function') {
            layoutObserver = new global.ResizeObserver(scheduleLayoutSync);
            layoutObserver.observe(stage);
            if (root) layoutObserver.observe(root);
        }
    }

    function initGameClassPicker() {
        const root = getPickerRoot();
        if (!root || root.dataset.initialized === 'true') return;

        getClassOptions().forEach(bindClassOption);
        getClassPanels().forEach(bindClassPanel);
        bindClassPerkBranchControls();
        bindClassConfirmButton();
        bindClassSwapControls();
        bindClassPickerLayout();
        bindPortraitImageLoads();
        getClassPanels().forEach((panel) => {
            panel.hidden = false;
        });
        activeClassId = displayedClassId;
        hydrateClassPerkPanels();
        syncBattlemagePanelHeight(true);
        refreshSelectionState();
        syncClassConfirmButtonState();
        scheduleLayoutSync();

        root.dataset.initialized = 'true';
        root.dataset.layoutMode = usesDocumentFlowLayout() ? 'grid' : 'stack';
    }

    global.GAME_CLASS_OPTIONS = GAME_CLASS_OPTIONS;
    global.getSelectedGameClassId = function getSelectedGameClassId() {
        return activeClassId;
    };
    global.getDisplayedGameClassId = function getDisplayedGameClassId() {
        return displayedClassId;
    };
    global.getSelectedGameClassPath = function getSelectedGameClassPath() {
        return activeClassId ? GAME_CLASS_OPTIONS[activeClassId].pathCode : null;
    };
    global.getSelectedGameClassPerk1Branch = function getSelectedGameClassPerk1Branch() {
        const classId = activeClassId || displayedClassId;
        return classId ? getPerk1BranchForClass(classId) : null;
    };
    global.applySavedGameClassChoices = applySavedClassChoicesFromCommander;
    global.initGameClassPicker = initGameClassPicker;
    global.clearGameClassPickerSelection = function clearGameClassPickerSelection() {
        displayedClassId = 'battlemaster';
        activeClassId = displayedClassId;
        perk1BranchByClass.battlemaster = null;
        perk1BranchByClass.battlemage = null;
        hydrateClassPerkPanels();
        refreshSelectionState();
    };
    global.confirmGameClassSelection = confirmClassSelection;
    global.swapDisplayedGameClass = swapDisplayedClass;

    if (global.document.readyState === 'loading') {
        global.document.addEventListener('DOMContentLoaded', initGameClassPicker);
    } else {
        initGameClassPicker();
    }
}(typeof window !== 'undefined' ? window : globalThis));
