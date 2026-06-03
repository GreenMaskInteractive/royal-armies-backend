/**
 * RIFT — War Ledger (embedded in Headquarters; legacy modal retained for compatibility).
 */
(function initAgeWarLedger(global) {
    'use strict';

    let bound = false;
    let escapeHandler = null;

    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function formatWarDate(iso) {
        if (!iso) return '—';
        const parsed = Date.parse(iso);
        if (!Number.isFinite(parsed)) return '—';
        return new Date(parsed).toLocaleString(undefined, {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit'
        });
    }

    function buildWarLedgerMarkup(warLedger) {
        const wars = Array.isArray(warLedger?.wars) ? warLedger.wars : [];
        if (!wars.length) {
            return '<li class="age-hq-war-ledger-empty">No recognized wars on record. Formal declarations are permanent once recorded.</li>';
        }

        return wars.map((war) => {
            const opponent = escapeHtml(war.opponentNationName || war.opponentNationId || 'Unknown nation');
            const declaredAt = formatWarDate(war.declaredAt);
            const status = String(war.status || 'active').toLowerCase();
            const statusLabel = status === 'active' ? 'Active' : status;
            return (
                `<li class="age-hq-war-ledger-item age-hq-war-ledger-item--${escapeHtml(status)}">`
                + `<div class="age-hq-war-ledger-item-head">`
                + `<strong class="age-hq-war-ledger-opponent">${opponent}</strong>`
                + `<span class="age-hq-war-ledger-status">${escapeHtml(statusLabel)}</span>`
                + `</div>`
                + `<p class="age-hq-war-ledger-date">Declared ${escapeHtml(declaredAt)}</p>`
                + `<p class="age-hq-war-ledger-rule">Ends only when a belligerent is eliminated.</p>`
                + `</li>`
            );
        }).join('');
    }

    function renderIntoListElement(listEl, warLedger) {
        if (!listEl) return;
        listEl.innerHTML = buildWarLedgerMarkup(warLedger);
    }

    function getModal() {
        return global.document.getElementById('age-war-ledger-modal');
    }

    function renderWarLedgerList(warLedger) {
        renderIntoListElement(global.document.getElementById('age-war-ledger-list'), warLedger);
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
            if (event.target.closest('[data-age-view-tab="headquarters"]')) {
                return;
            }
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
        close: closeWarLedgerModal,
        renderInto: renderIntoListElement
    };
    global.enableAgeWarLedger = enableWarLedger;
})(window);
