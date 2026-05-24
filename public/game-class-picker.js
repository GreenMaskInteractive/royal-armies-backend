/**
 * Choose-class artboard — paired character hover, click-to-lock, and side panels.
 */
(function initGameClassPicker(global) {
    'use strict';

    const PANEL_COPY = {
        arcane: {
            title: 'The Arcane Path',
            body: 'Channel world-shattering magic with the elder sage and crystal arcanist. Arcane commanders bend reality, summon elemental power, and rewrite the mathematics of the battlefield.',
            edge: 'left'
        },
        physical: {
            title: 'The Physical Path',
            body: 'Lead with steel through the shield-maiden and the armored knight. Physical commanders crush fortifications, hold the line with heavy arms, and dominate through raw martial superiority.',
            edge: 'right'
        }
    };

    let activeSelection = null;
    let hoveredSelection = null;

    function getPickerRoot() {
        return global.document.getElementById('game-class-picker');
    }

    function getZones() {
        const root = getPickerRoot();
        if (!root) return [];
        return Array.from(root.querySelectorAll('.game-class-picker-zone'));
    }

    function setZoneVisualState(zone, state) {
        if (!zone) return;
        zone.classList.toggle('is-hovered', state === 'hovered');
        zone.classList.toggle('is-selected', state === 'selected');
        zone.setAttribute('aria-pressed', state === 'selected' ? 'true' : 'false');
    }

    function refreshZoneVisualStates() {
        getZones().forEach((zone) => {
            const id = zone.dataset.classGroup;
            let state = null;
            if (activeSelection === id) state = 'selected';
            else if (hoveredSelection === id) state = 'hovered';
            setZoneVisualState(zone, state);
        });
    }

    function renderSidePanel(panel, groupId) {
        if (!panel) return;
        const copy = PANEL_COPY[groupId];
        if (!copy) {
            panel.hidden = true;
            panel.innerHTML = '';
            return;
        }

        panel.hidden = false;
        panel.innerHTML = `
            <div class="game-class-picker-side-panel-frame bordered-modal-panel">
                <h2 class="game-class-picker-side-panel-title">${copy.title}</h2>
                <p class="game-class-picker-side-panel-body">${copy.body}</p>
                <button type="button" class="game-class-picker-side-panel-close confirm-btn">Close</button>
            </div>
        `;

        const closeBtn = panel.querySelector('.game-class-picker-side-panel-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', (event) => {
                event.preventDefault();
                event.stopPropagation();
                clearSelection();
            });
        }
    }

    function updateSidePanels() {
        const root = getPickerRoot();
        if (!root) return;

        const leftPanel = root.querySelector('.game-class-picker-side-panel--left');
        const rightPanel = root.querySelector('.game-class-picker-side-panel--right');

        if (!activeSelection) {
            if (leftPanel) {
                leftPanel.hidden = true;
                leftPanel.innerHTML = '';
            }
            if (rightPanel) {
                rightPanel.hidden = true;
                rightPanel.innerHTML = '';
            }
            root.classList.remove('has-selection');
            delete root.dataset.activeEdge;
            return;
        }

        const copy = PANEL_COPY[activeSelection];
        root.classList.add('has-selection');
        root.dataset.activeEdge = copy ? copy.edge : '';

        if (leftPanel) {
            if (copy?.edge === 'left') renderSidePanel(leftPanel, activeSelection);
            else {
                leftPanel.hidden = true;
                leftPanel.innerHTML = '';
            }
        }
        if (rightPanel) {
            if (copy?.edge === 'right') renderSidePanel(rightPanel, activeSelection);
            else {
                rightPanel.hidden = true;
                rightPanel.innerHTML = '';
            }
        }
    }

    function clearSelection() {
        activeSelection = null;
        hoveredSelection = null;
        refreshZoneVisualStates();
        updateSidePanels();
    }

    function selectGroup(groupId) {
        activeSelection = groupId;
        refreshZoneVisualStates();
        updateSidePanels();
    }

    function bindZone(zone) {
        const groupId = zone.dataset.classGroup;
        if (!groupId) return;

        zone.addEventListener('mouseenter', () => {
            hoveredSelection = groupId;
            refreshZoneVisualStates();
        });

        zone.addEventListener('mouseleave', () => {
            if (hoveredSelection === groupId) hoveredSelection = null;
            refreshZoneVisualStates();
        });

        zone.addEventListener('focus', () => {
            hoveredSelection = groupId;
            refreshZoneVisualStates();
        });

        zone.addEventListener('blur', () => {
            if (hoveredSelection === groupId) hoveredSelection = null;
            refreshZoneVisualStates();
        });

        zone.addEventListener('click', (event) => {
            event.preventDefault();
            if (activeSelection === groupId) {
                clearSelection();
                return;
            }
            selectGroup(groupId);
        });
    }

    function bindPickerDismiss() {
        global.document.addEventListener('pointerdown', (event) => {
            const root = getPickerRoot();
            if (!root || !activeSelection) return;
            if (root.contains(event.target)) return;
            clearSelection();
        });
    }

    function initGameClassPicker() {
        const root = getPickerRoot();
        if (!root || root.dataset.initialized === 'true') return;

        getZones().forEach(bindZone);
        bindPickerDismiss();
        root.dataset.initialized = 'true';
    }

    global.initGameClassPicker = initGameClassPicker;
    global.clearGameClassPickerSelection = clearSelection;

    if (global.document.readyState === 'loading') {
        global.document.addEventListener('DOMContentLoaded', initGameClassPicker);
    } else {
        initGameClassPicker();
    }
})(window);
