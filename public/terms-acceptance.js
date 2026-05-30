/**
 * RIFT — Terms of Service acceptance (registration, dashboard gate, join-age enforcement).
 */
(function initRoyalArmiesTermsAcceptance(global) {
    'use strict';

    const TERMS_PAGE_PATH = '/terms';
    const TERMS_SUCCESS_TOKEN_KEY = 'royalArmiesTermsSuccessToken';

    let pendingLoginContinuation = null;
    let termsGateBlocking = false;
    let termsGateControlsBound = false;

    function resolveTermsVersion() {
        return global.RoyalArmiesLegalTermsVersion || '2026-05-28';
    }

    function resolveApiUrl(path) {
        if (typeof global.resolveRoyalArmiesApiUrl === 'function') {
            return global.resolveRoyalArmiesApiUrl(path);
        }
        return path;
    }

    function resolveFetchCredentials() {
        return typeof global.canUsePortalAuthSessionApi === 'function' && global.canUsePortalAuthSessionApi()
            ? 'include'
            : 'same-origin';
    }

    function isTermsGateBlocking() {
        return termsGateBlocking;
    }

    function setTermsGateBlocking(active) {
        termsGateBlocking = Boolean(active);
        const body = global.document.body;
        const gate = global.document.getElementById('terms-dashboard-gate');
        if (body) {
            body.classList.toggle('is-terms-gate-active', termsGateBlocking);
        }
        if (gate) {
            gate.hidden = !termsGateBlocking;
            gate.setAttribute('aria-hidden', termsGateBlocking ? 'false' : 'true');
        }
    }

    function syncRegistrationTermsSubmitState() {
        const checkbox = global.document.getElementById('reg-terms-accepted');
        const submitBtn = global.document.getElementById('reg-submit-btn');
        if (!submitBtn) return;

        const enabled = Boolean(checkbox?.checked);
        submitBtn.disabled = !enabled;
        submitBtn.setAttribute('aria-disabled', enabled ? 'false' : 'true');
    }

    function bindRegistrationTermsControls() {
        const checkbox = global.document.getElementById('reg-terms-accepted');
        if (!checkbox || checkbox.dataset.termsBound === 'true') return;

        checkbox.dataset.termsBound = 'true';
        checkbox.addEventListener('change', syncRegistrationTermsSubmitState);
        syncRegistrationTermsSubmitState();
    }

    function registrationTermsAccepted() {
        const checkbox = global.document.getElementById('reg-terms-accepted');
        return Boolean(checkbox?.checked);
    }

    function syncDashboardTermsConfirmState() {
        const checkbox = global.document.getElementById('terms-dashboard-accepted');
        const submitBtn = global.document.getElementById('terms-dashboard-confirm-btn');
        if (!submitBtn) return;

        const enabled = Boolean(checkbox?.checked);
        submitBtn.disabled = !enabled;
        submitBtn.setAttribute('aria-disabled', enabled ? 'false' : 'true');
    }

    function bindDashboardTermsGateControls() {
        if (termsGateControlsBound) return;
        termsGateControlsBound = true;

        const checkbox = global.document.getElementById('terms-dashboard-accepted');
        const submitBtn = global.document.getElementById('terms-dashboard-confirm-btn');
        const logoutBtn = global.document.getElementById('terms-dashboard-logout-btn');

        checkbox?.addEventListener('change', syncDashboardTermsConfirmState);

        submitBtn?.addEventListener('click', () => {
            submitDashboardTermsAcceptance();
        });

        logoutBtn?.addEventListener('click', () => {
            closeTermsDashboardGate();
            pendingLoginContinuation = null;
            if (typeof global.executeLogoutRedirect === 'function') {
                global.executeLogoutRedirect();
            }
        });

        syncDashboardTermsConfirmState();
    }

    function setTermsAcceptanceFeedback(message) {
        const feedback = global.document.getElementById('terms-dashboard-feedback');
        if (!feedback) return;
        const text = String(message || '').trim();
        if (!text) {
            feedback.hidden = true;
            feedback.textContent = '';
            return;
        }
        feedback.hidden = false;
        feedback.textContent = text;
    }

    function openTermsDashboardGate() {
        bindDashboardTermsGateControls();

        const checkbox = global.document.getElementById('terms-dashboard-accepted');
        const submitBtn = global.document.getElementById('terms-dashboard-confirm-btn');
        if (checkbox) checkbox.checked = false;
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.setAttribute('aria-disabled', 'true');
            submitBtn.textContent = 'Confirm & Play';
        }
        setTermsAcceptanceFeedback('');
        setTermsGateBlocking(true);

        global.requestAnimationFrame(() => {
            submitBtn?.focus();
        });
    }

    function closeTermsDashboardGate() {
        setTermsGateBlocking(false);
        setTermsAcceptanceFeedback('');
    }

    async function fetchSessionTermsStatus() {
        try {
            const response = await fetch(resolveApiUrl('/api/auth/session'), {
                credentials: resolveFetchCredentials(),
                cache: 'no-store'
            });
            if (!response.ok) return null;
            return response.json();
        } catch (_error) {
            return null;
        }
    }

    function resolveActiveCommanderUsernameForTerms() {
        if (typeof global.getActiveCommanderUsername === 'function') {
            const active = String(global.getActiveCommanderUsername() || '').trim();
            if (active && active.toLowerCase() !== 'testaccount') return active;
        }
        const saved = global.localStorage.getItem('activeCommanderUser');
        return saved && saved.trim() ? saved.trim() : '';
    }

    async function submitDashboardTermsAcceptance() {
        const checkbox = global.document.getElementById('terms-dashboard-accepted');
        if (!checkbox?.checked) {
            setTermsAcceptanceFeedback('You must accept the Terms of Service and Privacy Policy to continue.');
            return;
        }

        const submitBtn = global.document.getElementById('terms-dashboard-confirm-btn');
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Saving…';
        }

        try {
            const username = resolveActiveCommanderUsernameForTerms();
            const response = await fetch(resolveApiUrl('/api/portal/account/accept-terms'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: resolveFetchCredentials(),
                body: JSON.stringify({
                    username,
                    termsAccepted: true,
                    agreeToTerms: true,
                    termsVersion: resolveTermsVersion()
                })
            });

            const payload = await response.json().catch(() => ({}));
            if (!response.ok) {
                if (typeof global.handleRiftApiFailure === 'function') {
                    await global.handleRiftApiFailure(response, payload, 'Terms acceptance failed');
                } else {
                    setTermsAcceptanceFeedback(payload.message || 'Could not save your acceptance. Please try again.');
                }
                return;
            }

            if (payload?.successToken) {
                try {
                    global.sessionStorage.setItem(TERMS_SUCCESS_TOKEN_KEY, String(payload.successToken));
                } catch (_storageError) {
                    /* ignore */
                }
            }

            if (typeof global.stashPendingAchievementUnlocks === 'function') {
                global.stashPendingAchievementUnlocks(payload.achievementUnlocks);
            }

            closeTermsDashboardGate();

            const continuation = pendingLoginContinuation;
            pendingLoginContinuation = null;
            if (typeof continuation === 'function') {
                continuation(payload);
            }

            if (typeof global.refreshMainPortalAuthChrome === 'function') {
                global.refreshMainPortalAuthChrome();
            }
        } catch (error) {
            console.error('[RIFT] Terms acceptance failed:', error);
            setTermsAcceptanceFeedback('Cannot reach the Royal Armies server. Please try again.');
        } finally {
            if (submitBtn) {
                syncDashboardTermsConfirmState();
                submitBtn.textContent = 'Confirm & Play';
            }
        }
    }

    function promptReturningUserTermsAcceptance(continuation) {
        pendingLoginContinuation = typeof continuation === 'function' ? continuation : null;
        openTermsDashboardGate();
    }

    async function blockJoinAgeUntilTermsAccepted() {
        if (typeof global.isPortalUserAuthenticated === 'function' && !global.isPortalUserAuthenticated()) {
            return true;
        }

        if (isTermsGateBlocking()) {
            return false;
        }

        const session = await fetchSessionTermsStatus();
        if (session?.requiresTermsAcceptance) {
            promptReturningUserTermsAcceptance(() => {
                if (typeof global.applyPortalDeploymentDeckPresentation === 'function') {
                    global.applyPortalDeploymentDeckPresentation();
                }
            });
            return false;
        }

        return true;
    }

    async function gateAuthenticatedSessionTermsCompliance() {
        const onMainHub = typeof global.isMainPortalHub === 'function' && global.isMainPortalHub();
        if (!onMainHub) return;
        if (typeof global.isPortalUserAuthenticated !== 'function' || !global.isPortalUserAuthenticated()) return;
        if (isTermsGateBlocking()) return;

        const session = await fetchSessionTermsStatus();
        if (!session?.authenticated || !session?.requiresTermsAcceptance) return;

        if (typeof global.prepareMainPortalPostLoginTermsGate === 'function') {
            global.prepareMainPortalPostLoginTermsGate();
        }

        promptReturningUserTermsAcceptance(() => {
            if (typeof global.refreshMainPortalAuthChrome === 'function') {
                global.refreshMainPortalAuthChrome();
            }
        });
    }

    async function hydrateLegalTermsVersion() {
        try {
            const response = await fetch(resolveApiUrl('/api/portal/legal/terms-version'), { cache: 'no-store' });
            if (!response.ok) return;
            const payload = await response.json();
            if (payload?.termsVersion) {
                global.RoyalArmiesLegalTermsVersion = payload.termsVersion;
            }
        } catch (_error) {
            /* keep default */
        }
    }

    function bootTermsAcceptance() {
        bindRegistrationTermsControls();
        bindDashboardTermsGateControls();
        hydrateLegalTermsVersion();
        gateAuthenticatedSessionTermsCompliance();
    }

    global.RoyalArmiesTermsAcceptance = {
        bindRegistrationTermsControls,
        syncRegistrationTermsSubmitState,
        registrationTermsAccepted,
        promptReturningUserTermsAcceptance,
        openTermsDashboardGate,
        closeTermsDashboardGate,
        isTermsGateBlocking,
        blockJoinAgeUntilTermsAccepted,
        TERMS_PAGE_PATH
    };

    global.bindRegistrationTermsControls = bindRegistrationTermsControls;
    global.registrationTermsAccepted = registrationTermsAccepted;
    global.promptReturningUserTermsAcceptance = promptReturningUserTermsAcceptance;
    global.blockJoinAgeUntilTermsAccepted = blockJoinAgeUntilTermsAccepted;
    global.isTermsGateBlocking = isTermsGateBlocking;

    if (global.document.readyState === 'loading') {
        global.document.addEventListener('DOMContentLoaded', bootTermsAcceptance);
    } else {
        bootTermsAcceptance();
    }
})(window);
