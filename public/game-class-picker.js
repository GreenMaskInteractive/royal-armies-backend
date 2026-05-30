/**
 * Choose-class — fixed portrait slots; side panels open on click (fixed beside each class).
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

    const PANEL_GAP_PX = 20;
    const PANEL_TOP_OFFSET_PX = 32;
    const PANEL_DROP_OFFSET_PX = 80;
    const PANEL_WIDTH_PX = 340;
    const PANEL_OUTWARD_SHIFT_PX = 150;

    let activeClassId = null;

    function getPickerRoot() {
        return global.document.getElementById('game-class-picker');
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

    function getClassOptionButton(classId) {
        const root = getPickerRoot();
        if (!root) return null;
        return root.querySelector(`.game-class-option[data-class-id="${classId}"]`);
    }

    function getPortraitAnchorRect(anchorBtn) {
        if (!anchorBtn) return null;
        const portrait = anchorBtn.querySelector('.game-class-option-img');
        return (portrait || anchorBtn).getBoundingClientRect();
    }

    /** Same top for both class panels (tallest portrait top edge + offset). */
    function measureBattlemasterPanelHeight() {
        const bmPanel = global.document.getElementById('game-class-panel-battlemaster');
        if (!bmPanel) return 0;

        const wasHidden = bmPanel.hidden;
        const wasActive = bmPanel.classList.contains('is-active');
        const prevVisibility = bmPanel.style.visibility;
        const prevLeft = bmPanel.style.left;
        const prevTop = bmPanel.style.top;

        bmPanel.hidden = false;
        bmPanel.classList.add('is-active');
        bmPanel.style.setProperty('visibility', 'hidden', 'important');
        bmPanel.style.setProperty('left', '-10000px', 'important');
        bmPanel.style.setProperty('top', '0', 'important');

        const height = Math.ceil(bmPanel.getBoundingClientRect().height);

        bmPanel.style.visibility = prevVisibility;
        bmPanel.style.left = prevLeft;
        bmPanel.style.top = prevTop;
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

    function getSharedPanelTop() {
        const viewportPadding = 12;
        const portraitTops = Object.keys(GAME_CLASS_OPTIONS)
            .map((classId) => {
                const rect = getPortraitAnchorRect(getClassOptionButton(classId));
                return rect ? rect.top : null;
            })
            .filter((top) => top !== null);

        if (!portraitTops.length) {
            return viewportPadding + PANEL_TOP_OFFSET_PX + PANEL_DROP_OFFSET_PX;
        }

        return Math.max(
            viewportPadding,
            Math.min(...portraitTops) + PANEL_TOP_OFFSET_PX + PANEL_DROP_OFFSET_PX
        );
    }

    function applyPanelCoords(panel, left, top) {
        panel.style.setProperty('--game-class-panel-x', `${left}px`);
        panel.style.setProperty('--game-class-panel-y', `${top}px`);
        panel.style.setProperty('position', 'fixed', 'important');
        panel.style.setProperty('left', `${left}px`, 'important');
        panel.style.setProperty('top', `${top}px`, 'important');
        panel.style.setProperty('right', 'auto', 'important');
        panel.style.setProperty('bottom', 'auto', 'important');
        panel.style.setProperty('margin', '0', 'important');
        panel.style.setProperty('z-index', '999999910', 'important');
    }

    function positionClassPanel(panel, anchorBtn, side) {
        if (!panel || !anchorBtn) return;

        const anchorRect = getPortraitAnchorRect(anchorBtn);
        if (!anchorRect) return;

        const panelWidth = panel.offsetWidth || PANEL_WIDTH_PX;
        const top = getSharedPanelTop();
        const viewportPadding = 12;
        let left;

        if (side === 'left') {
            left = Math.max(
                viewportPadding,
                anchorRect.left - panelWidth - PANEL_GAP_PX - PANEL_OUTWARD_SHIFT_PX
            );
        } else {
            left = Math.min(
                anchorRect.right + PANEL_GAP_PX + PANEL_OUTWARD_SHIFT_PX,
                global.innerWidth - panelWidth - viewportPadding
            );
            left = Math.max(viewportPadding, left);
        }

        applyPanelCoords(panel, left, top);
    }

    function refreshPanelState() {
        const root = getPickerRoot();
        if (!root) return;

        root.dataset.activePanel = activeClassId || '';
        root.classList.toggle('has-active-panel', Boolean(activeClassId));

        getClassPanels().forEach((panel) => {
            const panelClassId = panel.dataset.classPanel;
            const config = GAME_CLASS_OPTIONS[panelClassId];
            const isActive = panelClassId === activeClassId;

            panel.classList.toggle('is-active', isActive);
            panel.hidden = !isActive;
            panel.setAttribute('aria-hidden', isActive ? 'false' : 'true');

            if (isActive && config) {
                const anchorBtn = getClassOptionButton(config.id);
                resetPanelPerkDetail(panel);
                positionClassPanel(panel, anchorBtn, config.side);
                global.requestAnimationFrame(() => {
                    positionClassPanel(panel, anchorBtn, config.side);
                    syncArchmagePanelHeight();
                });
            } else {
                panel.style.removeProperty('--game-class-panel-x');
                panel.style.removeProperty('--game-class-panel-y');
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
        global.addEventListener('resize', () => {
            syncArchmagePanelHeight();
            if (!activeClassId) return;
            refreshPanelState();
        });
    }

    function initGameClassPicker() {
        const root = getPickerRoot();
        if (!root || root.dataset.initialized === 'true') return;

        getClassOptions().forEach(bindClassOption);
        getClassPanels().forEach(bindClassPanel);
        bindPickerDismiss();
        bindClassPickerLayout();
        refreshSelectionState();
        syncArchmagePanelHeight();
        global.requestAnimationFrame(syncArchmagePanelHeight);

        root.dataset.initialized = 'true';
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
})(window);
