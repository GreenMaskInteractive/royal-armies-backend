/**
 * Choose-class artboard — four independent character masks with grayscale-to-color click selection.
 *
 * HOW TO TUNE MASK SHAPES
 * -----------------------
 * 1. Open public/images/chooseclass.png in any image editor.
 * 2. Read pixel coordinates for each corner of a character silhouette.
 * 3. Edit the `points` arrays below (native image size: 2752 × 1536).
 * 4. Add or remove [x, y] pairs to tighten/loosen each polygon.
 * 5. Reload /game — masks and click targets update automatically.
 */
(function initGameClassPicker(global) {
    'use strict';

  /** Must match chooseclass.png native dimensions. */
    const ARTBOARD = { width: 2752, height: 1536 };

    /**
     * Placeholder silhouettes for the four characters.
     * Each entry is an ordered list of [x, y] pixel coordinates tracing the character outline.
     */
    const CHARACTER_MASKS = {
        mage: {
            id: 'mage',
            name: 'Left Mage',
            ariaLabel: 'Left Mage — elder scholar',
            // Left Mage: hood, book, and robe on the far left.
            points: [
                [110, 1410], [110, 820], [160, 520], [230, 400], [310, 360],
                [420, 480], [460, 720], [480, 1410]
            ]
        },
        sorceress: {
            id: 'sorceress',
            name: 'Middle-Left Sorceress',
            ariaLabel: 'Middle-Left Sorceress — crystal staff wielder',
            // Sorceress: purple robes and staff between the mage and center pillar.
            points: [
                [520, 1410], [540, 860], [580, 520], [680, 380], [780, 400],
                [880, 560], [950, 820], [980, 1410]
            ]
        },
        knight: {
            id: 'knight',
            name: 'Middle-Right Knight',
            ariaLabel: 'Middle-Right Knight — armored guardian',
            // Knight: standing plate armor to the right of the center pillar.
            points: [
                [1380, 1410], [1400, 620], [1480, 420], [1580, 380], [1680, 420],
                [1750, 620], [1780, 1410]
            ]
        },
        soldier: {
            id: 'soldier',
            name: 'Right Soldier',
            ariaLabel: 'Right Soldier — seated veteran',
            // Soldier: seated knight and sword on the far right.
            points: [
                [1820, 1410], [1850, 900], [1920, 700], [2050, 650], [2200, 700],
                [2400, 850], [2550, 1100], [2600, 1410]
            ]
        }
    };

    let activeCharacterId = null;

    function getPickerRoot() {
        return global.document.getElementById('game-class-picker');
    }

    function pointsToSvgString(points) {
        return points.map(([x, y]) => `${x},${y}`).join(' ');
    }

    function pointsToCssPolygon(points) {
        const pairs = points.map(([x, y]) => {
            const px = ((x / ARTBOARD.width) * 100).toFixed(4);
            const py = ((y / ARTBOARD.height) * 100).toFixed(4);
            return `${px}% ${py}%`;
        });
        return `polygon(${pairs.join(', ')})`;
    }

    function applyMaskGeometry(root) {
        const hitmap = root.querySelector('.game-class-picker-hitmap');

        Object.values(CHARACTER_MASKS).forEach((mask) => {
            const pointString = pointsToSvgString(mask.points);
            const cssPolygon = pointsToCssPolygon(mask.points);

            const hitZone = hitmap?.querySelector(`[data-character-id="${mask.id}"]`);
            if (hitZone) {
                hitZone.setAttribute('points', pointString);
            }

            const layer = root.querySelector(`.game-class-character[data-character-id="${mask.id}"]`);
            if (layer) {
                layer.style.clipPath = cssPolygon;
                layer.style.webkitClipPath = cssPolygon;
            }
        });
    }

    function getCharacterLayers() {
        const root = getPickerRoot();
        if (!root) return [];
        return Array.from(root.querySelectorAll('.game-class-character'));
    }

    function getHitZones() {
        const root = getPickerRoot();
        if (!root) return [];
        return Array.from(root.querySelectorAll('.game-class-hit-zone'));
    }

    function refreshSelectionState() {
        getCharacterLayers().forEach((layer) => {
            const isActive = layer.dataset.characterId === activeCharacterId;
            layer.classList.toggle('selected', isActive);
            layer.classList.toggle('is-active', isActive);
            layer.setAttribute('aria-hidden', isActive ? 'true' : 'false');
        });

        getHitZones().forEach((zone) => {
            const isActive = zone.dataset.characterId === activeCharacterId;
            zone.classList.toggle('selected', isActive);
            zone.classList.toggle('is-active', isActive);
            zone.setAttribute('aria-pressed', isActive ? 'true' : 'false');
        });
    }

    function selectCharacter(characterId) {
        if (activeCharacterId === characterId) {
            activeCharacterId = null;
        } else {
            activeCharacterId = characterId;
        }
        refreshSelectionState();
    }

    function bindHitZone(zone) {
        const characterId = zone.dataset.characterId;
        if (!characterId) return;

        zone.addEventListener('mouseenter', () => {
            const layer = getPickerRoot()?.querySelector(`.game-class-character[data-character-id="${characterId}"]`);
            layer?.classList.add('is-hovered');
            zone.classList.add('is-hovered');
        });

        zone.addEventListener('mouseleave', () => {
            const layer = getPickerRoot()?.querySelector(`.game-class-character[data-character-id="${characterId}"]`);
            layer?.classList.remove('is-hovered');
            zone.classList.remove('is-hovered');
        });

        zone.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            selectCharacter(characterId);
        });

        zone.addEventListener('keydown', (event) => {
            if (event.key !== 'Enter' && event.key !== ' ') return;
            event.preventDefault();
            selectCharacter(characterId);
        });
    }

    function bindPickerDismiss() {
        global.document.addEventListener('pointerdown', (event) => {
            const root = getPickerRoot();
            if (!root || !activeCharacterId) return;
            if (event.target.closest('.game-class-hit-zone')) return;
            if (root.contains(event.target)) {
                activeCharacterId = null;
                refreshSelectionState();
            }
        });
    }

    function initGameClassPicker() {
        const root = getPickerRoot();
        if (!root || root.dataset.initialized === 'true') return;

        root.dataset.artWidth = String(ARTBOARD.width);
        root.dataset.artHeight = String(ARTBOARD.height);

        applyMaskGeometry(root);
        getHitZones().forEach(bindHitZone);
        bindPickerDismiss();
        refreshSelectionState();

        root.dataset.initialized = 'true';
    }

    global.CHARACTER_MASKS = CHARACTER_MASKS;
    global.GAME_CLASS_ARTBOARD = ARTBOARD;
    global.initGameClassPicker = initGameClassPicker;
    global.clearGameClassPickerSelection = function clearGameClassPickerSelection() {
        activeCharacterId = null;
        refreshSelectionState();
    };

    if (global.document.readyState === 'loading') {
        global.document.addEventListener('DOMContentLoaded', initGameClassPicker);
    } else {
        initGameClassPicker();
    }
})(window);
