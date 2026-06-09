/**
 * RIFT — Canonical Age class perk catalog (Battlemaster / Battlemage battle perks).
 * Hydrates game.html class panels and supplies labels for battle reports.
 */
(function initRoyalArmiesClassPerkCatalog(global) {
    'use strict';

    const PERK1_BRANCH = Object.freeze({
        buff: 'A',
        cover: 'B'
    });

    const CLASS_PERK_CATALOG = Object.freeze({
        battlemaster: Object.freeze({
            classId: 'battlemaster',
            pathCode: 'PHYS',
            honorLine: 'Champion of the',
            honorEmphasis: 'Physical Path',
            intro: 'Battlemasters command physical armies across the four battle phases. Mixed lane compositions unlock phase-linking bonuses in combat.',
            perk1: Object.freeze({
                heading: 'Perk 1 — Choose your doctrine',
                hint: 'Option A and B are mutually exclusive for this Age.',
                options: Object.freeze({
                    A: Object.freeze({
                        id: 'A',
                        title: 'Vanguard Cleave',
                        subtitle: 'Further Buff',
                        copy: 'Physical Cavalry (Phase 3) deals +20% damage against targets they already naturally counter on the matrix (Physical Artillery and Magic Infantry).'
                    }),
                    B: Object.freeze({
                        id: 'B',
                        title: 'Thick Hide Training',
                        subtitle: 'Protective Cover',
                        copy: 'Physical Infantry reduces matrix counter bonus damage from Physical Beasts and Magic Infantry by 15%.'
                    })
                })
            }),
            fixedPerks: Object.freeze([
                Object.freeze({
                    title: 'Cavalry Flanking Cover',
                    subtitle: 'Phase 4',
                    copy: 'If your cavalry outnumbers the enemy cavalry at the start of Phase 4, your Physical Infantry ignores enemy counter bonuses for the first 2 infantry rounds.'
                })
            ])
        }),
        battlemage: Object.freeze({
            classId: 'battlemage',
            pathCode: 'MAG',
            honorLine: 'Voice of the',
            honorEmphasis: 'Arcane Path',
            intro: 'Battlemages weave magic across ranged, beasts, cavalry, and infantry lanes. Phase-linking rewards balanced four-lane armies.',
            perk1: Object.freeze({
                heading: 'Perk 1 — Choose your doctrine',
                hint: 'Option A and B are mutually exclusive for this Age.',
                options: Object.freeze({
                    A: Object.freeze({
                        id: 'A',
                        title: 'Feedback Overload',
                        subtitle: 'Further Buff',
                        copy: 'Magic Artillery (Phase 1) deals +20% damage against targets they already naturally counter (Physical Cavalry and Magic Beasts).'
                    }),
                    B: Object.freeze({
                        id: 'B',
                        title: 'Warding Runes',
                        subtitle: 'Protective Cover',
                        copy: 'Magic Infantry absorbs 15% of incoming damage when struck by natural matrix counters (Physical Artillery and Magic Beasts).'
                    })
                })
            }),
            fixedPerks: Object.freeze([
                Object.freeze({
                    title: 'Arcane Conduits',
                    subtitle: 'Phase 1 → 2 & 3',
                    copy: 'Magic Artillery damage in Phase 1 builds mana resonance, boosting Magic Beasts and Magic Cavalry up to +20%.'
                }),
                Object.freeze({
                    title: 'Morale Resonance',
                    subtitle: 'Grand Combined',
                    copy: 'With all four valid active lanes, morale shock from damage is reduced (×30 instead of ×45 on the phase-shock formula).'
                })
            ])
        })
    });

    const ARCHETYPE_LABELS = Object.freeze({
        mono: 'Mono lane',
        dual: 'Dual-Phase',
        tri: 'Tri-Phase',
        grand: 'Grand Combined'
    });

    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function getClassCatalog(classId) {
        return CLASS_PERK_CATALOG[classId] || null;
    }

    function renderPerkEntry(perk, extraClass) {
        return (
            '<div class="game-class-perk-entry' + (extraClass ? ` ${extraClass}` : '') + '" role="listitem">'
            + '<div class="game-class-perk-icon-slot" aria-hidden="true">'
            + '<img src="images/units/unit-portrait-placeholder.svg" alt="" class="game-class-perk-icon is-placeholder" width="64" height="64" draggable="false">'
            + '</div>'
            + '<div class="game-class-perk-entry-text">'
            + `<h5 class="game-class-perk-entry-title">${escapeHtml(perk.title)}</h5>`
            + `<p class="game-class-perk-entry-subtitle">${escapeHtml(perk.subtitle)}</p>`
            + `<p class="game-class-perk-entry-copy">${escapeHtml(perk.copy)}</p>`
            + '</div>'
            + '</div>'
        );
    }

    function renderPerk1BranchChoice(classId, selectedBranch) {
        const catalog = getClassCatalog(classId);
        if (!catalog?.perk1) return '';

        const selected = String(selectedBranch || '').toUpperCase();
        const optionA = catalog.perk1.options.A;
        const optionB = catalog.perk1.options.B;

        function branchButton(option) {
            const isSelected = selected === option.id;
            return (
                '<button type="button"'
                + ` class="game-class-perk-branch-btn${isSelected ? ' is-selected' : ''}"`
                + ` data-class-perk-branch="${escapeHtml(classId)}"`
                + ` data-perk1-branch="${escapeHtml(option.id)}"`
                + ` aria-pressed="${isSelected ? 'true' : 'false'}">`
                + `<span class="game-class-perk-branch-tag">${escapeHtml(option.id === 'A' ? 'Option A' : 'Option B')}</span>`
                + `<span class="game-class-perk-branch-title">${escapeHtml(option.title)}</span>`
                + `<span class="game-class-perk-branch-sub">${escapeHtml(option.subtitle)}</span>`
                + `<span class="game-class-perk-branch-copy">${escapeHtml(option.copy)}</span>`
                + '</button>'
            );
        }

        return (
            '<section class="game-class-perk-branch" aria-label="Perk 1 choice">'
            + `<h4 class="game-class-perk-branch-heading">${escapeHtml(catalog.perk1.heading)}</h4>`
            + `<p class="game-class-perk-branch-hint">${escapeHtml(catalog.perk1.hint)}</p>`
            + '<div class="game-class-perk-branch-grid" role="group">'
            + branchButton(optionA)
            + branchButton(optionB)
            + '</div>'
            + '</section>'
        );
    }

    function renderClassPerkPanel(classId, selectedBranch) {
        const catalog = getClassCatalog(classId);
        if (!catalog) return '';

        return (
            renderPerk1BranchChoice(classId, selectedBranch)
            + '<p class="game-class-panel-notice">Class perks, banners, gear, and composition bonuses apply in city assault and border PvP only — not guild training runs. Your Perk 1 choice locks when you confirm class.</p>'
        );
    }

    function mountClassPerkPanel(classId, selectedBranch) {
        const mount = global.document.querySelector(`[data-class-perk-mount="${classId}"]`);
        if (!mount) return;
        mount.innerHTML = renderClassPerkPanel(classId, selectedBranch);
    }

    function mountAllClassPerkPanels(branchByClass) {
        const branches = branchByClass && typeof branchByClass === 'object' ? branchByClass : {};
        Object.keys(CLASS_PERK_CATALOG).forEach((classId) => {
            mountClassPerkPanel(classId, branches[classId] || null);
        });
    }

    function formatCompositionSummary(composition) {
        if (!composition || typeof composition !== 'object') return '';
        const archetype = ARCHETYPE_LABELS[composition.archetype] || composition.archetype || 'Unknown';
        const lanes = Math.max(0, Math.floor(Number(composition.validActiveLaneCount) || 0));
        const efficiency = Math.round(Math.max(0, Number(composition.compositionEfficiency) || 0) * 100);
        return `${archetype} · ${lanes} active lane${lanes === 1 ? '' : 's'} · ${efficiency}% balance`;
    }

    function formatPerk1BranchLabel(classId, branch) {
        const catalog = getClassCatalog(classId);
        const key = String(branch || '').toUpperCase();
        const option = catalog?.perk1?.options?.[key];
        return option ? `${option.title} (${option.subtitle})` : '';
    }

    global.RoyalArmiesClassPerkCatalog = Object.freeze({
        PERK1_BRANCH,
        CLASS_PERK_CATALOG,
        ARCHETYPE_LABELS,
        getClassCatalog,
        renderClassPerkPanel,
        mountClassPerkPanel,
        mountAllClassPerkPanels,
        formatCompositionSummary,
        formatPerk1BranchLabel
    });
}(typeof window !== 'undefined' ? window : globalThis));
