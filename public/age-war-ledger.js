/**
 * RIFT — War Ledger panel (nation war history) opened from the Age bottom bar.
 */
(function initAgeWarLedger(global) {
    'use strict';

    const PLACEHOLDER_ENTRIES = [
        {
            type: 'notice',
            title: 'No active wars logged',
            detail: 'Formal declarations and campaign records will appear here once NEXUS war ledger sync is live.'
        }
    ];

    let bound = false;
    let escapeHandler = null;

    function getModal() {
        return global.document.getElementById('age-war-ledger-modal');
    }

    function renderWarLedgerList() {
        const listEl = global.document.getElementById('age-war-ledger-list');
        if (!listEl) return;

        listEl.innerHTML = PLACEHOLDER_ENTRIES.map((entry) => (
            `<li class="age-war-ledger-item age-war-ledger-item--${entry.type}">`
            + `<span class="age-war-ledger-item-type">${entry.type}</span>`
            + `<strong class="age-war-ledger-item-title">${entry.title}</strong>`
            + `<p class="age-war-ledger-item-detail">${entry.detail}</p>`
            + '</li>'
        )).join('');
    }

    function closeWarLedgerModal() {
        const modal = getModal();
        if (!modal) return;

        modal.hidden = true;
        modal.setAttribute('aria-hidden', 'true');
        global.document.getElementById('age-war-ledger-open')?.setAttribute('aria-expanded', 'false');

        if (escapeHandler) {
            global.document.removeEventListener('keydown', escapeHandler);
            escapeHandler = null;
        }
    }

    function openWarLedgerModal() {
        const modal = getModal();
        if (!modal) return;

        renderWarLedgerList();
        modal.hidden = false;
        modal.setAttribute('aria-hidden', 'false');
        global.document.getElementById('age-war-ledger-open')?.setAttribute('aria-expanded', 'true');
        global.document.getElementById('age-war-ledger-close')?.focus();

        if (!escapeHandler) {
            escapeHandler = (event) => {
                if (event.key === 'Escape') {
                    closeWarLedgerModal();
                }
            };
            global.document.addEventListener('keydown', escapeHandler);
        }
    }

    function bindWarLedger() {
        if (bound) return;
        bound = true;

        global.document.getElementById('age-war-ledger-open')?.addEventListener('click', (event) => {
            event.preventDefault();
            openWarLedgerModal();
        });

        global.document.getElementById('age-war-ledger-close')?.addEventListener('click', closeWarLedgerModal);
        global.document.getElementById('age-war-ledger-backdrop')?.addEventListener('click', closeWarLedgerModal);
    }

    function enableWarLedger() {
        bindWarLedger();
        renderWarLedgerList();
    }

    global.RoyalArmiesAgeWarLedger = {
        enable: enableWarLedger,
        open: openWarLedgerModal,
        close: closeWarLedgerModal
    };
    global.enableAgeWarLedger = enableWarLedger;
})(window);
