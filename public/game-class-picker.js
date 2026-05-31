/**
 * Choose-class — CSS grid side panels; layout resync on resize, fonts, and image load.
 */
(function initGameClassPicker(global) {
    'use strict';

    const GAME_CLASS_OPTIONS = {
        battlemaster: {
            id: 'battlemaster',
            side: 'left',
            panelId: 'game-class-panel-battlemaster',
            pathCode: 'PHYS'
        },
        archmage: {
            id: 'archmage',
            side: 'right',
            panelId: 'game-class-panel-archmage',
            pathCode: 'MAG'
        }
    };

    const LAYOUT_SYNC_DELAYS_MS = [0, 50, 180, 420];
    const DESKTOP_LAYOUT_MQ = '(min-width: 900px)';

    let activeClassId = null;
    let layoutObserver = null;
    let layoutSyncToken = 0;

    function getPickerRoot() {
        return global.document.getElementById('game-class-picker');
    }

    function getPickerStage() {
        return global.document.querySelector('.game-class-picker-stage');
    }

    function getClassOptions() {
        const root = getPickerRoot();
        if (!root) return [];
        return Array.from(root.querySelectorAll('.game-class-option'));
    }

    function getClassPanels() {
        const root = getPickerRoot();
        if (!root) return [];
        return Array.from(root.querySelectorAll('.game-class-side-panel'));
    }

    function usesDocumentFlowLayout() {
        return global.matchMedia(DESKTOP_LAYOUT_MQ).matches;
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

    /** Same height for Archmage panel bezel as Battlemaster (measured in grid flow). */
    function measureBattlemasterPanelHeight() {
        const bmPanel = global.document.getElementById('game-class-panel-battlemaster');
        if (!bmPanel) return 0;

        const wasHidden = bmPanel.hidden;
        const wasActive = bmPanel.classList.contains('is-active');
        const prevVisibility = bmPanel.style.visibility;
        const prevPointerEvents = bmPanel.style.pointerEvents;
        const prevPosition = bmPanel.style.position;
        const prevLeft = bmPanel.style.left;

        bmPanel.hidden = false;
        bmPanel.classList.add('is-active');
        bmPanel.style.setProperty('visibility', 'hidden', 'important');
        bmPanel.style.setProperty('pointer-events', 'none', 'important');
        bmPanel.style.setProperty('position', 'absolute', 'important');
        bmPanel.style.setProperty('left', '-10000px', 'important');

        const height = Math.ceil(bmPanel.getBoundingClientRect().height);

        bmPanel.style.visibility = prevVisibility;
        bmPanel.style.pointerEvents = prevPointerEvents;
        bmPanel.style.position = prevPosition;
        bmPanel.style.left = prevLeft;
        if (!wasActive) bmPanel.classList.remove('is-active');
        if (wasHidden) bmPanel.hidden = true;

        return height;
    }

    function syncArchmagePanelHeight() {
        const root = getPickerRoot();
        if (!root) return;

        const bmHeight = measureBattlemasterPanelHeight();
        if (bmHeight > 0) {
            root.style.setProperty('--game-class-bm-panel-height', `${bmHeight}px`);
        }
    }

    function syncStageActiveSide() {
        const root = getPickerRoot();
        const stage = getPickerStage();
        if (!root || !stage) return;

        stage.classList.remove('has-active-panel-left', 'has-active-panel-right');
        if (activeClassId === 'battlemaster') {
            stage.classList.add('has-active-panel-left');
        } else if (activeClassId === 'archmage') {
            stage.classList.add('has-active-panel-right');
        }
    }

    function refreshPanelState() {
        const root = getPickerRoot();
        if (!root) return;

        root.dataset.activePanel = activeClassId || '';
        root.classList.toggle('has-active-panel', Boolean(activeClassId));
        syncStageActiveSide();

        getClassPanels().forEach((panel) => {
            const panelClassId = panel.dataset.classPanel;
            const isActive = panelClassId === activeClassId;

            panel.classList.toggle('is-active', isActive);
            panel.hidden = !isActive;
            panel.setAttribute('aria-hidden', isActive ? 'false' : 'true');

            if (isActive) {
                resetPanelPerkDetail(panel);
            } else {
                clearPanelInlineCoords(panel);
            }
        });

        syncArchmagePanelHeight();
    }

    function refreshSelectionState() {
        const root = getPickerRoot();
        if (!root) return;

        root.classList.toggle('has-selection', Boolean(activeClassId));

        getClassOptions().forEach((option) => {
            const classId = option.dataset.classId;
            const isSelected = classId === activeClassId;
            option.classList.toggle('is-selected', isSelected);
            option.classList.toggle('is-active', isSelected);
            option.setAttribute('aria-pressed', isSelected ? 'true' : 'false');
        });

        refreshPanelState();
        scheduleLayoutSync();
    }

    function selectClass(classId) {
        if (!GAME_CLASS_OPTIONS[classId]) return;
        activeClassId = activeClassId === classId ? null : classId;
        refreshSelectionState();
    }

    function showPanelPerk(panel, perkBtn) {
        if (!panel || !perkBtn) return;

        const entry = perkBtn.closest('.game-class-perk-entry');

        panel.querySelectorAll('.game-class-perk-entry').forEach((row) => {
            row.classList.toggle('is-active', row === entry);
        });

        panel.querySelectorAll('.game-class-perk-btn').forEach((btn) => {
            const isActive = btn === perkBtn;
            btn.classList.toggle('is-active', isActive);
            btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
        });

        scheduleLayoutSync();
    }

    function resetPanelPerkDetail(panel) {
        if (!panel) return;
        const firstPerk = panel.querySelector('.game-class-perk-btn');
        if (firstPerk) showPanelPerk(panel, firstPerk);
    }

    function confirmClassSelection(classId) {
        if (!GAME_CLASS_OPTIONS[classId]) return;
        activeClassId = classId;
        refreshSelectionState();
        global.dispatchEvent(new CustomEvent('royalarmies:class-confirmed', {
            detail: {
                classId,
                pathCode: GAME_CLASS_OPTIONS[classId].pathCode
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
                syncArchmagePanelHeight();
            }, delay);
        });

        global.requestAnimationFrame(() => {
            if (token !== layoutSyncToken) return;
            syncArchmagePanelHeight();
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

    function bindClassPanel(panel) {
        const classId = panel.dataset.classPanel;
        if (!classId) return;

        panel.querySelectorAll('.game-class-perk-btn').forEach((perkBtn) => {
            perkBtn.addEventListener('click', (event) => {
                event.preventDefault();
                event.stopPropagation();
                showPanelPerk(panel, perkBtn);
            });
        });

        const selectBtn = panel.querySelector('.game-class-select-btn');
        if (selectBtn) {
            selectBtn.addEventListener('click', (event) => {
                event.preventDefault();
                event.stopPropagation();
                confirmClassSelection(classId);
            });
        }
    }

    function bindClassOption(option) {
        const classId = option.dataset.classId;
        if (!classId || !GAME_CLASS_OPTIONS[classId]) return;

        option.addEventListener('mouseenter', () => {
            option.classList.add('is-hovered');
        });

        option.addEventListener('mouseleave', () => {
            option.classList.remove('is-hovered');
        });

        option.addEventListener('click', (event) => {
            event.preventDefault();
            selectClass(classId);
        });

        option.addEventListener('keydown', (event) => {
            if (event.key !== 'Enter' && event.key !== ' ') return;
            event.preventDefault();
            selectClass(classId);
        });
    }

    function bindPickerDismiss() {
        global.document.addEventListener('pointerdown', (event) => {
            const root = getPickerRoot();
            if (!root || !activeClassId) return;
            if (event.target.closest('.game-class-option')) return;
            if (event.target.closest('.game-class-side-panel')) return;
            if (root.contains(event.target)) {
                activeClassId = null;
                refreshSelectionState();
            }
        });
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
        bindPickerDismiss();
        bindClassPickerLayout();
        bindPortraitImageLoads();
        refreshSelectionState();
        scheduleLayoutSync();

        root.dataset.initialized = 'true';
        root.dataset.layoutMode = usesDocumentFlowLayout() ? 'grid' : 'stack';
    }

    global.GAME_CLASS_OPTIONS = GAME_CLASS_OPTIONS;
    global.getSelectedGameClassId = function getSelectedGameClassId() {
        return activeClassId;
    };
    global.getSelectedGameClassPath = function getSelectedGameClassPath() {
        return activeClassId ? GAME_CLASS_OPTIONS[activeClassId].pathCode : null;
    };
    global.initGameClassPicker = initGameClassPicker;
    global.clearGameClassPickerSelection = function clearGameClassPickerSelection() {
        activeClassId = null;
        refreshSelectionState();
    };
    global.confirmGameClassSelection = confirmClassSelection;

    if (global.document.readyState === 'loading') {
        global.document.addEventListener('DOMContentLoaded', initGameClassPicker);
    } else {
        initGameClassPicker();
    }
}(typeof window !== 'undefined' ? window : globalThis));
